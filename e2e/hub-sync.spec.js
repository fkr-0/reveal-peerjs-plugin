import { test, expect } from '@playwright/test';

async function loadHarness(page) {
  await page.goto('/e2e/fixtures/hub-sync-harness.html');
  await page.waitForFunction(() => Boolean(window.__rpjsHubSync));
}

test.describe('Hub-based game synchronization', () => {
  test('hub consumes arena input without rebroadcasting visitor commands', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const sentToA = [];
      const sentToB = [];
      const emitted = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = { id: 'hub', username: 'Hub', color: '#fff', isHub: true, number: 0 };
      hub._activeArenaId = 'arena-1';
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: (msg) => sentToA.push(msg) });
      hub.connections.set('visitor-b', { peer: 'visitor-b', open: true, send: (msg) => sentToB.push(msg) });
      hub.on('arena-input', (payload) => emitted.push(payload));

      hub._handleHubMessage({
        type: MSG.ARENA_INPUT,
        payload: { gameId: 'arena-1', from: 'spoofed-client-id', x: 42, y: 84, angle: 1.25 },
        timestamp: 1,
      }, { peer: 'visitor-a' });

      return { emitted, sentToA, sentToB };
    });

    expect(result.emitted).toEqual([{ gameId: 'arena-1', from: 'visitor-a', x: 42, y: 84, angle: 1.25 }]);
    expect(result.sentToA).toEqual([]);
    expect(result.sentToB.filter((msg) => msg.type === 'arena-input')).toEqual([]);
  });

  test('pong player labels render usernames as text instead of HTML', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { PongGame } = window.__rpjsHubSync;
      const game = Object.create(PongGame.prototype);
      game.network = {
        myId: 'visitor-a',
        myUser: { username: '<img src=x onerror=alert(1)>', color: '#0ff' },
        getUserList: () => [{
          id: 'visitor-b', username: '<b>Opponent</b>', color: '#f80',
        }],
      };
      game.opponentPeerId = 'visitor-b';
      game.isInitiator = true;
      game.el = document.createElement('div');
      game.el.innerHTML = '<div id="rpjs-pong-players"></div>';

      game._updatePlayerNames();
      const labels = game.el.querySelector('#rpjs-pong-players');
      return {
        text: labels.textContent,
        imageCount: labels.querySelectorAll('img').length,
        boldCount: labels.querySelectorAll('b').length,
      };
    });

    expect(result.imageCount).toBe(0);
    expect(result.boldCount).toBe(0);
    expect(result.text).toContain('<img src=x onerror=alert(1)>');
    expect(result.text).toContain('<b>Opponent</b>');
  });

  test('hub stamps arena state with monotonic sync metadata and visitors ignore stale states', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const sent = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = { id: 'hub', username: 'Hub', color: '#fff', isHub: true, number: 0 };
      hub._activeArenaId = 'arena-1';
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: (msg) => sent.push(msg) });

      hub.broadcastArenaState({ gameId: 'arena-1', players: { hub: { x: 1 } } });
      hub.broadcastArenaState({ gameId: 'arena-1', players: { hub: { x: 2 } } });

      const visitor = new LobbyNetwork();
      const acceptedStates = [];
      visitor.isHub = false;
      visitor.lobbyId = 'hub';
      visitor.myId = 'visitor-a';
      visitor.myUser = { id: 'visitor-a', username: 'A', color: '#0ff', isHub: false, number: 1 };
      visitor._activeArenaId = 'arena-1';
      visitor.on('arena-state', (payload) => acceptedStates.push(payload.players.hub.x));

      visitor._handleIncomingMessage(sent[1], { peer: 'hub' }, 'hub');
      visitor._handleIncomingMessage(sent[0], { peer: 'hub' }, 'hub');

      return {
        hubSync: sent.map((msg) => msg.payload.hubSync),
        acceptedStates,
      };
    });

    expect(result.hubSync[0]).toMatchObject({ hubId: 'hub', seq: 1 });
    expect(result.hubSync[1]).toMatchObject({ hubId: 'hub', seq: 2 });
    expect(result.hubSync[0].epoch).toBeTruthy();
    expect(result.hubSync[1].epoch).toBe(result.hubSync[0].epoch);
    expect(result.acceptedStates).toEqual([2]);
  });

  test('hub forwards pong state only to the target peer with sync metadata', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const sentToA = [];
      const sentToB = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = { id: 'hub', username: 'Hub', color: '#fff', isHub: true, number: 0 };
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: (msg) => sentToA.push(msg) });
      hub.connections.set('visitor-b', { peer: 'visitor-b', open: true, send: (msg) => sentToB.push(msg) });
      hub._pongSessions.set('pong-1', {
        gameId: 'pong-1', initiatorId: 'visitor-a', opponentId: 'visitor-b', status: 'active',
      });

      hub._handleHubMessage({
        type: MSG.PONG_STATE,
        payload: {
          gameId: 'pong-1',
          from: 'visitor-a',
          to: 'visitor-b',
          state: { ball: { x: 11, y: 22, vx: 3, vy: 4 }, scoreLeft: 1, scoreRight: 0 },
        },
        timestamp: 1,
      }, { peer: 'visitor-a' });

      return { sentToA, sentToB };
    });

    expect(result.sentToA).toEqual([]);
    expect(result.sentToB).toHaveLength(1);
    expect(result.sentToB[0].type).toBe('pong-state');
    expect(result.sentToB[0].payload.from).toBe('visitor-a');
    expect(result.sentToB[0].payload.to).toBe('visitor-b');
    expect(result.sentToB[0].payload.gameId).toBe('pong-1');
    expect(result.sentToB[0].payload.hubSync).toMatchObject({ hubId: 'hub', seq: 1 });
    expect(result.sentToB[0].payload.hubSync.epoch).toBeTruthy();
  });

  test('pong authority uses swept paddle collision so fast balls cannot tunnel through paddles', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { PongGame } = window.__rpjsHubSync;
      const fakeNetwork = {
        myId: 'visitor-a',
        myUser: { id: 'visitor-a', username: 'Visitor A', color: '#f80' },
        getUserList: () => [{ id: 'visitor-b', username: 'Visitor B', color: '#0ff' }],
        on: () => {},
        off: () => {},
        sendPongMove: () => {},
        sendPongState: () => {},
      };
      const game = new PongGame(fakeNetwork, true, 'visitor-b', { gameId: 'pong-1' });
      game.render();
      game.W = 400;
      game.H = 240;
      game.leftY = 120;
      game.rightY = 120;
      game.ball = { x: 340, y: 120, vx: 60, vy: 0 };
      game.currentSpeed = 60;
      game.hitCount = 100;
      game._update();
      const snapshot = { vx: game.ball.vx, x: game.ball.x, scoreLeft: game.scoreLeft };
      game.stop();
      return snapshot;
    });

    expect(result.scoreLeft).toBe(0);
    expect(result.vx).toBeLessThan(0);
    expect(result.x).toBeLessThanOrEqual(400 - 20 - 12 - 8);
  });

  test('pong follower applies authoritative state instead of advancing its own ball simulation', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { PongGame } = window.__rpjsHubSync;
      const handlers = new Map();
      const fakeNetwork = {
        myId: 'visitor-b',
        myUser: { id: 'visitor-b', username: 'Visitor B', color: '#0ff' },
        getUserList: () => [
          { id: 'visitor-a', username: 'Visitor A', color: '#f80' },
          { id: 'visitor-b', username: 'Visitor B', color: '#0ff' },
        ],
        on: (event, callback) => handlers.set(event, callback),
        off: () => {},
        sendPongMove: () => {},
        sendPongState: () => {},
      };

      const follower = new PongGame(fakeNetwork, false, 'visitor-a', { gameId: 'pong-1' });
      follower.render();
      const hasStateHandler = handlers.has('pong-state');
      if (hasStateHandler) {
        handlers.get('pong-state')({
          gameId: 'pong-1',
          from: 'visitor-a',
          to: 'visitor-b',
          state: {
            frame: 1,
            ball: { x: 111, y: 222, vx: 5, vy: -2 },
            leftY: 123,
            rightY: 321,
            scoreLeft: 3,
            scoreRight: 4,
            currentSpeed: 8,
            hitCount: 12,
          },
        });
      }
      const xBeforeUpdate = follower.ball.x;
      follower._update();
      const snapshot = {
        hasStateHandler,
        ball: follower.ball,
        leftY: follower.leftY,
        rightY: follower.rightY,
        scoreLeft: follower.scoreLeft,
        scoreRight: follower.scoreRight,
        xBeforeUpdate,
        xAfterUpdate: follower.ball.x,
      };
      follower.stop();
      return snapshot;
    });

    expect(result.hasStateHandler).toBe(true);
    expect(result.ball).toMatchObject({ x: 111, y: 222, vx: 5, vy: -2 });
    expect(result.leftY).toBe(123);
    expect(result.rightY).toBe(321);
    expect(result.scoreLeft).toBe(3);
    expect(result.scoreRight).toBe(4);
    expect(result.xAfterUpdate).toBe(result.xBeforeUpdate);
  });

  test('hub binds chat, profile, and poll identities to the sending connection', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const chats = [];
      const answers = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = { id: 'hub', username: 'Hub', color: '#fff', isHub: true, number: 0 };
      hub.users.set('hub', { ...hub.myUser, conn: null });
      hub.users.set('visitor-a', {
        id: 'visitor-a', username: 'Alice', color: '#0ff', isHub: false, number: 1,
      });
      hub.users.set('visitor-b', {
        id: 'visitor-b', username: 'Bob', color: '#f80', isHub: false, number: 2,
      });
      hub._activePollId = 'poll-1';
      hub.on('chat', value => chats.push(value));
      hub.on('poll-answer', value => answers.push(value));

      const conn = { peer: 'visitor-a' };
      hub._handleHubMessage({
        type: MSG.CHAT,
        payload: { from: 'visitor-b', username: 'Bob', color: '#bad', text: 'hello' },
        timestamp: 1,
      }, conn);
      hub._handleHubMessage({
        type: MSG.POLL_ANSWER,
        payload: { pollId: 'poll-1', from: 'visitor-b', username: 'Bob', answer: 'A' },
      }, conn);
      hub._handleHubMessage({
        type: MSG.USERNAME_UPDATE,
        payload: { id: 'visitor-b', username: 'Alice 2', color: '#123456', arenaCharacter: 'forged-class' },
      }, conn);

      return {
        chat: chats[0],
        answer: answers[0],
        alice: hub.users.get('visitor-a'),
        bob: hub.users.get('visitor-b'),
      };
    });

    expect(result.chat).toMatchObject({ from: 'visitor-a', username: 'Alice', color: '#0ff', text: 'hello' });
    expect(result.answer).toMatchObject({ from: 'visitor-a', username: 'Alice', pollId: 'poll-1', answer: 'A' });
    expect(result.alice).toMatchObject({ username: 'Alice 2', color: '#123456', arenaCharacter: 'vanguard' });
    expect(result.bob).toMatchObject({ username: 'Bob', color: '#f80' });
  });

  test('hub routes a complete pong session and rejects state from the non-authority player', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const sentToA = [];
      const sentToB = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = { id: 'hub', username: 'Hub', color: '#fff', isHub: true, number: 0 };
      hub.users.set('hub', { ...hub.myUser, conn: null });
      hub.users.set('visitor-a', { id: 'visitor-a', username: 'Alice', color: '#0ff', isHub: false, number: 1 });
      hub.users.set('visitor-b', { id: 'visitor-b', username: 'Bob', color: '#f80', isHub: false, number: 2 });
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: msg => sentToA.push(msg) });
      hub.connections.set('visitor-b', { peer: 'visitor-b', open: true, send: msg => sentToB.push(msg) });

      hub._handleHubMessage({
        type: MSG.PONG_INVITE,
        payload: { gameId: 'pong-1', from: 'spoofed', to: 'visitor-b', fromUsername: 'Mallory' },
      }, { peer: 'visitor-a' });
      hub._handleHubMessage({
        type: MSG.PONG_ACCEPT,
        payload: { gameId: 'pong-1', from: 'spoofed', to: 'visitor-a' },
      }, { peer: 'visitor-b' });
      hub._handleHubMessage({
        type: MSG.PONG_STATE,
        payload: { gameId: 'pong-1', to: 'visitor-a', state: { frame: 9 } },
      }, { peer: 'visitor-b' });
      hub._handleHubMessage({
        type: MSG.PONG_STATE,
        payload: { gameId: 'pong-1', to: 'visitor-b', state: { frame: 10 } },
      }, { peer: 'visitor-a' });
      hub._handleHubMessage({
        type: MSG.PONG_END,
        payload: { gameId: 'pong-1', to: 'visitor-a', result: { reason: 'player-left' } },
      }, { peer: 'visitor-b' });

      return {
        sentToA,
        sentToB,
        session: hub._pongSessions.get('pong-1'),
      };
    });

    expect(result.sentToB[0]).toMatchObject({
      type: 'pong-invite',
      payload: { gameId: 'pong-1', from: 'visitor-a', fromUsername: 'Alice', to: 'visitor-b' },
    });
    expect(result.sentToA).toHaveLength(2);
    expect(result.sentToA[0]).toMatchObject({ type: 'pong-accept', payload: { from: 'visitor-b', to: 'visitor-a' } });
    expect(result.sentToA[1]).toMatchObject({ type: 'pong-end', payload: { from: 'visitor-b', to: 'visitor-a' } });
    expect(result.sentToB).toHaveLength(2);
    expect(result.sentToB[1]).toMatchObject({ type: 'pong-state', payload: { from: 'visitor-a', state: { frame: 10 } } });
    expect(result.session).toBeUndefined();
  });

  test('hub binds arena leave commands to the sending connection and current session', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(() => {
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      const hub = new LobbyNetwork();
      const leaves = [];
      hub.isHub = true;
      hub.myId = 'hub';
      hub._activeArenaId = 'arena-1';
      hub.on('arena-leave', payload => leaves.push(payload));

      hub._handleHubMessage({
        type: MSG.ARENA_LEAVE,
        payload: { gameId: 'arena-old', peerId: 'visitor-b' },
      }, { peer: 'visitor-a' });
      hub._handleHubMessage({
        type: MSG.ARENA_LEAVE,
        payload: { gameId: 'arena-1', peerId: 'visitor-b' },
      }, { peer: 'visitor-a' });

      return leaves;
    });

    expect(result).toEqual([{ gameId: 'arena-1', peerId: 'visitor-a' }]);
  });
});
