/**
 * Arena mini-game - top-down 2D shooter
 *
 * Hub-triggered game where all lobby members are dropped into
 * a shared arena with walls/obstacles.
 *
 * Controls:
 *   H/J/K/L  - Move left/down/up/right
 *   Mouse    - Aim direction (line from player circle)
 *   Space    - Shoot burst of bullets
 *
 * Rules:
 *   - Each player is a colored circle on the map
 *   - Map has randomly placed wall segments (short lines)
 *   - Bullets travel until they hit a wall, player, or leave the screen
 *   - Being hit once: circle becomes half-filled, movement speed increases
 *   - Being hit twice: eliminated (circle turns into ghost marker)
 *   - Hub syncs authoritative game state; clients send inputs
 */

import { CLOSE_ICON } from './icons.js';
import {
  PLAYER_RADIUS,
  DIRECTION_LINE_LEN,
  BASE_SPEED,
  BOOST_SPEED,
  BULLET_SPEED,
  BULLET_LENGTH,
  BULLET_COUNT_CLOSE,
  BULLET_COUNT_FAR,
  SPREAD_CLOSE,
  SPREAD_FAR,
  SPREAD_MIN_DIST,
  SPREAD_MAX_DIST,
  SEND_RATE,
  INPUT_SEND_RATE,
  BASE_HP,
  WEAPONS,
  ITEM_TYPES,
  HASTE_SPEED_MULTIPLIER,
  OVERCHARGE_DAMAGE_MULTIPLIER,
  getCharacterConfig,
  normalizeCharacterType,
} from './arena-rules.js';
import {
  clamp,
  dist,
  updateBullets,
  bulletTargetDistance,
  applyBulletCollisions,
  updateItems,
} from './arena-sim.js';
import { generatePlayableMap } from './arena-map.js';
import { bindArenaInput, unbindArenaInput } from './arena-input.js';
import { drawArena, updateArenaHud, updateArenaScoreboard } from './arena-render.js';

// ---------- Helpers ----------
// Line-segment / circle intersection
function lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

export function createArenaPlayer(user, spawn) {
  const character = getCharacterConfig(user.arenaCharacter);
  return {
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    color: user.color,
    username: user.username,
    character: character.id,
    characterLabel: character.label,
    characterGlyph: character.glyph,
    radius: PLAYER_RADIUS * character.sizeMultiplier,
    maxHp: character.maxHp,
    maxArmor: character.maxArmor,
    hp: character.maxHp,
    armor: character.startArmor,
    baseWeapon: character.startingWeapon,
    weapon: character.startingWeapon,
    weaponUntil: 0,
    speedMultiplier: character.speedMultiplier,
    damageMultiplier: character.damageMultiplier,
    cooldownMultiplier: character.cooldownMultiplier,
    pickupRadiusMultiplier: character.pickupRadiusMultiplier,
    itemDurationMultiplier: character.itemDurationMultiplier,
    hasteUntil: 0,
    overchargeUntil: 0,
    magnetUntil: 0,
    regenUntil: 0,
    lastRegenAt: 0,
    lastShootTime: 0,
    lastInputAt: 0,
    eliminated: false,
  };
}

// Line-segment / line-segment intersection
function lineLineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ---------- Arena Game Class ----------
export class ArenaGame {
  constructor(network, isHub, { onStart, onStop } = {}) {
    this.network = network;
    this.isHub = isHub;
    this._onStartCb = onStart || null;
    this._onStopCb = onStop || null;
    this.el = null;
    this.canvas = null;
    this.ctx = null;
    this.running = false;
    this.animFrame = null;

    // Map dimensions
    this.W = 0;
    this.H = 0;

    // Game state
    this.players = new Map(); // peerId -> { x, y, angle, color, username, hp, armor, weapon, eliminated }
    this.walls = [];
    this.bullets = []; // { x, y, vx, vy, from, color, life }
    this.seed = 0;
    this.gameId = null;
    this.items = []; // { id, type, x, y, ttl }
    this._itemSpawnAt = 0;
    this.zombieMode = false;
    this.zombies = [];
    this._zombiesPerMin = 10;
    this._nextZombieSpawnAt = 0;
    this._zombieStartAt = 0;
    this._zombiesDefeated = 0;
    this._zombieWave = 1;
    this._nextWaveAtKills = 10;

    // Local input state
    this.keysDown = new Set();
    this.mouseX = 0;
    this.mouseY = 0;

    // Touch input
    this.touchDx = 0;
    this.touchDy = 0;
    this._joystickTouchId = null;
    this._joystickCenter = null;
    this._shootTouchInterval = null;
    this._isTouchDevice = false;

    // Hub authoritative state
    this._stateBroadcastInterval = null;
    this._inputSendInterval = null;

    // Event handlers
    this._onArenaState = null;
    this._onArenaInput = null;
    this._onArenaShoot = null;
    this._onArenaHit = null;
    this._onArenaEnd = null;
    this._onArenaLeave = null;
    this._leaveSent = false;
    this._statusText = '';
    this._statusTextUntil = 0;
    this._keyDownHandler = null;
    this._keyUpHandler = null;
    this._mouseMoveHandler = null;
    this._mouseDownHandler = null;
    this._resizeHandler = null;
    this._canvasTouchHandler = null;
    this._spawnPoints = [];
  }

  _handlePeerLeave(payload) {
    if (!this.isHub || payload?.gameId !== this.gameId) return;
    if (!this.players.delete(payload.peerId)) return;
    this.bullets = this.bullets.filter(bullet => bullet.from !== payload.peerId);
    this._checkGameOver();
  }

  /**
   * Start the game (hub calls this to begin)
   */
  start(gameConfig) {
    this._leaveSent = false;
    this.gameId = gameConfig.gameId;
    this.seed = gameConfig.seed;

    this._render();
    this._resize();

    // Generate playable map from seed
    const userCount = Math.max(1, this.network.getUserList().length + (this.network.myUser ? 1 : 0));
    const map = generatePlayableMap(this.W, this.H, this.seed, userCount);
    this.walls = map.walls;
    this._spawnPoints = map.spawns;

    // Build full user list (visitors don't include themselves in getUserList)
    const userList = this.network.getUserList();
    const myUser = this.network.myUser;
    if (myUser && !userList.find(u => u.id === myUser.id)) {
      userList.push({
        id: myUser.id,
        username: myUser.username,
        color: myUser.color,
        arenaCharacter: normalizeCharacterType(myUser.arenaCharacter),
        isHub: myUser.isHub,
        number: myUser.number,
      });
      userList.sort((a, b) => {
        if (a.isHub && !b.isHub) return -1;
        if (!a.isHub && b.isHub) return 1;
        return (a.number || 0) - (b.number || 0);
      });
    }

    for (let i = 0; i < userList.length; i++) {
      const user = userList[i];
      const spawn = this._spawnPoints[i % this._spawnPoints.length] || { x: this.W / 2, y: this.H / 2 };
      this.players.set(user.id, createArenaPlayer(user, spawn));
    }

    this.zombieMode = this.isHub && this.players.size === 1;
    this._zombiesPerMin = 10;
    this._zombieStartAt = Date.now();
    this._nextZombieSpawnAt = Date.now() + 2500;
    this._zombiesDefeated = 0;
    this._zombieWave = 1;
    this._nextWaveAtKills = 10;
    if (this.zombieMode) {
      this._setStatus('Zombie Mode: survive as long as possible');
    }

    this._bindEvents();
    this.running = true;

    if (this.isHub) {
      // Hub runs authoritative simulation + broadcasts
      this._stateBroadcastInterval = setInterval(() => {
        this._hubBroadcastState();
      }, SEND_RATE);
    } else {
      // Clients send inputs at regular rate
      this._inputSendInterval = setInterval(() => {
        this._sendInput();
      }, INPUT_SEND_RATE);
    }

    // Listen for network events
    this._onArenaState = (state) => this._handleStateUpdate(state);
    this._onArenaInput = (input) => this._handleRemoteInput(input);
    this._onArenaShoot = (shoot) => this._handleRemoteShoot(shoot);
    this._onArenaHit = (hit) => this._handleRemoteHit(hit);
    this._onArenaEnd = (results) => this._handleEnd(results);
    this._onArenaLeave = (payload) => this._handlePeerLeave(payload);

    this.network.on('arena-state', this._onArenaState);
    this.network.on('arena-input', this._onArenaInput);
    this.network.on('arena-shoot', this._onArenaShoot);
    this.network.on('arena-hit', this._onArenaHit);
    this.network.on('arena-end', this._onArenaEnd);
    this.network.on('arena-leave', this._onArenaLeave);

    if (this._onStartCb) this._onStartCb();

    this._loop();
  }

  /**
   * Called by hub to broadcast start to all
   */
  static triggerStart(network) {
    const gameConfig = {
      gameId: `arena-${Date.now()}`,
      seed: Math.floor(Math.random() * 100000),
    };
    network.startArena(gameConfig);
    return gameConfig;
  }

  // ---------- Rendering ----------

  _render() {
    if (this.el) this.el.remove();

    const itemLegend = Object.values(ITEM_TYPES).map(item => `
      <span class="rpjs-arena-legend-item">
        <span class="rpjs-arena-legend-glyph" style="background:${item.color}">${item.glyph || item.label[0]}</span>
        ${item.label}
      </span>
    `).join('');

    this.el = document.createElement('div');
    this.el.className = 'rpjs-arena-overlay';
    this.el.innerHTML = `
      <canvas class="rpjs-arena-canvas" id="rpjs-arena-canvas"></canvas>
      <div class="rpjs-arena-hud">
        <span class="rpjs-arena-hud-title">Arena</span>
        <span id="rpjs-arena-player-count"></span>
      </div>
      <button class="rpjs-arena-exit" id="rpjs-arena-exit">Exit [Esc]</button>
      <div class="rpjs-arena-controls">WASD / HJKL to move &middot; Mouse to aim &middot; Click / Space to shoot</div>
      <div class="rpjs-arena-touch-controls">
        <div class="rpjs-arena-joystick" id="rpjs-arena-joystick">
          <div class="rpjs-arena-joystick-knob" id="rpjs-arena-joystick-knob"></div>
        </div>
        <button class="rpjs-arena-shoot-btn" id="rpjs-arena-shoot-btn">FIRE</button>
      </div>
      <div class="rpjs-arena-scoreboard" id="rpjs-arena-scoreboard"></div>
      <details class="rpjs-arena-item-legend">
        <summary>Items</summary>
        <div class="rpjs-arena-item-legend-grid">${itemLegend}</div>
      </details>
    `;

    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('#rpjs-arena-canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    // Regenerate map on resize
    if (this.seed) {
      const map = generatePlayableMap(this.W, this.H, this.seed, Math.max(1, this.players.size));
      this.walls = map.walls;
    }
  }

  // ---------- Events ----------

  _bindEvents() {
    bindArenaInput(this);
  }

  _unbindEvents() {
    unbindArenaInput(this);

    if (this._onArenaState) this.network.off('arena-state', this._onArenaState);
    if (this._onArenaInput) this.network.off('arena-input', this._onArenaInput);
    if (this._onArenaShoot) this.network.off('arena-shoot', this._onArenaShoot);
    if (this._onArenaHit) this.network.off('arena-hit', this._onArenaHit);
    if (this._onArenaEnd) this.network.off('arena-end', this._onArenaEnd);
    if (this._onArenaLeave) this.network.off('arena-leave', this._onArenaLeave);
  }

  // ---------- Input ----------

  _sendInput() {
    const me = this.players.get(this.network.myId);
    if (!me || me.eliminated) return;

    let dx = 0, dy = 0;
    if (this.keysDown.has('h') || this.keysDown.has('a')) dx -= 1;
    if (this.keysDown.has('l') || this.keysDown.has('d')) dx += 1;
    if (this.keysDown.has('k') || this.keysDown.has('w')) dy -= 1;
    if (this.keysDown.has('j') || this.keysDown.has('s')) dy += 1;
    dx += this.touchDx;
    dy += this.touchDy;

    if (dx === 0 && dy === 0) return;

    const speed = this._moveSpeedFor(me);
    const len = Math.sqrt(dx * dx + dy * dy);
    const norm = len > 1 ? len : 1;
    dx = (dx / norm) * speed;
    dy = (dy / norm) * speed;

    const radius = me.radius || PLAYER_RADIUS;
    me.x = clamp(me.x + dx, radius, this.W - radius);
    me.y = clamp(me.y + dy, radius, this.H - radius);
    // Push out of walls
    this._resolveWalls(me);

    // Send to hub
    this.network.sendArenaInput({
      gameId: this.gameId,
      x: me.x,
      y: me.y,
      angle: me.angle,
    });
  }

  _shoot() {
    const me = this.players.get(this.network.myId);
    if (!me || me.eliminated) return;

    const now = Date.now();
    const weaponCfg = this._weaponConfigFor(me);
    if (now - me.lastShootTime < weaponCfg.cooldown) return;
    me.lastShootTime = now;

    const d = dist(me.x, me.y, this.mouseX, this.mouseY);
    const t = clamp((d - SPREAD_MIN_DIST) / (SPREAD_MAX_DIST - SPREAD_MIN_DIST), 0, 1);
    const count = weaponCfg.count == null
      ? Math.round(BULLET_COUNT_CLOSE + (BULLET_COUNT_FAR - BULLET_COUNT_CLOSE) * t)
      : weaponCfg.count;
    const spread = weaponCfg.spread == null
      ? SPREAD_CLOSE + (SPREAD_FAR - SPREAD_CLOSE) * t
      : weaponCfg.spread;

    const shootData = {
      gameId: this.gameId,
      x: me.x,
      y: me.y,
      angle: me.angle,
      color: me.color,
      count,
      spread,
      damage: weaponCfg.damage,
      bulletSpeed: weaponCfg.bulletSpeed,
      life: weaponCfg.life,
      weapon: me.weapon,
    };

    this._createBullets(this.network.myId, shootData);
    this.network.sendArenaShoot(shootData);
  }

  _createBullets(fromId, data) {
    const count = data.count || BULLET_COUNT_CLOSE;
    const spread = data.spread != null ? data.spread : SPREAD_CLOSE;

    const bulletSpeed = data.bulletSpeed || BULLET_SPEED;
    const bulletLife = data.life || 120;
    const bulletDamage = data.damage || 25;
    const shooter = this.players.get(fromId);
    const shooterRadius = shooter?.radius || PLAYER_RADIUS;
    for (let i = 0; i < count; i++) {
      const spreadAngle = data.angle + (i - (count - 1) / 2) * spread;
      this.bullets.push({
        x: data.x + Math.cos(data.angle) * (shooterRadius + 4),
        y: data.y + Math.sin(data.angle) * (shooterRadius + 4),
        vx: Math.cos(spreadAngle) * bulletSpeed,
        vy: Math.sin(spreadAngle) * bulletSpeed,
        from: fromId,
        color: data.color,
        life: bulletLife,
        speed: bulletSpeed,
        damage: bulletDamage,
        weapon: data.weapon || 'blaster',
      });
    }
  }

  _moveSpeedFor(player) {
    const maxHp = player.maxHp || BASE_HP;
    const hpRatio = clamp((player.hp || maxHp) / maxHp, 0.3, 1);
    const base = BASE_SPEED + (BOOST_SPEED - BASE_SPEED) * (1 - hpRatio);
    const weaponBonus = player.weapon === 'rapid' ? 0.5 : 0;
    const hasteMultiplier = (player.hasteUntil || 0) > Date.now() ? HASTE_SPEED_MULTIPLIER : 1;
    return (base + weaponBonus) * (player.speedMultiplier || 1) * hasteMultiplier;
  }

  _weaponConfigFor(player) {
    const now = Date.now();
    const baseWeapon = player.baseWeapon || 'blaster';
    if (player.weapon !== baseWeapon && player.weaponUntil && now > player.weaponUntil) {
      player.weapon = baseWeapon;
      player.weaponUntil = 0;
    }
    const weapon = WEAPONS[player.weapon] || WEAPONS[baseWeapon] || WEAPONS.blaster;
    const overchargeMultiplier = (player.overchargeUntil || 0) > now ? OVERCHARGE_DAMAGE_MULTIPLIER : 1;
    return {
      ...weapon,
      damage: weapon.damage * (player.damageMultiplier || 1) * overchargeMultiplier,
      cooldown: weapon.cooldown * (player.cooldownMultiplier || 1),
    };
  }

  _resolveWalls(player) {
    const radius = player.radius || PLAYER_RADIUS;
    for (const w of this.walls) {
      if (lineCircleIntersect(w.x1, w.y1, w.x2, w.y2, player.x, player.y, radius)) {
        // Push player out: find closest point on segment
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len2 = dx * dx + dy * dy;
        let t = ((player.x - w.x1) * dx + (player.y - w.y1) * dy) / len2;
        t = clamp(t, 0, 1);
        const cx = w.x1 + t * dx;
        const cy = w.y1 + t * dy;
        const px = player.x - cx;
        const py = player.y - cy;
        const d = Math.sqrt(px * px + py * py);
        if (d < radius && d > 0.01) {
          const push = radius - d + 1;
          player.x += (px / d) * push;
          player.y += (py / d) * push;
        }
      }
    }
  }

  // ---------- Hub authoritative simulation ----------

  _handleRemoteInput(input) {
    if (!this.isHub) return;
    if (input.gameId && input.gameId !== this.gameId) return;
    const player = this.players.get(input.from);
    if (!player || player.eliminated) return;

    const radius = player.radius || PLAYER_RADIUS;
    const targetX = clamp(Number.isFinite(input.x) ? input.x : player.x, radius, this.W - radius);
    const targetY = clamp(Number.isFinite(input.y) ? input.y : player.y, radius, this.H - radius);
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const now = Date.now();
    const elapsed = player.lastInputAt ? Math.max(0, now - player.lastInputAt) : INPUT_SEND_RATE;
    player.lastInputAt = now;
    const maxStep = this._moveSpeedFor(player) * clamp(elapsed / INPUT_SEND_RATE, 1, 5);

    if (distance > maxStep && distance > 0.0001) {
      player.x += (dx / distance) * maxStep;
      player.y += (dy / distance) * maxStep;
    } else {
      player.x = targetX;
      player.y = targetY;
    }

    if (Number.isFinite(input.angle)) player.angle = input.angle;
    this._resolveWalls(player);
  }

  _handleRemoteShoot(shoot) {
    if (!this.isHub) return;
    if (shoot.gameId && shoot.gameId !== this.gameId) return;
    if (shoot.from === this.network.myId) return;
    const player = this.players.get(shoot.from);
    if (!player || player.eliminated) return;
    const weaponCfg = this._weaponConfigFor(player);
    const now = Date.now();
    if (now - (player.lastShootTime || 0) < weaponCfg.cooldown) return;
    player.lastShootTime = now;
    this._createBullets(shoot.from, this._buildAuthoritativeShootData(player, shoot));
  }

  _buildAuthoritativeShootData(player, requestedShoot = {}) {
    const weaponCfg = this._weaponConfigFor(player);
    const count = weaponCfg.count == null
      ? clamp(Math.round(Number(requestedShoot.count) || BULLET_COUNT_CLOSE), BULLET_COUNT_FAR, BULLET_COUNT_CLOSE)
      : weaponCfg.count;
    const spread = weaponCfg.spread == null
      ? clamp(Number(requestedShoot.spread ?? SPREAD_CLOSE), SPREAD_FAR, SPREAD_CLOSE)
      : weaponCfg.spread;

    return {
      x: player.x,
      y: player.y,
      angle: Number.isFinite(requestedShoot.angle) ? requestedShoot.angle : (player.angle || 0),
      color: player.color,
      count,
      spread,
      damage: weaponCfg.damage,
      bulletSpeed: weaponCfg.bulletSpeed,
      life: weaponCfg.life,
      weapon: player.weapon || 'blaster',
    };
  }

  _handleRemoteHit(hit) {
    if (hit.gameId && hit.gameId !== this.gameId) return;
    // Apply hit from authoritative state
    const player = this.players.get(hit.targetId);
    if (player) {
      player.hp = hit.hp;
      player.armor = hit.armor || 0;
      player.eliminated = hit.eliminated;
    }
    // Add visual hit flash
    this._hitFlashes.push({ x: hit.x, y: hit.y, time: 10, color: hit.color || '#fff' });
  }

  _hubBroadcastState() {
    const playerStates = {};
    for (const [id, p] of this.players) {
      playerStates[id] = {
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        angle: Math.round(p.angle * 100) / 100,
        username: p.username,
        color: p.color,
        hp: p.hp,
        maxHp: p.maxHp,
        armor: p.armor,
        maxArmor: p.maxArmor,
        character: p.character,
        characterLabel: p.characterLabel,
        characterGlyph: p.characterGlyph,
        radius: p.radius,
        baseWeapon: p.baseWeapon,
        weapon: p.weapon,
        weaponUntil: p.weaponUntil || 0,
        speedMultiplier: p.speedMultiplier,
        damageMultiplier: p.damageMultiplier,
        cooldownMultiplier: p.cooldownMultiplier,
        pickupRadiusMultiplier: p.pickupRadiusMultiplier,
        itemDurationMultiplier: p.itemDurationMultiplier,
        hasteUntil: p.hasteUntil || 0,
        overchargeUntil: p.overchargeUntil || 0,
        magnetUntil: p.magnetUntil || 0,
        regenUntil: p.regenUntil || 0,
        eliminated: p.eliminated,
      };
    }

    const bulletStates = this.bullets.map(b => ({
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      vx: Math.round(b.vx * 10) / 10,
      vy: Math.round(b.vy * 10) / 10,
      from: b.from,
      color: b.color,
      life: b.life,
      damage: b.damage,
      speed: b.speed,
      weapon: b.weapon,
    }));

    this.network.broadcastArenaState({
      gameId: this.gameId,
      players: playerStates,
      bullets: bulletStates,
      items: this.items,
      zombies: this.zombies,
      zombieMode: this.zombieMode,
      zombiesPerMin: this._zombiesPerMin,
      zombieWave: this._zombieWave,
      zombiesDefeated: this._zombiesDefeated,
    });
  }

  // ---------- Client state sync ----------

  _handleStateUpdate(state) {
    if (this.isHub) return;
    if (!state || state.gameId !== this.gameId) return;

    const authoritativeIds = new Set(Object.keys(state.players || {}));
    for (const id of this.players.keys()) {
      if (!authoritativeIds.has(id)) this.players.delete(id);
    }

    for (const [id, ps] of Object.entries(state.players || {})) {
      let player = this.players.get(id);
      if (!player) {
        player = {
          x: ps.x, y: ps.y, angle: ps.angle, color: '#4fc3f7', username: '?',
          hp: ps.maxHp || BASE_HP, maxHp: ps.maxHp || BASE_HP,
          armor: 0, maxArmor: ps.maxArmor || 100,
          character: ps.character || 'vanguard', characterLabel: ps.characterLabel || 'Vanguard',
          characterGlyph: ps.characterGlyph || 'V', radius: ps.radius || PLAYER_RADIUS,
          baseWeapon: ps.baseWeapon || 'blaster', weapon: ps.weapon || 'blaster',
          weaponUntil: 0, lastShootTime: 0, eliminated: false
        };
        this.players.set(id, player);
      }
      // The hub is authoritative for every player, including the local one.
      // Client prediction is temporary and is reconciled by each snapshot.
      player.x = ps.x;
      player.y = ps.y;
      player.angle = ps.angle;
      player.username = ps.username || player.username || '?';
      player.color = ps.color || player.color || '#4fc3f7';
      player.hp = ps.hp ?? BASE_HP;
      player.maxHp = ps.maxHp || BASE_HP;
      player.armor = ps.armor ?? 0;
      player.maxArmor = ps.maxArmor || 100;
      player.character = ps.character || 'vanguard';
      player.characterLabel = ps.characterLabel || 'Vanguard';
      player.characterGlyph = ps.characterGlyph || 'V';
      player.radius = ps.radius || PLAYER_RADIUS;
      player.baseWeapon = ps.baseWeapon || 'blaster';
      player.weapon = ps.weapon || 'blaster';
      player.weaponUntil = ps.weaponUntil || 0;
      player.speedMultiplier = ps.speedMultiplier || 1;
      player.damageMultiplier = ps.damageMultiplier || 1;
      player.cooldownMultiplier = ps.cooldownMultiplier || 1;
      player.pickupRadiusMultiplier = ps.pickupRadiusMultiplier || 1;
      player.itemDurationMultiplier = ps.itemDurationMultiplier || 1;
      player.hasteUntil = ps.hasteUntil || 0;
      player.overchargeUntil = ps.overchargeUntil || 0;
      player.magnetUntil = ps.magnetUntil || 0;
      player.regenUntil = ps.regenUntil || 0;
      player.eliminated = ps.eliminated;
    }

    // Replace bullets with server state (authoritative)
    this.bullets = (state.bullets || []).map(b => ({ ...b }));
    this.items = (state.items || []).map(i => ({ ...i }));
    this.zombies = (state.zombies || []).map(z => ({ ...z }));
    this.zombieMode = !!state.zombieMode;
    this._zombiesPerMin = state.zombiesPerMin || this._zombiesPerMin;
    this._zombieWave = state.zombieWave || this._zombieWave;
    this._zombiesDefeated = state.zombiesDefeated || this._zombiesDefeated;
  }

  // ---------- Game loop ----------

  _loop() {
    if (!this.running) return;

    if (this.isHub) {
      this._updateHub();
    } else {
      this._updateClient();
    }

    // _updateHub may trigger game-over synchronously, which sets running=false
    if (!this.running) return;

    this._draw();
    this._updateHud();
    this._updateScoreboard();

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  _updateHub() {
    const me = this.players.get(this.network.myId);
    if (me && !me.eliminated) {
      let dx = 0, dy = 0;
      if (this.keysDown.has('h') || this.keysDown.has('a')) dx -= 1;
      if (this.keysDown.has('l') || this.keysDown.has('d')) dx += 1;
      if (this.keysDown.has('k') || this.keysDown.has('w')) dy -= 1;
      if (this.keysDown.has('j') || this.keysDown.has('s')) dy += 1;
      dx += this.touchDx;
      dy += this.touchDy;

      if (dx !== 0 || dy !== 0) {
        const speed = this._moveSpeedFor(me);
        const len = Math.sqrt(dx * dx + dy * dy);
        const norm = len > 1 ? len : 1;
        const radius = me.radius || PLAYER_RADIUS;
        me.x = clamp(me.x + (dx / norm) * speed, radius, this.W - radius);
        me.y = clamp(me.y + (dy / norm) * speed, radius, this.H - radius);
        this._resolveWalls(me);
      }
      me.angle = Math.atan2(this.mouseY - me.y, this.mouseX - me.x);
    }

    // Update bullets
    this._updateBullets();
    this._updateItems();
    this._updateZombies();

    // Check bullet-player collisions (hub only)
    this._checkBulletCollisions();
  }

  _updateClient() {
    // Client just updates local position via _sendInput and applies state updates
    // Update local angle from mouse
    const me = this.players.get(this.network.myId);
    if (me && !me.eliminated) {
      me.angle = Math.atan2(this.mouseY - me.y, this.mouseX - me.x);
    }

    // Process bullets visually (collision handled by hub via state)
    this._updateBullets();
  }

  _updateBullets() {
    updateBullets({
      bullets: this.bullets,
      W: this.W,
      H: this.H,
      walls: this.walls,
      sparks: this._sparks,
    }, lineLineIntersect);
  }

  _checkBulletCollisions() {
    if (!this.isHub) return;
    if (this.zombieMode) this._checkZombieBulletCollisions();
    applyBulletCollisions({
      bullets: this.bullets,
      players: this.players,
      hitFlashes: this._hitFlashes,
      sparks: this._sparks,
    }, (hitData) => {
      this.network.broadcastArenaHit(hitData);
      this._checkGameOver();
    });
  }

  _checkZombieBulletCollisions() {
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let zi = this.zombies.length - 1; zi >= 0; zi--) {
        const z = this.zombies[zi];
        const d = bulletTargetDistance(b, z);
        if (d > z.r + 3) continue;
        z.hp -= (b.damage || 25);
        this._sparks.push({ x: b.x, y: b.y, life: 7, color: z.color });
        this.bullets.splice(bi, 1);
        if (z.hp <= 0) {
          this._zombiesDefeated++;
          this._setStatus(`Zombie down! (${this._zombiesDefeated})`);
          this.zombies.splice(zi, 1);
          this._checkWaveMilestone();
        }
        break;
      }
    }
  }

  _hitFlashes = [];
  _sparks = [];

  _updateItems() {
    if (!this.isHub) return;
    const state = {
      items: this.items,
      players: this.players,
      walls: this.walls,
      W: this.W,
      H: this.H,
      itemSpawnAt: this._itemSpawnAt,
    };
    updateItems(state, lineCircleIntersect, (text) => this._setStatus(text));
    this._itemSpawnAt = state.itemSpawnAt;
  }

  _updateZombies() {
    if (!this.zombieMode || !this.isHub) return;
    const now = Date.now();
    const elapsedMin = (now - this._zombieStartAt) / 60000;
    this._zombiesPerMin = 10 + elapsedMin * 8;
    const intervalMs = Math.max(240, 60000 / this._zombiesPerMin);
    if (now >= this._nextZombieSpawnAt) {
      this._spawnZombie();
      this._nextZombieSpawnAt = now + intervalMs;
    }

    const target = this.players.get(this.network.myId);
    if (!target || target.eliminated) return;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const dx = target.x - z.x;
      const dy = target.y - z.y;
      const d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const speed = z.speed * (1 + elapsedMin * 0.2);
      z.x += (dx / d) * speed;
      z.y += (dy / d) * speed;

      if (d < z.r + (target.radius || PLAYER_RADIUS) + 2 && now - (z.lastBiteAt || 0) > 500) {
        z.lastBiteAt = now;
        target.hp -= 8;
        if (target.hp <= 0) {
          target.hp = 0;
          target.eliminated = true;
          this._checkGameOver();
        }
      }
      if (z.hp <= 0) this.zombies.splice(i, 1);
    }
  }

  _spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x = 0; let y = 0;
    if (side === 0) { x = Math.random() * this.W; y = -30; }
    if (side === 1) { x = this.W + 30; y = Math.random() * this.H; }
    if (side === 2) { x = Math.random() * this.W; y = this.H + 30; }
    if (side === 3) { x = -30; y = Math.random() * this.H; }
    const runnerBias = Math.min(0.75, 0.55 + this._zombieWave * 0.03);
    const isRunner = Math.random() < runnerBias;
    const archetype = isRunner ? 'runner' : 'tank';
    const stats = isRunner
      ? { r: 10 + Math.random() * 2, hp: 28 + this._zombieWave * 2, speed: 1.1 + Math.random() * 0.45, color: '#4dd0e1' }
      : { r: 16 + Math.random() * 3, hp: 95 + this._zombieWave * 7, speed: 0.42 + Math.random() * 0.2, color: '#ff8a65' };
    this.zombies.push({
      id: `z-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x, y,
      r: stats.r,
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      color: stats.color,
      archetype,
      lastBiteAt: 0,
    });
  }

  _checkWaveMilestone() {
    if (!this.zombieMode || !this.isHub) return;
    if (this._zombiesDefeated < this._nextWaveAtKills) return;
    this._zombieWave++;
    this._nextWaveAtKills += 8 + this._zombieWave * 2;
    this._zombiesPerMin += 2.5;
    this._setStatus(`Wave ${this._zombieWave}! Reward drop incoming`);
    this._dropWaveRewards();
  }

  _dropWaveRewards() {
    const rewardTypes = ['heal', 'medkit', 'armor', 'shield', 'haste', 'overcharge', 'magnet', 'regen', 'rapid', 'spread', 'sniper'];
    const dropCount = Math.min(5, 2 + Math.floor(this._zombieWave / 2));
    const my = this.players.get(this.network.myId);
    const cx = my ? my.x : this.W / 2;
    const cy = my ? my.y : this.H / 2;
    for (let i = 0; i < dropCount; i++) {
      const t = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
      if (!ITEM_TYPES[t]) continue;
      const angle = (Math.PI * 2 * i) / dropCount;
      const radius = 56 + Math.random() * 36;
      this.items.push({
        id: `it-wave-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        type: t,
        x: clamp(cx + Math.cos(angle) * radius, 30, this.W - 30),
        y: clamp(cy + Math.sin(angle) * radius, 30, this.H - 30),
        ttl: 900,
      });
    }
  }

  _setStatus(text) {
    this._statusText = text;
    this._statusTextUntil = Date.now() + 1800;
  }

  _checkGameOver() {
    if (this.zombieMode) {
      const me = this.players.get(this.network.myId);
      if (me && !me.eliminated) return;
      this.network.broadcastArenaEnd({
        gameId: this.gameId,
        winner: null,
        zombieMode: true,
        durationMs: Date.now() - this._zombieStartAt,
        zombiesDefeated: (this._zombiesDefeated || 0),
        zombieWave: this._zombieWave,
      });
      return;
    }
    const alivePlayers = [];
    for (const [id, p] of this.players) {
      if (!p.eliminated) {
        alivePlayers.push({
          id,
          username: p.username,
          color: p.color,
          character: p.character,
          characterLabel: p.characterLabel,
        });
      }
    }

    if (alivePlayers.length <= 1) {
      this.network.broadcastArenaEnd({
        gameId: this.gameId,
        winner: alivePlayers[0] || null,
        standings: Array.from(this.players.entries()).map(([id, p]) => ({
          id,
          username: p.username,
          color: p.color,
          hp: p.hp,
          maxHp: p.maxHp,
          armor: p.armor,
          maxArmor: p.maxArmor,
          character: p.character,
          weapon: p.weapon,
          eliminated: p.eliminated,
        })),
      });
    }
  }

  _handleEnd(results) {
    if (results?.gameId !== this.gameId) return;
    this._leaveSent = true;
    this.running = false;

    // Draw final frame
    this._draw();

    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    if (results.zombieMode) {
      const sec = Math.round((results.durationMs || 0) / 1000);
      ctx.fillText(`Survived ${sec}s`, this.W / 2, this.H / 2 - 20);
      ctx.font = '18px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`Wave ${results.zombieWave || this._zombieWave} · ${results.zombiesDefeated || 0} zombies defeated`, this.W / 2, this.H / 2 + 8);
    } else if (results.winner) {
      ctx.fillText(`${results.winner.username} Wins!`, this.W / 2, this.H / 2 - 20);
    } else {
      ctx.fillText('Draw!', this.W / 2, this.H / 2 - 20);
    }
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Click or press any key to close', this.W / 2, this.H / 2 + 20);

    const close = () => this.stop();
    this.el.addEventListener('click', close, { once: true });
    document.addEventListener('keydown', close, { once: true });
  }

  // ---------- Drawing ----------

  _draw() { drawArena(this); }

  _updateScoreboard() { updateArenaScoreboard(this); }

  _updateHud() { updateArenaHud(this); }

  // ---------- Cleanup ----------

  stop() {
    if (this.running && this.isHub && this.gameId && this.network.broadcastArenaEnd) {
      this.network.broadcastArenaEnd({
        gameId: this.gameId,
        winner: null,
        cancelled: true,
        reason: 'hub-left',
      });
    } else if (this.running && !this.isHub && !this._leaveSent && this.gameId && this.network.sendArenaLeave) {
      this._leaveSent = true;
      this.network.sendArenaLeave(this.gameId);
    }
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this._stateBroadcastInterval) {
      clearInterval(this._stateBroadcastInterval);
      this._stateBroadcastInterval = null;
    }
    if (this._inputSendInterval) {
      clearInterval(this._inputSendInterval);
      this._inputSendInterval = null;
    }
    if (this._shootTouchInterval) {
      clearInterval(this._shootTouchInterval);
      this._shootTouchInterval = null;
    }
    this._unbindEvents();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.players.clear();
    this.bullets = [];
    this.items = [];
    this.zombies = [];
    this._hitFlashes = [];
    this._sparks = [];
    if (this._onStopCb) this._onStopCb();
  }
}
