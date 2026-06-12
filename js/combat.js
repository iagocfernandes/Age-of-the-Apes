// Dano, projéteis, sistema de alerta (estilo "procurado" do GTA) e efeitos visuais.
import { G, dist, clamp, angDiff, addSkillXP, TAU } from './state.js';
import { isSolidAt } from './map.js';
import { notify, showDeath } from './ui.js';
import { spawnHunters } from './entities.js';
import { sfx } from './audio.js';

// ---------- efeitos ----------
export function fxText(x, y, str, color = '#ffe98a') {
  G.effects.push({ kind: 'text', x, y, t: 0, life: 0.9, str, color });
}
export function fx(kind, x, y, dir = 0) {
  G.effects.push({ kind, x, y, dir, t: 0, life: kind === 'slash' ? 0.16 : kind === 'flash' ? 0.1 : 0.3 });
}
export function updateEffects(dt) {
  for (const e of G.effects) { e.t += dt; if (e.kind === 'text') e.y -= 32 * dt; }
  G.effects = G.effects.filter(e => e.t < e.life);
}

// ---------- alerta símio (estrelas) ----------
export function gainAlert(n, msg) {
  const was = G.alert;
  G.alert = clamp(G.alert + n, 0, 5);
  G.lastCrimeT = G.time;
  if (G.alert > was) { sfx('alarm'); notify(msg || 'Nível de alerta símio aumentou!'); }
}

export function updateAlert(dt) {
  if (G.alert <= 0) return;
  G.hunterTimer -= dt;
  if (G.hunterTimer <= 0) {
    const alive = G.entities.filter(e => e.ai === 'hunter' && !e.dead).length;
    if (alive < 6) spawnHunters(Math.min(1 + (G.alert >> 1), 3));
    G.hunterTimer = Math.max(16 - G.alert * 2, 7);
  }
  const p = G.player;
  const hostNear = G.entities.some(e => !e.dead && e.aggro && dist(e.x, e.y, p.x, p.y) < 380);
  if (G.time - G.lastCrimeT > 10 && !hostNear) {
    G.alertDecay += dt;
    if (G.alertDecay >= 8) {
      G.alertDecay = 0; G.alert--;
      if (G.alert === 0) {
        notify('As patrulhas perderam seu rastro.');
        for (const e of G.entities) if (e.ai === 'hunter' && !e.dead) e.remove = true;
      }
    }
  } else G.alertDecay = 0;
}

export function aggroVaultGuards() {
  for (const e of G.entities) if (e.ai === 'guard' && !e.dead) e.aggro = true;
}

// ---------- dano ----------
export function damageEntity(e, dmg, src = 'player') {
  if (e.dead) return;
  e.hp -= dmg;
  // NPCs essenciais (quest) não morrem: caem a 1 de vida e fogem
  if (e.essential && e.hp <= 0) {
    e.hp = 1;
    e.scared = 10;
    if (!e.warnedEssential) {
      e.warnedEssential = true;
      notify(e.name + ' é essencial para a história e não pode morrer.');
    }
  }
  fxText(e.x, e.y - 14, '-' + Math.round(dmg), '#ffd27a');
  sfx('hit');
  if (src === 'player') {
    if (e.faction === 'mil') {
      if (e.ai === 'guard' && !G.vaultHostile) { G.vaultHostile = true; G.captainPeace = false; }
      if (!e.aggro) gainAlert(1, 'Você atacou o exército símio!');
      e.aggro = true;
      for (const o of G.entities)
        if (!o.dead && o.faction === 'mil' && dist(o.x, o.y, e.x, e.y) < 280) o.aggro = true;
    } else if (e.faction === 'pac') {
      e.scared = 8;
      G.facRep.pac -= 2;
      if (!e.reported) { e.reported = true; gainAlert(1, 'Os pacifistas pedem ajuda às patrulhas!'); }
    } else if (e.faction === 'hum') {
      e.scared = 8;
      G.facRep.hum -= 2;
    }
  }
  if (e.hp <= 0) killEntity(e, src);
}

function killEntity(e, src) {
  e.dead = true; e.deadT = 0; e.aggro = false;
  sfx('die');
  if (src !== 'player') return;
  G.kills++;
  // loot no chão
  const drop = { x: e.x, y: e.y, scrap: 3 + (Math.random() * 6 | 0), ammo: 0, medkits: 0 };
  if (e.faction === 'mil' && Math.random() < 0.35) drop.ammo = 4;
  G.pickups.push(drop);
  // consequências de facção / alerta
  if (e.faction === 'mil') { G.facRep.mil -= 5; gainAlert(1); }
  else if (e.faction === 'pac') { G.facRep.pac -= 15; gainAlert(2, 'Você matou um pacifista! As patrulhas foram alertadas.'); }
  else if (e.faction === 'hum') { G.facRep.hum -= 15; }
  if (e.boss) notify('Capitão Krag caiu.');
  if (e.ai === 'guard' && !G.entities.some(o => o.ai === 'guard' && !o.dead))
    notify('O caminho até a Arca está livre.');
}

export function damagePlayer(dmg) {
  const p = G.player;
  if (p.dead) return;
  p.hp -= dmg;
  p.hurtT = 0.35;
  sfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true;
    sfx('die');
    showDeath();
  }
}

// ---------- ataques do jogador ----------
export function playerAttack() {
  const p = G.player;
  if (p.attackCd > 0 || p.dead) return;
  if (p.weapon === 'pistol') playerShoot(); else playerMelee();
}

function playerMelee() {
  const p = G.player;
  p.attackCd = 0.45;
  sfx('swing');
  fx('slash', p.x + Math.cos(p.dir) * 22, p.y + Math.sin(p.dir) * 22, p.dir);
  let hit = false;
  for (const e of G.entities) {
    if (e.dead) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < 48 + e.r) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (angDiff(a, p.dir) < 0.95) {
        const dmg = (10 + p.attrs.FOR * 2) * (1 + 0.08 * (p.skills.melee.lv - 1));
        damageEntity(e, dmg);
        hit = true;
      }
    }
  }
  if (hit && addSkillXP('melee', 3)) {
    notify('Corpo a corpo subiu para o nível ' + p.skills.melee.lv + '!'); sfx('level');
  }
}

function playerShoot() {
  const p = G.player;
  if (p.inv.ammo <= 0) { notify('Sem munição! Compre com Bromo ou saqueie as ruínas.'); sfx('empty'); p.attackCd = 0.3; return; }
  p.inv.ammo--;
  p.attackCd = 0.5;
  sfx('shoot');
  fx('flash', p.x + Math.cos(p.dir) * 18, p.y + Math.sin(p.dir) * 18);
  const dmg = (7 + p.attrs.PER) * (1 + 0.08 * (p.skills.ranged.lv - 1));
  spawnProjectile(p.x + Math.cos(p.dir) * 14, p.y + Math.sin(p.dir) * 14, p.dir, 'bullet', dmg, 'player');
}

export function spawnProjectile(x, y, dir, kind, dmg, owner) {
  const spd = kind === 'bullet' ? 430 : 250;
  G.projectiles.push({ x, y, vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd, dir, kind, dmg, owner, t: 0 });
}

export function updateProjectiles(dt) {
  const p = G.player;
  for (const pr of G.projectiles) {
    pr.t += dt;
    if (pr.t > 1.8) { pr.remove = true; continue; }
    for (let s = 0; s < 2; s++) {
      pr.x += pr.vx * dt / 2; pr.y += pr.vy * dt / 2;
      if (isSolidAt(pr.x, pr.y)) { fx('puff', pr.x, pr.y); pr.remove = true; break; }
      if (pr.owner === 'player') {
        for (const e of G.entities) {
          if (e.dead) continue;
          if (dist(pr.x, pr.y, e.x, e.y) < e.r + 4) {
            damageEntity(e, pr.dmg);
            if (addSkillXP('ranged', 3)) { notify('Tiro subiu para o nível ' + p.skills.ranged.lv + '!'); sfx('level'); }
            pr.remove = true; break;
          }
        }
        if (pr.remove) break;
      } else if (!p.dead && dist(pr.x, pr.y, p.x, p.y) < p.r + 4) {
        damagePlayer(pr.dmg);
        pr.remove = true; break;
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr => !pr.remove);
}

export function useMedkit() {
  const p = G.player;
  if (p.dead) return;
  if (p.inv.medkits <= 0) { notify('Sem medkits.'); return; }
  if (p.hp >= p.maxHp) { notify('Vida já está cheia.'); return; }
  p.inv.medkits--;
  p.hp = Math.min(p.maxHp, p.hp + 40);
  sfx('heal');
  fxText(p.x, p.y - 20, '+40', '#8fd96a');
}
