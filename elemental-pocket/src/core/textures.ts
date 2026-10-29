import * as THREE from 'three';
import { TAU, rand } from './math';

export function radialTexture(stops: [number, string][], size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  return radialTexture([
    [0.0, 'rgba(38,50,72,0.92)'],
    [0.35, 'rgba(24,33,50,0.62)'],
    [0.72, 'rgba(12,17,28,0.22)'],
    [1.0, 'rgba(0,0,0,0)']
  ]);
}

export function frostTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  const cx = size / 2, cy = size / 2;

  const grd = g.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
  grd.addColorStop(0, 'rgba(185,238,255,0.55)');
  grd.addColorStop(0.5, 'rgba(120,200,255,0.20)');
  grd.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  // 放射状冰纹
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 110; i++) {
    const a = Math.random() * TAU;
    const r0 = size * 0.10 + Math.random() * size * 0.12;
    const r1 = r0 + size * 0.06 + Math.random() * size * 0.20;
    g.strokeStyle = `rgba(205,246,255,${rand(0.08, 0.30)})`;
    g.lineWidth = rand(0.8, 2.6);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    for (let s = 1; s <= 3; s++) {
      const rr = r0 + (r1 - r0) * (s / 3);
      const aa = a + rand(-0.09, 0.09);
      g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
