import {
  PLAYER_RADIUS,
  BULLET_SPEED,
  BULLET_LENGTH,
  BASE_HP,
  MAX_ARMOR,
  MAX_ITEMS,
  ITEM_SPAWN_MS,
  ITEM_RADIUS,
  WEAPON_BUFF_MS,
  MAGNET_PICKUP_MULTIPLIER,
  REGEN_TICK_MS,
  REGEN_HP_PER_TICK,
  ITEM_TYPES,
  chooseWeightedItemType,
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
      const hitRadius = (player.radius || PLAYER_RADIUS) + 4;
      const d = bulletTargetDistance(b, player);
      if (d >= hitRadius) continue;

      const damage = applyDamage(player, b.damage || 25);
      const attacker = players.get(b.from);
      if (attacker) {
        attacker.damageDealt = (attacker.damageDealt || 0) + damage.totalDamage;
        attacker.kills = (attacker.kills || 0) + (damage.newlyEliminated ? 1 : 0);
      }

      const hitData = {
        targetId: pid,
        sourceId: b.from,
        hp: player.hp,
        armor: player.armor,
        eliminated: player.eliminated,
        newlyEliminated: damage.newlyEliminated,
        damage: damage.totalDamage,
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

export function applyDamage(player, rawDamage, armorRatio = 0.6) {
  const amount = Number.isFinite(rawDamage) ? Math.max(0, rawDamage) : 0;
  const absorbRatio = Number.isFinite(armorRatio) ? clamp(armorRatio, 0, 1) : 0.6;
  const wasEliminated = !!player.eliminated;
  const armorBefore = Math.max(0, player.armor || 0);
  const hpBefore = Math.max(0, player.hp || 0);
  const armorDamage = Math.min(armorBefore, Math.ceil(amount * absorbRatio));
  const hpDamage = Math.min(hpBefore, Math.max(0, amount - armorDamage));

  player.armor = armorBefore - armorDamage;
  player.hp = hpBefore - hpDamage;
  player.eliminated = player.hp <= 0;
  if (player.eliminated) player.hp = 0;

  const newlyEliminated = player.eliminated && !wasEliminated;
  if (newlyEliminated) player.deaths = (player.deaths || 0) + 1;
  player.damageTaken = (player.damageTaken || 0) + armorDamage + hpDamage;

  return {
    armorDamage,
    hpDamage,
    totalDamage: armorDamage + hpDamage,
    newlyEliminated,
    eliminated: player.eliminated,
  };
}

export function spawnItem(state, lineCircleIntersect) {
  if (state.items.length >= MAX_ITEMS) return;
  const random = state.random || Math.random;
  const key = chooseWeightedItemType(random);
  const margin = 80;
  for (let i = 0; i < 10; i++) {
    const x = margin + random() * (state.W - margin * 2);
    const y = margin + random() * (state.H - margin * 2);
    const onPlayer = Array.from(state.players.values()).some(p => !p.eliminated && dist(x, y, p.x, p.y) < 100);
    if (onPlayer) continue;
    const blocked = state.walls.some(w => lineCircleIntersect(w.x1, w.y1, w.x2, w.y2, x, y, ITEM_RADIUS + 4));
    if (blocked) continue;
    const id = state.createId ? state.createId('item') : `item-${Date.now()}-${i}`;
    const item = { id, type: key, x, y, ttl: 800 };
    state.items.push(item);
    return item;
  }
  return null;
}

export function applyItemPickup(player, item) {
  const t = ITEM_TYPES[item.type];
  if (!t) return null;
  const now = Date.now();
  const maxHp = player.maxHp || BASE_HP;
  const maxArmor = player.maxArmor || MAX_ARMOR;
  const durationMultiplier = player.itemDurationMultiplier || 1;
  player.pickups = (player.pickups || 0) + 1;
  if (t.kind === 'heal') {
    player.hp = clamp((player.hp || 0) + t.value, 0, maxHp);
    return `${player.username} picked ${t.label}`;
  }
  if (t.kind === 'armor') {
    player.armor = clamp((player.armor || 0) + t.value, 0, maxArmor);
    return `${player.username} picked ${t.label}`;
  }
  if (t.kind === 'weapon') {
    player.weapon = t.weapon;
    player.weaponUntil = now + WEAPON_BUFF_MS * durationMultiplier;
    return `${player.username} picked ${t.label}`;
  }
  if (t.kind === 'effect') {
    player[`${t.effect}Until`] = now + t.duration * durationMultiplier;
    if (t.effect === 'regen') player.lastRegenAt = now;
    return `${player.username} picked ${t.label}`;
  }
  return null;
}

export function updatePlayerEffects(player, now = Date.now()) {
  if (!player || player.eliminated) return;
  if ((player.regenUntil || 0) <= now) {
    player.lastRegenAt = 0;
    return;
  }

  const lastTick = player.lastRegenAt || now;
  const ticks = Math.floor((now - lastTick) / REGEN_TICK_MS);
  if (ticks <= 0) return;
  player.lastRegenAt = lastTick + ticks * REGEN_TICK_MS;
  player.hp = clamp(
    (player.hp || 0) + ticks * REGEN_HP_PER_TICK,
    0,
    player.maxHp || BASE_HP,
  );
}

export function updateItems(state, lineCircleIntersect, onPickup) {
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
      const baseRadius = (player.radius || PLAYER_RADIUS) + ITEM_RADIUS + 2;
      const characterMultiplier = player.pickupRadiusMultiplier || 1;
      const magnetMultiplier = (player.magnetUntil || 0) > now ? MAGNET_PICKUP_MULTIPLIER : 1;
      if (dist(item.x, item.y, player.x, player.y) > baseRadius * characterMultiplier * magnetMultiplier) continue;
      const status = applyItemPickup(player, item);
      if (status) onPickup({ text: status, player, item });
      state.items.splice(i, 1);
      break;
    }
  }

  for (const [, player] of state.players) {
    updatePlayerEffects(player, now);
  }
}

export function bulletTail(b) {
  const speed = b.speed || BULLET_SPEED;
  return {
    tailX: b.x - (b.vx / speed) * BULLET_LENGTH,
    tailY: b.y - (b.vy / speed) * BULLET_LENGTH,
  };
}

