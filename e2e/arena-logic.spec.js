import { test, expect } from '@playwright/test';
import { generatePlayableMap } from '../src/arena-map.js';
import {
  applyBulletCollisions,
  applyItemPickup,
  bulletTail,
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
});
