// Bootstrap, input (Pointer Lock + câmera em terceira pessoa) e loop draw3d.
// Reusa toda a simulação 2D existente: state, map, entities, combat, dialog, quests, ui, audio.
import { G, TILE, clamp, dist, resetCore, saveGame, loadGame, SPECIES } from './state.js';
import { generateWorld, getContainerTemplate, zoneAt, ZONE_NAMES } from './map.js';
import { spawnEntities, updateEntities, moveCircle, findInteractable } from './entities.js';
import { playerAttack, updateProjectiles, updateAlert, updateEffects, useMedkit,
  gainAlert, aggroVaultGuards, fxText } from './combat.js';
import { openDialog, handleDialogKey } from './dialog.js';
import * as UI from './ui.js';
import { initScene, draw3d, lockScreenPos } from './render3d.js';
import { initAudio, sfx, toggleMute } from './audio.js';
import { objectiveText } from './quests.js';

const canvas = document.getElementById('canvas');
const keys = {};
let pointerLocked = false;

// Gira `cur` em direção a `target` pela fração k, pelo caminho angular mais curto.
function turnToward(cur, target, k) {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + d * k;
}

// IMPORTANTE: generateWorld() PRECISA rodar antes de initScene() —
// o buildBlocks em render3d lê o array `tiles` populado pelo mapa procedural.
// Sem isso, as paredes e palisades não existem no mundo 3D.
generateWorld();
initScene(canvas);
UI.initUI();
UI.buildMinimapBase();

// ---------- Pointer Lock ----------
function lockPointer() { canvas.requestPointerLock?.(); }
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.getElementById('lockHint')?.classList.toggle('hidden', pointerLocked || G.mode !== 'play');
});
canvas.addEventListener('click', () => { if (G.mode === 'play') lockPointer(); });

// ---------- mouse (Pointer Lock) ----------
const SENS = 0.0022;
// Limites da órbita em terceira pessoa: pitch negativo sobe a câmera (vista aérea),
// positivo desce até quase o nível do ombro. Ver o mapeamento em render3d.draw3d.
const PITCH_MIN = -0.9, PITCH_MAX = 0.28;
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  // O mouse gira a CÂMERA, não o personagem. Travado no alvo (Z-target), o yaw é
  // ditado pela mira e o mouse só controla o pitch.
  if (!G.lockOn) G.camYaw += e.movementX * SENS;
  G.pitch = clamp(G.pitch - e.movementY * SENS, PITCH_MIN, PITCH_MAX);
});

// ---------- Z-targeting (lock-on estilo Zelda N64) ----------
// Escolhe o alvo travável mais "à frente e perto": prioriza inimigos agressivos,
// depois qualquer entidade viva dentro do alcance e dentro de um cone de visão.
function findLockTarget() {
  const p = G.player;
  let best = null, bestScore = Infinity;
  for (const e of G.entities) {
    if (e.dead) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > 620) continue;
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    let diff = Math.abs(((ang - p.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff > 1.9) continue; // fora do cone de ~218° à frente
    // pontuação: distância penalizada por desvio angular; hostis ganham desconto
    const score = d * (1 + diff * 0.5) * (e.aggro ? 0.55 : 1);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function toggleLockOn() {
  if (G.lockOn) { G.lockOn = null; return; }
  const t = findLockTarget();
  if (t) { G.lockOn = t; sfx('talk'); }
  else UI.notify('Nenhum alvo à vista.');
}

// Libera o lock se o alvo morreu, sumiu ou se afastou demais
function validateLockOn() {
  const t = G.lockOn;
  if (!t) return;
  if (t.dead || t.remove || !G.entities.includes(t) || dist(G.player.x, G.player.y, t.x, t.y) > 760)
    G.lockOn = null;
}

// ataque: mousedown esquerdo apenas quando pointer está trancado (evita tiro ao clicar no overlay)
canvas.addEventListener('mousedown', e => {
  // botão do meio também trava/destrava alvo (Z-target)
  if (e.button === 1 && pointerLocked && G.mode === 'play') { e.preventDefault(); toggleLockOn(); return; }
  if (e.button !== 0) return;
  if (pointerLocked && G.mode === 'play') {
    const cdBefore = G.player.attackCd;
    playerAttack();
    // Lunge: impulso à frente quando o swing corpo a corpo realmente sai
    // (attackCd subiu) — dá peso físico ao ataque, estilo action-RPG.
    if (G.player.weapon === 'pipe' && G.player.attackCd > cdBefore)
      moveCircle(G.player, Math.cos(G.player.dir) * 14, Math.sin(G.player.dir) * 14);
  }
});

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
  // Sem blur, Espaço (pulo) re-ativa o botão focado e reinicia o jogo
  document.getElementById('btnStart').blur();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('crosshair')?.classList.add('on');
  setTimeout(lockPointer, 60); // após o hide do overlay
});

function newGame(attrs, sp) {
  resetCore(attrs, sp);
  G.containers = getContainerTemplate();
  spawnEntities();
  G.zone = zoneAt(G.player.x);
  G.pitch = 0;
  G.jumpH = 0; G.jumpV = 0;
  UI.showZone(ZONE_NAMES[G.zone]);
  UI.notify('Objetivo: ' + objectiveText());
}

// ---------- input (teclado) ----------
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'F5' || e.code === 'F9' || e.code === 'Tab' || e.code === 'Space') e.preventDefault();

  if (G.mode === 'dialog') {
    if (e.code === 'Escape') handleDialogKey(0);
    else if (/^Digit[1-9]$/.test(e.code)) handleDialogKey(+e.code.slice(5));
    return;
  }
  if (G.mode === 'inventory') {
    if (e.code === 'KeyI' || e.code === 'Tab' || e.code === 'Escape') UI.toggleInventory();
    return;
  }
  if (G.mode === 'dead') {
    if (e.code === 'Enter' || e.code === 'KeyR') document.getElementById('btnRespawn')?.click();
    return;
  }
  if (G.mode === 'end') {
    if (e.code === 'Enter') document.getElementById('btnContinue')?.click();
    return;
  }
  if (G.mode !== 'play') return;

  switch (e.code) {
    case 'Space': // pulo: física vertical visual (a simulação continua 2D)
      if (!(G.jumpH > 0) && !(G.jumpV > 0)) G.jumpV = 4.2;
      break;
    case 'KeyQ': // esquiva: impulso curto na direção do movimento (cooldown 0.95s)
      if (!(G.player.dashCd > 0) && !G.player.dead) {
        G.player.dashT = 0.16; G.player.dashCd = 0.95; sfx('swing');
      }
      break;
    case 'KeyF': toggleLockOn(); break; // Z-target: trava/destrava o alvo
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
window.addEventListener('contextmenu', e => e.preventDefault());

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

// ---------- update do jogador (terceira pessoa) ----------
function updatePlayer(dt) {
  const p = G.player;
  if (p.dead) return;

  validateLockOn();
  const locked = !!G.lockOn;
  // Direção de referência da entrada: travado = direção ao alvo; livre = yaw da câmera.
  const aimYaw = locked ? Math.atan2(G.lockOn.y - p.y, G.lockOn.x - p.x) : G.camYaw;

  // WASD relativo a aimYaw (+x=cos, +y=sin no espaço do jogo)
  const fwdX = Math.cos(aimYaw), fwdY = Math.sin(aimYaw);
  const rgtX = -fwdY, rgtY = fwdX; // perpendicular à direita
  let ix = 0, iy = 0;
  if (keys.KeyW || keys.ArrowUp)    { ix += fwdX; iy += fwdY; }
  if (keys.KeyS || keys.ArrowDown)  { ix -= fwdX; iy -= fwdY; }
  if (keys.KeyD || keys.ArrowRight) { ix += rgtX; iy += rgtY; }
  if (keys.KeyA || keys.ArrowLeft)  { ix -= rgtX; iy -= rgtY; }
  if (p.dashT > 0 && !ix && !iy) { ix = fwdX; iy = fwdY; } // esquiva sem input vai pra frente

  const running = keys.ShiftLeft || keys.ShiftRight;
  const maxSpd = (118 + p.attrs.AGI * 7) * (running ? 1.35 : 1);
  const moving = ix || iy;

  // velocidade-alvo (px/s) a partir da entrada normalizada
  let tvx = 0, tvy = 0;
  if (moving) { const n = Math.hypot(ix, iy); tvx = ix / n * maxSpd; tvy = iy / n * maxSpd; }

  if (p.dashT > 0) {
    // esquiva: impulso direto (ignora inércia para sair instantâneo)
    const n = Math.hypot(ix, iy) || 1;
    p.vx = ix / n * maxSpd * 4.2; p.vy = iy / n * maxSpd * 4.2;
  } else {
    // inércia: acelera rápido, desacelera com um leve deslize — dá peso ao passo
    const k = 1 - Math.exp(-dt * (moving ? 14 : 10));
    p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
  }
  if (Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1) { p.vx = 0; p.vy = 0; }
  if (p.vx || p.vy) moveCircle(p, p.vx * dt, p.vy * dt);

  // Frente do personagem (independente da câmera)
  if (locked) {
    p.dir = aimYaw;                                          // encara o alvo (strafe)
    G.camYaw = turnToward(G.camYaw, aimYaw, 1 - Math.exp(-dt * 8)); // câmera assenta atrás
  } else if (p.vx || p.vy) {
    p.dir = turnToward(p.dir, Math.atan2(p.vy, p.vx), 1 - Math.exp(-dt * 16)); // vira pra onde anda
  }
  p.dir = Math.atan2(Math.sin(p.dir), Math.cos(p.dir)); // mantém em [-π, π]

  p.attackCd = Math.max(0, p.attackCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.dashT = Math.max(0, (p.dashT || 0) - dt);
  p.dashCd = Math.max(0, (p.dashCd || 0) - dt);

  // física do pulo (vertical, só visual — entidades e tiros continuam no plano)
  if (G.jumpH > 0 || G.jumpV > 0) {
    G.jumpV -= 13 * dt;
    G.jumpH = Math.max(0, (G.jumpH || 0) + G.jumpV * dt);
    if (G.jumpH === 0) G.jumpV = 0;
  }
  // ataque é disparado em mousedown (acima)

  // coleta automática de loot no chão
  for (const pk of G.pickups) {
    const dx = pk.x - p.x, dy = pk.y - p.y;
    if (Math.hypot(dx, dy) < p.r + 12) {
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

  // minimap quer G.camera (para o retângulo de viewport). Em 3D não há scroll,
  // mas fingimos um viewport centrado no player para o indicador do minimapa.
  G.camera.x = p.x - 480;
  G.camera.y = p.y - 270;

  const z = zoneAt(p.x);
  if (z !== G.zone) { G.zone = z; UI.showZone(ZONE_NAMES[z]); }
  G.hint = findInteractable();
}

// ---------- loop ----------
const reticle = document.getElementById('lockReticle');
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode === 'play') {
    // Hit-stop: ao acertar um golpe, a ação quase congela por um instante.
    // É o "peso" do combate do Zelda. A câmera segue em tempo real (usa dt).
    let sdt = dt;
    if (G.hitStop > 0) { G.hitStop -= dt; sdt = dt * 0.12; }
    G.time += sdt;
    updatePlayer(sdt);
    updateEntities(sdt);
    updateProjectiles(sdt);
    updateAlert(sdt);
    updateEffects(sdt);
  }
  if (G.mode !== 'start') {
    draw3d(dt, G.pitch);
    UI.drawMinimap();
    UI.updateHUD();
    updateReticle();
  }
  requestAnimationFrame(loop);
}

// Retícula do alvo travado (triângulo estilo Z-target)
function updateReticle() {
  if (!reticle) return;
  const pos = (G.mode === 'play') ? lockScreenPos() : null;
  if (!pos) { reticle.style.display = 'none'; return; }
  reticle.style.display = 'block';
  reticle.style.left = pos.x + 'px';
  reticle.style.top = pos.y + 'px';
}
requestAnimationFrame(loop);

window.G = G; // debug no console
