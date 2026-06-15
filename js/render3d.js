// Camada de visualização 3D (Three.js) sobre a simulação 2D existente.
// Convenção: plano do jogo (x, y em pixels) → mundo 3D (x, z em metros); 1 tile = 2 m.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Clone que religa o esqueleto: Object3D.clone() comum quebra SkinnedMesh.
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { G, TILE, TAU, clamp } from './state.js';
import { MAPW, MAPH, T, tiles, PEDESTAL } from './map.js';
import { objectiveTarget } from './quests.js';

// ---------- Modelos GLTF por espécie (Rota A) ----------
// chimpanze/gorila/orangotango/bonobo: CC-BY (Poly by Google / cameron_). Atribuição em assets/ATTRIBUTION.md.
// bonobo reusa o mesh do chimpanze com material mais escuro (espécies anatomicamente idênticas).
const SPECIES_MODEL_URL = {
  chimpanze: './assets/models/chimpanzee.glb',
  gorila:    './assets/models/gorilla.glb',
  orangotango: './assets/models/orangutan.glb',
  bonobo:    './assets/models/bonobo.glb',
};
const modelCache = new Map();      // speciesId → THREE.Group (template)  — populado quando o GLB carrega
const modelLoadFailures = new Set();
let gltfLoader;
// Yaw corretivo por espécie: a convenção do jogo é frente = +x local, mas os
// GLBs olham para -z (verificado empiricamente nos quatro modelos — chimpanzé,
// gorila e bonobo do Poly by Google e orangotango do cameron_).
const MODEL_YAW = {
  chimpanze: Math.PI / 2, gorila: Math.PI / 2,
  orangotango: Math.PI / 2, bonobo: Math.PI / 2,
};

const S = 2 / TILE; // px → metros
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }; // smoothstep

let renderer, scene, camera, composer, bloomPass, vignettePass, fxaaPass;
const entMeshes = new Map();   // entity.id -> THREE.Group
const prMeshes = new Map();    // projétil -> mesh
const fxMeshes = new Map();    // efeito -> mesh
let contMeshes = [];           // [{c, mesh}]
let contRef = null;
let artifact, beacon;
let wallWindows;               // InstancedMesh de janelas nos prédios
let treeBranches;              // InstancedMesh de galhos de árvore

// ---------- terceira pessoa: personagem do jogador + câmera orbital ----------
let playerRig;                 // grupo raiz do personagem (posição/rotação no mundo)
let playerModel;               // filho do rig: GLB da espécie ou procedural (fallback)
let playerBody = null;         // mesh de referência para o flash de dano
let playerIsModelMesh = false; // true quando o GLB já substituiu o procedural
let playerSpeciesBuilt = null; // espécie do modelo atual (rebuild em novo jogo)
let playerModelH = 1.2;        // altura (bbox) do modelo atual — dirige câmera e mão
let playerArm, playerWeaponPipe, playerWeaponPistol; // braço-pivô (ombro) + armas
let playerMixer = null, playerActions = null, playerActionName = null; // animação esqueletal
let playerMoveT = 0;           // fase da animação procedural de caminhada
let lastPX = 0, lastPZ = 0;    // posição do frame anterior (mede velocidade real)
const cameraBlockers = [];     // meshes sólidas que a câmera orbital não atravessa
const camRay = new THREE.Raycaster();
const _camTarget = new THREE.Vector3(), _camPos = new THREE.Vector3(),
      _camDir = new THREE.Vector3(), _lookAt = new THREE.Vector3();

const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
// MeshStandardMaterial (PBR) com rugosidade/metalidade por uso. Lambert não reage
// à luz direcional com variação de intensidade — Standard sim, e é o que faz o sol
// parecer "sol" e não uma luz chapada.
const mat = (c, r = 0.85, m = 0.0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
// Alvo do sol: precisa existir na cena para o DirectionalLight usá-lo como foco.
const sunTarget = new THREE.Object3D();
let sun;

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // sombras com bordas suaves
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // curva PBR cinematográfica
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace; // sRGB na saída
  scene = new THREE.Scene();
  // O céu agora é uma esfera interna com gradiente (buildSky). Limpar o background
  // para não conflitar com a cor chapada.
  scene.background = null;
  // Névoa de montanha (referência: floresta de pinheiros do Skyrim) — começa mais
  // longe que na versão FP para a câmera recuada não "nadar" dentro do haze.
  scene.fog = new THREE.Fog(0xaab3a0, 26, 110); // cor de horizonte — fog e céu combinam no horizonte

  // Far precisa ser grande (> 200m) para a esfera do céu não ser clipada.
  // FOV 62: terceira pessoa pede menos distorção que os 72 do modo FP.
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
  scene.add(camera);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setSize(innerWidth, innerHeight);
      bloomPass.setSize(innerWidth, innerHeight);
      const pr = Math.min(devicePixelRatio, 2);
      fxaaPass.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
  };
  resize();
  window.addEventListener('resize', resize);

  // Hemisphere preenche as áreas de sombra — em terceira pessoa o personagem fica
  // muitas vezes na sombra de prédios/árvores e não pode virar uma silhueta preta.
  scene.add(new THREE.HemisphereLight(0xbcc2b0, 0x46402f, 1.15));
  // Sol baixo (golden hour): sombras longas, drama visual.
  sun = new THREE.DirectionalLight(0xfff0cf, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.bias = -0.0004; // evita acne
  sun.shadow.normalBias = 0.025; // evita sangria
  sun.shadow.radius = 2.5; // PCF: penumbra mais suave
  sun.position.set(40, 60, 20);
  sun.target = sunTarget;
  scene.add(sun);
  scene.add(sunTarget);

  // Rim light fria oposta ao sol: recorta a silhueta do personagem e das árvores
  // contra o fundo (sem sombra — é só um contorno, não uma segunda fonte "real").
  const rim = new THREE.DirectionalLight(0xbfd4e0, 0.4);
  rim.position.set(-30, 40, -25);
  scene.add(rim);

  buildSky();
  buildMountains();
  buildGround();
  buildBlocks();
  buildTrees();
  buildGroundDetails();
  buildWallDetails();
  buildPedestal();
  buildBeacon();
  buildPlayerRig();

  // ---------- pós-processamento: bloom no artefato + balas, vignette ----------
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // SSAO foi testado (SSAOPass r160) e descartado: com far=600 a precisão de
  // profundidade deixa a oclusão invisível, e o passe custa uma render extra
  // da cena inteira. O "assentamento" vem das sombras PCF + bump do chão.
  // threshold: 0.6 = só pega o que passar desse brilho linear.
  //   bullets (yellow), beacon (cyan) e artefato (cyan emissive) — todos acima.
  //   chão/paredes/NPCs ficam abaixo. Sem bloom "geral" indesejado.
  // strength 0.55 + radius 0.55 = halo cinematográfico moderado, não ofuscante.
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.55, 0.6);
  composer.addPass(bloomPass);
  // Vignette: cantos da tela escurecidos. 0.85 = quase imperceptível; 1.6 = cinema.
  vignettePass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uStrength: { value: 1.1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uStrength; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5; float v = 1.0 - dot(q, q) * uStrength; gl_FragColor = vec4(c.rgb * clamp(v, 0.0, 1.0), c.a); }',
  });
  composer.addPass(vignettePass);
  // OutputPass aplica tone mapping + conversão sRGB no final da cadeia
  // (sem isso, composer.render() escreveria em linear, e ficaria errado na tela).
  composer.addPass(new OutputPass());
  // FXAA por último (sobre a imagem já em sRGB): o composer não tem MSAA,
  // então sem isso as bordas das instâncias serrilharia.
  fxaaPass = new ShaderPass(FXAAShader);
  {
    const pr = Math.min(devicePixelRatio, 2);
    fxaaPass.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
  }
  composer.addPass(fxaaPass);

  // Dispara o carregamento dos modelos GLB (async; o jogo segue com procedural até chegarem)
  startLoadingEntityModels();

  // Expor referências de debug no window para inspeção via console
  if (typeof window !== 'undefined') {
    window.__r3d = { scene, camera, renderer, composer, entMeshes, modelCache, modelLoadFailures, getModelId, tryMakeApeModelMesh, SPECIES_MODEL_URL, GLTFLoader, THREE };
  }
}

// ---------- céu: esfera interna com gradiente vertical ----------
// Filha da câmera para não ter paralaxe. Cor de topo = céu; base = haze do horizonte (== fog).
function buildSky() {
  const geo = new THREE.SphereGeometry(220, 32, 16);
  // Cores: bottom = haze (mesma do fog), horizon = tom de transição, top = azul-acinzentado
  // frio de montanha — combina com a névoa 0xaab3a0 no horizonte.
  const top = new THREE.Color(0x8da0a8);
  const horizon = new THREE.Color(0xbdbfa4);
  const bottom = new THREE.Color(0x262a24);
  const col = geo.attributes.position;
  const colors = new Float32Array(col.count * 3);
  for (let i = 0; i < col.count; i++) {
    const y = col.getY(i);
    // normaliza de [-220, 220] para [0, 1]
    const t = (y + 220) / 440;
    const c = new THREE.Color();
    if (t > 0.55) c.copy(horizon).lerp(top, (t - 0.55) / 0.45);
    else c.copy(bottom).lerp(horizon, t / 0.55);
    // dá um leve viés quente perto do horizonte para "golden hour"
    c.r += 0.04 * (1 - t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  sky.renderOrder = -1; // desenha primeiro, fica no fundo
  camera.add(sky);
}

// ---------- montanhas no horizonte ----------
// Dois anéis de cones low-poly ao redor do mapa, com fog desligado e cor manual
// "pré-fogada": o anel próximo é mais escuro (menos haze), o distante quase some
// no céu — fecha a composição como as montanhas de Riverwood.
function buildMountains() {
  const cx = MAPW, cz = MAPH; // centro do mapa em metros
  const haze = new THREE.Color(0xaab3a0), slate = new THREE.Color(0x55636b);
  const rings = [
    { n: 16, dist: 150, hMin: 30, hVar: 40, mix: 0.62 },
    { n: 20, dist: 225, hMin: 55, hVar: 75, mix: 0.8 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const h = hash(i * 53 + ring.n, i * 91 + 3);
      const ang = (i / ring.n) * TAU + ((h % 7) - 3) * 0.05;
      const dist = ring.dist + (h % 40);
      const peakH = ring.hMin + (h % ring.hVar);
      const baseR = peakH * (0.8 + ((h >> 4) % 4) * 0.12);
      const col = slate.clone().lerp(haze, ring.mix + ((h >> 6) % 3) * 0.04);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(baseR, peakH, 5),
        new THREE.MeshBasicMaterial({ color: col, fog: false }));
      cone.position.set(cx + Math.cos(ang) * dist, peakH / 2 - 6, cz + Math.sin(ang) * dist);
      cone.rotation.y = h % 10;
      scene.add(cone);
    }
  }
}

// ---------- mundo estático ----------
const TILE_RGB = {
  [T.GRASS]: '#4a5d36', [T.DIRT]: '#6b5436', [T.CONCRETE]: '#73736b', [T.WALL]: '#3a3a38',
  [T.TREE]: '#42522f', [T.WATER]: '#2f4f5c', [T.FLOOR]: '#857d6c', [T.RUBBLE]: '#5e5c52',
  [T.PALISADE]: '#6b5436',
};

function buildGround() {
  // 16 px por tile (era 4): resolução suficiente para lajes de pedra e manchas
  // de vegetação legíveis de perto — referência: trilha de pedra do Skyrim.
  const PX = 16;
  const cv = document.createElement('canvas');
  cv.width = MAPW * PX; cv.height = MAPH * PX;
  const c = cv.getContext('2d');
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    let t = tiles[y * MAPW + x];
    if (t === T.TREE) t = T.GRASS;
    if (t === T.WALL || t === T.PALISADE) t = T.CONCRETE; // chão escondido sob blocos
    const h = hash(x, y);
    const X = x * PX, Y = y * PX;
    c.fillStyle = TILE_RGB[t];
    c.fillRect(X, Y, PX, PX);
    // variação de tom por tile, bem suave — contraste alto aqui vira xadrez
    c.globalAlpha = 0.025 + (h % 4) * 0.008;
    c.fillStyle = h % 2 ? '#fff6dd' : '#06080a';
    c.fillRect(X, Y, PX, PX);
    c.globalAlpha = 1;

    if (t === T.CONCRETE || t === T.FLOOR || t === T.RUBBLE) {
      // calçamento: gap escuro + 4 lajes irregulares por tile
      c.fillStyle = 'rgba(18,16,13,0.5)';
      c.fillRect(X, Y, PX, PX);
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const hs = hash(x * 4 + sx + 17, y * 4 + sy + 31);
        const g = 88 + (hs % 52) + (t === T.FLOOR ? 20 : 0);
        c.fillStyle = `rgb(${g},${g - 4},${g - 11})`;
        c.beginPath();
        c.ellipse(X + sx * 8 + 4, Y + sy * 8 + 4,
          3.2 + (hs % 3) * 0.5, 2.6 + ((hs >> 3) % 3) * 0.5, (hs % 6) * 0.5, 0, TAU);
        c.fill();
      }
      // musgo ocasional nas juntas
      if (h % 5 === 1) {
        c.fillStyle = 'rgba(74,93,54,0.5)';
        c.fillRect(X + (h % 9), Y + ((h >> 4) % 9), 4, 3);
      }
    } else if (t === T.GRASS) {
      for (let k = 0; k < 6; k++) {
        const hk = hash(x * 31 + k * 7, y * 17 + k * 5);
        c.fillStyle = ['#566b3c', '#465a30', '#5f7544', '#3d5029', '#6b7d4a'][hk % 5];
        c.globalAlpha = 0.55;
        c.fillRect(X + hk % (PX - 4), Y + (hk >> 5) % (PX - 4), 2 + hk % 3, 2 + (hk >> 7) % 3);
      }
      c.globalAlpha = 1;
    } else if (t === T.DIRT) {
      for (let k = 0; k < 5; k++) {
        const hk = hash(x * 13 + k * 11, y * 29 + k * 3);
        c.fillStyle = ['#75603e', '#5e4a2e', '#80684a', '#52402a'][hk % 4];
        c.globalAlpha = 0.5;
        c.fillRect(X + hk % (PX - 4), Y + (hk >> 5) % (PX - 4), 2 + hk % 4, 2 + (hk >> 7) % 3);
      }
      c.globalAlpha = 1;
      // seixos ocasionais na trilha
      if (h % 7 === 2) {
        c.fillStyle = '#8b857a';
        c.beginPath();
        c.ellipse(X + 3 + (h % 9), Y + 3 + ((h >> 4) % 9), 1.6, 1.2, h % 4, 0, TAU);
        c.fill();
      }
    } else if (t === T.WATER) {
      c.fillStyle = 'rgba(180,210,220,0.18)';
      c.fillRect(X, Y + (h % 10), PX, 1.5);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(MAPW * 2, MAPH * 2),
    // bumpMap reusa o próprio canvas: lajes claras "sobem", juntas escuras "afundam"
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0,
      bumpMap: tex, bumpScale: 0.5 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(MAPW, 0, MAPH);
  plane.receiveShadow = true;
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
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0 }), list.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach((b, i) => {
      m.makeScale(1, b.height, 1);
      m.setPosition(b.x * 2 + 1, b.height / 2, b.y * 2 + 1);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(b.color));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
    cameraBlockers.push(im); // a câmera orbital recua na frente de paredes/palisades
  }
}

// ---------- detalhes nas paredes: janelas escuras em ~28% dos blocos ----------
// Sem geometria nova nos próprios prédios — é um InstancedMesh de planos finos
// colado na superfície. Custa 1 draw call.
function buildWallDetails() {
  const inVault = (x, y) => x >= 4 && x <= 16 && y >= 27 && y <= 45;
  const windows = [];
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    if (tiles[y * MAPW + x] !== T.WALL) continue;
    const h = hash(x, y);
    if (h % 100 > 28) continue; // ~28% das paredes recebem uma janela
    // Mesma fórmula de altura de buildBlocks — não refatoramos pra manter a função independente
    const isRuin = x < 42 && !inVault(x, y);
    const height = inVault(x, y) ? 3.2 : isRuin ? (h % 3 === 0 ? 1.2 : 2.4 + (h % 5) * 0.18) : 2.4;
    const wx = x * 2 + 1, wz = y * 2 + 1;
    const wy = Math.max(0.6, height * 0.55); // bem na "altura dos olhos" do andar
    // Escolhe uma das 4 faces via hash — distribui janelas em todos os lados
    const face = (h >> 8) % 4;
    const rotY = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][face];
    const dx = [0.51, -0.51, 0, 0][face];
    const dz = [0, 0, 0.51, -0.51][face];
    windows.push({ pos: [wx + dx, wy, wz + dz], rotY });
  }
  if (!windows.length) return;
  const im = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.6, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 0.3, metalness: 0.15, emissive: 0x040608 }),
    windows.length,
  );
  const m = new THREE.Matrix4();
  windows.forEach((w, i) => {
    m.makeRotationY(w.rotY);
    m.setPosition(w.pos[0], w.pos[1], w.pos[2]);
    im.setMatrixAt(i, m);
  });
  // Janela só recebe sombra (se uma árvore/parede sombrear), não projeta (é um plano fino)
  im.receiveShadow = true;
  im.castShadow = false;
  scene.add(im);
  wallWindows = im;
}

function buildTrees() {
  const list = [];
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++)
    if (tiles[y * MAPW + x] === T.TREE) list.push({ x, y, h: hash(x, y) });
  if (!list.length) return;

  // ~70% pinheiros (silhueta de conífera, referência visual: floresta do Skyrim),
  // ~30% árvores de copa redonda para quebrar a repetição.
  const pines = list.filter(t => t.h % 10 < 7);
  const rounds = list.filter(t => t.h % 10 >= 7);
  const wpos = t => [t.x * 2 + 1 + (t.h % 7) * 0.1 - 0.3, t.y * 2 + 1 + ((t.h >> 3) % 7) * 0.1 - 0.3];
  const m = new THREE.Matrix4(), col = new THREE.Color();

  // Troncos (compartilhados): pinheiros mais altos, redondas mais baixas.
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13, 0.26, 1, 6), mat(0x4a3520, 0.9, 0.0), list.length);
  list.forEach((t, i) => {
    const [wx, wz] = wpos(t);
    const th = t.h % 10 < 7 ? 3.4 + (t.h % 4) * 0.3 : 2.4;
    m.makeScale(1, th, 1); m.setPosition(wx, th / 2, wz);
    trunk.setMatrixAt(i, m);
  });
  trunk.castShadow = true; trunk.receiveShadow = true;
  scene.add(trunk);

  // Pinheiros: 3 cones empilhados por árvore, estreitando para o topo.
  if (pines.length) {
    const cone = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1.7, 7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 }),
      pines.length * 3);
    let ci = 0;
    for (const t of pines) {
      const [wx, wz] = wpos(t);
      const s = 0.9 + (t.h % 5) * 0.14;          // porte da árvore
      const baseY = 2.0 + (t.h % 4) * 0.25;
      for (let k = 0; k < 3; k++) {
        const ck = 1 - k * 0.26;                  // cada andar é mais estreito
        m.makeScale(s * ck * 1.25, s * (1 + k * 0.06), s * ck * 1.25);
        m.setPosition(wx, baseY + k * s * 1.05, wz);
        cone.setMatrixAt(ci, m);
        // verde-abeto escuro com variação fria por instância
        cone.setColorAt(ci, col.setHex(t.h % 3 ? 0x24381f : 0x2c4527).offsetHSL(0, 0, ((t.h >> 5) % 5) * 0.012));
        ci++;
      }
    }
    cone.castShadow = true; cone.receiveShadow = true;
    scene.add(cone);
  }

  // Copas redondas (decíduas).
  if (rounds.length) {
    const folha = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.3, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 }), rounds.length);
    rounds.forEach((t, i) => {
      const [wx, wz] = wpos(t);
      const s = 0.85 + (t.h % 5) * 0.12;
      m.makeScale(s, s * (0.9 + (t.h % 3) * 0.15), s);
      m.setPosition(wx, 2.6 + (t.h % 3) * 0.2, wz);
      folha.setMatrixAt(i, m);
      folha.setColorAt(i, col.setHex(t.h % 3 ? 0x2e4426 : 0x35502b));
    });
    folha.castShadow = false; folha.receiveShadow = true;
    scene.add(folha);

    // Galhos só nas decíduas: 2 cilindros finos saindo do topo do tronco.
    const branches = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5), mat(0x3a2818, 0.95, 0.0), rounds.length * 2);
    const bq = new THREE.Quaternion(), be = new THREE.Euler();
    let bi = 0;
    for (const t of rounds) {
      const [wx, wz] = wpos(t);
      for (let k = 0; k < 2; k++) {
        const ang = (t.h * 0.13 + k * 2.4) % TAU;
        be.set(0, 0, ang);
        bq.setFromEuler(be);
        const len = 0.7 + ((t.h >> (k * 3)) % 5) * 0.12;
        m.compose(
          new THREE.Vector3(wx + Math.cos(ang) * 0.3, 2.0 + (k * 0.3), wz + Math.sin(ang) * 0.3),
          bq,
          new THREE.Vector3(1, len, 1),
        );
        branches.setMatrixAt(bi++, m);
      }
    }
    branches.castShadow = true; branches.receiveShadow = true;
    scene.add(branches);
    treeBranches = branches;
  }
}

// ---------- vegetação rasteira e rochas ----------
// Tufos de grama, samambaias e pedras espalhados por hash nos tiles de grama/terra.
// Tudo InstancedMesh: 3 draw calls para milhares de instâncias.
function buildGroundDetails() {
  const grass = [], ferns = [], rocks = [], boulders = [];
  for (let y = 1; y < MAPH - 1; y++) for (let x = 1; x < MAPW - 1; x++) {
    const t = tiles[y * MAPW + x];
    if (t !== T.GRASS && t !== T.DIRT) continue;
    const h = hash(x * 3 + 1, y * 5 + 2);
    if (t === T.GRASS && h % 5 < 2) grass.push({ x, y, h });           // ~40% dos tiles de grama
    if (t === T.GRASS && h % 12 === 3) ferns.push({ x, y, h });        // samambaias
    if (h % 89 === 7) rocks.push({ x, y, h });                          // pedras pequenas
    if (t === T.GRASS && h % 167 === 11) boulders.push({ x, y, h });    // pedregulhos raros
  }
  const m = new THREE.Matrix4(), col = new THREE.Color();
  const place = (im, list, fn) => {
    list.forEach((t, i) => fn(t, i));
    im.receiveShadow = true;
    scene.add(im);
  };

  if (grass.length) {
    // Cone baixo de 4 lados = tufo de grama barato; cor varia entre verde-seco e verde-vivo.
    const im = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.16, 0.42, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 }),
      grass.length);
    place(im, grass, (t, i) => {
      const wx = t.x * 2 + 0.3 + (t.h % 9) * 0.18, wz = t.y * 2 + 0.3 + ((t.h >> 4) % 9) * 0.18;
      const s = 0.7 + (t.h % 6) * 0.13;
      m.makeScale(s, s * (0.8 + ((t.h >> 7) % 4) * 0.2), s);
      m.setPosition(wx, 0.18 * s, wz);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(t.h % 3 ? 0x55663a : 0x466032).offsetHSL(0, 0, ((t.h >> 9) % 5) * 0.015));
    });
  }

  if (ferns.length) {
    // Samambaia: icosaedro achatado verde-escuro (lê como arbusto rasteiro à distância).
    const im = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 }),
      ferns.length);
    place(im, ferns, (t, i) => {
      const wx = t.x * 2 + 0.5 + (t.h % 7) * 0.15, wz = t.y * 2 + 0.5 + ((t.h >> 4) % 7) * 0.15;
      m.makeScale(1 + (t.h % 3) * 0.25, 0.45, 1 + ((t.h >> 6) % 3) * 0.25);
      m.setPosition(wx, 0.14, wz);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(0x2f4a28).offsetHSL(0, 0, ((t.h >> 8) % 4) * 0.02));
    });
  }

  if (rocks.length) {
    const im = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.02 }),
      rocks.length);
    place(im, rocks, (t, i) => {
      const wx = t.x * 2 + 1, wz = t.y * 2 + 1;
      const s = 0.5 + (t.h % 7) * 0.18;
      m.makeRotationY((t.h % 12) * 0.5);
      m.scale(new THREE.Vector3(s * (1 + (t.h % 3) * 0.3), s * 0.7, s));
      m.setPosition(wx, s * 0.22, wz);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(t.h % 2 ? 0x6e6e66 : 0x7d7d72));
    });
    im.castShadow = true;
  }

  if (boulders.length) {
    // Pedregulhos de 1.5–3 m com topo esverdeado (musgo), como os da referência.
    const im = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.02 }),
      boulders.length);
    place(im, boulders, (t, i) => {
      const wx = t.x * 2 + 1, wz = t.y * 2 + 1;
      const s = 0.8 + (t.h % 8) * 0.18;
      m.makeRotationY((t.h % 12) * 0.55);
      m.scale(new THREE.Vector3(s * (1 + (t.h % 3) * 0.25), s * 0.62, s));
      m.setPosition(wx, s * 0.3, wz);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(t.h % 3 ? 0x707a6c : 0x7b8276));
    });
    im.castShadow = true;
  }
}

function buildPedestal() {
  const px = PEDESTAL.x * S, pz = PEDESTAL.y * S;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.0, 8), mat(0x55534b, 0.8, 0.1));
  base.position.set(px, 0.5, pz);
  base.castShadow = true; base.receiveShadow = true;
  scene.add(base);
  artifact = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32),
    // emissive 0x4cd0f0 + intensity 1.8 → luminância ~0.88, acima do threshold de bloom
    new THREE.MeshStandardMaterial({ color: 0x6ee3ff, emissive: 0x4cd0f0, emissiveIntensity: 1.8,
      roughness: 0.25, metalness: 0.7 }));
  artifact.position.set(px, 1.45, pz);
  // Artefato emite luz, mas não projeta sombra (é um ponto flutuante, não ancora no chão)
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

// ---------- personagem do jogador (terceira pessoa) ----------
// O rig é um grupo no mundo: [modelo da espécie] + [armas na altura da mão].
// O modelo é o GLB da espécie escolhida (o chimpanzé é o herói padrão); enquanto o
// GLB baixa, usa o procedural. A locomoção é animada proceduralmente (bob + balanço),
// já que os GLBs do Poly são estáticos, sem skeleton.
function buildPlayerRig() {
  playerRig = new THREE.Group();
  scene.add(playerRig);
  rebuildPlayerModel();

  // Braço-pivô: um grupo no ombro direito. A "mão" é a origem do grupo; as armas
  // ficam penduradas a partir dela. Girar o braço descreve um arco real (golpe),
  // em vez de só inclinar a arma flutuando na frente da barriga.
  playerArm = new THREE.Group();
  playerRig.add(playerArm);

  // Cano de ferro: pendurado para baixo a partir da mão (eixo Y do cilindro).
  playerWeaponPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.52, 6), mat(0x9a9a90, 0.45, 0.6));
  playerWeaponPipe.position.set(0, -0.26, 0); // topo do cano na mão; resto desce
  playerWeaponPipe.castShadow = true;

  // Pistola: cano para a frente (+x) a partir da mão.
  playerWeaponPistol = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.055), mat(0x26261f, 0.35, 0.7));
  slide.position.set(0.14, 0, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.05), mat(0x1c1c18, 0.4, 0.6));
  grip.position.set(0.02, -0.11, 0);
  grip.rotation.z = 0.2;
  playerWeaponPistol.add(slide, grip);
  slide.castShadow = true;

  playerArm.add(playerWeaponPipe, playerWeaponPistol);
}

function rebuildPlayerModel() {
  if (playerModel) playerRig.remove(playerModel);
  const sp = (G.player && G.player.species) || 'chimpanze';
  playerModel = instantiateSpeciesModel(sp)
    || makeProceduralEntityMesh({ kind: 'ape', faction: null });
  playerIsModelMesh = playerModel.userData.isModelMesh === true;
  playerSpeciesBuilt = sp;
  // Animação esqueletal (só quando o GLB traz clipes; senão fica null → procedural)
  playerMixer = playerModel.userData.mixer || null;
  playerActions = playerModel.userData.actions || null;
  playerActionName = null;
  // Materiais exclusivos: o flash de dano do jogador não pode tingir os NPCs
  // que compartilham o mesmo template GLB.
  playerBody = null;
  playerModel.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      // A pelagem dos GLBs é quase preta; um boost só no herói o destaca dos NPCs
      // e evita que vire silhueta quando está em sombra.
      if (o.material.color) o.material.color.multiplyScalar(1.3);
      if (!playerBody && 'emissive' in o.material) playerBody = o;
    }
  });
  playerRig.add(playerModel);
  // Altura real do modelo: o gorila (1.57 m) e o chimpanzé (1.18 m) precisam de
  // enquadramentos diferentes — o raio de colisão (p.r) não conta essa história.
  const box = new THREE.Box3().setFromObject(playerModel);
  playerModelH = Math.max(0.6, box.max.y - box.min.y);
}

// Acha a primeira ação cujo nome contém um dos termos (case-insensitive).
// Tolera convenções diferentes de nomes de clipe (Mixamo, Quaternius, etc.).
function pickAction(terms) {
  if (!playerActions) return null;
  const names = Object.keys(playerActions);
  for (const term of terms) {
    const hit = names.find(n => n.includes(term));
    if (hit) return hit;
  }
  return names[0] || null;
}

// Transiciona para uma ação com crossfade suave (estilo AnimationTree do Zelda).
function setPlayerAction(name, fade = 0.2) {
  if (!playerActions || !name || name === playerActionName) return;
  const next = playerActions[name];
  if (!next) return;
  const prev = playerActionName && playerActions[playerActionName];
  next.reset().play();
  if (prev) { next.crossFadeFrom(prev, fade, false); }
  playerActionName = name;
}

// ---------- modelos das entidades ----------
// Dispara o download de um modelo. Quando chega, faz upgrade das entities daquela espécie
// que ainda estão usando a mesh procedural.
function loadModelAsync(speciesId) {
  if (modelCache.has(speciesId) || modelLoadFailures.has(speciesId)) return;
  if (!gltfLoader) gltfLoader = new GLTFLoader();
  const url = SPECIES_MODEL_URL[speciesId];
  gltfLoader.loadAsync(url).then(gltf => {
    const root = gltf.scene;
    // Configurar shadows no template
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // Guarda a cena E os clipes de animação. GLBs estáticos (atuais) têm clips=[]
    // e seguem pelo caminho procedural; um GLB riggado ativa o AnimationMixer.
    modelCache.set(speciesId, { scene: root, clips: gltf.animations || [] });
    // Upgrade: para cada entity daquela espécie que já existe, recriar a mesh.
    // Na tela inicial G.entities ainda não existe (resetCore só roda no COMEÇAR) —
    // sem o guard, o throw aqui marcava o modelo como "falho" para sempre.
    for (const e of G.entities || []) {
      if (getModelId(e) === speciesId) {
        const oldMesh = entMeshes.get(e.id);
        if (oldMesh && !oldMesh.userData.isModelMesh) {
          scene.remove(oldMesh);
          entMeshes.delete(e.id);
        }
      }
    }
  }).catch(err => {
    console.error(`[render3d] Falha ao carregar modelo ${speciesId}:`, err);
    modelLoadFailures.add(speciesId);
  });
}

function startLoadingEntityModels() {
  for (const id of Object.keys(SPECIES_MODEL_URL)) loadModelAsync(id);
}

// Mapeia um NPC ao id do modelo a usar.
// Regra: pac → orangotango, mil → gorila, sem faction → chimpanze, boss → gorila.
// Todo símio usa GLB ('ape', 'soldier', caçadores); só humanos ficam procedurais.
function getModelId(e) {
  if (e.kind === 'human') return null;
  if (e.boss) return 'gorila';
  if (e.faction === 'mil') return 'gorila';
  if (e.faction === 'pac') return 'orangotango';
  return 'chimpanze';
}

// Caminho riggado: clona um GLB com esqueleto (via SkeletonUtils) e cria o
// AnimationMixer + dicionário de ações a partir dos clipes do arquivo.
// Normaliza a altura por bounding-box (modelos do Mixamo/Quaternius vêm em
// escalas variadas) e aterra. O wrapper Group expõe mixer/actions em userData.
// Fica inativo até que algum GLB em assets/models/ realmente traga animações.
function instantiateAnimatedModel(entry, id) {
  const inner = cloneSkinned(entry.scene); // religa bones (clone comum quebraria)
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });

  // normaliza altura ao porte da espécie e aterra a base em y=0
  let box = new THREE.Box3().setFromObject(inner);
  const h = (box.max.y - box.min.y) || 1;
  const target = id === 'gorila' ? 1.9 : id === 'bonobo' ? 1.4 : 1.7;
  inner.scale.setScalar(target / h);
  box = new THREE.Box3().setFromObject(inner);
  inner.position.y -= box.min.y;
  inner.rotation.y = MODEL_YAW[id] || 0; // pode precisar de ajuste por asset

  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  for (const clip of entry.clips) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);

  const g = new THREE.Group();
  g.add(inner);
  g.userData.isModelMesh = true;
  g.userData.mixer = mixer;
  g.userData.actions = actions;
  let body = null;
  g.traverse(o => { if (!body && o.isMesh && o.material && 'emissive' in o.material) body = o; });
  g.userData.body = body || inner;
  return g;
}

// Instancia o modelo GLB de uma espécie (clone do template em cache).
// Retorna null se o GLB ainda não carregou. Usada para NPCs e para o jogador.
// Estrutura retornada: Group (origem nos pés, frente = +x) → inner (GLB corrigido).
// O wrapper existe para as correções de yaw/aterramento não serem sobrescritas
// pelas animações do caller (bob de caminhada, flatten de morte etc.).
function instantiateSpeciesModel(id) {
  const entry = modelCache.get(id);
  if (!entry) return null;
  // Caminho riggado: se o GLB trouxe clipes de animação, vai para o mixer.
  if (entry.clips && entry.clips.length) return instantiateAnimatedModel(entry, id);
  const template = entry.scene;
  // Deep clone para não compartilhar transforms entre instâncias.
  const inner = template.clone(true);
  // Configurar shadows nos meshes clonados (o template já tem, mas a clonagem herda?)
  // Forçamos de novo por garantia.
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Correção de escala: chimpanze/gorila/bonobo do Google Poly vêm em centímetros
  // (≈ 100 unidades de altura = 1m), enquanto orangotango do cameron_ vem em metros.
  // Aplicamos a escala no mesh raiz (não no grupo) para que filhos adicionados
  // depois — headband/lança — fiquem em coordenadas 1:1 com o mundo.
  if (id !== 'orangotango') {
    // chimpanze, gorila, bonobo: 1 unidade = 1 cm → escala 0.01
    const modelMesh = inner.children[0];
    if (modelMesh) modelMesh.scale.set(0.01, 0.01, 0.01);
  }
  // Bonobo = chimpanze com cor mais escura (espécies anatomicamente idênticas; diferenciação visual)
  if (id === 'bonobo') {
    inner.traverse(o => {
      if (o.isMesh && o.material && o.material.color) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.65);
      }
    });
  }
  // Alinha a frente do modelo com a convenção do jogo
  inner.rotation.y = MODEL_YAW[id] || 0;
  // Aterramento: desloca o modelo para a base da bounding box ficar em y=0
  // (a origem do gorila fica no centro do corpo — sem isso ele afunda no chão).
  const box = new THREE.Box3().setFromObject(inner);
  inner.position.y -= box.min.y;
  const g = new THREE.Group();
  g.add(inner);
  g.userData.isModelMesh = true;
  return g;
}

// Tenta criar a mesh a partir do modelo GLB carregado. Retorna null se ainda não carregou
// (ou se a espécie não tem modelo) — nesse caso o caller cai no procedural.
function tryMakeApeModelMesh(e) {
  const id = getModelId(e);
  if (!id) return null;
  const g = instantiateSpeciesModel(id);
  if (!g) return null;
  // Faixa de facção: pequeno toro na cabeça, à frente do rosto
  const head = g.getObjectByName('Head') || g.children[0];
  const headPos = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.0, 0);
  const bandCol = e.faction === 'mil' ? 0xc0392b : e.faction === 'pac' ? 0x7fc56f : null;
  if (bandCol) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16), mat(bandCol, 0.55, 0.1));
    band.position.set(0, 0.8, 0); // posição relativa ao grupo (assume origem no pé)
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  // Lança para os milicianos
  if (e.faction === 'mil') {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.6, 5), mat(0x8a6a3a, 0.7, 0.2));
    spear.rotation.z = Math.PI / 2 - 0.35;
    spear.position.set(0.35, 0.85, 0.25);
    g.add(spear);
  }
  // Body de referência para o hit-flash (primeiro mesh com material que tenha .emissive)
  let body = null;
  g.traverse(o => {
    if (!body && o.isMesh && o.material && 'emissive' in o.material) body = o;
  });
  g.userData.body = body || g.children[0];
  g.userData.isModelMesh = true;
  return g;
}

// Versão procedural antiga — usada como fallback enquanto os GLBs carregam,
// e exclusivamente para humanos (que continuam procedurais por design).
function makeProceduralEntityMesh(e) {
  const g = new THREE.Group();
  if (e.kind === 'human') {
    const shirt = e.dialog ? 0x7a3b2f : e.name === 'Sentinela' ? 0x39512f : 0x5a6470;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 1.05, 8), mat(shirt, 0.7, 0.0));
    body.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), mat(0xc9a07a, 0.65, 0.0));
    head.position.y = 1.34;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, TAU, 0, 1.3), mat(0x3a3026, 0.85, 0.0));
    hair.position.y = 1.37;
    g.add(body, head, hair);
    g.userData.body = body;
  } else {
    const bodyCol = e.boss ? 0x2e2e33 : 0x6b4a2f;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(bodyCol, 0.8, 0.0));
    body.scale.y = 1.2;
    body.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0x52381f, 0.8, 0.0));
    head.position.set(0.3, 1.18, 0);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), mat(0xb08968, 0.7, 0.0));
    face.position.set(0.52, 1.16, 0);
    g.add(body, head, face);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.85, 6), mat(bodyCol, 0.8, 0.0));
      arm.position.set(0.1, 0.5, side * 0.5);
      arm.rotation.x = side * 0.15;
      g.add(arm);
    }
    const bandCol = e.faction === 'mil' ? 0xc0392b : e.faction === 'pac' ? 0x7fc56f : null;
    if (bandCol) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 6, 12), mat(bandCol, 0.55, 0.1));
      band.position.set(0.3, 1.26, 0);
      band.rotation.x = Math.PI / 2;
      g.add(band);
    }
    if (e.faction === 'mil') {
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), mat(0x8a6a3a, 0.7, 0.2));
      spear.rotation.z = Math.PI / 2 - 0.35;
      spear.position.set(0.45, 1.0, 0.3);
      g.add(spear);
    }
  }
  g.userData.body = g.userData.body || g.children[0];
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.isModelMesh = false;
  return g;
}

function makeEntityMesh(e) {
  return tryMakeApeModelMesh(e) || makeProceduralEntityMesh(e);
}

// ---------- sync por frame ----------
function syncEntities(dt) {
  const seen = new Set();
  for (const e of G.entities) {
    seen.add(e.id);
    let g = entMeshes.get(e.id);
    if (!g) { g = makeEntityMesh(e); entMeshes.set(e.id, g); scene.add(g); }
    // NPC com esqueleto (GLB riggado): toca um clipe (anda/parado) e avança o mixer.
    // Dormiente com os meshes atuais; evita T-pose quando um asset animado for usado.
    if (g.userData.mixer) {
      const acts = g.userData.actions || {};
      const moving = !e.dead && (e.aggro || e.ai === 'patrol' || e.ai === 'hunter');
      const want = (Object.keys(acts).find(n => n.includes(moving ? 'walk' : 'idle'))
        || Object.keys(acts).find(n => n.includes('run')) || Object.keys(acts)[0]);
      if (want && g.userData._act !== want) {
        const nx = acts[want]; const pv = g.userData._act && acts[g.userData._act];
        nx.reset().play(); if (pv) nx.crossFadeFrom(pv, 0.2, false);
        g.userData._act = want;
      }
      g.userData.mixer.update(dt);
    }
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
        mat(c.big ? 0x8a6a30 : 0x7a5a30, 0.8, 0.05));
      m.position.set(c.x * S, 0.3, c.y * S);
      m.rotation.y = hash(c.x | 0, c.y | 0) % 7 * 0.2;
      m.castShadow = true; m.receiveShadow = true;
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

  // ---------- personagem do jogador ----------
  const px = p.x * S, pz = p.y * S;

  // Upgrade do modelo quando o GLB da espécie chegar (ou quando a espécie mudar em
  // um novo jogo — o rig é criado uma vez só em initScene).
  if (playerSpeciesBuilt !== p.species || (!playerIsModelMesh && modelCache.has(p.species)))
    rebuildPlayerModel();

  const baseScale = p.r / 10;
  const jumpH = G.jumpH || 0; // altura do pulo (física visual em main3d)
  playerRig.position.set(px, jumpH, pz);
  playerRig.rotation.y = -p.dir;
  playerRig.scale.setScalar(baseScale);
  playerRig.visible = !p.dead;

  // Métricas de movimento comuns aos dois caminhos de animação.
  const spd = Math.hypot(px - lastPX, pz - lastPZ) / Math.max(dt, 1e-4);
  lastPX = px; lastPZ = pz;
  const moveK = clamp(spd / 4.5, 0, 1);
  const dashing = (p.dashT || 0) > 0;
  const isPipe = p.weapon === 'pipe';
  const meleeActive = isPipe && p.attackCd > 0;

  // Flash de dano no corpo do jogador (mesmo tratamento dos NPCs)
  if (playerBody) playerBody.material.emissive.setHex(p.hurtT > 0 ? 0x801510 : 0x000000);

  if (playerMixer) {
    // ---------- animação esqueletal (GLB riggado) ----------
    // Os mesmos sinais de gameplay (velocidade, golpe, pulo) escolhem qual clipe
    // tocar; o esqueleto faz o resto. Fica ativo só quando o GLB traz animações.
    playerMixer.update(dt);
    let want;
    if (meleeActive)       want = pickAction(['attack', 'slash', 'swing', 'punch', 'melee']);
    else if (jumpH > 0.06) want = pickAction(['jump', 'fall', 'air']);
    else if (moveK > 0.55) want = pickAction(['run', 'sprint', 'jog']);
    else if (moveK > 0.06) want = pickAction(['walk']);
    else                   want = pickAction(['idle', 'breath', 'stand']);
    setPlayerAction(want, meleeActive ? 0.08 : 0.18);
    // o clipe já move o corpo: mantém o wrapper neutro e oculta as armas postiças
    // (um modelo riggado carregará a própria arma ou será preso a um osso da mão)
    playerModel.position.set(0, 0, 0);
    playerModel.rotation.set(0, 0, 0);
    playerWeaponPipe.visible = false;
    playerWeaponPistol.visible = false;
  } else {
    // ---------- locomoção de primata (procedural, fallback p/ mesh estático) ----------
    playerMoveT += dt * (4 + spd * 3.2); // cadência da passada
    // Postura de símio: tronco curvado para a frente mesmo parado, mais agachado ao
    // correr (knuckle-walk) e ainda mais na esquiva/pulo. Bem diferente do andar ereto.
    const hunch = 0.18 + 0.36 * moveK + (dashing ? 0.5 : 0) + clamp(jumpH * 0.3, 0, 0.3);
    const lope = Math.abs(Math.sin(playerMoveT));
    playerModel.position.y = lope * 0.13 * moveK;
    playerModel.rotation.x = -hunch;
    playerModel.rotation.z = Math.sin(playerMoveT) * 0.13 * moveK;       // ginga de ombro
    playerModel.rotation.y = Math.sin(playerMoveT * 0.5) * 0.07 * moveK; // waddle lateral

    // braço-pivô (ombro) + arma
    playerWeaponPipe.visible = isPipe && !p.dead;
    playerWeaponPistol.visible = !isPipe && !p.dead;
    const shoulderY = 0.62 * playerModelH;
    playerArm.position.set(0.12, shoulderY + lope * 0.05 * moveK, 0.2);

    // Progresso do golpe (0→1 no cooldown de 0.45s). Ângulo Z do braço: 0 = cano
    // pendurado; negativo ergue por trás; positivo desce à frente.
    const s = meleeActive ? clamp(1 - p.attackCd / 0.45, 0, 1) : 0;
    if (isPipe) {
      let swingZ;
      if (meleeActive) {
        if (s < 0.3)       swingZ = lerp(-0.35, -2.5, smooth(s / 0.3));          // windup
        else if (s < 0.55) swingZ = lerp(-2.5, 0.7, smooth((s - 0.3) / 0.25));   // strike
        else               swingZ = lerp(0.7, -0.35, smooth((s - 0.55) / 0.45)); // recover
        playerModel.rotation.y += -0.4 * Math.sin(s * Math.PI); // follow-through
      } else {
        swingZ = -0.35 + Math.sin(playerMoveT) * 0.2 * moveK;   // descanso gingando
      }
      playerArm.rotation.set(0, 0, swingZ);
    } else {
      // Pistola: braço sobe e aponta à frente; firme em combate, recuo no disparo.
      const aim = (G.lockOn || p.attackCd > 0) ? 1 : 0.4;
      const kick = p.attackCd > 0 ? p.attackCd / 0.5 : 0;
      playerArm.rotation.set(0, 0, lerp(-1.1, -0.05, aim) + kick * 0.4);
    }
  }

  // ---------- câmera orbital (terceira pessoa, sobre o ombro) ----------
  // Referência: Skyrim — câmera próxima na altura do peito, personagem levemente
  // à esquerda do centro (pivô deslocado para a direita da direção de visão).
  // pitch > 0 = olhar para cima (câmera desce); pitch < 0 = vista mais aérea.
  // Tudo escala com a altura efetiva do personagem (modelo × espécie): o gorila
  // de 1.9 m e o bonobo de 1.1 m ocupam a mesma fração da tela.
  const effH = playerModelH * baseScale;
  const locked = G.lockOn && !G.lockOn.dead;
  // Travado: câmera recua e sobe um pouco para enquadrar jogador + alvo.
  const CAM_DIST = 2.55 * effH * (locked ? 1.3 : 1);
  const el = clamp((locked ? 0.42 : 0.3) - pitch, 0.02, 1.25); // ângulo de elevação da órbita
  // A câmera orbita por G.camYaw (mouse), não pela frente do personagem — assim o
  // símio pode virar para onde anda sem arrastar a câmera junto.
  const yaw = G.camYaw;
  const shX = -Math.sin(yaw), shZ = Math.cos(yaw); // vetor "direita" no plano
  const sh = 0.34 * effH;                       // offset de ombro
  _camTarget.set(px + shX * sh, 0.8 * effH + jumpH, pz + shZ * sh);
  _camDir.set(
    -Math.cos(yaw) * Math.cos(el),
    Math.sin(el),
    -Math.sin(yaw) * Math.cos(el));

  // Colisão da câmera: raycast do personagem para trás; se há parede no caminho,
  // a câmera encosta na frente dela em vez de atravessar.
  let dist = CAM_DIST;
  camRay.set(_camTarget, _camDir);
  camRay.far = CAM_DIST;
  const hits = camRay.intersectObjects(cameraBlockers, false);
  if (hits.length) dist = Math.max(0.5 * effH, hits[0].distance - 0.35);

  _camPos.copy(_camTarget).addScaledVector(_camDir, dist);
  _camPos.y = Math.max(0.32, _camPos.y); // nunca afunda no chão

  // Suavização: a câmera persegue a posição alvo em vez de teleportar — tira a
  // rigidez "presa num trilho" do mouse. Snap no primeiro frame pós-spawn.
  const k = 1 - Math.exp(-dt * 16);
  if (camera.position.lengthSq() < 1e-6 || camera.position.distanceTo(_camPos) > 8) camera.position.copy(_camPos);
  else camera.position.lerp(_camPos, k);

  // Screen shake curto ao tomar dano e no impacto do swing
  const kick0 = p.attackCd > 0 ? p.attackCd : 0;
  const shake = (p.hurtT > 0 ? 0.045 : 0) + (kick0 > 0.3 ? 0.018 : 0);
  if (shake) {
    camera.position.x += (Math.random() - 0.5) * shake * 2;
    camera.position.y += (Math.random() - 0.5) * shake * 2;
  }

  if (locked) {
    // Olha para o ponto médio entre o peito do jogador e o do alvo — mantém os
    // dois enquadrados, a assinatura visual do Z-targeting.
    const tx = G.lockOn.x * S, tz = G.lockOn.y * S;
    _lookAt.set((px + tx) / 2, 0.8 * effH + jumpH, (pz + tz) / 2);
  } else {
    // Mira: o ponto observado sobe quando o jogador olha para cima — dá leitura do céu
    // sem precisar baixar a câmera até o chão.
    _lookAt.set(px + shX * sh, 0.8 * effH + jumpH + Math.max(0, pitch) * 2.2, pz + shZ * sh);
  }
  camera.lookAt(_lookAt);

  // O sol (e seu shadow camera) segue o jogador, senão as sombras "se perdem"
  // conforme a gente anda e sai do orto-volume de 76×76 m.
  sun.position.set(px + 40, 60, pz + 20);
  sunTarget.position.set(px, 0, pz);

  // renderer.render(scene, camera) → composer.render() (Roda RenderPass + Bloom + Vignette + OutputPass)
  composer.render();
}

// Projeta a posição (peito) do alvo travado para coordenadas de tela em pixels.
// Retorna null se não há alvo ou se ele está atrás da câmera. Usado pela retícula.
const _proj = new THREE.Vector3();
export function lockScreenPos() {
  if (!renderer || !G.lockOn || G.lockOn.dead) return null;
  _proj.set(G.lockOn.x * S, 1.0, G.lockOn.y * S).project(camera);
  if (_proj.z > 1) return null; // atrás da câmera
  return { x: (_proj.x * 0.5 + 0.5) * innerWidth, y: (-_proj.y * 0.5 + 0.5) * innerHeight };
}
