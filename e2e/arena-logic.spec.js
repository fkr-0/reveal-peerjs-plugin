import { test, expect } from '@playwright/test';
import { generatePlayableMap } from '../src/arena-map.js';
import { ArenaGame, collectArenaUsers, createArenaPlayer } from '../src/arena-game.js';
import {
  applyDamage,
  applyBulletCollisions,
  applyItemPickup,
  bulletTail,
  spawnItem,
  updateBullets,
  updatePlayerEffects,
} from '../src/arena-sim.js';
import { createSeededRandom } from '../src/arena-rng.js';
import {
  createArenaPlayerSnapshot,
  reconcileArenaPlayer,
} from '../src/arena-state.js';
import {
  BASE_HP,
  BULLET_LENGTH,
  CHARACTER_TYPES,
  PLAYER_RADIUS,
  chooseWeightedItemType,
} from '../src/arena-rules.js';

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0.001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

test.describe('arena simulation primitives', () => {
  test('playable map generation is deterministic and keeps spawn points clear of walls', () => {
    const first = generatePlayableMap(1280, 720, 4242, 4);
    const second = generatePlayableMap(1280, 720, 4242, 4);

    expect(first).toEqual(second);
    expect(first.spawns).toHaveLength(4);
    expect(first.walls.length).toBeGreaterThan(0);

    for (const spawn of first.spawns) {
      for (const wall of first.walls) {
        expect(pointToSegmentDistance(spawn.x, spawn.y, wall.x1, wall.y1, wall.x2, wall.y2)).toBeGreaterThan(PLAYER_RADIUS + 24);
      }
    }
  });

  test('Arena stop callback fires once per round even when cleanup is repeated', () => {
    let stops = 0;
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      running: false,
      isHub: false,
      gameId: null,
      _leaveSent: true,
      network: {},
      animFrame: null,
      _stateBroadcastInterval: null,
      _inputSendInterval: null,
      _shootTouchInterval: null,
      _unbindEvents: () => {},
      _unbindEndCloseHandler: () => {},
      el: null,
      players: new Map(),
      bullets: [],
      items: [],
      zombies: [],
      _hitFlashes: [],
      _sparks: [],
      _events: [],
      _stopNotified: false,
      _onStopCb: () => { stops++; },
    });

    game.stop();
    game.stop();

    expect(stops).toBe(1);
  });

  test('Arena user collection neither duplicates self nor omits a visitor self record', () => {
    const hubUser = { id: 'hub', username: 'Hub', isHub: true, number: 0, arenaCharacter: 'vanguard' };
    const visitorUser = { id: 'visitor', username: 'Visitor', isHub: false, number: 1, arenaCharacter: 'scout' };

    expect(collectArenaUsers({
      myUser: hubUser,
      getUserList: () => [hubUser, visitorUser, { ...visitorUser }],
    }).map(user => user.id)).toEqual(['hub', 'visitor']);

    expect(collectArenaUsers({
      myUser: visitorUser,
      getUserList: () => [hubUser],
    }).map(user => user.id)).toEqual(['hub', 'visitor']);
  });

  test('end-screen cleanup removes both close listeners after either path fires', () => {
    const removed = [];
    const originalDocument = globalThis.document;
    globalThis.document = {
      removeEventListener: (event, handler) => removed.push(['document', event, handler]),
    };
    const handler = () => {};
    const game = Object.create(ArenaGame.prototype);
    game._endCloseHandler = handler;
    game.el = {
      removeEventListener: (event, received) => removed.push(['element', event, received]),
    };

    try {
      game._unbindEndCloseHandler();
    } finally {
      globalThis.document = originalDocument;
    }

    expect(removed).toEqual([
      ['element', 'click', handler],
      ['document', 'keydown', handler],
    ]);
    expect(game._endCloseHandler).toBeNull();
  });

  test('seeded Arena randomness reproduces item positions and identifiers', () => {
    const makeState = () => {
      const random = createSeededRandom(4242);
      let sequence = 0;
      return {
        items: [], players: new Map(), walls: [], W: 800, H: 500,
        random,
        createId: prefix => `${prefix}-${++sequence}`,
      };
    };
    const first = makeState();
    const second = makeState();

    expect(spawnItem(first, () => false)).toEqual(spawnItem(second, () => false));
    expect(first.items).toEqual(second.items);
  });

  test('central damage handling tracks armor, damage taken, and one death', () => {
    const player = { hp: 20, armor: 10, eliminated: false, deaths: 0, damageTaken: 0 };

    const first = applyDamage(player, 20);
    const second = applyDamage(player, 20);

    expect(first).toMatchObject({ armorDamage: 10, hpDamage: 10, totalDamage: 20, newlyEliminated: false });
    expect(second).toMatchObject({ armorDamage: 0, hpDamage: 10, totalDamage: 10, newlyEliminated: true });
    expect(player).toMatchObject({ hp: 0, armor: 0, eliminated: true, deaths: 1, damageTaken: 30 });
  });

  test('Arena player snapshots preserve authoritative stats and tolerate partial state', () => {
    const player = createArenaPlayer({
      username: 'Mika', color: '#0ff', arenaCharacter: 'scout',
    }, { x: 12.34, y: 56.78 });
    Object.assign(player, { kills: 2, damageDealt: 91.5, pickups: 3 });

    const snapshot = createArenaPlayerSnapshot(player);
    const reconciled = reconcileArenaPlayer(null, snapshot);

    expect(snapshot).toMatchObject({ x: 12.3, y: 56.8, kills: 2, damageDealt: 91.5, pickups: 3 });
    expect(reconciled).toMatchObject({ character: 'scout', kills: 2, damageDealt: 91.5, pickups: 3 });
    expect(reconcileArenaPlayer(reconciled, { hp: 42 })).toMatchObject({ hp: 42, kills: 2, character: 'scout' });
  });

  test('bullet collisions apply armor mitigation before hp damage and emit one hit', () => {
    const players = new Map([
      ['attacker', { x: 0, y: 0, hp: BASE_HP, armor: 0, eliminated: false }],
      ['target', { x: 10, y: 0, hp: BASE_HP, armor: 30, eliminated: false, color: '#fff' }],
    ]);
    const bullets = [{ x: 10, y: 0, from: 'attacker', damage: 50, color: '#f80' }];
    const hits = [];
    const sparks = [];
    const hitFlashes = [];

    applyBulletCollisions({ bullets, players, sparks, hitFlashes }, hit => hits.push(hit));

    expect(bullets).toHaveLength(0);
    expect(hits).toEqual([{
      targetId: 'target', sourceId: 'attacker', hp: 80, armor: 0,
      eliminated: false, newlyEliminated: false, damage: 50,
      x: 10, y: 0, color: '#fff',
    }]);
    expect(players.get('target')).toMatchObject({ hp: 80, armor: 0, eliminated: false });
    expect(players.get('attacker')).toMatchObject({ damageDealt: 50, kills: 0 });
    expect(sparks).toHaveLength(1);
    expect(hitFlashes).toHaveLength(1);
  });

  test('item pickups clamp healing and armor and apply temporary weapon buffs', () => {
    const player = { username: 'Mara', hp: 90, armor: 85, weapon: 'blaster', weaponUntil: 0 };

    expect(applyItemPickup(player, { type: 'heal' })).toBe('Mara picked HEAL');
    expect(player.hp).toBe(BASE_HP);

    expect(applyItemPickup(player, { type: 'armor' })).toBe('Mara picked ARMOR');
    expect(player.armor).toBe(100);

    expect(applyItemPickup(player, { type: 'sniper' })).toBe('Mara picked SNIPER');
    expect(player.weapon).toBe('sniper');
    expect(player.weaponUntil).toBeGreaterThan(Date.now());
  });

  test('character presets create distinct authoritative player configurations', () => {
    const scout = createArenaPlayer({
      username: 'Scout', color: '#0ff', arenaCharacter: 'scout',
    }, { x: 10, y: 20 });
    const guardian = createArenaPlayer({
      username: 'Guardian', color: '#f80', arenaCharacter: 'guardian',
    }, { x: 30, y: 40 });
    const fallback = createArenaPlayer({
      username: 'Fallback', color: '#fff', arenaCharacter: 'forged-class',
    }, { x: 50, y: 60 });
    const prototypeKey = createArenaPlayer({
      username: 'Prototype', color: '#fff', arenaCharacter: 'toString',
    }, { x: 70, y: 80 });

    expect(scout).toMatchObject({
      character: 'scout', hp: 80, maxHp: 80, maxArmor: 70, weapon: 'rapid',
    });
    expect(scout.radius).toBeLessThan(PLAYER_RADIUS);
    expect(guardian).toMatchObject({
      character: 'guardian', hp: 135, maxHp: 135, armor: 40, maxArmor: 150,
    });
    expect(guardian.radius).toBeGreaterThan(PLAYER_RADIUS);
    expect(fallback.character).toBe('vanguard');
    expect(prototypeKey.character).toBe('vanguard');
  });

  test('timed items apply character-scaled effects and regeneration', () => {
    const engineer = createArenaPlayer({
      username: 'Engineer', color: '#fff', arenaCharacter: 'engineer',
    }, { x: 0, y: 0 });
    engineer.hp = 50;
    const before = Date.now();

    expect(applyItemPickup(engineer, { type: 'haste' })).toBe('Engineer picked HASTE');
    expect(engineer.hasteUntil).toBeGreaterThan(before + 13000);

    expect(applyItemPickup(engineer, { type: 'regen' })).toBe('Engineer picked REGEN');
    updatePlayerEffects(engineer, engineer.lastRegenAt + 1500);
    expect(engineer.hp).toBe(59);
  });

  test('weighted item selection is deterministic at distribution boundaries', () => {
    expect(chooseWeightedItemType(() => 0)).toBe('heal');
    expect(chooseWeightedItemType(() => 0.999999)).toBe('sniper');
    expect(Object.keys(CHARACTER_TYPES)).toEqual(['vanguard', 'scout', 'guardian', 'ranger', 'engineer']);
  });

  test('bulletTail uses per-bullet speed so non-default weapons render correct trails', () => {
    expect(bulletTail({ x: 100, y: 50, vx: 14, vy: 0, speed: 14 })).toEqual({
      tailX: 100 - BULLET_LENGTH,
      tailY: 50,
    });
  });

  test('hub clamps remote arena input so visitors cannot teleport across the map', () => {
    const game = Object.create(ArenaGame.prototype);
    const player = {
      x: 100, y: 100, angle: 0, color: '#0ff', hp: BASE_HP, armor: 0,
      weapon: 'blaster', weaponUntil: 0, lastShootTime: 0, eliminated: false,
    };
    Object.assign(game, {
      network: { myId: 'hub' },
      isHub: true,
      W: 1000,
      H: 500,
      walls: [],
      players: new Map([['visitor-a', player]]),
    });

    game._handleRemoteInput({ from: 'visitor-a', x: 900, y: 100, angle: 1.25 });

    expect(player.x).toBeLessThanOrEqual(112);
    expect(player.y).toBe(100);
    expect(player.angle).toBe(1.25);
  });

  test('hub derives remote arena shots from authoritative player state and weapon stats', () => {
    const game = Object.create(ArenaGame.prototype);
    const player = {
      x: 120, y: 80, angle: 0, color: '#0ff', hp: BASE_HP, armor: 0,
      weapon: 'rapid', weaponUntil: Date.now() + 1000, lastShootTime: 0, eliminated: false,
    };
    Object.assign(game, {
      network: { myId: 'hub' },
      isHub: true,
      players: new Map([['visitor-a', player]]),
      bullets: [],
    });

    game._handleRemoteShoot({
      from: 'visitor-a',
      x: 999,
      y: 999,
      angle: 0,
      color: '#bad',
      count: 20,
      spread: 1,
      damage: 999,
      bulletSpeed: 99,
      life: 999,
      weapon: 'sniper',
    });

    expect(game.bullets).toHaveLength(1);
    expect(game.bullets[0]).toMatchObject({
      x: 138,
      y: 80,
      from: 'visitor-a',
      color: '#0ff',
      damage: 18,
      speed: 9.5,
      weapon: 'rapid',
    });
  });

  test('hub shooting creates exactly one local bullet burst instead of echoing its own network event', () => {
    const listeners = new Map();
    const fakeNetwork = {
      myId: 'hub',
      on: (event, callback) => listeners.set(event, callback),
      sendArenaShoot: (shoot) => listeners.get('arena-shoot')?.({ ...shoot, from: 'hub' }),
    };
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      network: fakeNetwork,
      isHub: true,
      players: new Map([['hub', {
        x: 100, y: 100, angle: 0, color: '#fff', hp: BASE_HP, armor: 0,
        weapon: 'rapid', weaponUntil: 0, lastShootTime: -1000, eliminated: false,
      }]]),
      bullets: [],
      mouseX: 180,
      mouseY: 100,
    });
    listeners.set('arena-shoot', (shoot) => game._handleRemoteShoot(shoot));

    game._shoot();

    expect(game.bullets).toHaveLength(1);
  });

  test('bullet collisions use the swept movement segment so fast bullets cannot tunnel through players', () => {
    const players = new Map([
      ['attacker', { x: 0, y: 0, hp: BASE_HP, armor: 0, eliminated: false }],
      ['target', { x: 50, y: 0, hp: BASE_HP, armor: 0, eliminated: false, color: '#fff' }],
    ]);
    const bullets = [{ x: 0, y: 0, vx: 100, vy: 0, from: 'attacker', damage: 25, color: '#f80', life: 10 }];
    const hits = [];
    const sparks = [];
    const hitFlashes = [];

    updateBullets({ bullets, W: 200, H: 100, walls: [], sparks }, () => false);
    applyBulletCollisions({ bullets, players, sparks, hitFlashes }, hit => hits.push(hit));

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ targetId: 'target', hp: BASE_HP - 25, eliminated: false });
    expect(bullets).toHaveLength(0);
  });

  test('visitor reconciles its predicted player and removes peers absent from authoritative arena state', () => {
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      network: { myId: 'visitor-a' },
      isHub: false,
      gameId: 'arena-1',
      players: new Map([
        ['visitor-a', { x: 900, y: 400, angle: 2, hp: BASE_HP, armor: 0, weapon: 'blaster', eliminated: false }],
        ['departed', { x: 50, y: 50, angle: 0, hp: BASE_HP, armor: 0, weapon: 'blaster', eliminated: false }],
      ]),
      bullets: [{ x: 1, y: 1 }],
      items: [],
      zombies: [],
      _zombiesPerMin: 10,
      _zombieWave: 1,
      _zombiesDefeated: 0,
    });

    game._handleStateUpdate({
      gameId: 'arena-1',
      players: {
        'visitor-a': { x: 120, y: 80, angle: 0.5, hp: 75, armor: 10, weapon: 'rapid', eliminated: false },
      },
      bullets: [{ x: 10, y: 20, vx: 1, vy: 2 }],
      items: [],
      zombies: [],
    });

    expect(game.players.has('departed')).toBe(false);
    expect(game.players.get('visitor-a')).toMatchObject({
      x: 120, y: 80, angle: 0.5, hp: 75, armor: 10, weapon: 'rapid',
    });
    expect(game.bullets).toEqual([{ x: 10, y: 20, vx: 1, vy: 2 }]);
  });

  test('hub enforces weapon cooldown for remote arena shoot commands', () => {
    const game = Object.create(ArenaGame.prototype);
    const player = {
      x: 120, y: 80, angle: 0, color: '#0ff', hp: BASE_HP, armor: 0,
      weapon: 'rapid', weaponUntil: Date.now() + 1000, lastShootTime: 0, eliminated: false,
    };
    Object.assign(game, {
      network: { myId: 'hub' },
      isHub: true,
      gameId: 'arena-1',
      players: new Map([['visitor-a', player]]),
      bullets: [],
    });

    game._handleRemoteShoot({ gameId: 'arena-1', from: 'visitor-a', angle: 0 });
    game._handleRemoteShoot({ gameId: 'arena-1', from: 'visitor-a', angle: 0 });

    expect(game.bullets).toHaveLength(1);
  });

  test('closing a running hub arena publishes a terminal session event', () => {
    const ended = [];
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      running: true,
      isHub: true,
      gameId: 'arena-1',
      network: { broadcastArenaEnd: results => ended.push(results) },
      animFrame: null,
      _stateBroadcastInterval: null,
      _inputSendInterval: null,
      _shootTouchInterval: null,
      _unbindEvents: () => {},
      el: null,
      players: new Map(),
      bullets: [],
      items: [],
      zombies: [],
      _hitFlashes: [],
      _sparks: [],
      _onStopCb: null,
    });

    game.stop();

    expect(ended).toEqual([{
      gameId: 'arena-1', winner: null, cancelled: true, reason: 'hub-left',
    }]);
  });

  test('closing a running visitor arena sends one session-scoped leave command', () => {
    const left = [];
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      running: true,
      isHub: false,
      gameId: 'arena-1',
      _leaveSent: false,
      network: { sendArenaLeave: gameId => left.push(gameId) },
      animFrame: null,
      _stateBroadcastInterval: null,
      _inputSendInterval: null,
      _shootTouchInterval: null,
      _unbindEvents: () => {},
      el: null,
      players: new Map(),
      bullets: [],
      items: [],
      zombies: [],
      _hitFlashes: [],
      _sparks: [],
      _onStopCb: null,
    });

    game.stop();
    game.stop();

    expect(left).toEqual(['arena-1']);
  });

  test('zombie collision uses the swept bullet segment for high-speed projectiles', () => {
    const game = Object.create(ArenaGame.prototype);
    Object.assign(game, {
      bullets: [{ prevX: 0, prevY: 0, x: 100, y: 0, damage: 25 }],
      zombies: [{ id: 'z-1', x: 50, y: 0, r: 10, hp: 100, color: '#fff' }],
      _sparks: [],
      _zombiesDefeated: 0,
    });

    game._checkZombieBulletCollisions();

    expect(game.bullets).toHaveLength(0);
    expect(game.zombies[0].hp).toBe(75);
  });
});
