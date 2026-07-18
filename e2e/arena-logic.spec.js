import { test, expect } from '@playwright/test';
import { generatePlayableMap } from '../src/arena-map.js';
import { ArenaGame } from '../src/arena-game.js';
import {
  applyBulletCollisions,
  applyItemPickup,
  bulletTail,
  updateBullets,
} from '../src/arena-sim.js';
import {
  BASE_HP,
  BULLET_LENGTH,
  PLAYER_RADIUS,
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
    expect(hits).toEqual([{ targetId: 'target', hp: 80, armor: 0, eliminated: false, x: 10, y: 0, color: '#fff' }]);
    expect(players.get('target')).toMatchObject({ hp: 80, armor: 0, eliminated: false });
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
