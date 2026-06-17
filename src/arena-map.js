import { WALL_COUNT, WALL_MIN_LEN, WALL_MAX_LEN, PLAYER_RADIUS } from './arena-rules.js';

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lineLineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0.001) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return dist(px, py, cx, cy);
}

function buildSpawnPoints(W, H, count) {
  const cX = W / 2;
  const cY = H / 2;
  const r = Math.min(W, H) * 0.28;
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / Math.max(1, count);
    points.push({ x: cX + Math.cos(a) * r, y: cY + Math.sin(a) * r });
  }
  return points;
}

function clearRatio(walls, W, H) {
  const cellsX = 24;
  const cellsY = 14;
  let blocked = 0;
  for (let ix = 0; ix < cellsX; ix++) {
    for (let iy = 0; iy < cellsY; iy++) {
      const x = (ix + 0.5) * (W / cellsX);
      const y = (iy + 0.5) * (H / cellsY);
      const nearWall = walls.some(w => pointToSegmentDistance(x, y, w.x1, w.y1, w.x2, w.y2) < 18);
      if (nearWall) blocked++;
    }
  }
  return 1 - blocked / (cellsX * cellsY);
}

export function generatePlayableMap(W, H, seed, playerCount) {
  const rng = seededRandom(seed);
  const spawnCount = Math.max(1, Math.min(8, playerCount || 1));
  const spawns = buildSpawnPoints(W, H, spawnCount);
  const margin = 72;
  const centerSafeR = Math.min(W, H) * 0.16;
  const maxAttempts = 28;
  let bestWalls = [];
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const walls = [];
    const quadrantCounts = [0, 0, 0, 0];
    for (let i = 0; i < WALL_COUNT; i++) {
      let accepted = false;
      for (let k = 0; k < 30; k++) {
        const cx = margin + rng() * (W - margin * 2);
        const cy = margin + rng() * (H - margin * 2);
        const angle = rng() * Math.PI;
        const len = WALL_MIN_LEN + rng() * (WALL_MAX_LEN - WALL_MIN_LEN);
        const halfLen = len / 2;
        const cand = {
          x1: cx - Math.cos(angle) * halfLen,
          y1: cy - Math.sin(angle) * halfLen,
          x2: cx + Math.cos(angle) * halfLen,
          y2: cy + Math.sin(angle) * halfLen,
        };

        if (dist(cx, cy, W / 2, H / 2) < centerSafeR) continue;
        if (spawns.some(s => pointToSegmentDistance(s.x, s.y, cand.x1, cand.y1, cand.x2, cand.y2) < PLAYER_RADIUS + 34)) continue;
        if (walls.some(w => lineLineIntersect(cand.x1, cand.y1, cand.x2, cand.y2, w.x1, w.y1, w.x2, w.y2))) continue;
        if (walls.some(w => dist((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, cx, cy) < 42)) continue;

        const qi = (cx < W / 2 ? 0 : 1) + (cy < H / 2 ? 0 : 2);
        if (quadrantCounts[qi] >= Math.ceil(WALL_COUNT / 3.2)) continue;

        walls.push(cand);
        quadrantCounts[qi]++;
        accepted = true;
        break;
      }
      if (!accepted) break;
    }

    const ratio = clearRatio(walls, W, H);
    const score = walls.length * 3 + ratio * 10;
    if (score > bestScore) {
      bestWalls = walls;
      bestScore = score;
    }
    if (walls.length >= WALL_COUNT * 0.9 && ratio > 0.72) {
      return { walls, spawns };
    }
  }

  return { walls: bestWalls, spawns };
}

