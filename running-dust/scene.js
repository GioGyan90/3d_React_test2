import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Running Dust · independent Lucky Break Three.js visual prototype.
// Multiple low-poly smoke blobs emit ONLY on planted foot contact, fly toward
// negative X (behind the runner), swell, rise gently and fade. Reuse a bounded
// pool instead of continually allocating GPU meshes or materials.
const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const canvas = $('scene');
const speedInput = $('speed');
const speedOutput = $('speed-output');
const densityInput = $('density');
const densityOutput = $('density-output');
const toggleButton = $('toggle');
const toggleIcon = $('toggle-icon');
const toggleLabel = $('toggle-label');
const stepButton = $('step');
const clearButton = $('clear');
const phaseLabel = $('live-phase');
const puffReadout = $('puff-count');
const activeReadout = $('active-count');
const cycleReadout = $('cycle-count');
const toneButtons = [...document.querySelectorAll('[data-tone]')];
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const random = (min, max) => min + Math.random() * (max - min);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x0c2430, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const camera = new THREE.PerspectiveCamera(41, 1, .08, 130);
let azimuth = .19;
let altitude = .29;
let distance = 10.7;
const gaze = new THREE.Vector3(-.4, 1.05, 0);
const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xeafcff, 0x37505b, 2.6));
const sun = new THREE.DirectionalLight(0xffedcf, 3.3);
sun.position.set(-3, 7, 5);
scene.add(sun);
const coolRim = new THREE.PointLight(0x89b8f4, 50, 13, 2);
coolRim.position.set(1, 4, -3);
scene.add(coolRim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x1a3842, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.065;
scene.add(floor);
const platform = new THREE.Mesh(
  new THREE.BoxGeometry(15, .10, 5.1),
  new THREE.MeshStandardMaterial({ color: 0x244f52, roughness: .98, metalness: 0 })
);
platform.position.set(-.55, -.045, 0);
scene.add(platform);
const platformTop = .005;
const marks = new THREE.Group();
for (let i = -15; i <= 14; i++) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(.012, .003, 5.1),
    new THREE.MeshBasicMaterial({ color: 0x7ca5a1, transparent: true, opacity: i % 3 === 0 ? .13 : .07, depthWrite: false })
  );
  stripe.position.set(i * .5 - .55, platformTop + .004, 0);
  marks.add(stripe);
}
scene.add(marks);
const line = new THREE.Mesh(
  new THREE.BoxGeometry(15, .007, .014),
  new THREE.MeshBasicMaterial({ color: 0xb8c9b1, transparent: true, opacity: .30, depthWrite: false })
);
line.position.set(-.55, .02, -1.1);
scene.add(line);

function material(color, roughness = .9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
}
function connect(mesh, p1, p2) {
  const a = new THREE.Vector3(...p1);
  const b = new THREE.Vector3(...p2);
  const mid = a.clone().add(b).multiplyScalar(.5);
  mesh.position.copy(mid);
  mesh.scale.set(1, a.distanceTo(b), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}
const RUNNER_X = 1.55;
const torso = new THREE.Mesh(new THREE.CylinderGeometry(.36, .29, .68, 8), material(0xe7b2a4));
torso.position.set(RUNNER_X, 2.48, 0);
scene.add(torso);
const waistband = new THREE.Mesh(new THREE.BoxGeometry(.65, .22, .7), material(0x405e80));
waistband.position.set(RUNNER_X, 2.10, 0);
scene.add(waistband);
const shorts = new THREE.Mesh(new THREE.BoxGeometry(.72, .35, .72), material(0x334e70));
shorts.position.set(RUNNER_X, 1.94, 0);
scene.add(shorts);

const legParts = [];
const upperGeom = new THREE.CylinderGeometry(.15, .13, 1, 9);
const lowerGeom = new THREE.CylinderGeometry(.103, .083, 1, 9);
const kneeGeom = new THREE.IcosahedronGeometry(.15, 1);
const upperMat = material(0x586a87);
const lowerMat = material(0xe3ad95);
const kneeMat = material(0xdfa38d);
const soleMat = material(0xe8e9e2);
const shoeMats = [material(0xe2a270), material(0xaac6ce)];
const detailMat = material(0xece8d9);

for (let leg = 0; leg < 2; leg++) {
  const side = leg === 0 ? -.285 : .285;
  const upper = new THREE.Mesh(upperGeom, upperMat);
  const lower = new THREE.Mesh(lowerGeom, lowerMat);
  const knee = new THREE.Mesh(kneeGeom, kneeMat);
  const foot = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(.78, .13, .42), soleMat);
  sole.position.set(.04, .08, 0);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(.66, .21, .37), shoeMats[leg]);
  shoe.position.set(.04, .23, 0);
  const toe = new THREE.Mesh(new THREE.IcosahedronGeometry(.23, 1), shoeMats[leg]);
  toe.scale.set(1.28, .63, .88);
  toe.position.set(.33, .18, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.32, .035, .383), detailMat);
  stripe.position.set(.04, .34, 0);
  foot.add(sole, shoe, toe, stripe);
  scene.add(upper, lower, knee, foot);
  legParts.push({ side, upper, lower, knee, foot, previousAir: false });
}
function animateLegs(phase, landing = true) {
  for (let i = 0; i < legParts.length; i++) {
    const part = legParts[i];
    const a = phase + i * Math.PI;
    // Tiny floating-point sin(PI) errors must not create a phantom landing.
    const inAir = Math.sin(a) > .015;
    const lift = Math.max(0, Math.sin(a)) * .40;
    const ankleX = RUNNER_X + Math.cos(a) * .58;
    const ankleY = platformTop + .04 + lift;
    const hip = [RUNNER_X, 1.85, part.side];
    const knee = [RUNNER_X + Math.cos(a) * .22 + .10, 1.12 + lift * .22, part.side];
    const ankle = [ankleX, ankleY + .31, part.side];
    connect(part.upper, hip, knee);
    connect(part.lower, knee, ankle);
    part.knee.position.set(...knee);
    part.foot.position.set(ankleX, ankleY, part.side);
    part.foot.rotation.z = inAir ? -.13 + .15 * Math.cos(a) : 0;
    if (landing && part.previousAir && !inAir) {
      emitFootImpact(ankleX - .25, part.side);
    }
    part.previousAir = inAir;
  }
}
animateLegs(0, false);

// Each pooled cloud is a 3D cluster of low-poly, nonuniform spheres.
const PALETTES = {
  sand: [0xf6e8cf, 0xd7c3a4, 0xae9b83, 0xffe3b5],
  slate: [0xe5eff1, 0xb5c7cb, 0x879fa8, 0xd2dfe8],
};
const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
const POOL_SIZE = reducedMotion ? 56 : 120;
let tone = 'sand';
let emittedTotal = 0;
let impacts = 0;

export class DustEmitter {
  constructor(targetScene = scene) {
    this.scene = targetScene;
    this.pool = [];
    this.cursor = 0;
    this.total = 0;
    this.tone = tone;
    for (let i = 0; i < POOL_SIZE; i++) {
      const root = new THREE.Group();
      root.visible = false;
      const materials = PALETTES.sand.slice(0, 3).map(c =>
        new THREE.MeshStandardMaterial({
          color: c, transparent: true, opacity: 0,
          flatShading: true, roughness: 1, metalness: 0,
          depthWrite: false, side: THREE.DoubleSide
        }));
      // Irregular overlapping lobes, not a single transparent billboard.
      const lobes = [
        [-.22, .03, -.08, .72, 1.02, .68],
        [ .02, .12, .02, 1.07, 1.12, .9],
        [ .27, -.015, .10, .79, .76, .74],
        [-.08, .19, .17, .63, .73, .60],
      ];
      lobes.forEach((lobe, idx) => {
        const mesh = new THREE.Mesh(cloudGeo, materials[idx % materials.length]);
        mesh.position.set(lobe[0], lobe[1], lobe[2]);
        mesh.scale.set(lobe[3], lobe[4], lobe[5]);
        root.add(mesh);
      });
      this.scene.add(root);
      this.pool.push({ root, materials, active: false, age: 0, life: 1, size: 1, vx: 0, vz: 0, vy: 0, spin: 0 });
    }
  }
  setTone(next) {
    if (!PALETTES[next]) return;
    this.tone = next;
    for (const puff of this.pool) {
      for (let j = 0; j < puff.materials.length; j++) {
        puff.materials[j].color.setHex(PALETTES[next][j]);
      }
    }
  }
  puff(x, z, strength = 1) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.active = true;
    p.root.visible = true;
    p.age = 0;
    p.life = random(.62, 1.30);
    p.size = random(.18, .40) * strength;
    p.vx = -random(1.30, 3.05) * strength; // behind the runner in negative X
    p.vz = random(-.75, .75);
    p.vy = random(.11, .43);
    p.spin = random(-1.2, 1.2);
    p.root.position.set(x + random(-.19, .13), platformTop + random(.07, .15), z + random(-.22, .22));
    p.root.rotation.set(random(-.2,.2),random(-.4,.4),random(-.3,.3));
    p.root.scale.setScalar(p.size * .48);
    p.materials.forEach(m => { m.opacity = .68; });
    this.total++;
  }
  burst(x, z, n = 5, strength = 1) {
    for (let i = 0; i < n; i++) this.puff(x - i * .045, z, strength * random(.78, 1.23));
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.root.visible = false;
        continue;
      }
      const slow = Math.exp(-2 * dt);
      p.vx *= slow;
      p.vz *= slow;
      p.root.position.x += p.vx * dt;
      p.root.position.z += p.vz * dt;
      p.root.position.y += p.vy * dt;
      p.vy -= .16 * dt;
      p.root.position.y = Math.max(platformTop + .05, p.root.position.y);
      p.root.rotation.y += p.spin * dt;
      p.root.rotation.z += p.spin * dt * .14;
      const grow = p.size * (.46 + 1.38 * smooth(t));
      p.root.scale.setScalar(grow);
      const visible = (1 - smooth(t)) * Math.min(1, t * 13);
      for (let i = 0; i < p.materials.length; i++) {
        p.materials[i].opacity = visible * [ .64, .80, .65 ][i];
      }
    }
  }
  get active() { return this.pool.filter(p => p.active).length; }
  clear() {
    for (const p of this.pool) { p.active = false; p.root.visible = false; }
  }
  dispose() {
    this.clear();
    for (const p of this.pool) {
      this.scene.remove(p.root);
      p.materials.forEach(mat => mat.dispose());
    }
    this.pool.length = 0;
  }
}
const dust = new DustEmitter(scene);
let speed = Number(speedInput.value);
let density = Number(densityInput.value);
let running = true;
let phase = .35;
let pointer = null;
const frame = { id: 0 };

function emitFootImpact(x, z, manual = false) {
  impacts++;
  const amount = reducedMotion ? Math.min(4, density) : density;
  dust.burst(x, z, amount, manual ? 1.1 : 1);
  emittedTotal = dust.total;
}
function reset() {
  running = false;
  phase = .35;
  dust.clear();
  dust.total = 0;
  impacts = 0;
  emittedTotal = 0;
  animateLegs(phase, false);
  legParts.forEach((part, i) => { part.previousAir = Math.sin(phase + i * Math.PI) > .015; });
  updateButtons();
  updateReadouts();
}
function updateButtons() {
  toggleLabel.textContent = running ? '暂停跑步' : '继续跑步';
  toggleIcon.textContent = running ? 'Ⅱ' : '▶';
  toggleButton.setAttribute('aria-pressed', String(running));
  phaseLabel.textContent = running ? 'RUNNING' : 'PAUSED';
}
function updateReadouts() {
  puffReadout.textContent = String(emittedTotal).padStart(3, '0');
  activeReadout.textContent = String(dust.active).padStart(2, '0');
  cycleReadout.textContent = String(Math.floor(impacts / 2)).padStart(2, '0');
}
function cameraView() {
  const flat = Math.cos(altitude) * distance;
  camera.position.set(gaze.x + Math.sin(azimuth) * flat,
    gaze.y + Math.sin(altitude) * distance,
    gaze.z + Math.cos(azimuth) * flat);
  camera.lookAt(gaze);
}
function resize() {
  const r = viewport.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function animate() {
  frame.id = requestAnimationFrame(animate);
  const dt = document.hidden ? 0 : Math.min(.05, clock.getDelta());
  if (running && dt > 0) {
    // Alternating feet: each leg makes contact once per full stride.
    phase += dt * speed * 2.1 * Math.PI;
    animateLegs(phase, true);
  }
  dust.update(dt);
  cameraView();
  updateReadouts();
  renderer.render(scene, camera);
}

speedInput.addEventListener('input', () => {
  speed = clamp(Number(speedInput.value), .5, 2);
  speedOutput.textContent = speed.toFixed(2) + '×';
});
densityInput.addEventListener('input', () => {
  density = clamp(Number(densityInput.value), 2, 9);
  densityOutput.textContent = String(density) + ' 团 / 脚';
});
toggleButton.addEventListener('click', () => { running = !running; updateButtons(); });
stepButton.addEventListener('click', () => {
  emitFootImpact(RUNNER_X - .6, legParts[impacts % 2].side, true);
  updateReadouts();
});
clearButton.addEventListener('click', reset);
toneButtons.forEach(button => button.addEventListener('click', () => {
  const next = button.dataset.tone;
  dust.setTone(next);
  tone = next;
  toneButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tone === next)));
}));

viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  azimuth = clamp(azimuth - dx * .006, -1.2, 1.45);
  altitude = clamp(altitude + dy * .005, .14, 1.02);
});
function stopOrbit(e) {
  if (!pointer || pointer.id !== e.pointerId) return;
  pointer = null;
  if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
}
viewport.addEventListener('pointerup', stopOrbit);
viewport.addEventListener('pointercancel', stopOrbit);
viewport.addEventListener('lostpointercapture', stopOrbit);
viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  distance = clamp(distance + e.deltaY * .009, 6.4, 17);
}, { passive: false });
const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
observer?.observe(viewport);
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => clock.getDelta());
resize();
updateButtons();
updateReadouts();
// Seed a small puff for a visually legible first frame, then the gait loops.
emitFootImpact(RUNNER_X - .45, legParts[0].side, true);
animate();
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame.id);
  observer?.disconnect();
  dust.dispose();
  cloudGeo.dispose();
  renderer.dispose();
  upperGeom.dispose(); lowerGeom.dispose(); kneeGeom.dispose();
  legParts.forEach(part => {
    for (const mesh of part.foot.children) mesh.geometry.dispose();
  });
  upperMat.dispose(); lowerMat.dispose(); kneeMat.dispose(); soleMat.dispose(); detailMat.dispose();
  shoeMats.forEach(mat => mat.dispose());
  [floor,platform,line,torso,shorts,waistband].forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
  marks.children.forEach(mesh=>{ mesh.geometry.dispose(); mesh.material.dispose(); });
}, { once: true });
