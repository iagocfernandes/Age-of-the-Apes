// Geração procedural determinística do mundo (3 zonas) + colisão.
import { TILE, mulberry32 } from './state.js';

export const MAPW = 110, MAPH = 72;

export const T = {
  GRASS: 0, DIRT: 1, CONCRETE: 2, WALL: 3, TREE: 4,
  WATER: 5, FLOOR: 6, RUBBLE: 7, PALISADE: 8,
};
export const SOLID = new Uint8Array(16);
SOLID[T.WALL] = 1; SOLID[T.TREE] = 1; SOLID[T.WATER] = 1; SOLID[T.PALISADE] = 1;

export const tiles = new Uint8Array(MAPW * MAPH);

// Pedestal da Arca de Dados, dentro do Cofre nas ruínas
export const PEDESTAL = { x: 8.5 * TILE, y: 36.5 * TILE };

const containerTemplate = [];

export function getContainerTemplate() {
  return containerTemplate.map(c => ({ ...c, opened: false }));
}

function set(x, y, t) { if (x >= 0 && y >= 0 && x < MAPW && y < MAPH) tiles[y * MAPW + x] = t; }
function get(x, y) { return tiles[y * MAPW + x]; }

export function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return T.WALL;
  return tiles[ty * MAPW + tx];
}
export function isSolidAt(px, py) {
  return SOLID[tileAt(Math.floor(px / TILE), Math.floor(py / TILE))] === 1;
}
export function circleBlocked(x, y, r) {
  const k = r * 0.71;
  return isSolidAt(x - r, y) || isSolidAt(x + r, y) || isSolidAt(x, y - r) || isSolidAt(x, y + r) ||
    isSolidAt(x - k, y - k) || isSolidAt(x + k, y - k) || isSolidAt(x - k, y + k) || isSolidAt(x + k, y + k);
}

export function zoneAt(px) {
  const tx = px / TILE;
  return tx < 42 ? 'ruins' : tx < 70 ? 'settlement' : 'forest';
}
export const ZONE_NAMES = {
  ruins: 'Ruínas da Cidade Humana',
  settlement: 'Assentamento de Comércio',
  forest: 'Floresta Símia',
};

function addContainer(tx, ty, big = false) {
  containerTemplate.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, big, opened: false });
}

export function generateWorld() {
  const rnd = mulberry32(20290612);
  containerTemplate.length = 0;
  tiles.fill(T.GRASS);

  // manchas de terra no campo central
  for (let i = 0; i < 50; i++) {
    const cx = 2 + (rnd() * (MAPW - 4)) | 0, cy = 2 + (rnd() * (MAPH - 4)) | 0, r = 1 + rnd() * 3;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++)
      if (Math.hypot(x - cx, y - cy) < r && get(x, y) === T.GRASS) set(x, y, T.DIRT);
  }

  // ===== RUÍNAS: chão de concreto rachado =====
  for (let y = 2; y < MAPH - 2; y++) for (let x = 2; x < 42; x++)
    set(x, y, rnd() < 0.86 ? T.CONCRETE : T.RUBBLE);

  // ===== ESTRADA principal (liga as 3 zonas), linhas 35..37 =====
  for (let x = 2; x < MAPW - 1; x++) for (let y = 35; y <= 37; y++)
    set(x, y, x < 42 ? T.CONCRETE : T.DIRT);

  // ===== Prédios em ruínas (grade urbana com paredes quebradas) =====
  function addBuilding(bx, by, w, h) {
    for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) {
      const edge = (x === bx || x === bx + w - 1 || y === by || y === by + h - 1);
      set(x, y, edge ? (rnd() < 0.24 ? T.RUBBLE : T.WALL) : T.FLOOR);
    }
    set(bx + (w >> 1), by + h - 1, T.FLOOR); // porta ao sul
    if (rnd() < 0.5 && containerTemplate.length < 14)
      addContainer(bx + 1 + (rnd() * (w - 2)) | 0, by + 1 + (rnd() * (h - 2)) | 0);
  }
  for (const bx of [20, 28, 36])
    for (const by of [6, 14, 22, 42, 50, 58]) addBuilding(bx, by, 6, 6);
  for (const bx of [6, 14])
    for (const by of [6, 14, 50, 58]) addBuilding(bx, by, 6, 6);

  // ===== O COFRE (vault) — objetivo da quest principal =====
  for (let y = 27; y <= 45; y++) for (let x = 4; x <= 16; x++) {
    const edge = (x === 4 || x === 16 || y === 27 || y === 45);
    set(x, y, edge ? T.WALL : T.FLOOR);
  }
  for (let y = 35; y <= 37; y++) set(16, y, T.FLOOR); // entrada leste, alinhada à estrada
  addContainer(6, 29, true); // contêiner especial do Cofre

  // ===== ASSENTAMENTO: paliçada, cabanas, mercado =====
  for (let y = 26; y <= 46; y++) for (let x = 46; x <= 66; x++) set(x, y, T.DIRT);
  for (let x = 46; x <= 66; x++) { set(x, 26, T.PALISADE); set(x, 46, T.PALISADE); }
  for (let y = 26; y <= 46; y++) { set(46, y, T.PALISADE); set(66, y, T.PALISADE); }
  for (let y = 35; y <= 37; y++) { set(46, y, T.DIRT); set(66, y, T.DIRT); } // portões

  function addHut(bx, by, w, h, doorNorth = false) {
    for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) {
      const edge = (x === bx || x === bx + w - 1 || y === by || y === by + h - 1);
      set(x, y, edge ? T.WALL : T.FLOOR);
    }
    set(bx + (w >> 1), doorNorth ? by : by + h - 1, T.FLOOR);
  }
  addHut(48, 28, 5, 4);            // QG da Resistência (Maya)
  addHut(60, 28, 5, 4);            // cabana do mercado (Bromo)
  addHut(54, 40, 5, 4, true);      // cabana sul
  addContainer(52, 44);            // depósito do assentamento

  // ===== FLORESTA: árvores densas, vila pacifista, lago =====
  const VILX = 94, VILY = 22;
  for (let y = 2; y < MAPH - 2; y++) for (let x = 70; x < MAPW - 1; x++) {
    if (y >= 34 && y <= 38) continue;                        // faixa da estrada
    if (Math.hypot(x - VILX, y - VILY) < 7) { if (Math.hypot(x - VILX, y - VILY) < 5) set(x, y, T.DIRT); continue; }
    if ((x === 93 || x === 94) && y > 22 && y < 38) { set(x, y, T.DIRT); continue; } // trilha p/ vila
    const dPond = Math.hypot(x - 82, y - 52);
    if (dPond < 4) { set(x, y, T.WATER); continue; }
    if (dPond < 5.2) { set(x, y, T.DIRT); continue; }
    if (get(x, y) === T.GRASS || get(x, y) === T.DIRT) { if (rnd() < 0.22) set(x, y, T.TREE); }
  }
  addHut(89, 17, 4, 4);
  addHut(97, 17, 4, 4);
  addContainer(80, 48);
  addContainer(85, 55);

  // árvores esparsas no campo entre assentamento e floresta
  for (let y = 2; y < MAPH - 2; y++) for (let x = 42; x < 70; x++)
    if (get(x, y) === T.GRASS && rnd() < 0.05) set(x, y, T.TREE);

  // ===== Borda do mundo =====
  for (let x = 0; x < MAPW; x++) { set(x, 0, T.WALL); set(x, MAPH - 1, T.WALL); }
  for (let y = 0; y < MAPH; y++) { set(0, y, T.WALL); set(MAPW - 1, y, T.WALL); }
}
