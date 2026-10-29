import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
import { TAU, RING_R, rand, clamp01, smooth01, easeIn } from '../core/math';
import { radialTexture, frostTexture } from '../core/textures';

function makeLeafGeometry() {
  const SEG = 14;
  const W = 0.085;
  const LEN = 0.28;

  const pos = [];
  const col = [];
  const idx = [];

  const dark = new THREE.Color(0x2c7a3d);
  const mid = new THREE.Color(0x62c56a);
  const light = new THREE.Color(0xa9ea9d);

  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const w = Math.sin(Math.PI * Math.pow(t, 0.68)) * W * (1 - 0.22 * t) + 0.0012;
    const cup = Math.sin(Math.PI * t) * 0.022;
    const y = t * LEN;

    const edge = dark.clone().lerp(mid, t).lerp(light, t * t).multiplyScalar(0.70);
    const center = dark.clone().lerp(mid, t).lerp(light, t * t);

    // 左 / 中 / 右 三列，中列为亮脊
    pos.push(-w, y, cup);        col.push(edge.r, edge.g, edge.b);
    pos.push(0, y, cup + 0.008); col.push(center.r, center.g, center.b);
    pos.push(w, y, cup);         col.push(edge.r, edge.g, edge.b);
  }

  for (let i = 0; i < SEG; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Leaf = { ang: number; r: number; y: number; size: number; dir: number; spinSpd: number; bobF: number; bobP: number; flapF: number; flapP: number; tilt: number; spin: number };
export class GrassEffect extends BaseEffect {
  private count: number;
  private dummy: THREE.Object3D;
  private mesh: THREE.InstancedMesh;
  private leaves: Leaf[];
  private groundGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  constructor(scene: THREE.Object3D, quality: number) {
    super(scene, 4.1);

    this.count = Math.max(12, Math.round(38 * quality));
    this.dummy = new THREE.Object3D();

    const geo = makeLeafGeometry();
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    this.leaves = [];
    const palette = [0x9fe08a, 0x6fd07a, 0xc8f08a, 0x54b56a, 0xa8d96a];

    for (let i = 0; i < this.count; i++) {
      this.leaves.push({
        ang: (i / this.count) * TAU + rand(-0.22, 0.22),
        r: RING_R * rand(0.80, 1.38),
        y: rand(0.10, 0.78),
        size: rand(0.72, 1.55),
        dir: Math.random() < 0.5 ? -1 : 1,
        spinSpd: rand(0.35, 0.95),
        bobF: rand(1.4, 2.8),
        bobP: Math.random() * TAU,
        flapF: rand(2.0, 4.2),
        flapP: Math.random() * TAU,
        tilt: rand(-0.5, 0.5),
        spin: rand(-1.2, 1.2)
      });
      this.mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]).multiplyScalar(rand(0.85, 1.12)));
    }
    this.mesh.instanceColor!.needsUpdate = true;

    // 地面微光（叶影氛围）
    const glow = radialTexture([
      [0.0, 'rgba(150,240,150,0.35)'],
      [0.5, 'rgba(90,200,110,0.12)'],
      [1.0, 'rgba(90,200,110,0)']
    ]);
    this.groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: glow, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0
      })
    );
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.y = 0.004;
    this.group.add(this.groundGlow);
  }

  update() {
    const T = this.t;
    const EXIT_START = 2.55;
    const EXIT_DUR = 1.45;

    let globalIntensity;
    if (T < 0) globalIntensity = 0.62;
    else globalIntensity = 1.0;

    for (let i = 0; i < this.count; i++) {
      const L = this.leaves[i];
      const st = i / this.count;

      // 出场：错峰生长
      const emerge = T < 0
        ? 0.62
        : smooth01((T - st * 0.30) / 0.45);

      // 退场：错峰卷入球洞
      let exitP = 0;
      if (T >= EXIT_START) {
        exitP = clamp01((T - EXIT_START - st * 0.50 * EXIT_DUR) / (0.50 * EXIT_DUR));
      }
      const e = easeIn(exitP);

      const R = L.r * (1 - e * 0.995);
      const ang = L.ang + this.time * L.spinSpd * L.dir * (1 + e * 4.0);
      const x = Math.cos(ang) * R;
      const z = Math.sin(ang) * R;

      const bob = Math.sin(this.time * L.bobF + L.bobP) * 0.055;
      const y = (L.y + bob) * (1 - e) + (-0.14) * e;

      const scale = L.size * emerge * (1 - e * e) * globalIntensity;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(
        L.tilt + Math.sin(this.time * L.flapF + L.flapP) * 0.55 + e * 2.2,
        ang + Math.PI * 0.5 + this.time * L.spin * (1 + e * 2),
        Math.sin(this.time * L.flapF * 0.7 + L.flapP) * 0.65
      );
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;

    const gAlpha = T < 0 ? 0.18 : smooth01(T / 0.7) * (1 - smooth01((T - EXIT_START) / EXIT_DUR));
    this.groundGlow.material.opacity = 0.30 * gAlpha;
  }
}
