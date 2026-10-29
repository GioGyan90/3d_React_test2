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
  const points = scene.children[0].children.find(child => child.isPoints);
  assert.equal(points.geometry.attributes.position.count, Math.round(950 * 0.35));
  effects.dispose();
});
