import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PocketEffects } from '../lib/index.js';

// Texture creation only needs the 2D drawing methods below. WebGL is tested in the live preview.
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    return { width: 0, height: 0, getContext() { return {
      createRadialGradient() { return { addColorStop() {} }; },
      fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    }; } };
  },
};

test('all four effects play concurrently at the requested position and finish once', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2, 3, 4);
  const effects = new PocketEffects(scene, { camera, quality: 'low', pixelRatio: 1.5 });
  let completed = 0;
  const names = ['fire', 'thunder', 'grass', 'ice'];
  const handles = names.map((name, i) => effects.play(name, { position: { x: i, y: 0.2, z: -i }, radius: 0.92, duration: 2, onComplete: () => completed++ }));
  assert.equal(scene.children.length, 4);
  assert.deepEqual(scene.children[1].position.toArray(), [1, 0.2, -1]);
  assert.equal(scene.children[0].scale.x, 2);
  for (let i = 0; i < 20; i++) effects.update(0.1);
  assert.equal(completed, 4);
  assert.ok(handles.every(handle => !handle.active));
  effects.update(1);
  assert.equal(completed, 4);
  effects.dispose();
  assert.equal(scene.children.length, 0);
});

test('pooled objects can be replayed without an old handle stopping a new playback', () => {
  const scene = new THREE.Scene();
  const effects = new PocketEffects(scene);
  let completed = 0;
  const first = effects.play('fire', { duration: 0.2, onComplete: () => completed++ });
  effects.update(0.2);
  const second = effects.play('fire', { duration: 1, onComplete: () => completed++ });
  assert.equal(scene.children.length, 1);
  first.stop();
  assert.equal(second.active, true);
  second.stop();
  assert.equal(second.active, false);
  assert.equal(completed, 1);
  effects.dispose();
});

test('disposing releases owned resources without disturbing the parent or shared sprite geometry', () => {
  const scene = new THREE.Scene();
  const other = new THREE.Object3D();
  scene.add(other);
  const effects = new PocketEffects(scene);
  effects.play('fire');
  const group = scene.children[1];
  const points = group.children.find(child => child.isPoints);
  const sprite = group.children.find(child => child.isSprite);
  let pointsDisposed = false;
  let sharedSpriteDisposed = false;
  points.geometry.addEventListener('dispose', () => { pointsDisposed = true; });
  sprite.geometry.addEventListener('dispose', () => { sharedSpriteDisposed = true; });
  effects.dispose();
  effects.dispose();
  assert.equal(pointsDisposed, true);
  assert.equal(sharedSpriteDisposed, false);
  assert.deepEqual(scene.children, [other]);
  assert.throws(() => effects.play('ice'), /disposed/);
});

test('invalid values are rejected and quality controls particle count', () => {
  const scene = new THREE.Scene();
  const effects = new PocketEffects(scene, { quality: 'low' });
  assert.throws(() => effects.play('fire', { radius: 0 }), /radius/);
  assert.throws(() => effects.play('fire', { duration: NaN }), /duration/);
  assert.throws(() => effects.update(-1), /deltaSeconds/);
  effects.play('fire');
  const lowCount = scene.children[0].children.find(child => child.isPoints).geometry.attributes.position.count;
  const highScene = new THREE.Scene();
  const high = new PocketEffects(highScene, { quality: 'high' });
  high.play('fire');
  const highCount = highScene.children[0].children.find(child => child.isPoints).geometry.attributes.position.count;
  assert.ok(lowCount < highCount);
  effects.dispose();
  high.dispose();
});


test('fire has a connected mesh body as well as sparse embers', () => {
  const scene = new THREE.Scene();
  const fx = new PocketEffects(scene);
  fx.play('fire');
  const body = scene.children[0].children.filter(child => child.name === 'Continuous flame');
  assert.ok(body.length >= 1);
  assert.ok(body[0].geometry.index.count > 100);
  assert.ok(scene.children[0].children.some(child => child.isPoints));
  fx.dispose();
});

test('ground lightning arcs meet the main strike at a common point', () => {
  const scene = new THREE.Scene();
  const fx = new PocketEffects(scene);
  fx.play('thunder');
  fx.update(0.15);
  const group = scene.children[0];
  const trunk = group.children.find(child => child.name === 'Lightning trunk');
  const arcs = group.children.filter(child => child.name === 'Connected ground arc');
  const centerAt = (geometry, pointIndex) => {
    const p = geometry.attributes.position.array;
    const offset = pointIndex * 6;
    return new THREE.Vector3((p[offset] + p[offset + 3]) / 2, (p[offset + 1] + p[offset + 4]) / 2, (p[offset + 2] + p[offset + 5]) / 2);
  };
  const end = centerAt(trunk.geometry, trunk.geometry.drawRange.count / 6);
  assert.ok(arcs.length >= 2);
  for (const arc of arcs) assert.ok(centerAt(arc.geometry, 0).distanceTo(end) < 1e-5);
  fx.dispose();
});

test('ice and leaves have a visible range of sizes and leaf orientations', () => {
  const scalesAndRotations = (type, elapsed) => {
    const scene = new THREE.Scene();
    const fx = new PocketEffects(scene);
    fx.play(type);
    fx.update(elapsed);
    const mesh = scene.children[0].children.find(child => child.isInstancedMesh);
    const scales = [], rotations = [];
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      if (scale.y > 0.05) { scales.push(scale.y); rotations.push(rotation); }
    }
    fx.dispose();
    return { scales, rotations };
  };
  const ice = scalesAndRotations('ice', 1.0);
  const leaves = scalesAndRotations('grass', 0.6);
  assert.ok(Math.max(...ice.scales) / Math.min(...ice.scales) > 3);
  assert.ok(Math.max(...leaves.scales) / Math.min(...leaves.scales) > 3);
  assert.ok(leaves.rotations.some(q => Math.abs(q.dot(leaves.rotations[0])) < 0.9));
});


test('all effects finish at two seconds by default and keep custom durations', () => {
  const scene = new THREE.Scene();
  const fx = new PocketEffects(scene);
  let completed = 0;
  const handles = ['fire', 'thunder', 'grass', 'ice'].map(type => fx.play(type, { onComplete: () => completed++ }));
  fx.update(1.999);
  assert.ok(handles.every(handle => handle.active));
  assert.equal(completed, 0);
  fx.update(0.001);
  assert.ok(handles.every(handle => !handle.active));
  assert.equal(completed, 4);
  const custom = fx.play('fire', { duration: 0.5 });
  fx.update(0.49);
  assert.equal(custom.active, true);
  fx.update(0.01);
  assert.equal(custom.active, false);
  fx.dispose();
});

test('fire rises and fades without contracting its parent during extinction', () => {
  const scene = new THREE.Scene();
  const fx = new PocketEffects(scene);
  const handle = fx.play('fire');
  const group = scene.children[0];
  const flame = group.children.find(child => child.name === 'Continuous flame');
  fx.update(0.1);
  assert.ok(flame.material.uniforms.uGrow.value > 0 && flame.material.uniforms.uGrow.value < 1);
  fx.update(0.5);
  assert.equal(flame.material.uniforms.uGrow.value, 1);
  fx.update(1.0);
  assert.equal(handle.active, true);
  assert.equal(flame.material.uniforms.uGrow.value, 1);
  assert.ok(flame.material.uniforms.uExtinguish.value > 0 && flame.material.uniforms.uExtinguish.value < 1);
  assert.deepEqual(group.scale.toArray(), [1, 1, 1]);
  fx.update(0.4);
  assert.equal(handle.active, false);
  fx.dispose();
});
