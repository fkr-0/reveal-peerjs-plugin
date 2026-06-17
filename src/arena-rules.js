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
export const MAX_ITEMS = 6;
export const ITEM_SPAWN_MS = 4500;
export const ITEM_RADIUS = 12;
export const ITEM_PICKUP_RADIUS = PLAYER_RADIUS + ITEM_RADIUS + 2;
export const WEAPON_BUFF_MS = 12000;

export const WEAPONS = {
  blaster: { bulletSpeed: 8, damage: 34, life: 110, count: null, spread: null, cooldown: 300 },
  rapid: { bulletSpeed: 9.5, damage: 18, life: 95, count: 1, spread: 0, cooldown: 120 },
  spread: { bulletSpeed: 7.2, damage: 15, life: 100, count: 7, spread: 0.09, cooldown: 340 },
  sniper: { bulletSpeed: 14, damage: 55, life: 150, count: 1, spread: 0.005, cooldown: 650 },
};

export const ITEM_TYPES = {
  heal: { kind: 'heal', color: '#66bb6a', label: 'HEAL', value: 35 },
  armor: { kind: 'armor', color: '#42a5f5', label: 'ARMOR', value: 30 },
  rapid: { kind: 'weapon', color: '#ff7043', label: 'RAPID', weapon: 'rapid' },
  spread: { kind: 'weapon', color: '#ab47bc', label: 'SPREAD', weapon: 'spread' },
  sniper: { kind: 'weapon', color: '#ffee58', label: 'SNIPER', weapon: 'sniper' },
};

