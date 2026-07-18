import { expect, test } from '@playwright/test';

async function createVisitorNetwork() {
  global.window = { location: { href: 'http://deck.test/slides#frag' } };
  const { LobbyNetwork } = await import('../src/networking.js');
  const { MSG } = await import('../src/protocol.js');
  const visitor = new LobbyNetwork();
  visitor.isHub = false;
  visitor.lobbyId = 'hub-peer';
  visitor.myId = 'visitor-a';
  visitor.myUser = { id: 'visitor-a', username: 'Visitor A', color: '#0ff', isHub: false, number: 1 };
  visitor._activeArenaId = 'arena-1';
  return { visitor, MSG };
}

test.describe('networking hub sync guards', () => {
  test('visitor rejects hub-synced arena state received from a non-hub direct peer', async () => {
    const { visitor, MSG } = await createVisitorNetwork();
    const acceptedStates = [];
    visitor.on('arena-state', (payload) => acceptedStates.push(payload));

    visitor._handleIncomingMessage({
      type: MSG.ARENA_STATE,
      payload: {
        hubSync: { hubId: 'hub-peer', epoch: 'epoch-a', seq: 5 },
        gameId: 'arena-1',
        players: { hub: { x: 999 } },
      },
    }, { peer: 'visitor-b' }, 'visitor-b');

    expect(acceptedStates).toEqual([]);
  });

  test('visitor accepts hub-synced arena state from the lobby hub and ignores stale repeats', async () => {
    const { visitor, MSG } = await createVisitorNetwork();
    const acceptedStates = [];
    visitor.on('arena-state', (payload) => acceptedStates.push(payload.players.hub.x));

    visitor._handleIncomingMessage({
      type: MSG.ARENA_STATE,
      payload: { gameId: 'arena-1', hubSync: { hubId: 'hub-peer', epoch: 'epoch-a', seq: 2 }, players: { hub: { x: 2 } } },
    }, { peer: 'hub-peer' }, 'hub-peer');
    visitor._handleIncomingMessage({
      type: MSG.ARENA_STATE,
      payload: { gameId: 'arena-1', hubSync: { hubId: 'hub-peer', epoch: 'epoch-a', seq: 1 }, players: { hub: { x: 1 } } },
    }, { peer: 'hub-peer' }, 'hub-peer');

    expect(acceptedStates).toEqual([2]);
  });

  test('visitor rejects unstamped authoritative state even when it arrives from the hub connection', async () => {
    const { visitor, MSG } = await createVisitorNetwork();
    const acceptedStates = [];
    visitor.on('arena-state', payload => acceptedStates.push(payload));

    visitor._handleIncomingMessage({
      type: MSG.ARENA_STATE,
      payload: { gameId: 'arena-1', players: { hub: { x: 99 } } },
    }, { peer: 'hub-peer' }, 'hub-peer');

    expect(acceptedStates).toEqual([]);
  });

  test('visitor accepts a new hub epoch with a reset sequence and permanently retires the old epoch', async () => {
    const { visitor, MSG } = await createVisitorNetwork();
    const acceptedStates = [];
    visitor.on('arena-state', payload => acceptedStates.push(payload.players.hub.x));

    const deliver = (epoch, seq, x) => visitor._handleIncomingMessage({
      type: MSG.ARENA_STATE,
      payload: {
        gameId: 'arena-1',
        hubSync: { hubId: 'hub-peer', epoch, seq },
        players: { hub: { x } },
      },
    }, { peer: 'hub-peer' }, 'hub-peer');

    deliver('epoch-a', 8, 8);
    deliver('epoch-b', 1, 10);
    deliver('epoch-a', 9, 9);

    expect(acceptedStates).toEqual([8, 10]);
  });
});
