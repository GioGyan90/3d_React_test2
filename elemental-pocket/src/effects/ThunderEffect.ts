import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
import { TAU, RING_R, rand, clamp01, smooth01, easeIn } from '../core/math';
import { radialTexture, frostTexture } from '../core/textures';

function makeBoltPath(a: THREE.Vector3, b: THREE.Vector3, depth: number, jitter: number) {
  let pts = [a.clone(), b.clone()];
  let disp = a.distanceTo(b) * jitter;

  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      mid.x += rand(-0.5, 0.5) * disp;
      mid.z += rand(-0.5, 0.5) * disp;
      mid.y += rand(-0.5, 0.5) * disp * 0.25;
      next.push(mid, p1);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

const RIBBON_VERT = /* glsl */`
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vSide;

  void main() {
    float d = abs(vSide);
    float core = 1.0 - smoothstep(0.05, 0.42, d);
    float halo = pow(1.0 - d, 2.0) * 0.35;
    vec3 col = mix(uColor, vec3(0.95, 0.98, 1.0), core * 0.76);
    gl_FragColor = vec4(col, (core * 0.80 + halo) * uAlpha);
  }
`;

/** 面向镜头的带状闪电网格 */
class Ribbon {
  maxPts: number;
  pos: Float32Array;
  geo: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  constructor(maxPts: number) {
    this.maxPts = maxPts;
    this.pos = new Float32Array(maxPts * 2 * 3);

    const side = new Float32Array(maxPts * 2);
    for (let i = 0; i < maxPts; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }

    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setIndex(idx);
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3(0.55, 0.78, 1.0) },
        uAlpha: { value: 0 }
      },
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  setPath(points: THREE.Vector3[], width: number, viewDir: THREE.Vector3) {
    const n = Math.min(points.length, this.maxPts);
    const tan = new THREE.Vector3();
    const perp = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];

      tan.subVectors(next, prev);
      if (tan.lengthSq() < 1e-9) tan.set(0, 1, 0);
      tan.normalize();

      perp.crossVectors(tan, viewDir);
      if (perp.lengthSq() < 1e-9) perp.set(1, 0, 0);
      perp.normalize().multiplyScalar(width);

      const o = i * 6;
      this.pos[o]     = p.x + perp.x;
      this.pos[o + 1] = p.y + perp.y;
      this.pos[o + 2] = p.z + perp.z;
      this.pos[o + 3] = p.x - perp.x;
      this.pos[o + 4] = p.y - perp.y;
      this.pos[o + 5] = p.z - perp.z;
    }

    this.geo.setDrawRange(0, (n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class ThunderEffect extends BaseEffect {
  private viewDir: THREE.Vector3;
  private mainBolt: Ribbon;
  private mainGlow: Ribbon;
  private lastImpact = new THREE.Vector3(0, 0.03, 0);
  private branchA: Ribbon;
  private branchB: Ribbon;
  private arcs: Ribbon[];
  private sparkMat: THREE.ShaderMaterial;
  private sparks: THREE.Points;
  private ringMat: THREE.ShaderMaterial;
  private ring: THREE.Mesh<THREE.TorusGeometry, THREE.ShaderMaterial>;
  private flash: THREE.Sprite;
  private groundFlash: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private strikeTimer: number;
  private boltAge: number;
  private arcTimer: number;
  private flashPeak: number;
  constructor(scene: THREE.Object3D, quality: number) {
    super(scene, 3.6);

    this.viewDir = new THREE.Vector3(0, 0.24, 1).normalize();

    const glowTex = radialTexture([
      [0.0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(200,225,255,0.55)'],
      [0.62, 'rgba(150,190,255,0.12)'],
      [1.0, 'rgba(150,190,255,0)']
    ]);

    // ---- 闪电带 ----
    this.mainBolt = new Ribbon(64);
    this.mainBolt.mesh.name = 'Lightning trunk';
    this.mainGlow = new Ribbon(64);
    this.mainGlow.material.uniforms.uColor.value.set(0.3, 0.48, 1.0);
    this.branchA = new Ribbon(32);
    this.branchB = new Ribbon(32);
    this.group.add(this.mainGlow.mesh, this.mainBolt.mesh, this.branchA.mesh, this.branchB.mesh);

    // ---- 环绕电弧 ----
    this.arcs = [];
    for (let i = 0; i < 3; i++) {
      const r = new Ribbon(32);
      r.mesh.name = 'Connected ground arc';
      r.material.uniforms.uColor.value.set(0.45, 0.68, 1.0);
      this.group.add(r.mesh);
      this.arcs.push(r);
    }

    // ---- 电火花（向心收缩） ----
    const N = Math.round(180 * quality);
    const g = new THREE.BufferGeometry();
    const aSeed = new Float32Array(N), aAng = new Float32Array(N),
          aRad = new Float32Array(N), aHeight = new Float32Array(N),
          aSize = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      aSeed[i] = Math.random();
      aAng[i] = Math.random() * TAU;
      aRad[i] = Math.random();
      aHeight[i] = Math.random();
      aSize[i] = rand(2.0, 7.0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1));
    g.setAttribute('aAng', new THREE.Float32BufferAttribute(aAng, 1));
    g.setAttribute('aRad', new THREE.Float32BufferAttribute(aRad, 1));
    g.setAttribute('aHeight', new THREE.Float32BufferAttribute(aHeight, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(aSize, 1));

    this.sparkMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: RING_R },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Vector3(0.62, 0.82, 1.0) }
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        attribute float aAng;
        attribute float aRad;
        attribute float aHeight;
        attribute float aSize;

        uniform float uTime, uGrow, uContract, uRadius, uPixelRatio;
        varying float vA;
        varying float vSpark;

        void main() {
          float seed = aSeed;
          float ang = aAng + uTime * (2.2 + seed * 3.4) + uContract * 4.2;
          float r = uRadius * (0.90 + aRad * 0.55) * mix(1.0, 0.02, uContract);
          float y = 0.03 + aHeight * 0.40 * uGrow + sin(uTime * 9.0 + seed * 23.0) * 0.05;

          vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r);
          pos += vec3(
            sin(seed * 90.0 + uTime * 24.0),
            cos(seed * 70.0 + uTime * 19.0),
            sin(seed * 50.0 + uTime * 31.0)
          ) * 0.05 * (1.0 - uContract * 0.8);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = length(modelMatrix[0].xyz) * aSize * uPixelRatio * uGrow * mix(1.0, 0.5, uContract) * (2.4 / max(0.001, -mv.z));

          float blink = step(0.42, fract(seed * 7.0 + uTime * 9.0));
          vA = uGrow * (1.0 - uContract * 0.9) * (0.35 + 0.65 * blink);
          vSpark = seed;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vA;
        varying float vSpark;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          float a = pow(1.0 - d, 2.2);
          vec3 col = mix(uColor, vec3(1.0), pow(1.0 - d, 5.0));
          gl_FragColor = vec4(col, a * vA);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.sparks = new THREE.Points(g, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    // ---- 电流环 ----
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime, uGrow, uContract;
        varying vec2 vUv;
        void main() {
          float seg = fract(vUv.x * 6.0 - uTime * 0.9);
          float dash = smoothstep(0.0, 0.10, seg) * (1.0 - smoothstep(0.22, 0.5, seg));
          float flick = 0.62 + 0.38 * sin(uTime * 22.0 + vUv.x * 42.0);
          float a = dash * uGrow * (1.0 - uContract) * flick;
          vec3 col = mix(vec3(0.34, 0.60, 1.0), vec3(1.0), dash * 0.75);
          gl_FragColor = vec4(col, a * 0.95);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(RING_R, 0.012, 8, 220),
      this.ringMat
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    this.group.add(this.ring);

    // ---- 闪光 ----
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xcfe2ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
    }));
    this.flash.position.set(0, 1.4, 0);
    this.flash.scale.setScalar(1.6);
    this.group.add(this.flash);

    this.groundFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({
        map: glowTex, color: 0x6ea8ff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
      })
    );
    this.groundFlash.rotation.x = -Math.PI / 2;
    this.groundFlash.position.y = 0.005;
    this.group.add(this.groundFlash);

    this.strikeTimer = 0;
    this.boltAge = 999;
    this.arcTimer = 0;
    this.flashPeak = 0;
  }

  onPlay() {
    this.strikeTimer = 0.10;
    this.boltAge = 999;
    this.arcTimer = 0;
    this.flashPeak = 0;
    this.lastImpact.set(0, 0.03, 0);
    for (const m of [this.mainGlow, this.mainBolt, this.branchA, this.branchB, ...this.arcs]) {
      m.material.uniforms.uAlpha.value = 0;
      m.mesh.visible = true;
      m.mesh.scale.setScalar(1);
    }
  }

  onResize(pr: number) {
    this.sparkMat.uniforms.uPixelRatio.value = pr;
  }

  onCamera(camera: THREE.Camera | undefined) {
    if (!camera) return;
    const position = camera.getWorldPosition(new THREE.Vector3());
    this.group.updateWorldMatrix(true, false);
    this.group.worldToLocal(position);
    if (position.lengthSq() > 0.0001) this.viewDir.copy(position).normalize();
  }

  strike() {
    const top = new THREE.Vector3(rand(-0.8, 0.8), rand(1.9, 2.5), rand(-0.85, 0.75));
    const bottom = new THREE.Vector3(rand(-0.10, 0.10), 0.02, rand(-0.10, 0.10));

    const main = makeBoltPath(top, bottom, 5, 0.20);
    this.lastImpact.copy(bottom);
    this.arcTimer = 0;
    this.mainBolt.setPath(main, 0.041, this.viewDir);
    this.mainGlow.setPath(main, 0.105, this.viewDir);

    // 分叉
    const fork = (ribbon: Ribbon) => {
      const i0 = Math.floor(rand(main.length * 0.15, main.length * 0.6));
      const start = main[i0].clone();
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.75, 0.25), rand(-1, 1)).normalize();
      const end = start.clone().addScaledVector(dir, rand(0.45, 1.05));
      ribbon.setPath(makeBoltPath(start, end, 4, 0.28), 0.026, this.viewDir);
    };
    fork(this.branchA);
    fork(this.branchB);

    this.boltAge = 0;
    this.flashPeak = 1;
    this.flash.position.copy(top);
    this.flash.scale.setScalar(rand(1.3, 2.3));
  }

  /** Every arc starts at the strike point and runs outward into a jagged ring. */
  buildArc(ribbon: Ribbon, index: number) {
    const a0 = (index / this.arcs.length) * TAU + rand(-0.42, 0.42);
    const span = rand(0.85, 2.0) * (index === 1 ? -1 : 1);
    const targetR = RING_R * rand(0.90, 1.20);
    const target = new THREE.Vector3(Math.cos(a0) * targetR, rand(0.03, 0.10), Math.sin(a0) * targetR);
    const mid = this.lastImpact.clone().lerp(target, rand(0.45, 0.65));
    mid.y += rand(0.05, 0.16);
    mid.x += rand(-0.05, 0.05);
    mid.z += rand(-0.05, 0.05);
    const pts = [this.lastImpact.clone(), mid, target];
    for (let i = 1; i <= 13; i++) {
      const a = a0 + span * (i / 13);
      const r = targetR * rand(0.92, 1.08);
      pts.push(new THREE.Vector3(Math.cos(a) * r, rand(0.02, 0.14), Math.sin(a) * r));
    }
    ribbon.setPath(pts, rand(0.026, 0.037), this.viewDir);
  }

  update(dt: number) {
    const T = this.t;
    let grow, contract;

    if (T < 0) {
      grow = 0.34 + 0.05 * Math.sin(this.time * 2.4);
      contract = 0;
    } else {
      grow = smooth01(T / 0.45);
      contract = smooth01((T - 2.45) / 0.95);
    }

    // 触发落雷
    if (T >= 0 && T < 2.5) {
      this.strikeTimer -= dt;
      if (this.strikeTimer <= 0) {
        this.strike();
        this.strikeTimer = rand(0.52, 0.80);
      }
    }

    // 闪电衰减 + 频闪
    this.boltAge += dt;
    const live = 1 - smooth01(this.boltAge / 0.30);
    const flick = 0.78 + 0.22 * Math.sin(this.time * 32.0);
    const boltAlpha = live * flick * (1 - contract) * (T >= 0 ? 1 : 0);
    for (const m of [this.mainBolt, this.branchA, this.branchB]) {
      m.material.uniforms.uAlpha.value = boltAlpha;
    }
    this.mainGlow.material.uniforms.uAlpha.value = boltAlpha * 0.28;

    // The ground arcs share the strike point, so the electricity reads as a network.
    this.arcTimer -= dt;
    if (this.arcTimer <= 0) {
      this.arcTimer = rand(0.20, 0.30);
      this.arcs.forEach((arc, index) => this.buildArc(arc, index));
    }
    this.arcs.forEach((arc, index) => {
      const pulse = 0.72 + 0.28 * Math.sin(this.time * 17 + index * 2.1);
      arc.material.uniforms.uAlpha.value = grow * (1 - contract) * pulse;
      arc.mesh.scale.setScalar(1 - contract * 0.88);
    });

    // 闪光衰减
    this.flashPeak = Math.max(0, this.flashPeak - dt * 5.5);
    this.flash.material.opacity = this.flashPeak * 0.65;
    this.groundFlash.material.opacity = this.flashPeak * 0.34;
    this.groundFlash.scale.setScalar(0.8 + this.flashPeak * 0.6);

    // 公共 uniform
    this.sparkMat.uniforms.uTime.value = this.time;
    this.sparkMat.uniforms.uGrow.value = grow;
    this.sparkMat.uniforms.uContract.value = contract;

    this.ringMat.uniforms.uTime.value = this.time;
    this.ringMat.uniforms.uGrow.value = grow;
    this.ringMat.uniforms.uContract.value = contract;
    this.ring.scale.setScalar(1 - contract * 0.35);
  }
}
