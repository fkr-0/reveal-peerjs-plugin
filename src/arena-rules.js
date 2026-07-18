export const PLAYER_RADIUS = 14;
export const DIRECTION_LINE_LEN = 22;
export const BASE_SPEED = 3;
export const BOOST_SPEED = 5;
export const BULLET_SPEED = 8;
export const BULLET_LENGTH = 8;
export const BULLET_COUNT_CLOSE = 8;
export const BULLET_COUNT_FAR = 2;
export const SPREAD_CLOSE = 0.12;
export const SPREAD_FAR = 0.02;
export const SPREAD_MIN_DIST = 40;
export const SPREAD_MAX_DIST = 350;
export const WALL_COUNT = 18;
export const WALL_MIN_LEN = 40;
export const WALL_MAX_LEN = 140;
export const HIT_RADIUS = PLAYER_RADIUS + 4;
export const SEND_RATE = 50;
export const INPUT_SEND_RATE = 33;
export const BASE_HP = 100;
export const MAX_ARMOR = 100;
export const MAX_ITEMS = 8;
export const ITEM_SPAWN_MS = 3800;
export const ITEM_RADIUS = 12;
export const ITEM_PICKUP_RADIUS = PLAYER_RADIUS + ITEM_RADIUS + 2;
export const WEAPON_BUFF_MS = 12000;
export const STATUS_BUFF_MS = 10000;
export const HASTE_SPEED_MULTIPLIER = 1.35;
export const OVERCHARGE_DAMAGE_MULTIPLIER = 1.35;
export const MAGNET_PICKUP_MULTIPLIER = 1.75;
export const REGEN_TICK_MS = 500;
export const REGEN_HP_PER_TICK = 3;

export const DEFAULT_CHARACTER_TYPE = 'vanguard';

export const CHARACTER_TYPES = {
  vanguard: {
    id: 'vanguard',
    label: 'Vanguard',
    glyph: 'V',
    description: 'Balanced health, speed, armor capacity, and blaster handling.',
    maxHp: 100,
    maxArmor: 100,
    startArmor: 0,
    startingWeapon: 'blaster',
    speedMultiplier: 1,
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    pickupRadiusMultiplier: 1,
    itemDurationMultiplier: 1,
    sizeMultiplier: 1,
  },
  scout: {
    id: 'scout',
    label: 'Scout',
    glyph: 'S',
    description: 'Fast and compact, with rapid fire at the cost of durability.',
    maxHp: 80,
    maxArmor: 70,
    startArmor: 0,
    startingWeapon: 'rapid',
    speedMultiplier: 1.22,
    damageMultiplier: 0.9,
    cooldownMultiplier: 0.88,
    pickupRadiusMultiplier: 1.15,
    itemDurationMultiplier: 1,
    sizeMultiplier: 0.9,
  },
  guardian: {
    id: 'guardian',
    label: 'Guardian',
    glyph: 'G',
    description: 'Large, slow, and heavily armored with superior survivability.',
    maxHp: 135,
    maxArmor: 150,
    startArmor: 40,
    startingWeapon: 'blaster',
    speedMultiplier: 0.82,
    damageMultiplier: 1,
    cooldownMultiplier: 1.05,
    pickupRadiusMultiplier: 0.95,
    itemDurationMultiplier: 1.1,
    sizeMultiplier: 1.15,
  },
  ranger: {
    id: 'ranger',
    label: 'Ranger',
    glyph: 'R',
    description: 'Precise long-range damage with a slower firing rhythm.',
    maxHp: 90,
    maxArmor: 80,
    startArmor: 0,
    startingWeapon: 'sniper',
    speedMultiplier: 1,
    damageMultiplier: 1.12,
    cooldownMultiplier: 1.12,
    pickupRadiusMultiplier: 1,
    itemDurationMultiplier: 1,
    sizeMultiplier: 0.95,
  },
  engineer: {
    id: 'engineer',
    label: 'Engineer',
    glyph: 'E',
    description: 'Extended item effects, wider pickup reach, and efficient firing.',
    maxHp: 95,
    maxArmor: 120,
    startArmor: 20,
    startingWeapon: 'blaster',
    speedMultiplier: 0.95,
    damageMultiplier: 0.95,
    cooldownMultiplier: 0.92,
    pickupRadiusMultiplier: 1.35,
    itemDurationMultiplier: 1.4,
    sizeMultiplier: 1,
  },
};

export function normalizeCharacterType(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARACTER_TYPES, value)
    ? value
    : DEFAULT_CHARACTER_TYPE;
}

export function getCharacterConfig(value) {
  return CHARACTER_TYPES[normalizeCharacterType(value)];
}

export const WEAPONS = {
  blaster: { bulletSpeed: 8, damage: 34, life: 110, count: null, spread: null, cooldown: 300 },
  rapid: { bulletSpeed: 9.5, damage: 18, life: 95, count: 1, spread: 0, cooldown: 120 },
  spread: { bulletSpeed: 7.2, damage: 15, life: 100, count: 7, spread: 0.09, cooldown: 340 },
  sniper: { bulletSpeed: 14, damage: 55, life: 150, count: 1, spread: 0.005, cooldown: 650 },
};

export const ITEM_TYPES = {
  heal: { kind: 'heal', color: '#66bb6a', label: 'HEAL', glyph: '+', value: 35, weight: 18 },
  medkit: { kind: 'heal', color: '#2e7d32', label: 'MED+', glyph: 'M', value: 65, weight: 6 },
  armor: { kind: 'armor', color: '#42a5f5', label: 'ARMOR', glyph: 'A', value: 30, weight: 16 },
  shield: { kind: 'armor', color: '#1565c0', label: 'SHIELD', glyph: 'S', value: 60, weight: 6 },
  haste: { kind: 'effect', color: '#26c6da', label: 'HASTE', glyph: 'H', effect: 'haste', duration: STATUS_BUFF_MS, weight: 10 },
  overcharge: { kind: 'effect', color: '#ec407a', label: 'AMP', glyph: '!', effect: 'overcharge', duration: STATUS_BUFF_MS, weight: 9 },
  magnet: { kind: 'effect', color: '#8d6e63', label: 'MAGNET', glyph: 'U', effect: 'magnet', duration: STATUS_BUFF_MS + 4000, weight: 8 },
  regen: { kind: 'effect', color: '#9ccc65', label: 'REGEN', glyph: 'R', effect: 'regen', duration: STATUS_BUFF_MS + 2000, weight: 7 },
  rapid: { kind: 'weapon', color: '#ff7043', label: 'RAPID', glyph: 'R', weapon: 'rapid', weight: 9 },
  spread: { kind: 'weapon', color: '#ab47bc', label: 'SPREAD', glyph: 'W', weapon: 'spread', weight: 8 },
  sniper: { kind: 'weapon', color: '#ffee58', label: 'SNIPER', glyph: 'N', weapon: 'sniper', weight: 7 },
};

export function chooseWeightedItemType(random = Math.random) {
  const entries = Object.entries(ITEM_TYPES);
  const totalWeight = entries.reduce((sum, [, item]) => sum + (item.weight || 1), 0);
  let target = random() * totalWeight;
  for (const [key, item] of entries) {
    target -= item.weight || 1;
    if (target < 0) return key;
  }
  return entries[entries.length - 1]?.[0] || 'heal';
}

