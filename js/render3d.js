// Camada de visualização 3D (Three.js) sobre a simulação 2D existente.
// Convenção: plano do jogo (x, y em pixels) → mundo 3D (x, z em metros); 1 tile = 2 m.
import * as THREE from 'three';
import { G, TILE, TAU, clamp } from './state.js';
import { MAPW, MAPH, T, tiles, PEDESTAL } from './map.js';
import { objectiveTarget } from './quests.js';

const S = 2 / TILE; // px → metros

let renderer, scene, camera;
const entMeshes = new Map();   // entity.id -> THREE.Group
const prMeshes = new Map();    // projétil -> mesh
const fxMeshes = new Map();    // efeito -> mesh
let contMeshes = [];           // [{c, mesh}]
let contRef = null;
let artifact, beacon, viewPipe, viewPistol;

const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
const mat = c => new THREE.MeshLambertMaterial({ color: c });

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  const sky = 0x8d8d74; // céu empoeirado pós-apocalíptico
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 12, 95);

  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 220);
  scene.add(camera);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  scene.add(new THREE.HemisphereLight(0xb5b89c, 0x3a3528, 1.05));
  const sun = new THREE.DirectionalLight(0xfff0cf, 0.8);
  sun.position.set(40, 60, 20);
  scene.add(sun);

  buildGround();
  buildBlocks();
  buildTrees();
  buildPedestal();
  buildBeacon();
  buildViewmodel();
}

// ---------- mundo estático ----------
const TILE_RGB = {
  [T.GRASS]: '#4a5d36', [T.DIRT]: '#6b5436', [T.CONCRETE]: '#73736b', [T.WALL]: '#3a3a38',
  [T.TREE]: '#42522f', [T.WATER]: '#2f4f5c', [T.FLOOR]: '#857d6c', [T.RUBBLE]: '#5e5c52',
  [T.PALISADE]: '#6b5436',
};

function buildGround() {
  const cv = document.createElement('canvas');
  cv.width = MAPW * 4; cv.height = MAPH * 4;
  const c = cv.getContext('2d');
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = tiles[y * MAPW + x];
    c.fillStyle = TILE_RGB[t === T.TREE ? T.GRASS : t];
    c.fillRect(x * 4, y * 4, 4, 4);
    const h = hash(x, y);
    c.fillStyle = `rgba(${h % 2 ? 255 : 0},${h % 2 ? 255 : 0},${h % 2 ? 230 : 0},0.05)`;
    c.fillRect(x * 4 + (h % 3), y * 4 + ((h >> 2) % 3), 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(MAPW * 2, MAPH * 2),
    new THREE.MeshLambertMaterial({ map: tex }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(MAPW, 0, MAPH);
  scene.add(plane);
}

function buildBlocks() {
  const walls = [], pals = [];
  const inVault = (x, y) => x >= 4 && x <= 16 && y >= 27 && y <= 45;
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = tiles[y * MAPW + x];
    if (t === T.WALL) {
      const h = hash(x, y);
      const isRuin = x < 42 && !inVault(x, y);
      const height = inVault(x, y) ? 3.2 : isRuin ? (h % 3 === 0 ? 1.2 : 2.4 + (h % 5) * 0.18) : 2.4;
      const shade = 0x3a3a38 + ((h % 5) * 0x040404);
      walls.push({ x, y, height, color: shade });
    } else if (t === T.PALISADE) {
      pals.push({ x, y, height: 2.3, color: 0x6b4a26 + ((hash(x, y) % 4) * 0x030200) });
    }
  }
  for (const [list, baseCol] of [[walls, 0x3a3a38], [pals, 0x6b4a26]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach((b, i) => {
      m.makeScale(1, b.height, 1);
      m.setPosition(b.x * 2 + 1, b.height / 2, b.y * 2 + 1);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(b.color));
    });
    scene.add(im);
  }
}

function buildTrees() {
  const list = [];
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++)
    if (tiles[y * MAPW + x] === T.TREE) list.push({ x, y, h: hash(x, y) });
  if (!list.length) return;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.14, 0.24, 2.4, 6), mat(0x4a3520), list.length);
  const folha = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((t, i) => {
    const wx = t.x * 2 + 1 + (t.h % 7) * 0.1 - 0.3, wz = t.y * 2 + 1 + ((t.h >> 3) % 7) * 0.1 - 0.3;
    m.makeScale(1, 1, 1); m.setPosition(wx, 1.2, wz);
    trunk.setMatrixAt(i, m);
    const s = 0.85 + (t.h % 5) * 0.12;
    m.makeScale(s, s * (0.9 + (t.h % 3) * 0.15), s);
    m.setPosition(wx, 2.6 + (t.h % 3) * 0.2, wz);
    folha.setMatrixAt(i, m);
    folha.setColorAt(i, col.setHex(t.h % 3 ? 0x2e4426 : 0x35502b));
  });
  scene.add(trunk); scene.add(folha);
}

function buildPedestal() {
  const px = PEDESTAL.x * S, pz = PEDESTAL.y * S;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.0, 8), mat(0x55534b));
  base.position.set(px, 0.5, pz);
  scene.add(base);
  artifact = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32),
    new THREE.MeshLambertMaterial({ color: 0x6ee3ff, emissive: 0x2a8aa6 }));
  artifact.position.set(px, 1.45, pz);
  scene.add(artifact);
  const glow = new THREE.PointLight(0x6ee3ff, 1.4, 9);
  glow.position.set(px, 1.6, pz);
  artifact.userData.glow = glow;
  scene.add(glow);
}

function buildBeacon() {
  beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 40, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x6ee3ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false }));
  beacon.position.y = 20;
  scene.add(beacon);
}

// ---------- viewmodel (arma em primeira pessoa) ----------
function buildViewmodel() {
  viewPipe = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 6), mat(0x9a9a90));
  pipe.rotation.x = -Math.PI / 2.4;
  viewPipe.add(pipe);
  viewPipe.position.set(0.28, -0.25, -0.55);
  camera.add(viewPipe);

  viewPistol = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), mat(0x26261f));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.07), mat(0x1c1c18));
  grip.position.set(0, -0.1, 0.1);
  grip.rotation.x = 0.25;
  viewPistol.add(slide); viewPistol.add(grip);
  viewPistol.position.set(0.24, -0.22, -0.5);
  camera.add(viewPistol);
}

// ---------- modelos das entidades ----------
function makeEntityMesh(e) {
  const g = new THREE.Group();
  if (e.kind === 'human') {
    const shirt = e.dialog ? 0x7a3b2f : e.name === 'Sentinela' ? 0x39512f : 0x5a6470;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 1.05, 8), mat(shirt));
    body.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), mat(0xc9a07a));
    head.position.y = 1.34;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, TAU, 0, 1.3), mat(0x3a3026));
    hair.position.y = 1.37;
    g.add(body, head, hair);
    g.userData.body = body;
  } else {
    const bodyCol = e.boss ? 0x2e2e33 : 0x6b4a2f;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(bodyCol));
    body.scale.y = 1.2;
    body.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0x52381f));
    head.position.set(0.3, 1.18, 0);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), mat(0xb08968));
    face.position.set(0.52, 1.16, 0);
    g.add(body, head, face);
    // braços
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.85, 6), mat(bodyCol));
      arm.position.set(0.1, 0.5, side * 0.5);
      arm.rotation.x = side * 0.15;
      g.add(arm);
    }
    // faixa de facção na cabeça
    const bandCol = e.faction === 'mil' ? 0xc0392b : e.faction === 'pac' ? 0x7fc56f : null;
    if (bandCol) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 6, 12), mat(bandCol));
      band.position.set(0.3, 1.26, 0);
      band.rotation.x = Math.PI / 2;
      g.add(band);
    }
    if (e.faction === 'mil') { // lança
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), mat(0x8a6a3a));
      spear.rotation.z = Math.PI / 2 - 0.35;
      spear.position.set(0.45, 1.0, 0.3);
      g.add(spear);
    }
    g.scale.setScalar(e.r / 10);
    g.userData.body = body;
  }
  return g;
}

// ---------- sync por frame ----------
function syncEntities(dt) {
  const seen = new Set();
  for (const e of G.entities) {
    seen.add(e.id);
    let g = entMeshes.get(e.id);
    if (!g) { g = makeEntityMesh(e); entMeshes.set(e.id, g); scene.add(g); }
    g.position.set(e.x * S, 0, e.y * S);
    g.rotation.y = -e.dir;
    const baseScale = e.kind === 'human' ? 1 : e.r / 10;
    g.scale.y = e.dead ? baseScale * 0.22 : baseScale;
    if (e.flashT > 0) {
      e.flashT -= dt;
      g.userData.body.material.emissive.setHex(0x801510);
    } else {
      g.userData.body.material.emissive.setHex(0x000000);
    }
  }
  for (const [id, g] of entMeshes) {
    if (!seen.has(id)) { scene.remove(g); entMeshes.delete(id); }
  }
}

function syncProjectiles() {
  const seen = new Set();
  for (const pr of G.projectiles) {
    seen.add(pr);
    let m = prMeshes.get(pr);
    if (!m) {
      if (pr.kind === 'bullet') {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xffe98a }));
      } else {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), mat(0x8a6a3a));
        m.geometry.rotateZ(Math.PI / 2);
      }
      prMeshes.set(pr, m);
      scene.add(m);
    }
    m.position.set(pr.x * S, 1.3, pr.y * S);
    m.rotation.y = -pr.dir;
  }
  for (const [pr, m] of prMeshes) {
    if (!seen.has(pr)) { scene.remove(m); prMeshes.delete(pr); }
  }
}

function syncEffects() {
  const seen = new Set();
  for (const f of G.effects) {
    if (f.kind === 'text' || f.kind === 'slash') continue;
    seen.add(f);
    let m = fxMeshes.get(f);
    if (!m) {
      const col = f.kind === 'flash' ? 0xffe98a : 0xb4b4aa;
      m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      fxMeshes.set(f, m);
      scene.add(m);
    }
    const k = 1 - f.t / f.life;
    m.position.set(f.x * S, 1.3, f.y * S);
    m.scale.setScalar(f.kind === 'puff' ? 1 + (1 - k) * 4 : 1 + k);
    m.material.opacity = k;
  }
  for (const [f, m] of fxMeshes) {
    if (!seen.has(f)) { scene.remove(m); fxMeshes.delete(f); }
  }
}

function syncContainers() {
  if (G.containers !== contRef) {
    for (const cm of contMeshes) scene.remove(cm.mesh);
    contMeshes = [];
    contRef = G.containers;
    for (const c of G.containers) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.65),
        mat(c.big ? 0x8a6a30 : 0x7a5a30));
      m.position.set(c.x * S, 0.3, c.y * S);
      m.rotation.y = hash(c.x | 0, c.y | 0) % 7 * 0.2;
      scene.add(m);
      contMeshes.push({ c, mesh: m });
    }
  }
  for (const cm of contMeshes)
    cm.mesh.material.color.setHex(cm.c.opened ? 0x3a2c18 : (cm.c.big ? 0x8a6a30 : 0x7a5a30));
}

export function draw3d(dt, pitch) {
  if (!renderer) return;
  const p = G.player;

  syncContainers();
  syncEntities(dt);
  syncProjectiles();
  syncEffects();

  // artefato girando no pedestal
  const taken = G.flags && G.flags.artifactTaken;
  artifact.visible = !taken;
  artifact.userData.glow.visible = !taken;
  artifact.rotation.y += dt * 2;
  artifact.position.y = 1.45 + Math.sin(G.time * 3) * 0.08;

  // pilar de objetivo
  const t = objectiveTarget();
  if (t) {
    beacon.visible = true;
    beacon.position.set(t.x * S, 20, t.y * S);
    beacon.material.opacity = 0.16 + 0.08 * Math.sin(G.time * 4);
  } else beacon.visible = false;

  // câmera em primeira pessoa
  const eyeH = p.species === 'gorila' ? 1.85 : p.species === 'bonobo' ? 1.5 : 1.7;
  camera.position.set(p.x * S, eyeH, p.y * S);
  const cp = Math.cos(pitch);
  camera.lookAt(
    p.x * S + Math.cos(p.dir) * cp,
    eyeH + Math.sin(pitch),
    p.y * S + Math.sin(p.dir) * cp);

  // viewmodel: arma equipada + animação de ataque
  viewPipe.visible = p.weapon === 'pipe' && !p.dead;
  viewPistol.visible = p.weapon === 'pistol' && !p.dead;
  const kick = p.attackCd > 0 ? p.attackCd : 0;
  const bob = Math.sin(G.time * 7) * 0.008;
  viewPipe.rotation.x = -kick * 1.6;
  viewPipe.position.y = -0.25 + bob;
  viewPistol.position.z = -0.5 + kick * 0.1;
  viewPistol.position.y = -0.22 + bob;

  renderer.render(scene, camera);
}
