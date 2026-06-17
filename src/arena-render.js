import { PLAYER_RADIUS, DIRECTION_LINE_LEN, BASE_HP, MAX_ARMOR, ITEM_TYPES, ITEM_RADIUS } from './arena-rules.js';
import { clamp, bulletTail } from './arena-sim.js';

export function drawArena(game) {
  const { ctx, W, H } = game;
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const w of game.walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 8;
  for (const w of game.walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }

  for (const b of game.bullets) {
    const { tailX, tailY } = bulletTail(b);
    ctx.strokeStyle = b.color || 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = (b.color || 'rgba(255,255,255,0.8)').replace(')', ',0.3)').replace('rgb', 'rgba');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  drawParticles(game);
  drawPlayers(game);
  drawZombies(game);
  drawCrosshair(game);
  drawItems(game);
  drawStatus(game);
}

function drawParticles(game) {
  const { ctx } = game;
  for (let i = game._sparks.length - 1; i >= 0; i--) {
    const s = game._sparks[i];
    ctx.fillStyle = `rgba(255, 200, 50, ${s.life / 8})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3 * (s.life / 8), 0, Math.PI * 2);
    ctx.fill();
    s.life--;
    if (s.life <= 0) game._sparks.splice(i, 1);
  }

  for (let i = game._hitFlashes.length - 1; i >= 0; i--) {
    const f = game._hitFlashes[i];
    ctx.fillStyle = `rgba(255, 255, 255, ${f.time / 15 * 0.4})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, PLAYER_RADIUS * 2 * (1 - f.time / 15) + PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    f.time--;
    if (f.time <= 0) game._hitFlashes.splice(i, 1);
  }
}

function drawPlayers(game) {
  const { ctx } = game;
  const myId = game.network.myId;
  for (const [pid, p] of game.players) {
    const isMe = pid === myId;
    const alpha = p.eliminated ? 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.eliminated) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6);
      ctx.lineTo(p.x + 6, p.y + 6);
      ctx.moveTo(p.x + 6, p.y - 6);
      ctx.lineTo(p.x - 6, p.y + 6);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    if (isMe) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * PLAYER_RADIUS, p.y + Math.sin(p.angle) * PLAYER_RADIUS);
      ctx.lineTo(p.x + Math.cos(p.angle) * (PLAYER_RADIUS + DIRECTION_LINE_LEN), p.y + Math.sin(p.angle) * (PLAYER_RADIUS + DIRECTION_LINE_LEN));
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.username, p.x, p.y + PLAYER_RADIUS + 14);

    const hpPct = clamp((p.hp || 0) / BASE_HP, 0, 1);
    ctx.strokeStyle = hpPct > 0.5 ? '#66bb6a' : hpPct > 0.25 ? '#ffa726' : '#ef5350';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
    ctx.stroke();

    if (p.armor > 0) {
      const arPct = clamp((p.armor || 0) / MAX_ARMOR, 0, 1);
      ctx.strokeStyle = 'rgba(66,165,245,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * arPct);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawZombies(game) {
  const { ctx } = game;
  for (const z of game.zombies || []) {
    ctx.fillStyle = z.color;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.stroke();
    const hpPct = clamp(z.hp / z.maxHp, 0, 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(z.x - 10, z.y - z.r - 7);
    ctx.lineTo(z.x - 10 + 20 * hpPct, z.y - z.r - 7);
    ctx.stroke();
  }
}

function drawCrosshair(game) {
  const { ctx } = game;
  const me = game.players.get(game.network.myId);
  if (!me || me.eliminated) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(game.mouseX, game.mouseY, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(game.mouseX - 12, game.mouseY);
  ctx.lineTo(game.mouseX + 12, game.mouseY);
  ctx.moveTo(game.mouseX, game.mouseY - 12);
  ctx.lineTo(game.mouseX, game.mouseY + 12);
  ctx.stroke();
}

function drawItems(game) {
  const { ctx } = game;
  for (const item of game.items) {
    const meta = ITEM_TYPES[item.type];
    if (!meta) continue;
    const pulse = 1 + Math.sin(Date.now() / 120) * 0.1;
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(item.x, item.y, ITEM_RADIUS * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(item.x, item.y, ITEM_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(meta.label[0], item.x, item.y + 3);
  }
}

function drawStatus(game) {
  if (Date.now() >= game._statusTextUntil || !game._statusText) return;
  const { ctx, W } = game;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W / 2 - 170, 46, 340, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillText(game._statusText, W / 2, 63);
}

export function updateArenaScoreboard(game) {
  const sb = game.el?.querySelector('#rpjs-arena-scoreboard');
  if (!sb) return;
  const myId = game.network.myId;
  let html = '<div style="font-weight:600;margin-bottom:4px;color:rgba(255,255,255,0.9)">Players</div>';
  const sortedPlayers = Array.from(game.players.entries()).sort((a, b) => {
    if (a[1].eliminated && !b[1].eliminated) return 1;
    if (!a[1].eliminated && b[1].eliminated) return -1;
    return (b[1].hp + b[1].armor) - (a[1].hp + a[1].armor);
  });
  for (const [id, p] of sortedPlayers) {
    const isMe = id === myId;
    const hpClass = p.eliminated ? 'hit' : p.hp < 45 ? 'hit' : 'alive';
    const status = p.eliminated ? 'OUT' : `HP ${Math.max(0, Math.round(p.hp))}`;
    html += `<div class="rpjs-arena-scoreboard-row">
      <span class="rpjs-arena-scoreboard-name">
        <span style="width:6px;height:6px;border-radius:50%;background:${p.color};display:inline-block"></span>
        <span style="${isMe ? 'font-weight:600' : ''}">${p.username}</span>
      </span>
      <span class="rpjs-arena-scoreboard-hp ${hpClass}" title="Armor ${Math.round(p.armor || 0)} | Weapon ${p.weapon || 'blaster'}">${status}</span>
    </div>`;
  }
  if (game.zombieMode) {
    html += `<div class="rpjs-arena-scoreboard-row"><span>Zombies</span><span>${game.zombies.length}</span></div>`;
    html += `<div class="rpjs-arena-scoreboard-row"><span>Wave</span><span>${game._zombieWave || 1}</span></div>`;
    html += `<div class="rpjs-arena-scoreboard-row"><span>Defeated</span><span>${game._zombiesDefeated || 0}</span></div>`;
  }
  sb.innerHTML = html;
}

export function updateArenaHud(game) {
  const hudCount = game.el?.querySelector('#rpjs-arena-player-count');
  if (!hudCount) return;
  const alive = Array.from(game.players.values()).filter(p => !p.eliminated).length;
  const me = game.players.get(game.network.myId);
  const hp = me ? Math.round(me.hp || 0) : 0;
  const armor = me ? Math.round(me.armor || 0) : 0;
  const weapon = me ? (me.weapon || 'blaster').toUpperCase() : 'BLASTER';
  const mode = game.zombieMode ? ` · W${game._zombieWave || 1} · ZM ${Math.round(game._zombiesPerMin)}/min` : '';
  hudCount.textContent = `Alive ${alive}/${game.players.size} · HP ${hp} · AR ${armor} · ${weapon}${mode}`;
}
