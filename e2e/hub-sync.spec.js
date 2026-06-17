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
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: (msg) => sentToA.push(msg) });
      hub.connections.set('visitor-b', { peer: 'visitor-b', open: true, send: (msg) => sentToB.push(msg) });
      hub.on('arena-input', (payload) => emitted.push(payload));

      hub._handleHubMessage({
        type: MSG.ARENA_INPUT,
        payload: { from: 'spoofed-client-id', x: 42, y: 84, angle: 1.25 },
        timestamp: 1,
      }, { peer: 'visitor-a' });

      return { emitted, sentToA, sentToB };
    });

    expect(result.emitted).toEqual([{ from: 'visitor-a', x: 42, y: 84, angle: 1.25 }]);
    expect(result.sentToA).toEqual([]);
    expect(result.sentToB.filter((msg) => msg.type === 'arena-input')).toEqual([]);
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
      hub.connections.set('visitor-a', { peer: 'visitor-a', open: true, send: (msg) => sent.push(msg) });

      hub.broadcastArenaState({ gameId: 'arena-1', players: { hub: { x: 1 } } });
      hub.broadcastArenaState({ gameId: 'arena-1', players: { hub: { x: 2 } } });

      const visitor = new LobbyNetwork();
      const acceptedStates = [];
      visitor.isHub = false;
      visitor.myId = 'visitor-a';
      visitor.myUser = { id: 'visitor-a', username: 'A', color: '#0ff', isHub: false, number: 1 };
      visitor.on('arena-state', (payload) => acceptedStates.push(payload.players.hub.x));

      visitor._handleIncomingMessage(sent[1], { peer: 'hub' }, 'hub');
      visitor._handleIncomingMessage(sent[0], { peer: 'hub' }, 'hub');

      return {
        hubSync: sent.map((msg) => msg.payload.hubSync),
        acceptedStates,
      };
    });

    expect(result.hubSync).toEqual([
      { hubId: 'hub', seq: 1 },
      { hubId: 'hub', seq: 2 },
    ]);
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

      hub._handleHubMessage({
        type: MSG.PONG_STATE,
        payload: {
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
    expect(result.sentToB[0].payload.hubSync).toEqual({ hubId: 'hub', seq: 1 });
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

      const follower = new PongGame(fakeNetwork, false, 'visitor-a');
      follower.render();
      const hasStateHandler = handlers.has('pong-state');
      if (hasStateHandler) {
        handlers.get('pong-state')({
          from: 'visitor-a',
          to: 'visitor-b',
          state: {
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
});
