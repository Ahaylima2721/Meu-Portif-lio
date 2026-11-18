/* ============================================================================
   maos.js — hero "Conectando": mão robótica + mão humana em 3D, desenhadas
   como meio-tom (pontos), com a Zoe entre as pontas dos dedos.

   Modelo das mãos: "generic-hand" do WebXR Input Profiles (licença MIT, ver
   modelos/LICENSE.md). A mão humana é a malha real; a robótica é montada com
   peças mecânicas sobre o mesmo esqueleto, na mesma pose.
   O three.js fica em vendor/three (licença MIT) e é carregado pelo importmap.
   ============================================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const hero = document.querySelector('.cx-hero');
const cvs = hero && hero.querySelector('.cx-maos');
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ---------------------------------------------------------------- pose ---- */
const FING = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const cadeia = f => f === 'thumb'
  ? ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
  : [f + '-metacarpal', f + '-phalanx-proximal', f + '-phalanx-intermediate', f + '-phalanx-distal', f + '-tip'];
const ossos = s => { const m = {}; s.traverse(o => { if (o.isBone) m[o.name] = o; }); return m; };

// as juntas do modelo são independentes: dobrar = girar a junta e tudo depois dela em torno do pivô
function dobrar(B, f, angulos, eixo) {
  const n = cadeia(f);
  angulos.forEach((a, j) => {
    const pv = B[n[j + 1]]; if (!pv || !a) return;
    const q = new THREE.Quaternion().setFromAxisAngle(eixo, a), p = pv.position.clone();
    for (let k = j + 1; k < n.length; k++) {
      const b = B[n[k]];
      if (k > j + 1) b.position.sub(p).applyQuaternion(q).add(p);
      b.quaternion.premultiply(q);
    }
  });
}
function posar(cena, P, lado) {
  const B = ossos(cena), eixo = new THREE.Vector3(0, 0, lado === 'e' ? 1 : -1);
  const eixoPol = new THREE.Vector3(1, 0, 0);
  for (const f of FING) if (P[f]) dobrar(B, f, P[f], f === 'thumb' ? eixoPol : eixo);
  return B;
}
const POSE_ROBO = { 'index-finger': [0, .06, .1, .06], 'middle-finger': [0, .55, .85, .4], 'ring-finger': [0, .7, .9, .45], 'pinky-finger': [0, .85, .9, .45], thumb: [0, .15, .2, .1] };
const POSE_HUMANA = { 'index-finger': [0, .1, .16, .1], 'middle-finger': [0, .35, .6, .32], 'ring-finger': [0, .5, .7, .36], 'pinky-finger': [0, .65, .75, .36], thumb: [0, .15, .2, .1] };

/* --------------------------------------------------------- mão humana ---- */
function maoHumana(gltf) {
  const g = gltf.scene, B = posar(g, POSE_HUMANA, 'd');
  const pele = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: .55, metalness: 0 });
  g.traverse(o => { if (o.isMesh) { o.material = pele; o.frustumCulled = false; } });
  const w = B['wrist'].position;
  const braco = new THREE.Mesh(new THREE.CylinderGeometry(.027, .036, .6, 40, 1, true), pele);
  braco.position.set(w.x + .004, w.y + .3 - .014, w.z + .004); g.add(braco);
  const tampa = new THREE.Mesh(new THREE.SphereGeometry(.027, 32, 16), pele);
  tampa.position.set(w.x + .004, w.y - .008, w.z + .004); tampa.scale.set(1, .7, 1); g.add(tampa);
  return { g, ponta: B['index-finger-tip'].position.clone() };
}

/* ------------------------------------------------------- mão robótica ---- */
function maoRobo(gltf) {
  const g = gltf.scene, B = posar(g, POSE_ROBO, 'e');
  g.traverse(o => { if (o.isMesh) o.visible = false; });
  const placa = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: .32, metalness: .25 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: .4, metalness: .6 });
  const medio = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: .3, metalness: .5 });
  const R = new THREE.Group(); g.add(R);
  const V = n => B[n].position.clone();
  const peca = (a, b, r, m) => {
    const d = b.clone().sub(a), L = d.length();
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(L - r * 1.2, .001), 6, 16), m);
    o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); R.add(o); return o;
  };
  const bola = (p, r, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), m); o.position.copy(p); R.add(o); };
  const raio = { thumb: .0085, 'index-finger': .0078, 'middle-finger': .008, 'ring-finger': .0075, 'pinky-finger': .0066 };
  for (const f of FING) {
    const n = cadeia(f), r = raio[f];
    for (let k = 1; k < n.length - 1; k++) {
      const a = V(n[k]), b = V(n[k + 1]);
      peca(a, b, r * (k === n.length - 2 ? .85 : 1), placa);
      const trilho = peca(a.clone().lerp(b, .2), a.clone().lerp(b, .8), r * .45, escuro); trilho.position.x -= r * .75;
    }
    for (let k = 1; k < n.length - 1; k++) bola(V(n[k]), r * 1.25, escuro);
    bola(V(n[n.length - 1]), r * .9, medio);
  }
  const pts = [], nrm = new THREE.Vector3(1, 0, 0);
  for (const n of ['wrist', 'index-finger-phalanx-proximal', 'middle-finger-phalanx-proximal', 'ring-finger-phalanx-proximal', 'pinky-finger-phalanx-proximal', 'thumb-phalanx-proximal', 'index-finger-metacarpal', 'pinky-finger-metacarpal']) {
    const p = V(n); pts.push(p.clone().addScaledVector(nrm, .011), p.clone().addScaledVector(nrm, -.011));
  }
  const palma = new THREE.Mesh(new ConvexGeometry(pts), placa); R.add(palma);
  for (const f of ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) { const p = V(f + '-metacarpal').lerp(V(f + '-phalanx-proximal'), .45); p.x -= .012; bola(p, .0035, escuro); }
  const w = V('wrist');
  bola(w.clone().add(new THREE.Vector3(0, .006, 0)), .024, escuro);
  const braco = new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, .6, 32), medio); braco.position.set(w.x, w.y + .32, w.z); R.add(braco);
  for (let i = 0; i < 11; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.03 + i * .0005, .0035, 8, 32), escuro); t.rotation.x = Math.PI / 2; t.position.set(w.x, w.y + .05 + i * .05, w.z); R.add(t); }
  const manga = new THREE.Mesh(new THREE.CylinderGeometry(.031, .033, .09, 32), placa); manga.position.set(w.x, w.y + .07, w.z); R.add(manga);
  for (let i = 0; i < 4; i++) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(w.x + .03, w.y + .03, w.z - .015 + i * .01), new THREE.Vector3(w.x + .07 + i * .01, w.y + .13, w.z - .02 + i * .012), new THREE.Vector3(w.x + .04, w.y + .26, w.z + .01 * i)]);
    R.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, .0026, 8), i % 2 ? escuro : medio));
  }
  return { g, ponta: B['index-finger-tip'].position.clone() };
}

/* --------------------------------------------------------------- cena ---- */
async function iniciar() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' }); }
  catch (e) { hero.classList.add('sem-3d'); return; }
  const loader = new GLTFLoader();
  const [ge, gd] = await Promise.all([loader.loadAsync('modelos/mao-esquerda.glb'), loader.loadAsync('modelos/mao-direita.glb')]);
  const robo = maoRobo(ge), hum = maoHumana(gd);

  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xffffff, 0x303030, 1.0));
  const sol = new THREE.DirectionalLight(0xffffff, 2.6); sol.position.set(.2, 1, .7); cena.add(sol);
  const rebote = new THREE.DirectionalLight(0xffffff, .8); rebote.position.set(-.5, -.3, .5); cena.add(rebote);

  // cada mão num grupo com a ponta do indicador na origem
  const E = new THREE.Group(), D = new THREE.Group();
  robo.g.position.copy(robo.ponta).multiplyScalar(-1); E.add(robo.g);
  hum.g.position.copy(hum.ponta).multiplyScalar(-1); D.add(hum.g);
  const BE = new THREE.Group(), BD = new THREE.Group();   // bases (balanço) por fora
  BE.add(E); BD.add(D); cena.add(BE, BD);
  E.rotation.set(2.3, 0, Math.PI / 2 + .1);
  D.rotation.set(2.3, 0, -Math.PI / 2 - .1);

  const cam = new THREE.PerspectiveCamera(26, 1, .01, 10);
  const rt = new THREE.WebGLRenderTarget(4, 4);
  rt.texture.colorSpace = THREE.SRGBColorSpace;   // lê os pixels já em sRGB, como na tela
  renderer.setClearColor(0xffffff, 1);

  const ctx = cvs.getContext('2d');
  const zoe = hero.querySelector('.cx-zoe');
  let W, H, DPR, CELL, cols, rows, px, seeds, gapMundo, alvoY, larguraVis;
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0 };
  const t0 = performance.now();
  const faiscas = [];

  function medir() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = cvs.clientWidth; H = cvs.clientHeight;
    cvs.width = W * DPR; cvs.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CELL = 4;
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    rt.setSize(cols, rows); px = new Uint8Array(cols * rows * 4);
    seeds = new Float32Array(cols * rows * 3);
    for (let i = 0; i < seeds.length; i += 3) { const a = Math.random() * 6.283, r = 160 + Math.random() * 560; seeds[i] = Math.cos(a) * r; seeds[i + 1] = Math.sin(a) * r; seeds[i + 2] = Math.random(); }
    cam.aspect = W / H;
    larguraVis = W < 640 ? .23 : W < 1000 ? .46 : .6;             // largura do mundo visível
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const z = (larguraVis / 2) / (tan * cam.aspect);
    alvoY = W < 640 ? .66 : .64;                                   // altura das pontas na tela (0 topo, 1 base)
    cam.position.set(0, (alvoY * 2 - 1) * z * tan, z); cam.lookAt(0, cam.position.y, 0);
    cam.updateProjectionMatrix();
    const orbPx = zoe ? zoe.offsetWidth : 100;
    gapMundo = (orbPx + (W < 640 ? 26 : 64)) / W * larguraVis;
    if (zoe) { hero.style.setProperty('--zoe-x', (W / 2) + 'px'); hero.style.setProperty('--zoe-y', (H * alvoY) + 'px'); }
  }

  function quadro(agora) {
    const t = agora - t0;
    const resp = calmo ? 0 : Math.sin(agora * .0009);
    const g = gapMundo + resp * gapMundo * .05;
    // balanço leve e paralaxe com o mouse
    mouse.nx += ((mouse.x > -999 ? (mouse.x / W - .5) : 0) - mouse.nx) * .05;
    mouse.ny += ((mouse.y > -999 ? (mouse.y / H - .5) : 0) - mouse.ny) * .05;
    BE.position.set(-g / 2, calmo ? 0 : Math.sin(agora * .0007) * .002, 0);
    BD.position.set(g / 2, calmo ? 0 : Math.sin(agora * .0007 + 1.7) * .002, 0);
    BE.rotation.set(mouse.ny * .12, mouse.nx * .25, 0);
    BD.rotation.set(mouse.ny * .12, mouse.nx * .25, 0);

    renderer.setRenderTarget(rt); renderer.render(cena, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, cols, rows, px);
    renderer.setRenderTarget(null);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    const R = CELL * .6;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      const yy = rows - 1 - y;                                   // a leitura vem de baixo para cima
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x, j = (yy * cols + x) * 4;
        let d = 1 - (px[j] * .3 + px[j + 1] * .59 + px[j + 2] * .11) / 255;
        const sd = seeds[i * 3 + 2];
        if (d < .04) { if (sd > .995 && y > rows * .1) d = .08; else continue; }
        d = Math.min(1, Math.pow(d, 1.1) * 1.15);
        const k = calmo ? 1 : ease((t - sd * 900) / 1700);
        if (k <= 0) continue;
        let cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        if (k < 1) { cx += seeds[i * 3] * (1 - k); cy += seeds[i * 3 + 1] * (1 - k); }
        const dx = cx - mouse.x, dy = cy - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 12100) { const dd = Math.sqrt(d2) || 1, f = (1 - dd / 110) * 22; cx += dx / dd * f; cy += dy / dd * f; }
        const r = Math.sqrt(d) * R * (.85 + sd * .3);
        if (r < .35) continue;
        ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, 6.283);
      }
    }
    ctx.fill();

    // faíscas saindo das pontas em direção à Zoe
    if (!calmo && t > 1600) {
      const mx = W / 2, my = H * alvoY, meio = (g / larguraVis) * W / 2;
      if (faiscas.length < 50 && Math.random() < .5) {
        const lado = Math.random() < .5 ? -1 : 1;
        faiscas.push({ x: mx + lado * meio, y: my + (Math.random() - .5) * 6, vx: -lado * (.4 + Math.random() * .9), vy: (Math.random() - .5) * .5, v: 1 });
      }
      for (let i = faiscas.length - 1; i >= 0; i--) {
        const p = faiscas[i]; p.x += p.vx; p.y += p.vy; p.v -= .018;
        if (p.v <= 0) { faiscas.splice(i, 1); continue; }
        ctx.globalAlpha = p.v; ctx.fillStyle = '#7C3AED';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.v * 1.3, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  let visivel = true, rodando = false;
  function loop(agora) { if (!visivel || document.hidden) { rodando = false; return; } quadro(agora); requestAnimationFrame(loop); }
  function ligar() { if (!rodando) { rodando = true; requestAnimationFrame(loop); } }
  new IntersectionObserver(es => { visivel = es[0].isIntersecting; if (visivel) ligar(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ligar(); });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { medir(); ligar(); }, 120); });
  hero.addEventListener('pointermove', e => { const r = cvs.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  medir(); ligar();
  hero.classList.add('pronto');
  window.dispatchEvent(new CustomEvent('maos-prontas'));
}

if (hero && cvs) iniciar().catch(err => { console.warn('maos.js:', err); hero.classList.add('sem-3d'); });
