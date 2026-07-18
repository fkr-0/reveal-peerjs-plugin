import {
  PLAYER_RADIUS,
  BULLET_SPEED,
  BULLET_LENGTH,
  HIT_RADIUS,
  BASE_HP,
  MAX_ARMOR,
  MAX_ITEMS,
  ITEM_SPAWN_MS,
  ITEM_RADIUS,
  ITEM_PICKUP_RADIUS,
  WEAPON_BUFF_MS,
  ITEM_TYPES,
} from './arena-rules.js';

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function updateBullets(state, lineLineIntersect) {
  const { bullets, W, H, walls, sparks } = state;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20 || b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    let hitWall = false;
    for (const w of walls) {
      if (lineLineIntersect(b.x - b.vx, b.y - b.vy, b.x, b.y, w.x1, w.y1, w.x2, w.y2)) {
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      sparks.push({ x: b.x, y: b.y, life: 6, color: b.color });
      bullets.splice(i, 1);
    }
  }
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0.0001) return dist(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

export function bulletTargetDistance(bullet, target) {
  const fromX = Number.isFinite(bullet.prevX) ? bullet.prevX : bullet.x;
  const fromY = Number.isFinite(bullet.prevY) ? bullet.prevY : bullet.y;
  return pointSegmentDistance(target.x, target.y, fromX, fromY, bullet.x, bullet.y);
}

export function applyBulletCollisions(state, onHit) {
  const { bullets, players, hitFlashes, sparks } = state;
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (const [pid, player] of players) {
      if (pid === b.from || player.eliminated) continue;
      const d = bulletTargetDistance(b, player);
      if (d >= HIT_RADIUS) continue;

      const rawDamage = b.damage || 25;
      const armorAbsorb = Math.min(player.armor || 0, Math.ceil(rawDamage * 0.6));
      player.armor = Math.max(0, (player.armor || 0) - armorAbsorb);
      player.hp -= (rawDamage - armorAbsorb);
      if (player.hp <= 0) {
        player.hp = 0;
        player.eliminated = true;
      }

      const hitData = {
        targetId: pid,
        hp: player.hp,
        armor: player.armor,
        eliminated: player.eliminated,
        x: player.x,
        y: player.y,
        color: player.color,
      };

      onHit(hitData);
      hitFlashes.push({ x: player.x, y: player.y, time: 15, color: '#fff' });
      sparks.push({ x: b.x, y: b.y, life: 8, color: b.color });
      bullets.splice(bi, 1);
      break;
    }
  }
}

export function spawnItem(state, lineCircleIntersect) {
  if (state.items.length >= MAX_ITEMS) return;
  const keys = Object.keys(ITEM_TYPES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const margin = 80;
  for (let i = 0; i < 10; i++) {
    const x = margin + Math.random() * (state.W - margin * 2);
    const y = margin + Math.random() * (state.H - margin * 2);
    const onPlayer = Array.from(state.players.values()).some(p => !p.eliminated && dist(x, y, p.x, p.y) < 100);
    if (onPlayer) continue;
    const blocked = state.walls.some(w => lineCircleIntersect(w.x1, w.y1, w.x2, w.y2, x, y, ITEM_RADIUS + 4));
    if (blocked) continue;
    state.items.push({ id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: key, x, y, ttl: 800 });
    return;
  }
}

export function applyItemPickup(player, item) {
  const t = ITEM_TYPES[item.type];
  if (!t) return null;
  if (t.kind === 'heal') {
    player.hp = clamp((player.hp || 0) + t.value, 0, BASE_HP);
    return `${player.username} picked HEAL`;
  }
  if (t.kind === 'armor') {
    player.armor = clamp((player.armor || 0) + t.value, 0, MAX_ARMOR);
    return `${player.username} picked ARMOR`;
  }
  if (t.kind === 'weapon') {
    player.weapon = t.weapon;
    player.weaponUntil = Date.now() + WEAPON_BUFF_MS;
    return `${player.username} picked ${t.label}`;
  }
  return null;
}

export function updateItems(state, lineCircleIntersect, setStatus) {
  const now = Date.now();
  if (now >= state.itemSpawnAt) {
    spawnItem(state, lineCircleIntersect);
    state.itemSpawnAt = now + ITEM_SPAWN_MS;
  }
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    item.ttl--;
    if (item.ttl <= 0) {
      state.items.splice(i, 1);
      continue;
    }
    for (const [, player] of state.players) {
      if (player.eliminated) continue;
      if (dist(item.x, item.y, player.x, player.y) > ITEM_PICKUP_RADIUS) continue;
      const status = applyItemPickup(player, item);
      if (status) setStatus(status);
      state.items.splice(i, 1);
      break;
    }
  }
}

export function bulletTail(b) {
  const speed = b.speed || BULLET_SPEED;
  return {
    tailX: b.x - (b.vx / speed) * BULLET_LENGTH,
    tailY: b.y - (b.vy / speed) * BULLET_LENGTH,
  };
}

export { PLAYER_RADIUS, BULLET_LENGTH, BASE_HP, MAX_ARMOR };

