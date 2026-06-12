// Bootstrap, input, loop principal e interações contextuais.
import { G, TILE, dist, clamp, resetCore, saveGame, loadGame, SPECIES } from './state.js';
import { generateWorld, getContainerTemplate, zoneAt, ZONE_NAMES, MAPW, MAPH } from './map.js';
import { spawnEntities, updateEntities, moveCircle, findInteractable } from './entities.js';
import { playerAttack, updateProjectiles, updateAlert, updateEffects, useMedkit,
  gainAlert, aggroVaultGuards, fxText } from './combat.js';
import { openDialog, handleDialogKey } from './dialog.js';
import * as UI from './ui.js';
import { draw } from './render.js';
import { initAudio, sfx, toggleMute } from './audio.js';
import { objectiveText } from './quests.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const keys = {};
const mouse = { x: 480, y: 270, down: false };

generateWorld();
UI.initUI();
UI.buildMinimapBase();

// ---------- tela inicial: espécie + distribuição de pontos ----------
const ATTRS = [
  ['FOR', 'Força', 'dano corpo a corpo'],
  ['PER', 'Percepção', 'dano à distância'],
  ['CAR', 'Carisma', 'checks de diálogo'],
  ['AGI', 'Agilidade', 'velocidade de movimento'],
];
let alloc = { FOR: 0, PER: 0, CAR: 0, AGI: 0 };
let pts = 3;
let speciesId = 'chimpanze';

function speciesMod(k) {
  const sp = SPECIES.find(s => s.id === speciesId);
  return (sp.mods && sp.mods[k]) || 0;
}
function attrVal(k) { return 5 + speciesMod(k) + alloc[k]; }

function buildSpeciesRow() {
  const row = document.getElementById('speciesRow');
  row.innerHTML = '';
  for (const sp of SPECIES) {
    const b = document.createElement('button');
    b.textContent = sp.name;
    if (sp.id === speciesId) b.style.background = '#39512f';
    b.addEventListener('click', () => {
      speciesId = sp.id;
      document.getElementById('speciesDesc').textContent = sp.desc;
      buildSpeciesRow(); buildAttrRows();
    });
    row.appendChild(b);
  }
  document.getElementById('speciesDesc').textContent = SPECIES.find(s => s.id === speciesId).desc;
}

function buildAttrRows() {
  const box = document.getElementById('attrRows');
  document.getElementById('ptsLeft').textContent = pts;
  box.innerHTML = '';
  for (const [k, nm, hint] of ATTRS) {
    const row = document.createElement('div');
    row.className = 'attrRow';
    const minus = document.createElement('button'); minus.textContent = '−';
    const plus = document.createElement('button'); plus.textContent = '+';
    minus.disabled = alloc[k] <= 0;
    plus.disabled = pts <= 0 || attrVal(k) >= 9;
    minus.addEventListener('click', () => { alloc[k]--; pts++; buildAttrRows(); });
    plus.addEventListener('click', () => { alloc[k]++; pts--; buildAttrRows(); });
    row.innerHTML = `<span class="nm">${nm}</span>`;
    const val = document.createElement('span'); val.className = 'val'; val.textContent = attrVal(k);
    row.appendChild(val); row.appendChild(minus); row.appendChild(plus);
    const h = document.createElement('span'); h.className = 'hint'; h.textContent = hint;
    row.appendChild(h);
    box.appendChild(row);
  }
}
buildSpeciesRow();
buildAttrRows();

document.getElementById('btnStart').addEventListener('click', () => {
  initAudio();
  const attrs = {};
  for (const [k] of ATTRS) attrs[k] = attrVal(k);
  newGame(attrs, speciesId);
  document.getElementById('startScreen').classList.add('hidden');
});

function newGame(attrs, sp) {
  resetCore(attrs, sp);
  G.containers = getContainerTemplate();
  spawnEntities();
  G.zone = zoneAt(G.player.x);
  UI.showZone(ZONE_NAMES[G.zone]);
  UI.notify('Objetivo: ' + objectiveText());
}

// ---------- input ----------
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'F5' || e.code === 'F9' || e.code === 'Tab') e.preventDefault();

  if (G.mode === 'dialog') {
    if (e.code === 'Escape') handleDialogKey(0);
    else if (/^Digit[1-9]$/.test(e.code)) handleDialogKey(+e.code.slice(5));
    return;
  }
  if (G.mode === 'inventory') {
    if (e.code === 'KeyI' || e.code === 'Tab' || e.code === 'Escape') UI.toggleInventory();
    return;
  }
  if (G.mode !== 'play') return;

  switch (e.code) {
    case 'KeyE': tryInteract(); break;
    case 'KeyI': case 'Tab': UI.toggleInventory(); break;
    case 'KeyH': useMedkit(); break;
    case 'Digit1': G.player.weapon = 'pipe'; break;
    case 'Digit2':
      if (G.player.weapons.includes('pistol')) G.player.weapon = 'pistol';
      else UI.notify('Você ainda não tem a pistola — fale com Maya.');
      break;
    case 'KeyM': UI.notify(toggleMute() ? 'Som desligado.' : 'Som ligado.'); break;
    case 'F5': UI.notify(saveGame() ? 'Jogo salvo (na memória da sessão).' : 'Não foi possível salvar agora.'); break;
    case 'F9': UI.notify(loadGame() ? 'Jogo carregado.' : 'Nenhum save na memória.'); break;
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- interações ----------
function tryInteract() {
  const h = G.hint;
  if (!h) return;
  if (h.type === 'npc') openDialog(h.id);
  else if (h.type === 'container') lootContainer(h.c);
  else if (h.type === 'pedestal') takeArtifact();
}

function lootContainer(c) {
  c.opened = true;
  sfx('pickup');
  const inv = G.player.inv, drops = [];
  let s = 5 + (Math.random() * 11 | 0);
  if (c.big) s += 15;
  inv.scrap += s; drops.push(s + ' sucata');
  if (c.big || Math.random() < 0.4) { inv.medkits++; drops.push('1 medkit'); }
  if (c.big || Math.random() < 0.45) {
    const a = (c.big ? 10 : 4) + (Math.random() * 4 | 0);
    inv.ammo += a; drops.push(a + ' munições');
  }
  UI.notify('Contêiner: +' + drops.join(', +'));
}

function takeArtifact() {
  if (G.quest.stage < 1) {
    UI.notify('Uma relíquia humana selada. Maya, no assentamento, saberia o que fazer com isso.');
    return;
  }
  const guardsAlive = G.entities.some(e => e.ai === 'guard' && !e.dead);
  if (guardsAlive && !G.captainPeace && !G.vaultHostile) {
    G.vaultHostile = true;
    aggroVaultGuards();
    gainAlert(2, 'Você pegou a Arca — os guardas do Cofre atacam!');
  }
  G.player.inv.artifact = true;
  G.flags.artifactTaken = true;
  G.quest.path = G.captainPeace ? 'diplomacia' : 'combate';
  G.quest.stage = 2;
  sfx('quest');
  UI.notify('Arca de Dados obtida! Diário atualizado: ' + objectiveText());
}

// ---------- update do jogador ----------
function updatePlayer(dt) {
  const p = G.player;
  if (p.dead) return;
  let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (dx || dy) {
    const n = Math.hypot(dx, dy);
    const spd = (118 + p.attrs.AGI * 7) * ((keys.ShiftLeft || keys.ShiftRight) ? 1.35 : 1);
    moveCircle(p, dx / n * spd * dt, dy / n * spd * dt);
  }
  p.dir = Math.atan2(mouse.y + G.camera.y - p.y, mouse.x + G.camera.x - p.x);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (mouse.down) playerAttack();

  // coleta automática de loot no chão
  for (const pk of G.pickups) {
    if (dist(p.x, p.y, pk.x, pk.y) < p.r + 12) {
      pk.remove = true;
      p.inv.scrap += pk.scrap || 0;
      p.inv.ammo += pk.ammo || 0;
      p.inv.medkits += pk.medkits || 0;
      const parts = [];
      if (pk.scrap) parts.push('+' + pk.scrap + ' sucata');
      if (pk.ammo) parts.push('+' + pk.ammo + ' mun.');
      if (pk.medkits) parts.push('+1 medkit');
      fxText(p.x, p.y - 24, parts.join(' '), '#cfe6b0');
      sfx('pickup');
    }
  }
  G.pickups = G.pickups.filter(pk => !pk.remove);

  const z = zoneAt(p.x);
  if (z !== G.zone) { G.zone = z; UI.showZone(ZONE_NAMES[z]); }
  G.hint = findInteractable();
}

function updateCamera(dt) {
  const p = G.player, cam = G.camera;
  const tx = clamp(p.x - 480, 0, MAPW * TILE - 960);
  const ty = clamp(p.y - 270, 0, MAPH * TILE - 540);
  const k = Math.min(1, dt * 8);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode === 'play') {
    G.time += dt;
    updatePlayer(dt);
    updateEntities(dt);
    updateProjectiles(dt);
    updateAlert(dt);
    updateEffects(dt);
    updateCamera(dt);
  }
  if (G.mode !== 'start') {
    draw(ctx);
    UI.drawMinimap();
    UI.updateHUD();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.G = G; // debug no console
