// Estado global do jogo + helpers básicos. Nenhum import (raiz do grafo de módulos).
export const TILE = 32;
export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function angDiff(a, b) {
  let d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

export const G = { saveSlot: null, muted: false, mode: 'start', pitch: 0 };

// Espécies jogáveis — modificadores sobre os atributos base (5)
export const SPECIES = [
  { id: 'chimpanze',   name: 'Chimpanzé',   mods: { AGI: +2 },          color: '#6b4a2f', r: 10, hp: 100,
    desc: 'Rápido e versátil. +2 Agilidade.' },
  { id: 'gorila',      name: 'Gorila',      mods: { FOR: +2, AGI: -1 }, color: '#3c3c42', r: 13, hp: 120,
    desc: 'Força bruta. +2 Força, -1 Agilidade, +20 de vida.' },
  { id: 'orangotango', name: 'Orangotango', mods: { PER: +1, CAR: +1 }, color: '#9a5526', r: 12, hp: 100,
    desc: 'Sábio das árvores. +1 Percepção, +1 Carisma.' },
  { id: 'bonobo',      name: 'Bonobo',      mods: { CAR: +2, FOR: -1 }, color: '#4a3526', r: 9,  hp: 90,
    desc: 'Diplomata nato. +2 Carisma, -1 Força, -10 de vida.' },
];

export function resetCore(attrs, speciesId) {
  const sp = SPECIES.find(s => s.id === speciesId) || SPECIES[0];
  Object.assign(G, {
    mode: 'play', time: 0,
    alert: 0, alertDecay: 0, lastCrimeT: -999, hunterTimer: 6,
    facRep: { mil: -20, pac: 0, hum: 15 },
    quest: { stage: 0, path: null },
    vaultHostile: false, captainPeace: false,
    flags: { artifactTaken: false, liraGreeted: false, patrolSpotted: 0 },
    entities: [], projectiles: [], pickups: [], effects: [], containers: [],
    camera: { x: 0, y: 0 }, zone: '', hint: null, kills: 0,
    lockOn: null, hitStop: 0, // Z-targeting (alvo travado) + micro-pausa no impacto
    jumpH: 0, jumpV: 0,
    camYaw: 0, // giro da câmera (mouse), independente da frente do personagem
    player: {
      x: 56.5 * TILE, y: 33.5 * TILE, r: sp.r, hp: sp.hp, maxHp: sp.hp,
      species: sp.id, speciesName: sp.name, color: sp.color,
      dir: 0, vx: 0, vy: 0, attackCd: 0, hurtT: 0, dead: false,
      attrs: attrs || { FOR: 5, PER: 5, CAR: 5, AGI: 5 },
      skills: { melee: { xp: 0, lv: 1 }, ranged: { xp: 0, lv: 1 }, speech: { xp: 0, lv: 1 } },
      inv: { scrap: 10, medkits: 1, ammo: 0, artifact: false, artifactDelivered: false, seal: false },
      weapons: ['pipe'], weapon: 'pipe',
    },
  });
}

// Carisma efetivo: atributo + bônus da habilidade Lábia (progressão por uso)
export function effCAR() {
  const p = G.player;
  return p.attrs.CAR + Math.floor((p.skills.speech.lv - 1) / 2);
}

// Retorna quantos níveis subiu (0 se nenhum)
export function addSkillXP(name, amt) {
  const s = G.player.skills[name];
  s.xp += amt;
  let ups = 0;
  while (s.xp >= s.lv * 25) { s.xp -= s.lv * 25; s.lv++; ups++; }
  return ups;
}

const SAVE_KEYS = ['time', 'alert', 'alertDecay', 'lastCrimeT', 'hunterTimer', 'facRep', 'quest',
  'vaultHostile', 'captainPeace', 'flags', 'entities', 'pickups', 'containers', 'kills', 'player', 'zone'];

export function saveGame() {
  if (G.mode !== 'play' && G.mode !== 'inventory') return false;
  const o = {};
  for (const k of SAVE_KEYS) o[k] = G[k];
  G.saveSlot = JSON.stringify(o);
  return true;
}

export function loadGame() {
  if (!G.saveSlot) return false;
  Object.assign(G, JSON.parse(G.saveSlot));
  G.projectiles = []; G.effects = []; G.hint = null;
  G.mode = 'play';
  return true;
}
