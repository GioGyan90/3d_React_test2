import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
import { TAU, RING_R, rand, clamp01, smooth01, easeIn } from '../core/math';
import { radialTexture, frostTexture } from '../core/textures';

function ringStripGeometry(r0: number, r1: number, seg: number, clockwise: boolean) {
  const pos = [], uv = [], idx = [];

  for (let i = 0; i <= seg; i++) {
    const f = i / seg;
    const a = (clockwise ? -1 : 1) * f * TAU + Math.PI * 0.5;
    const c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1);
    uv.push(f, 0, f, 1);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

type Shard = { rj: number; y: number; sx: number; sy: number; sz: number; rx: number; rz: number; spin: number };
export class IceEffect extends BaseEffect {
  private count: number;
  private freezeDur: number;
  private holdEnd: number;
  private dummy: THREE.Object3D;
  private shards: THREE.InstancedMesh;
  private shardParams: Shard[];
  private sweepMat: THREE.ShaderMaterial;
  private sweep: THREE.Mesh;
  private frost: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private dustMat: THREE.ShaderMaterial;
  private dust: THREE.Points;
  constructor(scene: THREE.Object3D, quality: number) {
    super(scene, 3.9);

    this.count = Math.max(24, Math.round(84 * quality));
    this.freezeDur = 1.65;
    this.holdEnd = 2.30;
    this.dummy = new THREE.Object3D();

    // ---- 冰晶 ----
    const shardGeo = new THREE.OctahedronGeometry(1, 0);
    shardGeo.scale(0.055, 0.155, 0.055);
    const shardMat = new THREE.MeshBasicMaterial({
      color: 0xc8efff,
      transparent: true,
      opacity: 0.95
    });

    this.shards = new THREE.InstancedMesh(shardGeo, shardMat, this.count);
    this.shards.frustumCulled = false;
    this.group.add(this.shards);

    this.shardParams = [];
    const tints = [0xbdeaff, 0x9fd8ff, 0xe2f8ff, 0x86c9ee];
    for (let i = 0; i < this.count; i++) {
      this.shardParams.push({
        rj: rand(-0.05, 0.06),
        y: rand(0.0, 0.10),
        sx: rand(0.75, 1.45),
        sy: rand(0.65, 1.75),
        sz: rand(0.75, 1.45),
        rx: rand(-0.35, 0.35),
        rz: rand(-0.35, 0.35),
        spin: rand(-1.1, 1.1)
      });
      this.shards.setColorAt(i, new THREE.Color(tints[i % tints.length]));
    }
    this.shards.instanceColor!.needsUpdate = true;

    // ---- 顺时针扫光 / 冻结层 ----
    this.sweepMat = new THREE.ShaderMaterial({
      uniforms: {
        uFront: { value: 0 },
        uCrack: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uFront, uCrack, uTime, uOpacity;
        varying vec2 vUv;

        void main() {
          float f = vUv.x;

          // 冻结前沿的锐利亮边
          float edge = exp(-pow((uFront - f) * 26.0, 2.0));
          edge *= (1.0 - smoothstep(0.82, 1.0, uFront));

          // 已冻结区域的淡蓝填充
          float filled = step(f, uFront) * 0.30;

          // 碎裂推进：已碎区域熄灭
          float alive = 1.0 - step(f, uCrack);

          float shimmer = 0.76 + 0.24 * sin(f * 150.0 - uTime * 6.0);

          float a = (edge * 1.15 + filled) * alive * uOpacity * shimmer;
          vec3 col = mix(vec3(0.36, 0.78, 1.0), vec3(1.0), edge);

          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.sweep = new THREE.Mesh(
      ringStripGeometry(RING_R * 0.74, RING_R * 1.26, 160, true),
      this.sweepMat
    );
    this.sweep.position.y = 0.008;
    this.group.add(this.sweep);

    // ---- 地面霜环 ----
    this.frost = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 1.85),
      new THREE.MeshBasicMaterial({
        map: frostTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0
      })
    );
    this.frost.rotation.x = -Math.PI / 2;
    this.frost.position.y = 0.003;
    this.group.add(this.frost);

    // ---- 碎冰屑 ----
    const N = Math.round(900 * quality);
    const g = new THREE.BufferGeometry();
    const aShard = new Float32Array(N), aSeed = new Float32Array(N);
    const aOff = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      aShard[i] = Math.floor(Math.random() * this.count) / this.count;
      aSeed[i] = Math.random();
      aOff[i * 3] = rand(-0.09, 0.09);
      aOff[i * 3 + 1] = rand(0.0, 0.22);
      aOff[i * 3 + 2] = rand(-0.09, 0.09);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aShard', new THREE.Float32BufferAttribute(aShard, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1));
    g.setAttribute('aOff', new THREE.Float32BufferAttribute(aOff, 3));

    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uCrack: { value: 0 },
        uRadius: { value: RING_R },
        uTime: { value: 0 },
        uPixelRatio: { value: 1 }
      },
      vertexShader: /* glsl */`
        attribute float aShard;
        attribute float aSeed;
        attribute vec3 aOff;

        uniform float uCrack, uRadius, uTime, uPixelRatio;
        varying float vA;

        void main() {
          float b = aShard;
          float local = clamp((uCrack - b) / 0.14, 0.0, 1.0);

          float ang = 1.5707963 - b * 6.2831853;
          vec3 base = vec3(cos(ang) * uRadius, 0.12, sin(ang) * uRadius) + aOff;

          // 顺时针旋入
          float sw = local * 2.6;
          float c = cos(sw), s = sin(sw);
          vec3 p = vec3(
            base.x * c - base.z * s,
            base.y * (1.0 - local * 0.85),
            base.x * s + base.z * c
          );

          vec3 target = vec3(0.0, -0.14, 0.0);
          p = mix(p, target, smoothstep(0.15, 1.0, local));
          p.y += sin(uTime * 6.0 + aSeed * 20.0) * 0.02 * (1.0 - local);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = length(modelMatrix[0].xyz) * (5.0 + aSeed * 13.0) * uPixelRatio * (1.0 - local * 0.6) * (2.4 / max(0.001, -mv.z));

          vA = local > 0.001 ? (1.0 - smoothstep(0.72, 1.0, local)) : 0.0;
        }
      `,
      fragmentShader: /* glsl */`
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          float a = pow(1.0 - d, 1.9);
          vec3 col = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), pow(1.0 - d, 4.0));
          gl_FragColor = vec4(col, a * vA);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  onResize(pr: number) {
    this.dustMat.uniforms.uPixelRatio.value = pr;
  }

  update() {
    const T = this.t;

    let front, crack;
    if (T < 0) {
      front = 0.22 + 0.04 * Math.sin(this.time * 1.6);   // 待机：一小段残霜
      crack = 0;
    } else {
      front = smooth01(T / this.freezeDur);
      crack = smooth01((T - this.holdEnd) / 1.25) * 1.14;
    }

    // ---- 冰晶 ----
    for (let i = 0; i < this.count; i++) {
      const f = i / this.count;
      const a = Math.PI * 0.5 - f * TAU;          // 顺时针序号
      const s = this.shardParams[i];

      const appear = clamp01((front - f) / 0.045);
      const gone = smooth01((crack - f) / 0.12);
      const pop = 1 + 0.42 * Math.sin(clamp01((front - f) / 0.14) * Math.PI);
      const wob = 0.88 + 0.12 * Math.sin(this.time * 3.1 + i);

      const sc = appear * (1 - gone) * pop * wob;

      this.dummy.position.set(
        Math.cos(a) * (RING_R + s.rj) * (1 - gone * 0.8),
        (0.02 + s.y * appear) * (1 - gone) - gone * 0.12,
        Math.sin(a) * (RING_R + s.rj) * (1 - gone * 0.8)
      );
      this.dummy.rotation.set(
        s.rx + this.time * s.spin * 0.35,
        -a + this.time * s.spin,
        s.rz
      );
      this.dummy.scale.set(s.sx * sc, s.sy * sc, s.sz * sc);
      this.dummy.updateMatrix();
      this.shards.setMatrixAt(i, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;

    // ---- 扫光 ----
    this.sweepMat.uniforms.uFront.value = front;
    this.sweepMat.uniforms.uCrack.value = crack;
    this.sweepMat.uniforms.uTime.value = this.time;
    this.sweepMat.uniforms.uOpacity.value = 1 - smooth01(crack * 1.15);

    // ---- 霜环 ----
    const frostA = T < 0
      ? 0.10
      : smooth01(front) * (1 - smooth01(crack));
    this.frost.material.opacity = 0.55 * frostA;
    this.frost.scale.setScalar(0.9 + 0.25 * front);

    // ---- 碎冰屑 ----
    this.dustMat.uniforms.uCrack.value = crack;
    this.dustMat.uniforms.uTime.value = this.time;
  }
}
