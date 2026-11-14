import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Rainbow Cue / Lucky Break. All meshes and textures are procedural.
// Velocity decreases with constant rolling friction. The world-space
// rainbow remains behind the moving ball and fades after the ball stops.
const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const viewport = $('#stage-view');
const hitButton = $('#hit');
const resetButton = $('#reset');
const powerInput = $('#power');
const powerOutput = $('#power-output');
const speedLabel = $('#speed-value');
const speedFill = $('#speed-fill');
const phaseLabel = $('#phase-label');
const renderStatus = $('#render-status');
const paletteButtons = [...document.querySelectorAll('[data-palette]')];

const RADIUS = 0.56;
const TRAIL_CONTACT_Y = 0.095; // just above the felt at y = -0.02
const TRAIL_ATTACH = RADIUS * .22; // under the rolling ball, near the contact patch
const START_X = -2.6;
const FRICTION = 2.35; // units / s^2
const TRAIL_LIFETIME = 2.8;
const POINT_CAPACITY = 165;
const CLOUD_SLICES = 11;
const CLOUD_LAYERS = 2;
const MIN_SPEED = 0.03;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const random = (lo, hi) => lo + Math.random() * (hi - lo);
const smooth = (v) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 63);
  grad.addColorStop(0, 'rgba(255,255,255,.78)');
  grad.addColorStop(.28, 'rgba(255,255,255,.3)');
  grad.addColorStop(.67, 'rgba(255,255,255,.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeFourPointTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const halo = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,255,255,1)');
  halo.addColorStop(.14, 'rgba(255,255,255,.94)');
  halo.addColorStop(.36, 'rgba(255,255,255,.33)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.moveTo(64, 5);
  g.quadraticCurveTo(70, 56, 123, 64);
  g.quadraticCurveTo(70, 72, 64, 123);
  g.quadraticCurveTo(58, 72, 5, 64);
  g.quadraticCurveTo(58, 56, 64, 5);
  g.closePath();
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 13; g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function addSpot(ball, normal, color, radius) {
  const direction = new THREE.Vector3(...normal).normalize();
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false })
  );
  marker.position.copy(direction).multiplyScalar(RADIUS + .003);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  ball.add(marker);
}

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
});
renderer.setClearColor(0x0d2030, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.26;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const camera = new THREE.PerspectiveCamera(43, 1, .1, 250);
const clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xe6fbff, 0x2d4957, 2.35));
const keyLight = new THREE.DirectionalLight(0xfffaf1, 3.8);
keyLight.position.set(-3.8, 7.4, 5.4); scene.add(keyLight);
const rimLight = new THREE.PointLight(0x8cbcff, 55, 14, 2);
rimLight.position.set(2.4, 3.2, -2); scene.add(rimLight);
const pinkLight = new THREE.PointLight(0xffacd9, 35, 13, 2);
pinkLight.position.set(-5, 2.8, 2); scene.add(pinkLight);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 100),
  new THREE.MeshStandardMaterial({ color: 0x163443, roughness: 1, metalness: 0 })
);
table.rotation.x = -Math.PI / 2;
table.position.y = -.02; scene.add(table);
const grid = new THREE.GridHelper(300, 150, 0x7899a6, 0x40687a);
grid.position.y = .007;
const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
gridMats.forEach(mat => { mat.transparent = true; mat.opacity = .18; mat.depthWrite = false; });
scene.add(grid);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(RADIUS, 64, 48),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .20, metalness: .025,
    clearcoat: .82, clearcoatRoughness: .16
  })
);
ball.position.set(START_X, RADIUS, 0); scene.add(ball);
addSpot(ball, [0, .15, .99], 0x5c8fba, .052);
addSpot(ball, [.9, .12, .42], 0xd65d7a, .040);
addSpot(ball, [-.3, .94, .24], 0x6d98b3, .035);

const glowTexture = makeGlowTexture();
const groundGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.5, 1.8),
  new THREE.MeshBasicMaterial({
    map: glowTexture, color: 0x5de9df, transparent: true,
    blending: THREE.AdditiveBlending, opacity: .22,
    depthWrite: false, side: THREE.DoubleSide
  })
);
groundGlow.rotation.x = -Math.PI / 2;
groundGlow.position.set(START_X, .012, 0); scene.add(groundGlow);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 1.35),
  new THREE.MeshBasicMaterial({
    map: glowTexture, color: 0x07121c, transparent: true,
    opacity: .7, depthWrite: false, side: THREE.DoubleSide
  })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(START_X, .01, 0); scene.add(shadow);

// An illuminated volume made of overlapping radial point sprites, not separate
// ribbon strips. Every sprite fades to alpha 0 at its perimeter, so the trail
// has no polygon borders, colored rails, or hard silhouettes.
const PALETTE_HEX = {
  warm: ['#ffe0b4', '#ffc1ab', '#ffabc2', '#eda5d5', '#d9b5e8'],
  cool: ['#c0f5e5', '#9de9de', '#90dcea', '#98c4f2', '#b8b5ee']
};
const PALETTES = Object.fromEntries(
  Object.entries(PALETTE_HEX).map(([name, hexes]) =>
    [name, hexes.map(hex => new THREE.Color(hex))])
);
let activePalette = 'warm';
let activeColors = PALETTES[activePalette];
const workingColor = new THREE.Color();

function paletteColor(t, out = workingColor) {
  const stop = clamp(t, 0, 1) * (activeColors.length - 1);
  const i = Math.min(activeColors.length - 2, Math.floor(stop));
  const fract = stop - i;
  return out.copy(activeColors[i]).lerp(activeColors[i + 1], smooth(fract));
}
function setPalette(name) {
  if (!PALETTES[name]) return;
  activePalette = name;
  activeColors = PALETTES[name];
  paletteButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.palette === name));
  });
  // Existing glitter recolors immediately; newly spawned stars use the same palette.
  stars.forEach(star => {
    if (star.active) star.sprite.material.color.copy(activeColors[star.colorIndex || 0]);
  });
}

// Each sampled position contributes an inner pearly glow and an outer haze.
// Using point sprites rather than adjoining translucent triangle strips prevents
// sharp seams even while the ribbon bends or changes viewing angle.
const MAX_CLOUD_POINTS = POINT_CAPACITY * CLOUD_SLICES * CLOUD_LAYERS;
const positions = new Float32Array(MAX_CLOUD_POINTS * 3);
const tints = new Float32Array(MAX_CLOUD_POINTS * 3);
const alphas = new Float32Array(MAX_CLOUD_POINTS);
const sizes = new Float32Array(MAX_CLOUD_POINTS);
const ribbonGeo = new THREE.BufferGeometry();
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
ribbonGeo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
ribbonGeo.setAttribute('aOpacity', new THREE.BufferAttribute(alphas, 1));
ribbonGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
ribbonGeo.setDrawRange(0, 0);
const ribbonMat = new THREE.ShaderMaterial({
  uniforms: { uPointScale: { value: 450 } },
  vertexShader: [
    'attribute vec3 aTint;',
    'attribute float aOpacity;',
    'attribute float aSize;',
    'varying vec3 vTint;',
    'varying float vOpacity;',
    'uniform float uPointScale;',
    'void main() {',
    '  vTint = aTint;',
    '  vOpacity = aOpacity;',
    '  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * viewPos;',
    '  gl_PointSize = clamp(aSize * uPointScale / max(0.1, -viewPos.z), 1.0, 180.0);',
    '}'
  ].join('\n'),
  fragmentShader: [
    'varying vec3 vTint;',
    'varying float vOpacity;',
    'void main() {',
    '  vec2 uv = gl_PointCoord * 2.0 - 1.0;',
    '  float d = length(uv);',
    '  if (d >= 1.0) discard;',
    '  float feather = pow(max(0.0, 1.0 - d * d), 3.0);',
    '  float haze = exp(-3.0 * d * d);',
    '  gl_FragColor = vec4(vTint, vOpacity * feather * haze);',
    '}'
  ].join('\n'),
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending
});
const ribbon = new THREE.Points(ribbonGeo, ribbonMat);
ribbon.renderOrder = 2;
ribbon.frustumCulled = false;
scene.add(ribbon);

const starTexture = makeFourPointTexture();
const stars = Array.from({ length: reducedMotion ? 48 : 100 }, () => {
  const material = new THREE.SpriteMaterial({
    map: starTexture, color: 0xffffff, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false; sprite.renderOrder = 3;
  scene.add(sprite);
  return { sprite, active: false, born: 0, life: 0, baseY: 0,
    size: 0, phase: 0, frequency: 0 };
});
let starCursor = 0;
let power = Number(powerInput.value);
let velocity = 0;
let launchVelocity = 0;
let time = 0;
let lastSampleX = START_X - RADIUS;
let starAccumulator = 0;
let trail = [];
let focusX = START_X - .65;
let azimuth = .13, altitude = .37, cameraDistance = 10.5;
let animationId = 0;
let activePointer = null;

function initialSpeed() { return 4.4 + power / 100 * 6.4; }
function getPhase() {
  if (velocity > MIN_SPEED) return 'ROLLING';
  if (trail.length) return 'TRAIL FADING';
  return 'READY';
}
function updateHUD() {
  speedLabel.textContent = velocity.toFixed(1);
  speedFill.style.width = launchVelocity ? (velocity / launchVelocity * 100).toFixed(1) + '%' : '0%';
  const phase = getPhase();
  phaseLabel.textContent = phase === 'ROLLING' ? '母球滚动中'
    : phase === 'TRAIL FADING' ? '彩虹余光消散中' : '准备击打';
  renderStatus.textContent = phase;
}
function clearStars() {
  stars.forEach(s => {
    s.active = false; s.sprite.visible = false;
    s.sprite.material.opacity = 0;
  });
  starCursor = 0; starAccumulator = 0;
}
function reset() {
  velocity = 0; launchVelocity = 0;
  ball.position.set(START_X, RADIUS, 0);
  ball.rotation.set(0, 0, 0);
  lastSampleX = START_X - RADIUS;
  trail = [];
  focusX = START_X - .65;
  clearStars();
  ribbonGeo.setDrawRange(0, 0);
  groundGlow.position.x = shadow.position.x = START_X;
  updateHUD();
}
function hit() {
  reset();
  velocity = initialSpeed(); launchVelocity = velocity;
  lastSampleX = ball.position.x - TRAIL_ATTACH;
  trail.push({ x: lastSampleX, born: time });
  updateHUD();
}
function spawnStar() {
  const s = stars[starCursor];
  starCursor = (starCursor + 1) % stars.length;
  s.active = true; s.born = time;
  s.life = random(.70, 2.4);
  s.size = random(.075, .245) * (Math.random() < .13 ? 1.65 : 1);
  s.baseY = random(.12, .39); // most starbursts skim the felt
  s.phase = random(0, Math.PI * 2);
  s.frequency = random(7.4, 18);
  s.colorIndex = Math.floor(random(0, activeColors.length));
  s.sprite.position.set(
    ball.position.x - random(.25, 1.1), s.baseY, random(-.50, .50)
  );
  s.sprite.material.rotation = random(-.6, .6);
  s.sprite.material.color.copy(activeColors[s.colorIndex]);
  s.sprite.visible = true;
}
function ageStars() {
  for (const s of stars) {
    if (!s.active) continue;
    const age = time - s.born;
    if (age >= s.life) { s.sprite.visible = false; s.active = false; continue; }
    const fade = 1 - smooth(age / s.life);
    const twinkle = Math.pow(.5 + .5 * Math.sin(age * s.frequency + s.phase), 2);
    s.sprite.material.opacity = fade * (.32 + .68 * twinkle) * .95;
    s.sprite.scale.setScalar(s.size * (.67 + .65 * twinkle));
    s.sprite.position.y = s.baseY + Math.sin(time * 2.1 + s.phase) * .025;
    s.sprite.material.rotation += .006;
  }
}
function sampleTrail(distance) {
  const tip = ball.position.x - TRAIL_ATTACH;
  const step = .085;
  let iterations = 0;
  while (tip - lastSampleX >= step && iterations < 22) {
    lastSampleX += step;
    trail.push({ x: lastSampleX, born: time });
    iterations++;
  }
  if (distance > 0 && trail.length < 2) {
    trail.push({ x: tip, born: time });
    lastSampleX = tip;
  }
  if (trail.length > POINT_CAPACITY - 2) {
    trail.splice(0, trail.length - (POINT_CAPACITY - 2));
  }
}
function removeExpiredPoints() {
  while (trail.length && time - trail[0].born >= TRAIL_LIFETIME) trail.shift();
  if (trail.length === 1 && velocity <= MIN_SPEED &&
      time - trail[0].born > 1.1) trail = [];
}
function updateMovement(dt) {
  if (velocity > MIN_SPEED) {
    const next = Math.max(0, velocity - FRICTION * dt);
    const distance = (velocity + next) * .5 * dt;
    velocity = next;
    ball.position.x += distance;
    // No slipping: angular displacement = translation / ball radius.
    ball.rotation.z -= distance / RADIUS;
    sampleTrail(distance);
    starAccumulator += distance * (reducedMotion ? 4.4 : 10);
    while (starAccumulator >= 1) { spawnStar(); starAccumulator -= 1; }
    if (velocity <= MIN_SPEED) velocity = 0;
  }
  removeExpiredPoints(); ageStars();
}
function updateRibbon() {
  // Each point is an overlapping soft glowing cloud, not a polygon-edge strip.
  if (!trail.length) { ribbonGeo.setDrawRange(0, 0); return; }
  const pts = velocity > MIN_SPEED
    ? [...trail, { x: ball.position.x - TRAIL_ATTACH, born: time }]
    : trail;
  let count = 0;
  for (const sample of pts) {
    if (count + CLOUD_SLICES * CLOUD_LAYERS > MAX_CLOUD_POINTS) break;
    const age = clamp((time - sample.born) / TRAIL_LIFETIME, 0, 1);
    const fade = Math.pow(1 - smooth(age), 1.5);
    const spread = .78 + age * .20;
    for (let slice = 0; slice < CLOUD_SLICES; slice++) {
      const u = (slice + .5) / CLOUD_SLICES;
      const side = u * 2 - 1;
      const hue = clamp(u + .06 * Math.sin(sample.x * 1.35 + time * 1.0), 0, 1);
      const color = paletteColor(hue);
      const edgeFalloff = .55 + .45 * Math.exp(-2.5 * side * side);
      const wave = Math.sin(sample.x * 2.1 - time * 3.0 + u * 2.5) * .085;
      const z = side * spread * .56 + wave;
      const y = TRAIL_CONTACT_Y + .032 * (1 - side * side) +
        .015 * Math.sin(sample.x * 2.6 - time * 4.2 + u * 2.0) + age * .02;
      for (let layer = 0; layer < CLOUD_LAYERS; layer++) {
        const k = count * 3;
        positions[k] = sample.x + .015 * Math.sin(u * 21 + sample.x * 2.0 + layer * 1.8);
        positions[k + 1] = y + (layer === 0 ? .016 : -.012);
        positions[k + 2] = z;
        tints[k] = color.r; tints[k + 1] = color.g; tints[k + 2] = color.b;
        const flicker = .92 + .08 * Math.sin(time * 4.1 + sample.x * 7.0 + u * 5.0);
        // Several dim clouds overlap to make one continuous gradient volume.
        alphas[count] = (layer === 0 ? .023 : .045) * fade * edgeFalloff * flicker;
        sizes[count] = (layer === 0 ? 1.00 : .47) * (1 + age * .12);
        count++;
      }
    }
  }
  ribbonGeo.setDrawRange(0, count);
  ribbonGeo.attributes.position.needsUpdate = true;
  ribbonGeo.attributes.aTint.needsUpdate = true;
  ribbonGeo.attributes.aOpacity.needsUpdate = true;
  ribbonGeo.attributes.aSize.needsUpdate = true;
}
function updateCamera(dt) {
  const target = ball.position.x - .70;
  focusX += (target - focusX) * (1 - Math.exp(-dt * 3.25));
  const horizontal = Math.cos(altitude) * cameraDistance;
  camera.position.set(
    focusX + Math.sin(azimuth) * horizontal,
    .6 + Math.sin(altitude) * cameraDistance,
    Math.cos(azimuth) * horizontal
  );
  camera.lookAt(focusX, .45, 0);
}
function resize() {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  renderer.setSize(width, height, false);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ribbonMat.uniforms.uPointScale.value = (height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)));

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
function render() {
  animationId = requestAnimationFrame(render);
  let dt = Math.min(clock.getDelta(), .05);
  if (document.hidden) dt = 0;
  time += dt;
  updateMovement(dt);
  updateRibbon();
  groundGlow.position.x = shadow.position.x = ball.position.x;
  groundGlow.material.opacity = .18 + (launchVelocity ? .11 * velocity / launchVelocity : 0);
  updateCamera(dt);
  updateHUD();
  renderer.render(scene, camera);
}

// Drag to orbit the 3D stage; the hit button applies motion to the ball.
viewport.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  activePointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove', e => {
  if (!activePointer || e.pointerId !== activePointer.id) return;
  const dx = e.clientX - activePointer.x;
  const dy = e.clientY - activePointer.y;
  activePointer.x = e.clientX; activePointer.y = e.clientY;
  azimuth = clamp(azimuth - dx * .006, -1.15, 1.15);
  altitude = clamp(altitude + dy * .004, .18, 1.04);
});
function releasePointer(e) {
  if (!activePointer || e.pointerId !== activePointer.id) return;
  activePointer = null;
  if (viewport.hasPointerCapture(e.pointerId))
    viewport.releasePointerCapture(e.pointerId);
}
viewport.addEventListener('pointerup', releasePointer);
viewport.addEventListener('pointercancel', releasePointer);
viewport.addEventListener('lostpointercapture', releasePointer);
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  cameraDistance = clamp(cameraDistance + e.deltaY * .008, 6.4, 15);
}, { passive: false });

powerInput.addEventListener('input', () => {
  power = Number(powerInput.value);
  powerOutput.value = power + '%';
  powerOutput.textContent = power + '%';
});
paletteButtons.forEach(button => {
  button.addEventListener('click', () => setPalette(button.dataset.palette));
});
hitButton.addEventListener('click', hit);
resetButton.addEventListener('click', reset);
document.addEventListener('visibilitychange', () => { clock.getDelta(); });
window.addEventListener('resize', resize);
const observer = new ResizeObserver(resize);
observer.observe(viewport);
resize(); reset(); setPalette('warm'); render();

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(animationId);
  observer.disconnect();
  renderer.dispose();
  table.geometry.dispose(); table.material.dispose();
  grid.geometry.dispose(); gridMats.forEach(m => m.dispose());
  ball.geometry.dispose(); ball.material.dispose();
  ball.children.forEach(ch => { ch.geometry.dispose(); ch.material.dispose(); });
  glowTexture.dispose();
  groundGlow.geometry.dispose(); groundGlow.material.dispose();
  shadow.geometry.dispose(); shadow.material.dispose();
  starTexture.dispose(); stars.forEach(s => s.sprite.material.dispose());
  ribbonGeo.dispose(); ribbonMat.dispose();
}, { once: true });
