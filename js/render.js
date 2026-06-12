// Renderização: tiles com variação procedural, entidades geométricas, efeitos e marcadores.
import { G, TILE, TAU, clamp, dist } from './state.js';
import { MAPW, MAPH, T, tiles, PEDESTAL } from './map.js';
import { objectiveTarget } from './quests.js';

const VW = 960, VH = 540;

// paleta base por tile + 5 tons de variação pré-computados
const BASE = {
  [T.GRASS]: [74, 93, 54], [T.DIRT]: [107, 84, 54], [T.CONCRETE]: [115, 115, 107],
  [T.WALL]: [58, 58, 56], [T.TREE]: [66, 82, 47], [T.WATER]: [47, 79, 92],
  [T.FLOOR]: [133, 125, 108], [T.RUBBLE]: [94, 92, 82], [T.PALISADE]: [110, 79, 44],
};
const COLORS = {};
for (const t in BASE) {
  COLORS[t] = [];
  for (let s = 0; s < 5; s++) {
    const d = (s - 2) * 6;
    const [r, g, b] = BASE[t];
    COLORS[t].push(`rgb(${clamp(r + d, 0, 255)},${clamp(g + d, 0, 255)},${clamp(b + d, 0, 255)})`);
  }
}
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);

export function draw(ctx) {
  const cam = G.camera, p = G.player;
  ctx.clearRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  drawTiles(ctx, cam);
  drawPedestal(ctx);
  drawContainers(ctx);
  drawPickups(ctx);
  drawProjectiles(ctx);

  // entidades + jogador ordenados por Y (profundidade)
  const list = G.entities.filter(e => onScreen(e.x, e.y, cam, 60));
  list.push({ isPlayer: true, y: p.y });
  list.sort((a, b) => a.y - b.y);
  for (const e of list) e.isPlayer ? drawPlayer(ctx, p) : drawEntity(ctx, e);

  drawEffects(ctx);
  drawHint(ctx);
  ctx.restore();

  drawMarker(ctx, cam);
  // vinheta de dano
  if (p.hurtT > 0) {
    ctx.fillStyle = `rgba(200,30,20,${p.hurtT * 0.5})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  // pulso de alerta
  if (G.alert > 0) {
    const a = 0.12 + 0.1 * Math.sin(G.time * 5);
    ctx.strokeStyle = `rgba(255,80,50,${a})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, VW - 6, VH - 6);
    ctx.lineWidth = 1;
  }
}

function onScreen(x, y, cam, pad = 40) {
  return x > cam.x - pad && x < cam.x + VW + pad && y > cam.y - pad && y < cam.y + VH + pad;
}

function drawTiles(ctx, cam) {
  const x0 = Math.max(0, cam.x / TILE | 0), y0 = Math.max(0, cam.y / TILE | 0);
  const x1 = Math.min(MAPW - 1, (cam.x + VW) / TILE + 1 | 0), y1 = Math.min(MAPH - 1, (cam.y + VH) / TILE + 1 | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[y * MAPW + x], h = hash(x, y);
      const px = x * TILE, py = y * TILE;
      const ground = t === T.TREE ? T.GRASS : t;
      ctx.fillStyle = COLORS[ground][h % 5];
      ctx.fillRect(px, py, TILE, TILE);
      switch (t) {
        case T.TREE: {
          ctx.fillStyle = '#4a3520';
          ctx.fillRect(px + 13, py + 16, 6, 12);
          ctx.fillStyle = h % 3 ? '#2e4426' : '#35502b';
          ctx.beginPath();
          ctx.arc(px + 16 + (h % 5) - 2, py + 12, 13, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.06)';
          ctx.beginPath(); ctx.arc(px + 12, py + 8, 5, 0, TAU); ctx.fill();
          break;
        }
        case T.WALL:
          ctx.fillStyle = '#4a4a46';
          ctx.fillRect(px, py, TILE, 7);
          if (h % 4 === 0) { ctx.fillStyle = '#2e2e2c'; ctx.fillRect(px + (h % 20), py + 12, 6, 2); }
          break;
        case T.PALISADE:
          ctx.fillStyle = '#5b3f22';
          for (let i = 4; i < TILE; i += 8) ctx.fillRect(px + i, py, 3, TILE);
          ctx.fillStyle = '#7d5a32';
          ctx.fillRect(px, py + 2, TILE, 3);
          break;
        case T.WATER:
          ctx.fillStyle = 'rgba(255,255,255,.10)';
          ctx.fillRect(px + (h % 16), py + (h % 24), 8, 2);
          break;
        case T.RUBBLE:
          ctx.fillStyle = '#45443c';
          ctx.fillRect(px + (h % 18), py + ((h >> 3) % 18), 7, 5);
          ctx.fillRect(px + ((h >> 5) % 20), py + ((h >> 7) % 22), 4, 4);
          break;
        case T.CONCRETE:
          if (h % 6 === 0) { ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(px + (h % 22), py + 14, 10, 2); }
          break;
        case T.FLOOR:
          if (h % 7 === 0) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(px + 4, py + (h % 22), 12, 2); }
          break;
      }
    }
  }
}

function drawPedestal(ctx) {
  const { x, y } = PEDESTAL;
  ctx.fillStyle = '#55534b';
  ctx.fillRect(x - 12, y - 8, 24, 18);
  ctx.fillStyle = '#6a685e';
  ctx.fillRect(x - 9, y - 12, 18, 6);
  if (!G.flags.artifactTaken) {
    const g = 0.6 + 0.4 * Math.sin(G.time * 3);
    ctx.save();
    ctx.translate(x, y - 22);
    ctx.rotate(G.time);
    ctx.fillStyle = `rgba(110,227,255,${g})`;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.fillStyle = `rgba(110,227,255,${g * 0.18})`;
    ctx.beginPath(); ctx.arc(x, y - 22, 26, 0, TAU); ctx.fill();
  }
}

function drawContainers(ctx) {
  for (const c of G.containers) {
    ctx.fillStyle = c.opened ? '#4f3c22' : (c.big ? '#8a6a30' : '#7a5a30');
    ctx.fillRect(c.x - 10, c.y - 8, 20, 15);
    ctx.fillStyle = c.opened ? '#3a2c18' : '#5c4322';
    ctx.fillRect(c.x - 10, c.y - 8, 20, 4);
    if (!c.opened && c.big) {
      ctx.fillStyle = '#ffe98a';
      ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
    }
  }
}

function drawPickups(ctx) {
  for (const pk of G.pickups) {
    ctx.fillStyle = '#9a9a90';
    ctx.fillRect(pk.x - 4, pk.y - 4, 8, 8);
    if (pk.ammo) { ctx.fillStyle = '#e8d35f'; ctx.fillRect(pk.x + 2, pk.y - 6, 5, 8); }
    if (pk.medkits) {
      ctx.fillStyle = '#ddd'; ctx.fillRect(pk.x - 9, pk.y - 8, 9, 9);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(pk.x - 6, pk.y - 6, 3, 5); ctx.fillRect(pk.x - 7.5, pk.y - 4.5, 6, 2);
    }
  }
}

function drawProjectiles(ctx) {
  for (const pr of G.projectiles) {
    if (pr.kind === 'bullet') {
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pr.x - Math.cos(pr.dir) * 9, pr.y - Math.sin(pr.dir) * 9);
      ctx.lineTo(pr.x + Math.cos(pr.dir) * 9, pr.y + Math.sin(pr.dir) * 9);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}

function shadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r, r * 0.45, 0, 0, TAU); ctx.fill();
}

function drawApeBody(ctx, e, bodyColor, bandColor) {
  const r = e.r;
  shadow(ctx, e.x, e.y, r);
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
  // braços
  ctx.strokeStyle = bodyColor; ctx.lineWidth = 4;
  const a = e.dir + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
  ctx.lineTo(e.x - Math.cos(a) * r, e.y - Math.sin(a) * r);
  ctx.stroke(); ctx.lineWidth = 1;
  // cabeça + face
  const hx = e.x + Math.cos(e.dir) * r * 0.4, hy = e.y + Math.sin(e.dir) * r * 0.4 - 3;
  ctx.fillStyle = shade(bodyColor, -18);
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b08968';
  ctx.beginPath(); ctx.arc(hx + Math.cos(e.dir) * 3, hy + Math.sin(e.dir) * 3, r * 0.34, 0, TAU); ctx.fill();
  if (bandColor) {
    ctx.strokeStyle = bandColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, r * 0.62, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.lineWidth = 1;
  }
  if (e.aggro) {
    ctx.fillStyle = '#ff5040';
    ctx.fillRect(hx - 3, hy - r * 0.5 - 6, 6, 2);
  }
}

function drawHumanBody(ctx, e, shirt) {
  const r = e.r;
  shadow(ctx, e.x, e.y, r);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.92, 0, TAU); ctx.fill();
  const hx = e.x + Math.cos(e.dir) * 2, hy = e.y + Math.sin(e.dir) * 2 - 4;
  ctx.fillStyle = '#c9a07a';
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a3026';
  ctx.beginPath(); ctx.arc(hx, hy - 2, r * 0.42, Math.PI, TAU); ctx.fill();
}

function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + d, 0, 255), g = clamp(((n >> 8) & 255) + d, 0, 255), b = clamp((n & 255) + d, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawEntity(ctx, e) {
  if (e.dead) {
    ctx.fillStyle = 'rgba(30,24,18,.7)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 3, e.r * 0.55, 0, 0, TAU); ctx.fill();
    return;
  }
  if (e.kind === 'human') {
    drawHumanBody(ctx, e, e.dialog ? '#7a3b2f' : e.name === 'Sentinela' ? '#39512f' : '#5a6470');
  } else {
    const band = e.faction === 'mil' ? '#c0392b' : e.faction === 'pac' ? '#7fc56f' : null;
    drawApeBody(ctx, e, e.boss ? '#2e2e33' : '#6b4a2f', band);
    if (e.faction === 'mil') { // lança
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.dir) * (e.r + 12), e.y + Math.sin(e.dir) * (e.r + 12));
      ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  // barra de vida
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#1c1c18';
    ctx.fillRect(e.x - 13, e.y - e.r - 12, 26, 4);
    ctx.fillStyle = '#c75b4a';
    ctx.fillRect(e.x - 12, e.y - e.r - 11, 24 * Math.max(0, e.hp / e.maxHp), 2);
  }
  // nome de NPCs com diálogo
  if (e.dialog && dist(e.x, e.y, G.player.x, G.player.y) < 150) {
    ctx.fillStyle = '#cfe6b0';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, e.x, e.y - e.r - 16);
  }
}

function drawPlayer(ctx, p) {
  if (p.dead) return;
  drawApeBody(ctx, p, p.color || '#6b4a2f', '#e8e3d0'); // bandana clara = o exilado
  // arma equipada
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.dir);
  if (p.weapon === 'pipe') {
    ctx.strokeStyle = '#9a9a90'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.r - 3, 4); ctx.lineTo(p.r + 14, 4); ctx.stroke();
  } else {
    ctx.fillStyle = '#26261f';
    ctx.fillRect(p.r - 2, 1, 13, 5);
    ctx.fillRect(p.r + 1, 5, 4, 4);
  }
  ctx.restore();
  ctx.lineWidth = 1;
}

function drawEffects(ctx) {
  for (const f of G.effects) {
    const k = 1 - f.t / f.life;
    if (f.kind === 'text') {
      ctx.globalAlpha = k;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(f.str, f.x, f.y);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'slash') {
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 16, f.dir - 0.9, f.dir + 0.9);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (f.kind === 'flash') {
      ctx.fillStyle = `rgba(255,230,140,${k})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 7 * k + 3, 0, TAU); ctx.fill();
    } else if (f.kind === 'puff') {
      ctx.fillStyle = `rgba(180,180,170,${k * 0.6})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 5 + 8 * (1 - k), 0, TAU); ctx.fill();
    }
  }
}

function drawHint(ctx) {
  const h = G.hint;
  if (!h || G.mode !== 'play') return;
  ctx.fillStyle = '#ffe98a';
  ctx.font = '12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('[E] ' + h.label, h.x, h.y - 30);
}

function drawMarker(ctx, cam) {
  const t = objectiveTarget();
  if (!t) return;
  const sx = t.x - cam.x, sy = t.y - cam.y;
  const pulse = 0.6 + 0.4 * Math.sin(G.time * 4);
  if (sx > 20 && sx < VW - 20 && sy > 20 && sy < VH - 20) {
    ctx.fillStyle = `rgba(110,227,255,${pulse})`;
    const by = sy - 46 - 4 * Math.sin(G.time * 3);
    ctx.beginPath();
    ctx.moveTo(sx, by + 10); ctx.lineTo(sx - 6, by); ctx.lineTo(sx, by - 10); ctx.lineTo(sx + 6, by);
    ctx.closePath(); ctx.fill();
  } else {
    const cx = VW / 2, cy = VH / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(a) * (Math.min(VW, VH) / 2 - 30);
    const ey = cy + Math.sin(a) * (VH / 2 - 30);
    ctx.save();
    ctx.translate(clamp(ex, 24, VW - 24), clamp(ey, 24, VH - 24));
    ctx.rotate(a);
    ctx.fillStyle = `rgba(110,227,255,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
