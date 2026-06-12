// HUD, notificações, minimapa, inventário e telas de fim/morte.
import { G, TILE, clamp, effCAR, SPECIES } from './state.js';
import { MAPW, MAPH, T, tiles, zoneAt } from './map.js';
import { objectiveText, objectiveTarget } from './quests.js';
import { sfx } from './audio.js';

let el = {};
const mmBase = document.createElement('canvas');

export function initUI() {
  for (const id of ['hptext', 'hpfill', 'weaponLine', 'suppliesLine', 'repMil', 'repPac', 'repHum',
    'stars', 'objective', 'notif', 'zoneBanner', 'invPanel', 'invBody', 'minimap',
    'endScreen', 'endStats', 'btnContinue', 'deathScreen', 'btnRespawn'])
    el[id] = document.getElementById(id);

  el.btnContinue.addEventListener('click', () => { el.endScreen.classList.add('hidden'); G.mode = 'play'; });
  el.btnRespawn.addEventListener('click', respawn);
}

export function notify(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  el.notif.appendChild(d);
  while (el.notif.children.length > 5) el.notif.firstChild.remove();
  setTimeout(() => d.remove(), 4200);
}

const WEAPON_NAMES = { pipe: 'Cano de ferro', pistol: 'Pistola' };

function repSpan(span, v) {
  span.textContent = (v > 0 ? '+' : '') + v;
  span.style.color = v >= 20 ? '#8fd96a' : v <= -20 ? '#e06a50' : '#cfd6bd';
}

export function updateHUD() {
  const p = G.player;
  el.hptext.textContent = `VIDA ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp} · ${p.speciesName || ''}`;
  el.hpfill.style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  el.hpfill.style.background = p.hp / p.maxHp > 0.35 ? '#7fae4e' : '#c75b4a';
  el.weaponLine.textContent = 'ARMA: ' + WEAPON_NAMES[p.weapon] +
    (p.weapon === 'pistol' ? ` (${p.inv.ammo})` : '') +
    (p.weapons.includes('pistol') ? '  [1/2 troca]' : '');
  el.suppliesLine.textContent = `Medkits ${p.inv.medkits} · Munição ${p.inv.ammo} · Sucata ${p.inv.scrap}`;
  repSpan(el.repMil, G.facRep.mil);
  repSpan(el.repPac, G.facRep.pac);
  repSpan(el.repHum, G.facRep.hum);
  el.stars.innerHTML = Array.from({ length: 5 },
    (_, i) => `<span class="${i < G.alert ? 'on' : ''}">★</span>`).join('');
  el.objective.textContent = '◆ ' + objectiveText();
}

let bannerTimer = null;
export function showZone(name) {
  el.zoneBanner.textContent = name;
  el.zoneBanner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.zoneBanner.classList.remove('show'), 2600);
}

// ---------- minimapa ----------
const MM_COLORS = {
  [T.GRASS]: '#42522f', [T.DIRT]: '#5e4a2e', [T.CONCRETE]: '#6a6a63', [T.WALL]: '#2c2c2a',
  [T.TREE]: '#243520', [T.WATER]: '#27434f', [T.FLOOR]: '#7a7263', [T.RUBBLE]: '#54524a',
  [T.PALISADE]: '#5d4326',
};

export function buildMinimapBase() {
  mmBase.width = MAPW * 2; mmBase.height = MAPH * 2;
  const c = mmBase.getContext('2d');
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    c.fillStyle = MM_COLORS[tiles[y * MAPW + x]] || '#000';
    c.fillRect(x * 2, y * 2, 2, 2);
  }
}

export function drawMinimap() {
  const c = el.minimap.getContext('2d');
  c.drawImage(mmBase, 0, 0);
  const s = 2 / TILE;
  for (const e of G.entities) {
    if (e.dead) continue;
    c.fillStyle = e.dialog ? '#6fe3ff'
      : e.faction === 'mil' ? (e.aggro ? '#ff5040' : '#d08030')
      : e.faction === 'pac' ? '#7fc56f' : '#e0d090';
    c.fillRect(e.x * s - 1, e.y * s - 1, 2, 2);
  }
  const t = objectiveTarget();
  if (t && (G.time * 2 | 0) % 2 === 0) {
    c.fillStyle = '#6fe3ff';
    c.fillRect(t.x * s - 2, t.y * s - 2, 4, 4);
  }
  const p = G.player;
  c.fillStyle = '#ffffff';
  c.fillRect(p.x * s - 1.5, p.y * s - 1.5, 3, 3);
  c.strokeStyle = 'rgba(255,255,255,.35)';
  c.strokeRect(G.camera.x * s, G.camera.y * s, 960 * s, 540 * s);
}

// ---------- inventário / ficha ----------
export function toggleInventory() {
  if (G.mode === 'inventory') {
    el.invPanel.classList.add('hidden');
    G.mode = 'play';
  } else if (G.mode === 'play') {
    G.mode = 'inventory';
    refreshInventory();
    el.invPanel.classList.remove('hidden');
  }
}

export function refreshInventory() {
  const p = G.player, a = p.attrs, sk = p.skills, inv = p.inv;
  const skLine = (nm, s) => `${nm} — nível ${s.lv} <span style="color:#777f68">(${s.xp}/${s.lv * 25} xp)</span>`;
  const wBtn = w => p.weapon === w ? '<span class="eq">[equipada]</span>'
    : `<button data-eq="${w}">Equipar</button>`;
  el.invBody.innerHTML = `
    <h2>FICHA DO EXILADO · ${p.speciesName}</h2>
    <h3>Atributos (F.P.C.A.)</h3>
    Força ${a.FOR} · Percepção ${a.PER} · Carisma ${a.CAR}
    <span style="color:#777f68">(efetivo ${effCAR()})</span> · Agilidade ${a.AGI}
    <h3>Habilidades (sobem com o uso)</h3>
    ${skLine('Corpo a corpo', sk.melee)}<br>${skLine('Tiro', sk.ranged)}<br>${skLine('Lábia', sk.speech)}
    <h3>Armas</h3>
    Cano de ferro ${wBtn('pipe')}<br>
    ${p.weapons.includes('pistol') ? `Pistola — ${inv.ammo} munições ${wBtn('pistol')}` :
      '<span style="color:#777f68">Pistola — (Maya entrega ao aceitar a missão)</span>'}
    <h3>Itens</h3>
    Medkits ×${inv.medkits} ${inv.medkits > 0 ? '<button data-act="medkit">Usar (H)</button>' : ''}<br>
    Sucata ×${inv.scrap} <span style="color:#777f68">— moeda de troca com Bromo</span><br>
    ${inv.seal ? 'Selo de Paz <span style="color:#7fc56f">(item de quest)</span><br>' : ''}
    ${inv.artifact ? 'Arca de Dados <span class="pathTag">(item de quest — leve até Maya)</span><br>' : ''}
    ${inv.artifactDelivered ? '<span style="color:#777f68">Arca de Dados — entregue à Resistência</span><br>' : ''}
    <div style="margin-top:12px;color:#777f68">[I] ou [Esc] para fechar</div>`;
  el.invBody.querySelectorAll('[data-eq]').forEach(b =>
    b.addEventListener('click', () => { p.weapon = b.dataset.eq; sfx('pickup'); refreshInventory(); }));
  const mk = el.invBody.querySelector('[data-act="medkit"]');
  if (mk) mk.addEventListener('click', async () => {
    const { useMedkit } = await import('./combat.js');
    useMedkit(); refreshInventory();
  });
}

// ---------- telas ----------
export function showEnd() {
  G.mode = 'end';
  const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
  const path = G.quest.path === 'diplomacia'
    ? 'DIPLOMACIA — a Arca foi recuperada sem transformar o Cofre em campo de batalha.'
    : 'COMBATE — a Arca foi tomada à força do exército do General.';
  el.endStats.innerHTML =
    `Caminho: <span class="pathTag">${path}</span><br>` +
    `Tempo de jogo: ${m}m ${s}s · Abates: ${G.kills}<br>` +
    `Reputação final — Militaristas ${G.facRep.mil} · Pacifistas ${G.facRep.pac} · Resistência ${G.facRep.hum}`;
  el.endScreen.classList.remove('hidden');
}

export function showDeath() {
  G.mode = 'dead';
  document.getElementById('deathScreen').classList.remove('hidden');
}

function respawn() {
  const p = G.player;
  const loss = Math.ceil(p.inv.scrap * 0.2);
  p.inv.scrap -= loss;
  p.hp = Math.round(p.maxHp * 0.6);
  p.dead = false;
  p.x = 56.5 * TILE; p.y = 33.5 * TILE;
  G.alert = 0;
  for (const e of G.entities) { if (e.ai === 'hunter' && !e.dead) e.remove = true; e.aggro = false; }
  document.getElementById('deathScreen').classList.add('hidden');
  G.mode = 'play';
  G.zone = zoneAt(p.x);
  notify(`Você acorda no assentamento. Perdeu ${loss} de sucata.`);
}
