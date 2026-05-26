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

// ---------- Constants ----------
const PLAYER_RADIUS = 14;
const DIRECTION_LINE_LEN = 22;
const BASE_SPEED = 3;
const BOOST_SPEED = 5;
const BULLET_SPEED = 8;
const BULLET_LENGTH = 8;
const SHOOT_COOLDOWN = 300; // ms
const BULLET_COUNT = 5; // bullets per burst
const BULLET_SPREAD = 0.15; // radians spread
const WALL_COUNT = 18;
const WALL_MIN_LEN = 40;
const WALL_MAX_LEN = 140;
const HIT_RADIUS = PLAYER_RADIUS + 4;
const SEND_RATE = 50; // ms between state broadcasts (hub)
const INPUT_SEND_RATE = 33; // ms between input sends (client)

// ---------- Helpers ----------
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

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

// Line-segment / line-segment intersection
function lineLineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------- Wall generation ----------
function generateWalls(W, H, seed) {
  const rng = seededRandom(seed);
  const walls = [];
  const margin = 60;
  for (let i = 0; i < WALL_COUNT; i++) {
    const cx = margin + rng() * (W - margin * 2);
    const cy = margin + rng() * (H - margin * 2);
    const angle = rng() * Math.PI;
    const len = WALL_MIN_LEN + rng() * (WALL_MAX_LEN - WALL_MIN_LEN);
    const halfLen = len / 2;
    walls.push({
      x1: cx - Math.cos(angle) * halfLen,
      y1: cy - Math.sin(angle) * halfLen,
      x2: cx + Math.cos(angle) * halfLen,
      y2: cy + Math.sin(angle) * halfLen,
    });
  }
  return walls;
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
    this.players = new Map(); // peerId -> { x, y, angle, color, username, hitCount, eliminated }
    this.walls = [];
    this.bullets = []; // { x, y, vx, vy, from, color, life }
    this.seed = 0;
    this.gameId = null;

    // Local input state
    this.keysDown = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastShootTime = 0;

    // Hub authoritative state
    this._stateBroadcastInterval = null;
    this._inputSendInterval = null;

    // Event handlers
    this._onArenaState = null;
    this._onArenaInput = null;
    this._onArenaShoot = null;
    this._onArenaHit = null;
    this._onArenaEnd = null;
    this._keyDownHandler = null;
    this._keyUpHandler = null;
    this._mouseMoveHandler = null;
    this._resizeHandler = null;
  }

  /**
   * Start the game (hub calls this to begin)
   */
  start(gameConfig) {
    this.gameId = gameConfig.gameId;
    this.seed = gameConfig.seed;

    this._render();
    this._resize();

    // Generate walls from seed
    this.walls = generateWalls(this.W, this.H, this.seed);

    // Build full user list (visitors don't include themselves in getUserList)
    const userList = this.network.getUserList();
    const myUser = this.network.myUser;
    if (myUser && !userList.find(u => u.id === myUser.id)) {
      userList.push({
        id: myUser.id,
        username: myUser.username,
        color: myUser.color,
        isHub: myUser.isHub,
        number: myUser.number,
      });
      userList.sort((a, b) => {
        if (a.isHub && !b.isHub) return -1;
        if (!a.isHub && b.isHub) return 1;
        return (a.number || 0) - (b.number || 0);
      });
    }

    const margin = 80;
    const rng = seededRandom(this.seed + 999);
    for (const user of userList) {
      const x = margin + rng() * (this.W - margin * 2);
      const y = margin + rng() * (this.H - margin * 2);
      this.players.set(user.id, {
        x, y,
        angle: 0,
        color: user.color,
        username: user.username,
        hitCount: 0,
        eliminated: false,
      });
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

    this.network.on('arena-state', this._onArenaState);
    this.network.on('arena-input', this._onArenaInput);
    this.network.on('arena-shoot', this._onArenaShoot);
    this.network.on('arena-hit', this._onArenaHit);
    this.network.on('arena-end', this._onArenaEnd);

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

    this.el = document.createElement('div');
    this.el.className = 'rpjs-arena-overlay';
    this.el.innerHTML = `
      <canvas class="rpjs-arena-canvas" id="rpjs-arena-canvas"></canvas>
      <div class="rpjs-arena-hud">
        <span class="rpjs-arena-hud-title">Arena</span>
        <span id="rpjs-arena-player-count"></span>
      </div>
      <button class="rpjs-arena-exit" id="rpjs-arena-exit">Exit [Esc]</button>
      <div class="rpjs-arena-controls">WASD / HJKL to move &middot; Mouse to aim &middot; Space to shoot</div>
      <div class="rpjs-arena-scoreboard" id="rpjs-arena-scoreboard"></div>
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
    // Regenerate walls on resize
    if (this.seed) {
      this.walls = generateWalls(this.W, this.H, this.seed);
    }
  }

  // ---------- Events ----------

  _bindEvents() {
    this._keyDownHandler = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const key = e.key.toLowerCase();
      this.keysDown.add(key);

      if (key === ' ' && this.running) {
        this._shoot();
      }
      if (key === 'escape') {
        this.stop();
      }
    };
    this._keyUpHandler = (e) => {
      e.stopImmediatePropagation();
      this.keysDown.delete(e.key.toLowerCase());
    };
    this._mouseMoveHandler = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      // Update local player angle
      const me = this.players.get(this.network.myId);
      if (me) {
        me.angle = Math.atan2(this.mouseY - me.y, this.mouseX - me.x);
      }
    };
    this._resizeHandler = () => this._resize();

    document.addEventListener('keydown', this._keyDownHandler, true);
    document.addEventListener('keyup', this._keyUpHandler, true);
    this.el.addEventListener('mousemove', this._mouseMoveHandler);
    window.addEventListener('resize', this._resizeHandler);

    this.el.querySelector('#rpjs-arena-exit').addEventListener('click', () => {
      this.stop();
    });
  }

  _unbindEvents() {
    document.removeEventListener('keydown', this._keyDownHandler, true);
    document.removeEventListener('keyup', this._keyUpHandler, true);
    if (this.el) this.el.removeEventListener('mousemove', this._mouseMoveHandler);
    window.removeEventListener('resize', this._resizeHandler);

    if (this._onArenaState) this.network.off('arena-state', this._onArenaState);
    if (this._onArenaInput) this.network.off('arena-input', this._onArenaInput);
    if (this._onArenaShoot) this.network.off('arena-shoot', this._onArenaShoot);
    if (this._onArenaHit) this.network.off('arena-hit', this._onArenaHit);
    if (this._onArenaEnd) this.network.off('arena-end', this._onArenaEnd);
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

    if (dx === 0 && dy === 0) return;

    const speed = me.hitCount > 0 ? BOOST_SPEED : BASE_SPEED;
    const len = Math.sqrt(dx * dx + dy * dy);
    dx = (dx / len) * speed;
    dy = (dy / len) * speed;

    me.x = clamp(me.x + dx, PLAYER_RADIUS, this.W - PLAYER_RADIUS);
    me.y = clamp(me.y + dy, PLAYER_RADIUS, this.H - PLAYER_RADIUS);
    // Push out of walls
    this._resolveWalls(me);

    // Send to hub
    this.network.sendArenaInput({
      x: me.x,
      y: me.y,
      angle: me.angle,
    });
  }

  _shoot() {
    const me = this.players.get(this.network.myId);
    if (!me || me.eliminated) return;

    const now = Date.now();
    if (now - this.lastShootTime < SHOOT_COOLDOWN) return;
    this.lastShootTime = now;

    const shootData = {
      x: me.x,
      y: me.y,
      angle: me.angle,
      color: me.color,
    };

    // Create bullets locally
    this._createBullets(this.network.myId, shootData);

    // Send to hub/peers
    this.network.sendArenaShoot(shootData);
  }

  _createBullets(fromId, data) {
    for (let i = 0; i < BULLET_COUNT; i++) {
      const spreadAngle = data.angle + (i - (BULLET_COUNT - 1) / 2) * BULLET_SPREAD;
      this.bullets.push({
        x: data.x + Math.cos(data.angle) * (PLAYER_RADIUS + 4),
        y: data.y + Math.sin(data.angle) * (PLAYER_RADIUS + 4),
        vx: Math.cos(spreadAngle) * BULLET_SPEED,
        vy: Math.sin(spreadAngle) * BULLET_SPEED,
        from: fromId,
        color: data.color,
        life: 120, // frames
      });
    }
  }

  _resolveWalls(player) {
    for (const w of this.walls) {
      if (lineCircleIntersect(w.x1, w.y1, w.x2, w.y2, player.x, player.y, PLAYER_RADIUS)) {
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
        if (d < PLAYER_RADIUS && d > 0.01) {
          const push = PLAYER_RADIUS - d + 1;
          player.x += (px / d) * push;
          player.y += (py / d) * push;
        }
      }
    }
  }

  // ---------- Hub authoritative simulation ----------

  _handleRemoteInput(input) {
    if (!this.isHub) return;
    const player = this.players.get(input.from);
    if (!player || player.eliminated) return;
    player.x = clamp(input.x, PLAYER_RADIUS, this.W - PLAYER_RADIUS);
    player.y = clamp(input.y, PLAYER_RADIUS, this.H - PLAYER_RADIUS);
    player.angle = input.angle;
    this._resolveWalls(player);
  }

  _handleRemoteShoot(shoot) {
    if (!this.isHub) return;
    this._createBullets(shoot.from, shoot);
  }

  _handleRemoteHit(hit) {
    // Apply hit from authoritative state
    const player = this.players.get(hit.targetId);
    if (player) {
      player.hitCount = hit.hitCount;
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
        hitCount: p.hitCount,
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
    }));

    this.network.broadcastArenaState({
      gameId: this.gameId,
      players: playerStates,
      bullets: bulletStates,
    });
  }

  // ---------- Client state sync ----------

  _handleStateUpdate(state) {
    if (this.isHub) return;

    for (const [id, ps] of Object.entries(state.players || {})) {
      let player = this.players.get(id);
      if (!player) {
        player = { x: ps.x, y: ps.y, angle: ps.angle, color: '#4fc3f7', username: '?', hitCount: 0, eliminated: false };
        this.players.set(id, player);
      }
      if (id !== this.network.myId) {
        player.x = ps.x;
        player.y = ps.y;
        player.angle = ps.angle;
      }
      player.hitCount = ps.hitCount;
      player.eliminated = ps.eliminated;
    }

    // Replace bullets with server state (authoritative)
    this.bullets = (state.bullets || []).map(b => ({ ...b }));
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

      if (dx !== 0 || dy !== 0) {
        const speed = me.hitCount > 0 ? BOOST_SPEED : BASE_SPEED;
        const len = Math.sqrt(dx * dx + dy * dy);
        me.x = clamp(me.x + (dx / len) * speed, PLAYER_RADIUS, this.W - PLAYER_RADIUS);
        me.y = clamp(me.y + (dy / len) * speed, PLAYER_RADIUS, this.H - PLAYER_RADIUS);
        this._resolveWalls(me);
      }
      me.angle = Math.atan2(this.mouseY - me.y, this.mouseX - me.x);
    }

    // Update bullets
    this._updateBullets();

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
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      // Check if out of bounds
      if (b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20 || b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check wall collision
      let hitWall = false;
      for (const w of this.walls) {
        if (lineLineIntersect(b.x - b.vx, b.y - b.vy, b.x, b.y, w.x1, w.y1, w.x2, w.y2)) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        // Spawn impact spark
        this._sparks.push({ x: b.x, y: b.y, life: 6, color: b.color });
        this.bullets.splice(i, 1);
      }
    }
  }

  _checkBulletCollisions() {
    if (!this.isHub) return;

    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];

      for (const [pid, player] of this.players) {
        if (pid === b.from) continue; // Don't hit yourself
        if (player.eliminated) continue;

        const d = dist(b.x, b.y, player.x, player.y);
        if (d < HIT_RADIUS) {
          // Hit!
          player.hitCount++;
          if (player.hitCount >= 2) {
            player.eliminated = true;
          }

          const hitData = {
            targetId: pid,
            hitCount: player.hitCount,
            eliminated: player.eliminated,
            x: player.x,
            y: player.y,
            color: player.color,
          };

          // Broadcast hit to all
          this.network.broadcastArenaHit(hitData);

          // Apply locally too
          this._hitFlashes.push({ x: player.x, y: player.y, time: 15, color: '#fff' });
          this._sparks.push({ x: b.x, y: b.y, life: 8, color: b.color });

          // Remove bullet
          this.bullets.splice(bi, 1);

          // Check game over
          this._checkGameOver();
          break;
        }
      }
    }
  }

  _hitFlashes = [];
  _sparks = [];

  _checkGameOver() {
    const alivePlayers = [];
    for (const [id, p] of this.players) {
      if (!p.eliminated) alivePlayers.push({ id, username: p.username, color: p.color });
    }

    if (alivePlayers.length <= 1) {
      this.network.broadcastArenaEnd({
        gameId: this.gameId,
        winner: alivePlayers[0] || null,
        standings: Array.from(this.players.entries()).map(([id, p]) => ({
          id,
          username: p.username,
          color: p.color,
          hitCount: p.hitCount,
          eliminated: p.eliminated,
        })),
      });
    }
  }

  _handleEnd(results) {
    this.running = false;

    // Draw final frame
    this._draw();

    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    if (results.winner) {
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

  _draw() {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.W, this.H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < this.W; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.H);
      ctx.stroke();
    }
    for (let y = 0; y < this.H; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }

    // Draw walls
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
    // Wall glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 8;
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    // Draw bullets
    for (const b of this.bullets) {
      const tailX = b.x - (b.vx / BULLET_SPEED) * BULLET_LENGTH;
      const tailY = b.y - (b.vy / BULLET_SPEED) * BULLET_LENGTH;

      ctx.strokeStyle = b.color || 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Bullet glow
      ctx.strokeStyle = (b.color || 'rgba(255,255,255,0.8)').replace(')', ',0.3)').replace('rgb', 'rgba');
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw sparks
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      ctx.fillStyle = `rgba(255, 200, 50, ${s.life / 8})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3 * (s.life / 8), 0, Math.PI * 2);
      ctx.fill();
      s.life--;
      if (s.life <= 0) this._sparks.splice(i, 1);
    }

    // Draw hit flashes
    for (let i = this._hitFlashes.length - 1; i >= 0; i--) {
      const f = this._hitFlashes[i];
      ctx.fillStyle = `rgba(255, 255, 255, ${f.time / 15 * 0.4})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, PLAYER_RADIUS * 2 * (1 - f.time / 15) + PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      f.time--;
      if (f.time <= 0) this._hitFlashes.splice(i, 1);
    }

    // Draw players
    const myId = this.network.myId;
    for (const [pid, p] of this.players) {
      const isMe = pid === myId;
      const alpha = p.eliminated ? 0.2 : 1;

      // Player circle
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.eliminated) {
        // Ghost marker
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        // X through it
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 6);
        ctx.lineTo(p.x + 6, p.y + 6);
        ctx.moveTo(p.x + 6, p.y - 6);
        ctx.lineTo(p.x - 6, p.y + 6);
        ctx.stroke();
      } else {
        if (p.hitCount > 0) {
          // Half-filled circle: filled on one side
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, PLAYER_RADIUS, -Math.PI / 2, Math.PI / 2);
          ctx.fill();
          // Unfilled half
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, PLAYER_RADIUS, Math.PI / 2, -Math.PI / 2);
          ctx.stroke();
        } else {
          // Full circle
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }

        // Player outline
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        // Direction line (only visible for yourself)
        if (isMe) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(
            p.x + Math.cos(p.angle) * PLAYER_RADIUS,
            p.y + Math.sin(p.angle) * PLAYER_RADIUS
          );
          ctx.lineTo(
            p.x + Math.cos(p.angle) * (PLAYER_RADIUS + DIRECTION_LINE_LEN),
            p.y + Math.sin(p.angle) * (PLAYER_RADIUS + DIRECTION_LINE_LEN)
          );
          ctx.stroke();
        }

        // Player name
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.username, p.x, p.y + PLAYER_RADIUS + 14);
      }

      ctx.restore();
    }

    // Crosshair for local player
    const me = this.players.get(myId);
    if (me && !me.eliminated) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.mouseX, this.mouseY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.mouseX - 12, this.mouseY);
      ctx.lineTo(this.mouseX + 12, this.mouseY);
      ctx.moveTo(this.mouseX, this.mouseY - 12);
      ctx.lineTo(this.mouseX, this.mouseY + 12);
      ctx.stroke();
    }
  }

  _updateScoreboard() {
    const sb = this.el?.querySelector('#rpjs-arena-scoreboard');
    if (!sb) return;

    const myId = this.network.myId;
    let html = '<div style="font-weight:600;margin-bottom:4px;color:rgba(255,255,255,0.9)">Players</div>';
    const sortedPlayers = Array.from(this.players.entries()).sort((a, b) => {
      if (a[1].eliminated && !b[1].eliminated) return 1;
      if (!a[1].eliminated && b[1].eliminated) return -1;
      return a[1].hitCount - b[1].hitCount;
    });

    for (const [id, p] of sortedPlayers) {
      const isMe = id === myId;
      const hpClass = p.eliminated ? 'hit' : p.hitCount > 0 ? 'hit' : 'alive';
      const status = p.eliminated ? 'OUT' : p.hitCount > 0 ? 'HURT' : 'OK';
      html += `<div class="rpjs-arena-scoreboard-row">
        <span class="rpjs-arena-scoreboard-name">
          <span style="width:6px;height:6px;border-radius:50%;background:${p.color};display:inline-block"></span>
          <span style="${isMe ? 'font-weight:600' : ''}">${p.username}</span>
        </span>
        <span class="rpjs-arena-scoreboard-hp ${hpClass}">${status}</span>
      </div>`;
    }

    sb.innerHTML = html;
  }

  // ---------- Cleanup ----------

  stop() {
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
    this._unbindEvents();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.players.clear();
    this.bullets = [];
    this._hitFlashes = [];
    this._sparks = [];
    if (this._onStopCb) this._onStopCb();
  }
}
