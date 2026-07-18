import { BASE_HP, MAX_ARMOR, PLAYER_RADIUS } from './arena-rules.js';

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function createArenaPlayerSnapshot(player) {
  return {
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    angle: Math.round(player.angle * 100) / 100,
    username: player.username,
    color: player.color,
    hp: player.hp,
    maxHp: player.maxHp,
    armor: player.armor,
    maxArmor: player.maxArmor,
    character: player.character,
    characterLabel: player.characterLabel,
    characterGlyph: player.characterGlyph,
    radius: player.radius,
    baseWeapon: player.baseWeapon,
    weapon: player.weapon,
    weaponUntil: player.weaponUntil || 0,
    speedMultiplier: player.speedMultiplier,
    damageMultiplier: player.damageMultiplier,
    cooldownMultiplier: player.cooldownMultiplier,
    pickupRadiusMultiplier: player.pickupRadiusMultiplier,
    itemDurationMultiplier: player.itemDurationMultiplier,
    hasteUntil: player.hasteUntil || 0,
    overchargeUntil: player.overchargeUntil || 0,
    magnetUntil: player.magnetUntil || 0,
    regenUntil: player.regenUntil || 0,
    kills: player.kills || 0,
    deaths: player.deaths || 0,
    damageDealt: player.damageDealt || 0,
    damageTaken: player.damageTaken || 0,
    pickups: player.pickups || 0,
    eliminated: !!player.eliminated,
  };
}

export function createArenaBulletSnapshot(bullet) {
  return {
    x: Math.round(bullet.x * 10) / 10,
    y: Math.round(bullet.y * 10) / 10,
    vx: Math.round(bullet.vx * 10) / 10,
    vy: Math.round(bullet.vy * 10) / 10,
    from: bullet.from,
    color: bullet.color,
    life: bullet.life,
    damage: bullet.damage,
    speed: bullet.speed,
    weapon: bullet.weapon,
  };
}

export function reconcileArenaPlayer(player, snapshot) {
  const target = player || {};
  target.x = finiteOr(snapshot.x, target.x || 0);
  target.y = finiteOr(snapshot.y, target.y || 0);
  target.angle = finiteOr(snapshot.angle, target.angle || 0);
  target.username = snapshot.username || target.username || '?';
  target.color = snapshot.color || target.color || '#4fc3f7';
  target.hp = finiteOr(snapshot.hp, target.hp ?? BASE_HP);
  target.maxHp = finiteOr(snapshot.maxHp, target.maxHp || BASE_HP);
  target.armor = finiteOr(snapshot.armor, target.armor || 0);
  target.maxArmor = finiteOr(snapshot.maxArmor, target.maxArmor || MAX_ARMOR);
  target.character = snapshot.character || target.character || 'vanguard';
  target.characterLabel = snapshot.characterLabel || target.characterLabel || 'Vanguard';
  target.characterGlyph = snapshot.characterGlyph || target.characterGlyph || 'V';
  target.radius = finiteOr(snapshot.radius, target.radius || PLAYER_RADIUS);
  target.baseWeapon = snapshot.baseWeapon || target.baseWeapon || 'blaster';
  target.weapon = snapshot.weapon || target.weapon || target.baseWeapon;
  target.weaponUntil = finiteOr(snapshot.weaponUntil, 0);
  target.speedMultiplier = finiteOr(snapshot.speedMultiplier, target.speedMultiplier || 1);
  target.damageMultiplier = finiteOr(snapshot.damageMultiplier, target.damageMultiplier || 1);
  target.cooldownMultiplier = finiteOr(snapshot.cooldownMultiplier, target.cooldownMultiplier || 1);
  target.pickupRadiusMultiplier = finiteOr(snapshot.pickupRadiusMultiplier, target.pickupRadiusMultiplier || 1);
  target.itemDurationMultiplier = finiteOr(snapshot.itemDurationMultiplier, target.itemDurationMultiplier || 1);
  target.hasteUntil = finiteOr(snapshot.hasteUntil, 0);
  target.overchargeUntil = finiteOr(snapshot.overchargeUntil, 0);
  target.magnetUntil = finiteOr(snapshot.magnetUntil, 0);
  target.regenUntil = finiteOr(snapshot.regenUntil, 0);
  target.kills = finiteOr(snapshot.kills, target.kills || 0);
  target.deaths = finiteOr(snapshot.deaths, target.deaths || 0);
  target.damageDealt = finiteOr(snapshot.damageDealt, target.damageDealt || 0);
  target.damageTaken = finiteOr(snapshot.damageTaken, target.damageTaken || 0);
  target.pickups = finiteOr(snapshot.pickups, target.pickups || 0);
  target.lastShootTime = target.lastShootTime || 0;
  target.eliminated = !!snapshot.eliminated;
  return target;
}

export function createArenaStanding(id, player) {
  return {
    id,
    username: player.username,
    color: player.color,
    hp: player.hp,
    maxHp: player.maxHp,
    armor: player.armor,
    maxArmor: player.maxArmor,
    character: player.character,
    characterLabel: player.characterLabel,
    weapon: player.weapon,
    kills: player.kills || 0,
    deaths: player.deaths || 0,
    damageDealt: Math.round(player.damageDealt || 0),
    damageTaken: Math.round(player.damageTaken || 0),
    pickups: player.pickups || 0,
    eliminated: !!player.eliminated,
  };
}

