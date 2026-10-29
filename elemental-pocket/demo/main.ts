import * as THREE from 'three';
import { PocketEffects, type ElementType, type EffectHandle, type EffectQuality } from '../src';
import './style.css';

type Preview = {
  type: ElementType;
  viewport: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  effects: PocketEffects;
  handle?: EffectHandle;
  delay: number;
};

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

function buildStage(scene: THREE.Scene): void {
  // A simple pocket is shown only in the demo. The reusable effect contains no table.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: 0x101b23 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.018;
  scene.add(floor);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.54, 96), new THREE.MeshBasicMaterial({ color: 0x4f6066, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.008;
  scene.add(rim);
  const rimInner = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.48, 96), new THREE.MeshBasicMaterial({ color: 0x202c33, side: THREE.DoubleSide }));
  rimInner.rotation.x = -Math.PI / 2;
  rimInner.position.y = -0.004;
  scene.add(rimInner);
  const pocket = new THREE.Mesh(new THREE.CircleGeometry(0.44, 96), new THREE.MeshBasicMaterial({ color: 0x020509, side: THREE.DoubleSide }));
  pocket.rotation.x = -Math.PI / 2;
  pocket.position.y = 0;
  scene.add(pocket);
}

function start(): void {
  const canvas = required<HTMLCanvasElement>('#canvas');
  const showcase = required<HTMLElement>('#showcase');
  const qualitySelect = required<HTMLSelectElement>('#quality');
  const loopButton = required<HTMLButtonElement>('#loop');
  const playAllButton = required<HTMLButtonElement>('#play-all');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.autoClear = false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let looping = !prefersReducedMotion;
  let quality = qualitySelect.value as EffectQuality;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'));
  const previews: Preview[] = cards.map((card, index) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1119);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 1.55, 3.1);
    camera.lookAt(0, 0.20, 0);
    buildStage(scene);
    return {
      type: card.dataset.effect as ElementType,
      viewport: requiredWithin<HTMLElement>(card, '.visual'),
      scene,
      camera,
      effects: new PocketEffects(scene, { quality, camera, pixelRatio: renderer.getPixelRatio() }),
      delay: 0.25 + index * 0.16,
    };
  });

  function syncLoopButton(): void {
    loopButton.setAttribute('aria-pressed', String(looping));
    loopButton.innerHTML = `循环播放 <span>${looping ? 'ON' : 'OFF'}</span>`;
  }
  function play(preview: Preview): void {
    preview.handle?.stop();
    preview.handle = preview.effects.play(preview.type);
    preview.delay = 1.1;
  }
  cards.forEach((card, index) => requiredWithin<HTMLButtonElement>(card, '.replay').addEventListener('click', () => play(previews[index])));
  playAllButton.addEventListener('click', () => previews.forEach(play));
  loopButton.addEventListener('click', () => {
    looping = !looping;
    syncLoopButton();
    if (looping) previews.forEach((p, i) => { if (!p.handle?.active) p.delay = i * 0.16; });
  });
  qualitySelect.addEventListener('change', () => {
    quality = qualitySelect.value as EffectQuality;
    previews.forEach((preview, index) => {
      preview.effects.dispose();
      preview.effects = new PocketEffects(preview.scene, { quality, camera: preview.camera, pixelRatio: renderer.getPixelRatio() });
      preview.handle = undefined;
      preview.delay = index * 0.16;
    });
    if (!looping) previews.forEach(play);
  });
  syncLoopButton();

  let last = performance.now();
  let width = 0;
  let height = 0;
  function render(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const box = showcase.getBoundingClientRect();
    const nextWidth = Math.round(box.width);
    const nextHeight = Math.round(box.height);
    if (nextWidth !== width || nextHeight !== height) {
      width = nextWidth;
      height = nextHeight;
      renderer.setSize(width, height, false);
    }
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.setScissorTest(true);
    for (const preview of previews) {
      if (!document.hidden) {
        preview.effects.update(dt);
        if (looping && !preview.handle?.active) {
          preview.delay -= dt;
          if (preview.delay <= 0) play(preview);
        }
      }
      const rect = preview.viewport.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
      const x = rect.left - box.left;
      const y = box.bottom - rect.bottom;
      renderer.setViewport(x, y, rect.width, rect.height);
      renderer.setScissor(x, y, rect.width, rect.height);
      preview.camera.aspect = rect.width / rect.height;
      preview.camera.updateProjectionMatrix();
      renderer.render(preview.scene, preview.camera);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function requiredWithin<T extends Element>(parent: Element, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

try {
  start();
} catch (error) {
  console.error(error);
  const banner = required<HTMLElement>('#error');
  banner.textContent = `特效加载失败，请检查浏览器是否支持 WebGL。${error instanceof Error ? ` ${error.message}` : ''}`;
  banner.hidden = false;
}
