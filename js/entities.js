// Entidades: spawn, rotinas (waypoints), IA de combate e interação.
import { G, TILE, dist } from './state.js';
import { circleBlocked, PEDESTAL } from './map.js';
import { damagePlayer, spawnProjectile } from './combat.js';
import { notify } from './ui.js';

let nextId = 1;

function base(tx, ty, o) {
  return Object.assign({
    id: nextId++, x: tx * TILE, y: ty * TILE, r: 10, dir: 0,
    hp: 40, maxHp: 40, speed: 90, dmg: 8,
    dead: false, deadT: 0, attackCd: 0, aggro: false, scared: 0,
    waitT: 0, wpi: 0, reported: false, flashT: 0,
  }, o);
}

function wp(list) { return list.map(([x, y]) => [x * TILE, y * TILE]); }

function soldier(tx, ty, o = {}) {
  return base(tx, ty, Object.assign({
    kind: 'soldier', faction: 'mil', ai: 'patrol', aggroR: 230, hp: 40, maxHp: 40,
  }, o));
}

export function spawnEntities() {
  const E = G.entities;
  E.length = 0;

  // --- Assentamento (neutro): humanos da Resistência + comerciante pacifista ---
  E.push(base(50.5, 33.5, { kind: 'human', faction: 'hum', ai: 'wander', name: 'Maya', dialog: 'maya',
    essential: true, hp: 60, maxHp: 60, home: { x: 50.5 * TILE, y: 33.5 * TILE }, range: 40 }));
  E.push(base(61.5, 39.5, { kind: 'ape', faction: 'pac', ai: 'wander', name: 'Bromo', dialog: 'bromo',
    essential: true, hp: 60, maxHp: 60, home: { x: 61.5 * TILE, y: 39.5 * TILE }, range: 40 }));
  E.push(base(47.5, 34.2, { kind: 'human', faction: 'hum', ai: 'wander', name: 'Sentinela', hp: 50, maxHp: 50,
    home: { x: 47.5 * TILE, y: 34.2 * TILE }, range: 30 }));
  E.push(base(64.5, 38.5, { kind: 'human', faction: 'hum', ai: 'wander', name: 'Sentinela', hp: 50, maxHp: 50,
    home: { x: 64.5 * TILE, y: 38.5 * TILE }, range: 30 }));
  E.push(base(53.5, 39.5, { kind: 'human', faction: 'hum', ai: 'wander',
    home: { x: 53.5 * TILE, y: 39.5 * TILE }, range: 120 }));
  E.push(base(58.5, 32.5, { kind: 'human', faction: 'hum', ai: 'wander',
    home: { x: 58.5 * TILE, y: 32.5 * TILE }, range: 120 }));

  // --- Vila pacifista na floresta ---
  E.push(base(94.5, 22.5, { kind: 'ape', faction: 'pac', ai: 'wander', name: 'Anciã Lira', dialog: 'lira',
    essential: true, hp: 60, maxHp: 60, home: { x: 94.5 * TILE, y: 22.5 * TILE }, range: 36 }));
  for (const [tx, ty] of [[91.5, 24.5], [96.5, 25.5], [93.5, 19.5], [97.5, 21.5]])
    E.push(base(tx, ty, { kind: 'ape', faction: 'pac', ai: 'wander',
      home: { x: tx * TILE, y: ty * TILE }, range: 110 }));

  // --- O Cofre: Capitão Krag + guardas ---
  E.push(base(11.5, 36.5, { kind: 'ape', faction: 'mil', ai: 'guard', name: 'Capitão Krag', dialog: 'krag',
    boss: true, hp: 110, maxHp: 110, dmg: 14, speed: 100, r: 13,
    post: { x: 11.5 * TILE, y: 36.5 * TILE } }));
  for (const [tx, ty, rg] of [[17.5, 34.5, false], [17.5, 38.5, true], [12.5, 31.5, true], [12.5, 41.5, false]])
    E.push(base(tx, ty, { kind: 'soldier', faction: 'mil', ai: 'guard', hp: 50, maxHp: 50, dmg: 10,
      ranged: rg, post: { x: tx * TILE, y: ty * TILE } }));

  // --- Patrulhas militaristas nas ruínas (rotas fixas) ---
  const routes = [
    wp([[26.5, 12.5], [34.5, 12.5], [34.5, 20.5], [26.5, 20.5]]),
    wp([[26.5, 48.5], [34.5, 48.5], [34.5, 56.5], [26.5, 56.5]]),
    wp([[20.5, 36.5], [40.5, 36.5]]),
  ];
  for (const route of routes) {
    for (let i = 0; i < 2; i++) {
      const [sx, sy] = route[i % route.length];
      const s = soldier(0, 0, { ranged: i === 1, waypoints: route, wpi: (i * 2) % route.length });
      s.x = sx + i * 20; s.y = sy;
      E.push(s);
    }
  }
}

// Caçadores spawnam quando o alerta está ativo (sistema "procurado")
export function spawnHunters(n) {
  const p = G.player;
  let spawned = 0;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 480 + Math.random() * 200;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!circleBlocked(x, y, 10)) {
        const h = soldier(0, 0, { ai: 'hunter', hp: 35, maxHp: 35, dmg: 9, speed: 108,
          ranged: i % 2 === 1, aggro: true });
        h.x = x; h.y = y;
        G.entities.push(h);
        spawned++;
        break;
      }
    }
  }
  if (spawned) notify('Reforços símios estão te caçando!');
}

export function moveCircle(e, dx, dy) {
  if (!circleBlocked(e.x + dx, e.y, e.r)) e.x += dx;
  if (!circleBlocked(e.x, e.y + dy, e.r)) e.y += dy;
}

function moveToward(e, tx, ty, dt, spd = e.speed) {
  const d = dist(e.x, e.y, tx, ty);
  if (d < 3) return true;
  const dx = (tx - e.x) / d, dy = (ty - e.y) / d;
  e.dir = Math.atan2(dy, dx);
  moveCircle(e, dx * spd * dt, dy * spd * dt);
  return d < 8;
}

function combatChase(e, dt) {
  const p = G.player;
  if (p.dead) { e.aggro = false; return; }
  const d = dist(e.x, e.y, p.x, p.y);
  e.dir = Math.atan2(p.y - e.y, p.x - e.x);
  if (e.ranged && d > 70 && d < 280 && e.attackCd <= 0) {
    spawnProjectile(e.x, e.y, e.dir, 'spear', e.dmg, 'enemy');
    e.attackCd = 1.9;
  } else if (d > 26) {
    moveToward(e, p.x, p.y, dt);
  }
  if (d <= 30 + p.r && e.attackCd <= 0) { damagePlayer(e.dmg); e.attackCd = 1.1; }
}

function aiPatrol(e, dt) {
  const p = G.player;
  const d = dist(e.x, e.y, p.x, p.y);
  if (!e.aggro && !p.dead && d < e.aggroR) {
    e.aggro = true;
    if (G.time - G.flags.patrolSpotted > 8) {
      G.flags.patrolSpotted = G.time;
      notify('Uma patrulha militarista reconheceu o exilado!');
    }
  }
  if (e.aggro) {
    if (d > 520) { e.aggro = false; return; }
    combatChase(e, dt);
    return;
  }
  if (!e.waypoints) return;
  if (e.waitT > 0) { e.waitT -= dt; return; }
  const [tx, ty] = e.waypoints[e.wpi];
  if (moveToward(e, tx, ty, dt, e.speed * 0.7)) {
    e.wpi = (e.wpi + 1) % e.waypoints.length;
    e.waitT = 1;
  }
}

function aiGuard(e, dt) {
  const p = G.player;
  const d = dist(e.x, e.y, p.x, p.y);
  if (G.vaultHostile && !e.aggro && d < 340) e.aggro = true;
  if (e.aggro) {
    if (d > 600) { e.aggro = false; return; }
    combatChase(e, dt);
    return;
  }
  moveToward(e, e.post.x, e.post.y, dt, e.speed * 0.7);
}

function aiHunter(e, dt) {
  if (G.alert <= 0) { e.remove = true; return; }
  combatChase(e, dt);
}

function aiWander(e, dt) {
  const p = G.player;
  if (e.scared > 0) { // foge do jogador
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > 1) {
      const dx = (e.x - p.x) / d, dy = (e.y - p.y) / d;
      e.dir = Math.atan2(dy, dx);
      moveCircle(e, dx * e.speed * 1.25 * dt, dy * e.speed * 1.25 * dt);
    }
    return;
  }
  if (e.waitT > 0) { e.waitT -= dt; return; }
  if (e.tx === undefined || moveToward(e, e.tx, e.ty, dt, e.speed * 0.45)) {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * e.range;
      const x = e.home.x + Math.cos(a) * d, y = e.home.y + Math.sin(a) * d;
      if (!circleBlocked(x, y, e.r)) { e.tx = x; e.ty = y; break; }
    }
    e.waitT = 1 + Math.random() * 2.5;
  }
}

export function updateEntities(dt) {
  for (const e of G.entities) {
    if (e.dead) { e.deadT += dt; if (e.deadT > 30) e.remove = true; continue; }
    e.attackCd = Math.max(0, e.attackCd - dt);
    e.scared = Math.max(0, e.scared - dt);
    switch (e.ai) {
      case 'patrol': aiPatrol(e, dt); break;
      case 'guard': aiGuard(e, dt); break;
      case 'hunter': aiHunter(e, dt); break;
      case 'wander': aiWander(e, dt); break;
    }
  }
  G.entities = G.entities.filter(e => !e.remove);
}

// Interação contextual ([E]): NPC > contêiner > pedestal da Arca
export function findInteractable() {
  const p = G.player;
  let best = null, bd = 60;
  for (const e of G.entities) {
    if (e.dead || !e.dialog || e.aggro) continue;
    if (e.ai === 'guard' && G.vaultHostile) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bd) { bd = d; best = { type: 'npc', x: e.x, y: e.y, label: 'Falar com ' + e.name, id: e.dialog }; }
  }
  for (const c of G.containers) {
    if (c.opened) continue;
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = { type: 'container', x: c.x, y: c.y, label: 'Saquear contêiner', c }; }
  }
  if (!G.flags.artifactTaken) {
    const d = dist(p.x, p.y, PEDESTAL.x, PEDESTAL.y);
    if (d < bd) best = { type: 'pedestal', x: PEDESTAL.x, y: PEDESTAL.y, label: 'Pegar a Arca de Dados' };
  }
  return best;
}
