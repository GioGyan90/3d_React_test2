import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
import { TAU, RING_R, rand, clamp01, smooth01, easeIn } from '../core/math';
import { radialTexture } from '../core/textures';
import { addFlameBody } from './FlameBody';

const FIRE_VERT = /* glsl */`
  attribute float aSeed;
  attribute float aAng;
  attribute float aRad;
  attribute float aHeight;
  attribute float aSize;

  uniform float uTime, uGrow, uContract, uRadius, uPixelRatio, uSizeMul;

  varying float vHeat;
  varying float vFade;

  void main() {
    float seed = aSeed;
    float life = fract(uTime * (0.5 + seed * 0.55) + seed * 3.731);

    float ang = aAng + uTime * (0.35 + seed * 0.75) + uContract * 2.6;
    float baseR = uRadius * (0.62 + aRad * 0.62);
    float r = baseR * mix(1.0, 0.02, uContract);

    float h = aHeight * (0.34 + uGrow * 0.52);
    float y = life * h * (1.0 - uContract * 0.92);

    r += sin(seed * 41.0 + uTime * 3.4) * 0.030 * (1.0 - uContract);
    y += sin(seed * 23.0 + uTime * 7.0 + aAng * 2.0) * 0.018 * (1.0 - uContract);

    vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r);
    pos.x += sin(uTime * 5.1 + seed * 17.0) * 0.012 * (1.0 - uContract);
    pos.z += cos(uTime * 4.3 + seed * 11.0) * 0.012 * (1.0 - uContract);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float sz = aSize * uSizeMul * uPixelRatio * uGrow
             * (1.0 - life * 0.5) * mix(1.0, 0.42, uContract);
    gl_PointSize = sz * length(modelMatrix[0].xyz) * (2.4 / max(0.001, -mv.z));

    vHeat = life;
    vFade = uGrow * (1.0 - smoothstep(0.60, 1.0, life)) * (1.0 - uContract * 0.92);
  }
`;

const POINT_FRAG_BASIC = /* glsl */`
  uniform vec3 uC1, uC2, uC3;
  uniform float uAlpha;
  varying float vHeat;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    float a = pow(1.0 - d, 1.8);
    vec3 col = mix(uC1, uC2, smoothstep(0.0, 0.5, vHeat));
    col = mix(col, uC3, smoothstep(0.45, 1.0, vHeat));

    float core = pow(1.0 - d, 6.0);
    col += vec3(1.0, 0.92, 0.75) * core * (1.0 - vHeat) * 0.85;

    gl_FragColor = vec4(col, a * vFade * uAlpha);
  }
`;

export class FireEffect extends BaseEffect {
  private mats: THREE.ShaderMaterial[] = [];
  private flameMats: THREE.ShaderMaterial[];
  private lickMat: THREE.ShaderMaterial;
  private licks: THREE.Points;
  private glowMat: THREE.ShaderMaterial;
  private glow: THREE.Points;
  private core: THREE.Sprite;
  private groundGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  constructor(scene: THREE.Object3D, quality: number) {
    super(scene, 3.9);

    const glowTex = radialTexture([
      [0.0, 'rgba(255,255,255,1)'],
      [0.30, 'rgba(255,255,255,0.50)'],
      [0.65, 'rgba(255,255,255,0.10)'],
      [1.0, 'rgba(255,255,255,0)']
    ]);

    // 连续火焰体是主体，少量上升火星只是辅助。
    this.flameMats = addFlameBody(this.group);

    // ---- 稀疏火星 ----
    this.lickMat = this.makePointMat(1.0, 0.5,
      [1.00, 0.88, 0.58], [1.00, 0.42, 0.08], [0.80, 0.10, 0.02]);
    this.licks = this.makeLayer(Math.round(240 * quality), 3, 10, this.lickMat);

    // ---- 粒子层 B：柔和体积辉光 ----
    this.glowMat = this.makePointMat(1.95, 0.12,
      [1.00, 0.72, 0.36], [1.00, 0.34, 0.05], [0.62, 0.05, 0.01]);
    this.glow = this.makeLayer(Math.round(60 * quality), 9, 21, this.glowMat);

    // ---- 核心光团 ----
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb066, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
    }));
    this.core.position.set(0, 0.16, 0);
    this.core.scale.setScalar(0.7);
    this.group.add(this.core);

    // ---- 地面火光 ----
    this.groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({
        map: glowTex, color: 0xff6a1e, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
      })
    );
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.y = 0.004;
    this.groundGlow.renderOrder = -1;
    this.group.add(this.groundGlow);
  }

  makePointMat(sizeMul: number, alpha: number, c1: number[], c2: number[], c3: number[]) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: RING_R },
        uPixelRatio: { value: 1 },
        uSizeMul: { value: sizeMul },
        uAlpha: { value: alpha },
        uC1: { value: new THREE.Vector3(c1[0], c1[1], c1[2]) },
        uC2: { value: new THREE.Vector3(c2[0], c2[1], c2[2]) },
        uC3: { value: new THREE.Vector3(c3[0], c3[1], c3[2]) }
      },
      vertexShader: FIRE_VERT,
      fragmentShader: POINT_FRAG_BASIC,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.mats.push(m);
    return m;
  }

  makeLayer(count: number, sizeMin: number, sizeMax: number, material: THREE.ShaderMaterial) {
    const g = new THREE.BufferGeometry();
    const aSeed = new Float32Array(count);
    const aAng = new Float32Array(count);
    const aRad = new Float32Array(count);
    const aHeight = new Float32Array(count);
    const aSize = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      aSeed[i] = Math.random();
      aAng[i] = Math.random() * TAU;
      aRad[i] = Math.random();
      aHeight[i] = 0.60 + Math.random() * 0.85;
      aSize[i] = rand(sizeMin, sizeMax);
    }

    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1));
    g.setAttribute('aAng', new THREE.Float32BufferAttribute(aAng, 1));
    g.setAttribute('aRad', new THREE.Float32BufferAttribute(aRad, 1));
    g.setAttribute('aHeight', new THREE.Float32BufferAttribute(aHeight, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(aSize, 1));

    const pts = new THREE.Points(g, material);
    pts.frustumCulled = false;
    this.group.add(pts);
    return pts;
  }

  onResize(pr: number) {
    for (const m of this.mats) m.uniforms.uPixelRatio.value = pr;
  }

  update() {
    const T = this.t;
    let grow, contract;

    if (T < 0) {
      // 待机：余烬微弱呼吸
      grow = 0.13 + 0.03 * Math.sin(this.time * 1.8);
      contract = 0;
    } else {
      grow = smooth01(T / 0.65);
      contract = smooth01((T - 2.45) / 1.05);
    }

    for (const m of this.mats) {
      m.uniforms.uTime.value = this.time;
      m.uniforms.uGrow.value = grow;
      m.uniforms.uContract.value = contract;
    }

    for (const m of this.flameMats) {
      m.uniforms.uTime.value = this.time;
      m.uniforms.uGrow.value = grow;
      m.uniforms.uContract.value = contract;
    }

    const flick = 0.86 + 0.14 * Math.sin(this.time * 9.0) * Math.sin(this.time * 3.7);
    const fade = (1 - contract);

    this.core.material.opacity = 0.40 * grow * fade * flick;
    this.core.scale.setScalar((0.52 + 0.38 * grow) * (1 - contract * 0.9));
    this.core.position.y = 0.14 + 0.06 * grow;

    this.groundGlow.material.opacity = 0.27 * grow * fade * flick;
    this.groundGlow.scale.setScalar(0.85 + 0.55 * grow);
  }
}
