import * as a from "three";
const b = Math.PI * 2, w = 0.46, M = (d) => Math.max(0, Math.min(1, d)), g = (d) => {
  const t = M(d);
  return t * t * (3 - 2 * t);
}, k = (d) => {
  const t = M(d);
  return t * t;
}, c = (d, t) => d + Math.random() * (t - d);
class S {
  constructor(t, e) {
    this.group = new a.Group(), this.t = -1, this.time = 0, this.duration = e, this.group.visible = !1, t.add(this.group);
  }
  get active() {
    return this.t >= 0;
  }
  play() {
    this.time = 0, this.t = 0, this.group.visible = !0, this.onPlay(), this.update(0);
  }
  tick(t) {
    if (!this.active) return !1;
    this.time += t;
    const e = this.t + t;
    return this.t = e + 1e-8 >= this.duration ? this.duration : e, this.update(t), this.t >= this.duration ? (this.stop(), !0) : !1;
  }
  stop() {
    this.t = -1, this.group.visible = !1;
  }
  onPlay() {
  }
  onResize(t) {
  }
  onCamera(t) {
  }
}
function F(d, t = 256) {
  const e = document.createElement("canvas");
  e.width = e.height = t;
  const r = e.getContext("2d");
  if (!r) throw new Error("Canvas 2D is not available");
  const s = r.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  for (const [n, i] of d) s.addColorStop(n, i);
  r.fillStyle = s, r.fillRect(0, 0, t, t);
  const o = new a.CanvasTexture(e);
  return o.colorSpace = a.SRGBColorSpace, o;
}
function R(d = 512) {
  const t = document.createElement("canvas");
  t.width = t.height = d;
  const e = t.getContext("2d");
  if (!e) throw new Error("Canvas 2D is not available");
  const r = d / 2, s = d / 2, o = e.createRadialGradient(r, s, d * 0.08, r, s, d * 0.5);
  o.addColorStop(0, "rgba(185,238,255,0.55)"), o.addColorStop(0.5, "rgba(120,200,255,0.20)"), o.addColorStop(1, "rgba(120,200,255,0)"), e.fillStyle = o, e.fillRect(0, 0, d, d), e.globalCompositeOperation = "lighter";
  for (let i = 0; i < 110; i++) {
    const h = Math.random() * b, u = d * 0.1 + Math.random() * d * 0.12, f = u + d * 0.06 + Math.random() * d * 0.2;
    e.strokeStyle = `rgba(205,246,255,${c(0.08, 0.3)})`, e.lineWidth = c(0.8, 2.6), e.beginPath(), e.moveTo(r + Math.cos(h) * u, s + Math.sin(h) * u);
    for (let l = 1; l <= 3; l++) {
      const m = u + (f - u) * (l / 3), p = h + c(-0.09, 0.09);
      e.lineTo(r + Math.cos(p) * m, s + Math.sin(p) * m);
    }
    e.stroke();
  }
  const n = new a.CanvasTexture(t);
  return n.colorSpace = a.SRGBColorSpace, n;
}
function B() {
  const e = [], r = [], s = [];
  for (let n = 0; n <= 18; n++) {
    const i = n / 18;
    for (let h = 0; h <= 112; h++) {
      const u = h / 112, f = u * b;
      if (e.push(Math.cos(f), i, Math.sin(f)), r.push(u, i), n < 18 && h < 112) {
        const l = n * 113 + h;
        s.push(l, l + 112 + 1, l + 1), s.push(l + 1, l + 112 + 1, l + 112 + 2);
      }
    }
  }
  const o = new a.BufferGeometry();
  return o.setAttribute("position", new a.Float32BufferAttribute(e, 3)), o.setAttribute("uv", new a.Float32BufferAttribute(r, 2)), o.setIndex(s), o;
}
const G = (
  /* glsl */
  `
  uniform float uTime, uGrow, uExtinguish, uRadius, uHeight, uPhase;
  varying vec2 vUv;
  varying float vAngle;

  void main() {
    vUv = uv;
    float a = uv.x * 6.28318530718;
    float h = uv.y;
    vAngle = a;
    float curl = (sin(a * 3.0 - uTime * 1.4 + h * 4.0 + uPhase) * 0.10
                + sin(a * 7.0 + uTime * 1.1 + h * 5.0) * 0.035) * h;
    float angle = a + curl;
    float ripple = sin(a * 5.0 + uTime * 2.0 + h * 6.0 + uPhase) * 0.025 * h;
    float radius = uRadius + ripple;
    float lift = smoothstep(0.10, 0.92, uExtinguish) * (0.04 + 0.20 * h) * h;
    float y = h * uHeight + lift;
    vec3 p = vec3(cos(angle) * radius, y, sin(angle) * radius);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
), E = (
  /* glsl */
  `
  uniform float uTime, uGrow, uExtinguish, uOpacity, uPhase;
  varying vec2 vUv;
  varying float vAngle;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x);
    float b = mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x);
    float c = mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x);
    float d = mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }

  void main() {
    float a = vAngle;
    float h = vUv.y;
    // Circular coordinates keep the rolling noise continuous at the seam.
    vec3 flow = vec3(cos(a) * 2.15, sin(a) * 2.15, h * 2.9 - uTime * 1.10);
    flow += vec3(2.2 + uPhase, 4.1, uPhase * 0.37);
    float large = noise3(flow);
    float detail = noise3(flow * 2.1 + vec3(3.1, 6.4, uTime * 0.18));
    float turbulence = large * 0.72 + detail * 0.28;
    // The lower flame stays connected; rising turbulence breaks into soft, uneven tips.
    float density = 0.80 - h * 1.38 + (turbulence - 0.50) * 1.20
      - uExtinguish * (0.24 + detail * 0.16);
    float silhouette = smoothstep(-0.07, 0.16, density);
    float topFade = 1.0 - smoothstep(0.78, 1.0, h);
    float base = smoothstep(0.0, 0.045, h);
    float flicker = 0.86 + 0.14 * sin(uTime * 4.1 + a * 3.0);
    // The ignition front climbs; declining fuel removes irregular patches instead of scaling the ring.
    float front = 0.12 + uGrow * 0.96;
    float ignition = (1.0 - smoothstep(front - 0.13, front + 0.08, h)) * smoothstep(0.0, 0.30, uGrow);
    float localFade = 1.0 - smoothstep(0.02, 0.98, uExtinguish + (1.0 - h) * 0.12 - detail * 0.14);
    float finalFade = 1.0 - smoothstep(0.60, 1.0, uExtinguish);
    float opacity = silhouette * topFade * base * flicker * uOpacity * ignition * localFade * finalFade;
    opacity *= 0.72 + 0.28 * turbulence;
    vec3 deep = vec3(0.86, 0.10, 0.012);
    vec3 amber = vec3(1.0, 0.32, 0.025);
    vec3 gold = vec3(1.0, 0.70, 0.16);
    vec3 color = mix(amber, deep, smoothstep(0.16, 0.75, h));
    float hot = (1.0 - smoothstep(0.04, 0.52, h)) * (0.65 + 0.35 * detail);
    color = mix(color, gold, hot * 0.80);
    color = mix(color, deep * 0.75, uExtinguish * 0.42);
    gl_FragColor = vec4(color, opacity);
  }
`
);
function z(d) {
  const t = B(), e = [], r = [
    { radius: w * 1.02, height: 1.08, opacity: 0.64, phase: 0 },
    { radius: w * 0.77, height: 0.9, opacity: 0.57, phase: 2.1 }
  ];
  for (const s of r) {
    const o = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uExtinguish: { value: 0 },
        uRadius: { value: s.radius },
        uHeight: { value: s.height },
        uOpacity: { value: s.opacity },
        uPhase: { value: s.phase }
      },
      vertexShader: G,
      fragmentShader: E,
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide
    }), n = new a.Mesh(t, o);
    n.name = "Continuous flame", n.frustumCulled = !1, d.add(n), e.push(o);
  }
  return e;
}
const I = (
  /* glsl */
  `
  attribute float aSeed;
  attribute float aAng;
  attribute float aRad;
  attribute float aHeight;
  attribute float aSize;

  uniform float uTime, uGrow, uExtinguish, uRadius, uPixelRatio, uSizeMul;
  varying float vHeat;
  varying float vFade;

  void main() {
    float seed = aSeed;
    float life = fract(uTime * (0.5 + seed * 0.55) + seed * 3.731);
    float ang = aAng + uTime * (0.35 + seed * 0.75);
    float r = uRadius * (0.62 + aRad * 0.62);
    float h = aHeight * (0.34 + uGrow * 0.52);
    // The last embers continue rising as the fuel fades, rather than moving into the centre.
    float y = life * h + uExtinguish * (0.10 + life * 0.22);
    r += sin(seed * 41.0 + uTime * 3.4) * 0.030;
    y += sin(seed * 23.0 + uTime * 7.0 + aAng * 2.0) * 0.018;
    vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r);
    pos.x += sin(uTime * 5.1 + seed * 17.0) * 0.012;
    pos.z += cos(uTime * 4.3 + seed * 11.0) * 0.012;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = aSize * uSizeMul * uPixelRatio * uGrow
             * (1.0 - life * 0.5) * mix(1.0, 0.72, uExtinguish);
    gl_PointSize = sz * length(modelMatrix[0].xyz) * (2.4 / max(0.001, -mv.z));
    float emberFade = 1.0 - smoothstep(0.35, 1.0, uExtinguish);
    float noNewSparks = smoothstep(0.0, 0.22, life + (1.0 - uExtinguish) * 0.4);
    vHeat = life;
    vFade = uGrow * (1.0 - smoothstep(0.60, 1.0, life)) * emberFade * noNewSparks;
  }
`
), _ = (
  /* glsl */
  `
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
`
);
class V extends S {
  constructor(t, e) {
    super(t, 3.9), this.mats = [];
    const r = F([
      [0, "rgba(255,255,255,1)"],
      [0.3, "rgba(255,255,255,0.50)"],
      [0.65, "rgba(255,255,255,0.10)"],
      [1, "rgba(255,255,255,0)"]
    ]);
    this.flameMats = z(this.group), this.lickMat = this.makePointMat(
      1,
      0.5,
      [1, 0.88, 0.58],
      [1, 0.42, 0.08],
      [0.8, 0.1, 0.02]
    ), this.licks = this.makeLayer(Math.round(240 * e), 3, 10, this.lickMat), this.glowMat = this.makePointMat(
      1.95,
      0.12,
      [1, 0.72, 0.36],
      [1, 0.34, 0.05],
      [0.62, 0.05, 0.01]
    ), this.glow = this.makeLayer(Math.round(60 * e), 9, 21, this.glowMat), this.core = new a.Sprite(new a.SpriteMaterial({
      map: r,
      color: 16756838,
      transparent: !0,
      blending: a.AdditiveBlending,
      depthWrite: !1,
      opacity: 0
    })), this.core.position.set(0, 0.16, 0), this.core.scale.setScalar(0.7), this.group.add(this.core), this.groundGlow = new a.Mesh(
      new a.PlaneGeometry(1.9, 1.9),
      new a.MeshBasicMaterial({
        map: r,
        color: 16738846,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundGlow.rotation.x = -Math.PI / 2, this.groundGlow.position.y = 4e-3, this.groundGlow.renderOrder = -1, this.group.add(this.groundGlow);
  }
  makePointMat(t, e, r, s, o) {
    const n = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uExtinguish: { value: 0 },
        uRadius: { value: w },
        uPixelRatio: { value: 1 },
        uSizeMul: { value: t },
        uAlpha: { value: e },
        uC1: { value: new a.Vector3(r[0], r[1], r[2]) },
        uC2: { value: new a.Vector3(s[0], s[1], s[2]) },
        uC3: { value: new a.Vector3(o[0], o[1], o[2]) }
      },
      vertexShader: I,
      fragmentShader: _,
      transparent: !0,
      depthWrite: !1,
      blending: a.AdditiveBlending
    });
    return this.mats.push(n), n;
  }
  makeLayer(t, e, r, s) {
    const o = new a.BufferGeometry(), n = new Float32Array(t), i = new Float32Array(t), h = new Float32Array(t), u = new Float32Array(t), f = new Float32Array(t);
    for (let m = 0; m < t; m++)
      n[m] = Math.random(), i[m] = Math.random() * b, h[m] = Math.random(), u[m] = 0.6 + Math.random() * 0.85, f[m] = c(e, r);
    o.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(t * 3), 3)), o.setAttribute("aSeed", new a.Float32BufferAttribute(n, 1)), o.setAttribute("aAng", new a.Float32BufferAttribute(i, 1)), o.setAttribute("aRad", new a.Float32BufferAttribute(h, 1)), o.setAttribute("aHeight", new a.Float32BufferAttribute(u, 1)), o.setAttribute("aSize", new a.Float32BufferAttribute(f, 1));
    const l = new a.Points(o, s);
    return l.frustumCulled = !1, this.group.add(l), l;
  }
  onResize(t) {
    for (const e of this.mats) e.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = M(this.t / this.duration), e = g(t / 0.19), r = g((t - 0.56) / 0.44);
    for (const i of [...this.mats, ...this.flameMats])
      i.uniforms.uTime.value = this.time, i.uniforms.uGrow.value = e, i.uniforms.uExtinguish.value = r;
    const s = 0.86 + 0.14 * Math.sin(this.time * 9) * Math.sin(this.time * 3.7), o = 1 - g(r / 0.78), n = 1 - g(r / 0.94);
    this.core.material.opacity = 0.4 * e * o * s, this.core.scale.setScalar(0.52 + 0.38 * e), this.core.position.y = 0.14 + 0.06 * e + r * 0.04, this.groundGlow.material.opacity = 0.27 * e * n * s, this.groundGlow.scale.setScalar(0.85 + 0.55 * e);
  }
}
function P(d, t, e, r) {
  let s = [d.clone(), t.clone()], o = d.distanceTo(t) * r;
  for (let n = 0; n < e; n++) {
    const i = [s[0]];
    for (let h = 0; h < s.length - 1; h++) {
      const u = s[h], f = s[h + 1], l = u.clone().add(f).multiplyScalar(0.5);
      l.x += c(-0.5, 0.5) * o, l.z += c(-0.5, 0.5) * o, l.y += c(-0.5, 0.5) * o * 0.25, i.push(l, f);
    }
    s = i, o *= 0.55;
  }
  return s;
}
const U = (
  /* glsl */
  `
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
), O = (
  /* glsl */
  `
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
`
);
class A {
  constructor(t) {
    this.maxPts = t, this.pos = new Float32Array(t * 2 * 3);
    const e = new Float32Array(t * 2);
    for (let o = 0; o < t; o++)
      e[o * 2] = -1, e[o * 2 + 1] = 1;
    const r = [];
    for (let o = 0; o < t - 1; o++) {
      const n = o * 2;
      r.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    const s = new a.BufferGeometry();
    s.setAttribute("position", new a.BufferAttribute(this.pos, 3)), s.setAttribute("aSide", new a.BufferAttribute(e, 1)), s.setIndex(r), this.geo = s, this.material = new a.ShaderMaterial({
      uniforms: {
        uColor: { value: new a.Vector3(0.55, 0.78, 1) },
        uAlpha: { value: 0 }
      },
      vertexShader: U,
      fragmentShader: O,
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide,
      blending: a.AdditiveBlending
    }), this.mesh = new a.Mesh(s, this.material), this.mesh.frustumCulled = !1;
  }
  setPath(t, e, r) {
    const s = Math.min(t.length, this.maxPts), o = new a.Vector3(), n = new a.Vector3();
    for (let i = 0; i < s; i++) {
      const h = t[i], u = t[Math.max(0, i - 1)], f = t[Math.min(t.length - 1, i + 1)];
      o.subVectors(f, u), o.lengthSq() < 1e-9 && o.set(0, 1, 0), o.normalize(), n.crossVectors(o, r), n.lengthSq() < 1e-9 && n.set(1, 0, 0), n.normalize().multiplyScalar(e);
      const l = i * 6;
      this.pos[l] = h.x + n.x, this.pos[l + 1] = h.y + n.y, this.pos[l + 2] = h.z + n.z, this.pos[l + 3] = h.x - n.x, this.pos[l + 4] = h.y - n.y, this.pos[l + 5] = h.z - n.z;
    }
    this.geo.setDrawRange(0, (s - 1) * 6), this.geo.attributes.position.needsUpdate = !0;
  }
}
class D extends S {
  constructor(t, e) {
    super(t, 3.6), this.lastImpact = new a.Vector3(0, 0.03, 0), this.viewDir = new a.Vector3(0, 0.24, 1).normalize();
    const r = F([
      [0, "rgba(255,255,255,1)"],
      [0.25, "rgba(200,225,255,0.55)"],
      [0.62, "rgba(150,190,255,0.12)"],
      [1, "rgba(150,190,255,0)"]
    ]);
    this.mainBolt = new A(64), this.mainBolt.mesh.name = "Lightning trunk", this.mainGlow = new A(64), this.mainGlow.material.uniforms.uColor.value.set(0.3, 0.48, 1), this.branchA = new A(32), this.branchB = new A(32), this.group.add(this.mainGlow.mesh, this.mainBolt.mesh, this.branchA.mesh, this.branchB.mesh), this.arcs = [];
    for (let l = 0; l < 3; l++) {
      const m = new A(32);
      m.mesh.name = "Connected ground arc", m.material.uniforms.uColor.value.set(0.45, 0.68, 1), this.group.add(m.mesh), this.arcs.push(m);
    }
    const s = Math.round(180 * e), o = new a.BufferGeometry(), n = new Float32Array(s), i = new Float32Array(s), h = new Float32Array(s), u = new Float32Array(s), f = new Float32Array(s);
    for (let l = 0; l < s; l++)
      n[l] = Math.random(), i[l] = Math.random() * b, h[l] = Math.random(), u[l] = Math.random(), f[l] = c(2, 7);
    o.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(s * 3), 3)), o.setAttribute("aSeed", new a.Float32BufferAttribute(n, 1)), o.setAttribute("aAng", new a.Float32BufferAttribute(i, 1)), o.setAttribute("aRad", new a.Float32BufferAttribute(h, 1)), o.setAttribute("aHeight", new a.Float32BufferAttribute(u, 1)), o.setAttribute("aSize", new a.Float32BufferAttribute(f, 1)), this.sparkMat = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: w },
        uPixelRatio: { value: 1 },
        uColor: { value: new a.Vector3(0.62, 0.82, 1) }
      },
      vertexShader: (
        /* glsl */
        `
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
      `
      ),
      fragmentShader: (
        /* glsl */
        `
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
      `
      ),
      transparent: !0,
      depthWrite: !1,
      blending: a.AdditiveBlending
    }), this.sparks = new a.Points(o, this.sparkMat), this.sparks.frustumCulled = !1, this.group.add(this.sparks), this.ringMat = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 }
      },
      vertexShader: (
        /* glsl */
        `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `
      ),
      fragmentShader: (
        /* glsl */
        `
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
      `
      ),
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide,
      blending: a.AdditiveBlending
    }), this.ring = new a.Mesh(
      new a.TorusGeometry(w, 0.012, 8, 220),
      this.ringMat
    ), this.ring.rotation.x = -Math.PI / 2, this.ring.position.y = 0.012, this.group.add(this.ring), this.flash = new a.Sprite(new a.SpriteMaterial({
      map: r,
      color: 13624063,
      transparent: !0,
      blending: a.AdditiveBlending,
      depthWrite: !1,
      opacity: 0
    })), this.flash.position.set(0, 1.4, 0), this.flash.scale.setScalar(1.6), this.group.add(this.flash), this.groundFlash = new a.Mesh(
      new a.PlaneGeometry(2, 2),
      new a.MeshBasicMaterial({
        map: r,
        color: 7252223,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundFlash.rotation.x = -Math.PI / 2, this.groundFlash.position.y = 5e-3, this.group.add(this.groundFlash), this.strikeTimer = 0, this.boltAge = 999, this.arcTimer = 0, this.flashPeak = 0;
  }
  onPlay() {
    this.strikeTimer = 0.1, this.boltAge = 999, this.arcTimer = 0, this.flashPeak = 0, this.lastImpact.set(0, 0.03, 0);
    for (const t of [this.mainGlow, this.mainBolt, this.branchA, this.branchB, ...this.arcs])
      t.material.uniforms.uAlpha.value = 0, t.mesh.visible = !0, t.mesh.scale.setScalar(1);
  }
  onResize(t) {
    this.sparkMat.uniforms.uPixelRatio.value = t;
  }
  onCamera(t) {
    if (!t) return;
    const e = t.getWorldPosition(new a.Vector3());
    this.group.updateWorldMatrix(!0, !1), this.group.worldToLocal(e), e.lengthSq() > 1e-4 && this.viewDir.copy(e).normalize();
  }
  strike() {
    const t = new a.Vector3(c(-0.8, 0.8), c(1.9, 2.5), c(-0.85, 0.75)), e = new a.Vector3(c(-0.1, 0.1), 0.02, c(-0.1, 0.1)), r = P(t, e, 5, 0.2);
    this.lastImpact.copy(e), this.arcTimer = 0, this.mainBolt.setPath(r, 0.041, this.viewDir), this.mainGlow.setPath(r, 0.105, this.viewDir);
    const s = (o) => {
      const n = Math.floor(c(r.length * 0.15, r.length * 0.6)), i = r[n].clone(), h = new a.Vector3(c(-1, 1), c(-0.75, 0.25), c(-1, 1)).normalize(), u = i.clone().addScaledVector(h, c(0.45, 1.05));
      o.setPath(P(i, u, 4, 0.28), 0.026, this.viewDir);
    };
    s(this.branchA), s(this.branchB), this.boltAge = 0, this.flashPeak = 1, this.flash.position.copy(t), this.flash.scale.setScalar(c(1.3, 2.3));
  }
  /** Every arc starts at the strike point and runs outward into a jagged ring. */
  buildArc(t, e) {
    const r = e / this.arcs.length * b + c(-0.42, 0.42), s = c(0.85, 2) * (e === 1 ? -1 : 1), o = w * c(0.9, 1.2), n = new a.Vector3(Math.cos(r) * o, c(0.03, 0.1), Math.sin(r) * o), i = this.lastImpact.clone().lerp(n, c(0.45, 0.65));
    i.y += c(0.05, 0.16), i.x += c(-0.05, 0.05), i.z += c(-0.05, 0.05);
    const h = [this.lastImpact.clone(), i, n];
    for (let u = 1; u <= 13; u++) {
      const f = r + s * (u / 13), l = o * c(0.92, 1.08);
      h.push(new a.Vector3(Math.cos(f) * l, c(0.02, 0.14), Math.sin(f) * l));
    }
    t.setPath(h, c(0.026, 0.037), this.viewDir);
  }
  update(t) {
    const e = this.t;
    let r, s;
    e < 0 ? (r = 0.34 + 0.05 * Math.sin(this.time * 2.4), s = 0) : (r = g(e / 0.45), s = g((e - 2.45) / 0.95)), e >= 0 && e < 2.5 && (this.strikeTimer -= t, this.strikeTimer <= 0 && (this.strike(), this.strikeTimer = c(0.52, 0.8))), this.boltAge += t;
    const o = 1 - g(this.boltAge / 0.3), n = 0.78 + 0.22 * Math.sin(this.time * 32), i = o * n * (1 - s) * (e >= 0 ? 1 : 0);
    for (const h of [this.mainBolt, this.branchA, this.branchB])
      h.material.uniforms.uAlpha.value = i;
    this.mainGlow.material.uniforms.uAlpha.value = i * 0.28, this.arcTimer -= t, this.arcTimer <= 0 && (this.arcTimer = c(0.2, 0.3), this.arcs.forEach((h, u) => this.buildArc(h, u))), this.arcs.forEach((h, u) => {
      const f = 0.72 + 0.28 * Math.sin(this.time * 17 + u * 2.1);
      h.material.uniforms.uAlpha.value = r * (1 - s) * f, h.mesh.scale.setScalar(1 - s * 0.88);
    }), this.flashPeak = Math.max(0, this.flashPeak - t * 5.5), this.flash.material.opacity = this.flashPeak * 0.65, this.groundFlash.material.opacity = this.flashPeak * 0.34, this.groundFlash.scale.setScalar(0.8 + this.flashPeak * 0.6), this.sparkMat.uniforms.uTime.value = this.time, this.sparkMat.uniforms.uGrow.value = r, this.sparkMat.uniforms.uContract.value = s, this.ringMat.uniforms.uTime.value = this.time, this.ringMat.uniforms.uGrow.value = r, this.ringMat.uniforms.uContract.value = s, this.ring.scale.setScalar(1 - s * 0.35);
  }
}
function N() {
  const r = [], s = [], o = [], n = new a.Color(2914877), i = new a.Color(6473066), h = new a.Color(11135645);
  for (let f = 0; f <= 14; f++) {
    const l = f / 14, m = Math.sin(Math.PI * Math.pow(l, 0.68)) * 0.085 * (1 - 0.22 * l) + 12e-4, p = Math.sin(Math.PI * l) * 0.022, y = l * 0.28, v = n.clone().lerp(i, l).lerp(h, l * l).multiplyScalar(0.7), x = n.clone().lerp(i, l).lerp(h, l * l);
    r.push(-m, y, p), s.push(v.r, v.g, v.b), r.push(0, y, p + 8e-3), s.push(x.r, x.g, x.b), r.push(m, y, p), s.push(v.r, v.g, v.b);
  }
  for (let f = 0; f < 14; f++) {
    const l = f * 3, m = l + 3;
    o.push(l, m, l + 1, l + 1, m, m + 1), o.push(l + 1, m + 1, l + 2, l + 2, m + 1, m + 2);
  }
  const u = new a.BufferGeometry();
  return u.setAttribute("position", new a.Float32BufferAttribute(r, 3)), u.setAttribute("color", new a.Float32BufferAttribute(s, 3)), u.setIndex(o), u.computeVertexNormals(), u;
}
class H extends S {
  constructor(t, e) {
    super(t, 4.1), this.count = Math.max(12, Math.round(38 * e)), this.dummy = new a.Object3D();
    const r = N(), s = new a.MeshBasicMaterial({
      vertexColors: !0,
      side: a.DoubleSide
    });
    this.mesh = new a.InstancedMesh(r, s, this.count), this.mesh.frustumCulled = !1, this.group.add(this.mesh), this.leaves = [];
    const o = [10477706, 7327866, 13168778, 5551466, 11065706];
    for (let i = 0; i < this.count; i++) {
      const h = i % 11 === 1 || i % 17 === 4 ? c(1.65, 2.1) : i % 4 === 0 ? c(0.95, 1.3) : c(0.36, 0.72);
      this.leaves.push({
        ang: Math.random() * b,
        r: w * c(0.65, 1.55),
        y: c(0.06, 0.82),
        size: h,
        width: c(0.78, 1.28),
        length: c(0.8, 1.22),
        dir: Math.random() < 0.25 ? -1 : 1,
        spinSpd: c(0.35, 0.95),
        bobF: c(1.4, 2.8),
        bobP: Math.random() * b,
        flapF: c(2, 4.2),
        flapP: Math.random() * b,
        tilt: c(-1.4, 1.4),
        heading: c(-Math.PI, Math.PI),
        roll: c(-Math.PI, Math.PI),
        spin: c(-0.9, 0.9)
      }), this.mesh.setColorAt(i, new a.Color(o[i % o.length]).multiplyScalar(c(0.85, 1.12)));
    }
    this.mesh.instanceColor.needsUpdate = !0;
    const n = F([
      [0, "rgba(150,240,150,0.35)"],
      [0.5, "rgba(90,200,110,0.12)"],
      [1, "rgba(90,200,110,0)"]
    ]);
    this.groundGlow = new a.Mesh(
      new a.PlaneGeometry(1.8, 1.8),
      new a.MeshBasicMaterial({
        map: n,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundGlow.rotation.x = -Math.PI / 2, this.groundGlow.position.y = 4e-3, this.group.add(this.groundGlow);
  }
  update() {
    const t = this.t, e = 2.55, r = 1.45;
    let s;
    t < 0 ? s = 0.62 : s = 1;
    for (let n = 0; n < this.count; n++) {
      const i = this.leaves[n], h = n / this.count, u = t < 0 ? 0.62 : g((t - h * 0.3) / 0.45);
      let f = 0;
      t >= e && (f = M((t - e - h * 0.5 * r) / (0.5 * r)));
      const l = k(f), m = i.r * (1 - l * 0.995), p = i.ang + this.time * i.spinSpd * i.dir * (1 + l * 4), y = Math.cos(p) * m, v = Math.sin(p) * m, x = Math.sin(this.time * i.bobF + i.bobP) * 0.055, T = (i.y + x) * (1 - l) + -0.14 * l, C = i.size * u * (1 - l * l) * s;
      this.dummy.position.set(y, T, v), this.dummy.rotation.set(
        i.tilt + Math.sin(this.time * i.flapF + i.flapP) * 0.55 + l * 2.2,
        p + i.heading + this.time * i.spin * (1 + l * 2),
        i.roll + Math.sin(this.time * i.flapF * 0.7 + i.flapP) * 0.4
      ), this.dummy.scale.set(C * i.width, C * i.length, C), this.dummy.updateMatrix(), this.mesh.setMatrixAt(n, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = !0;
    const o = t < 0 ? 0.18 : g(t / 0.7) * (1 - g((t - e) / r));
    this.groundGlow.material.opacity = 0.3 * o;
  }
}
function W(d, t, e, r) {
  const s = [], o = [], n = [];
  for (let h = 0; h <= e; h++) {
    const u = h / e, f = -1 * u * b + Math.PI * 0.5, l = Math.cos(f), m = Math.sin(f);
    s.push(l * d, 0, m * d, l * t, 0, m * t), o.push(u, 0, u, 1);
  }
  for (let h = 0; h < e; h++) {
    const u = h * 2;
    n.push(u, u + 2, u + 1, u + 1, u + 2, u + 3);
  }
  const i = new a.BufferGeometry();
  return i.setAttribute("position", new a.Float32BufferAttribute(s, 3)), i.setAttribute("uv", new a.Float32BufferAttribute(o, 2)), i.setIndex(n), i;
}
class j extends S {
  constructor(t, e) {
    super(t, 3.9), this.count = Math.max(16, Math.round(42 * e)), this.freezeDur = 1.65, this.holdEnd = 2.3, this.dummy = new a.Object3D();
    const r = new a.OctahedronGeometry(1, 0);
    r.scale(0.06, 0.155, 0.06);
    const s = [], o = r.getAttribute("position");
    for (let p = 0; p < o.count; p += 3) {
      const y = 0.67 + p / 3 % 4 * 0.1;
      for (let v = 0; v < 3; v++) s.push(y * 0.8, y * 0.93, y);
    }
    r.setAttribute("color", new a.Float32BufferAttribute(s, 3));
    const n = new a.MeshBasicMaterial({
      color: 14086911,
      vertexColors: !0,
      transparent: !0,
      opacity: 0.96
    });
    this.shards = new a.InstancedMesh(r, n, this.count), this.shards.frustumCulled = !1, this.group.add(this.shards), this.shardParams = [];
    const i = [12446463, 10475775, 14874879, 8833518];
    for (let p = 0; p < this.count; p++) {
      const v = p % 11 === 1 || p % 17 === 4 ? c(2.1, 2.7) : p % 4 === 0 ? c(1, 1.5) : c(0.32, 0.72);
      this.shardParams.push({
        rj: c(-0.08, 0.08),
        angleJitter: c(-0.32, 0.32) * b / this.count,
        y: c(0.01, 0.07),
        sx: v * c(0.82, 1.28),
        sy: v * c(0.7, 1.18),
        sz: v * c(0.82, 1.28),
        rx: c(-0.5, 0.5),
        ry: c(-Math.PI, Math.PI),
        rz: c(-0.5, 0.5),
        spin: c(-1.1, 1.1)
      }), this.shards.setColorAt(p, new a.Color(i[p % i.length]));
    }
    this.shards.instanceColor.needsUpdate = !0, this.sweepMat = new a.ShaderMaterial({
      uniforms: {
        uFront: { value: 0 },
        uCrack: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 }
      },
      vertexShader: (
        /* glsl */
        `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `
      ),
      fragmentShader: (
        /* glsl */
        `
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
      `
      ),
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide,
      blending: a.AdditiveBlending
    }), this.sweep = new a.Mesh(
      W(w * 0.74, w * 1.26, 160),
      this.sweepMat
    ), this.sweep.position.y = 8e-3, this.group.add(this.sweep), this.frost = new a.Mesh(
      new a.PlaneGeometry(1.85, 1.85),
      new a.MeshBasicMaterial({
        map: R(),
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.frost.rotation.x = -Math.PI / 2, this.frost.position.y = 3e-3, this.group.add(this.frost);
    const h = Math.round(350 * e), u = new a.BufferGeometry(), f = new Float32Array(h), l = new Float32Array(h), m = new Float32Array(h * 3);
    for (let p = 0; p < h; p++)
      f[p] = Math.floor(Math.random() * this.count) / this.count, l[p] = Math.random(), m[p * 3] = c(-0.09, 0.09), m[p * 3 + 1] = c(0, 0.22), m[p * 3 + 2] = c(-0.09, 0.09);
    u.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(h * 3), 3)), u.setAttribute("aShard", new a.Float32BufferAttribute(f, 1)), u.setAttribute("aSeed", new a.Float32BufferAttribute(l, 1)), u.setAttribute("aOff", new a.Float32BufferAttribute(m, 3)), this.dustMat = new a.ShaderMaterial({
      uniforms: {
        uCrack: { value: 0 },
        uRadius: { value: w },
        uTime: { value: 0 },
        uPixelRatio: { value: 1 }
      },
      vertexShader: (
        /* glsl */
        `
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
      `
      ),
      fragmentShader: (
        /* glsl */
        `
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          float a = pow(1.0 - d, 1.9);
          vec3 col = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), pow(1.0 - d, 4.0));
          gl_FragColor = vec4(col, a * vA);
        }
      `
      ),
      transparent: !0,
      depthWrite: !1,
      blending: a.AdditiveBlending
    }), this.dust = new a.Points(u, this.dustMat), this.dust.frustumCulled = !1, this.group.add(this.dust);
  }
  onResize(t) {
    this.dustMat.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = this.t;
    let e, r;
    t < 0 ? (e = 0.22 + 0.04 * Math.sin(this.time * 1.6), r = 0) : (e = g(t / this.freezeDur), r = g((t - this.holdEnd) / 1.25) * 1.14);
    for (let o = 0; o < this.count; o++) {
      const n = o / this.count, i = this.shardParams[o], h = Math.PI * 0.5 - n * b + i.angleJitter, u = M((e - n) / 0.045), f = g((r - n) / 0.12), l = 1 + 0.42 * Math.sin(M((e - n) / 0.14) * Math.PI), m = 0.88 + 0.12 * Math.sin(this.time * 3.1 + o), p = u * (1 - f) * l * m;
      this.dummy.position.set(
        Math.cos(h) * (w + i.rj) * (1 - f * 0.8),
        (0.02 + i.y * u) * (1 - f) - f * 0.12,
        Math.sin(h) * (w + i.rj) * (1 - f * 0.8)
      ), this.dummy.rotation.set(
        i.rx + f * i.spin * 1.4,
        -h + i.ry + f * i.spin * 2,
        i.rz + f * i.spin
      ), this.dummy.scale.set(i.sx * p, i.sy * p, i.sz * p), this.dummy.updateMatrix(), this.shards.setMatrixAt(o, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = !0, this.sweepMat.uniforms.uFront.value = e, this.sweepMat.uniforms.uCrack.value = r, this.sweepMat.uniforms.uTime.value = this.time, this.sweepMat.uniforms.uOpacity.value = 1 - g(r * 1.15);
    const s = t < 0 ? 0.1 : g(e) * (1 - g(r));
    this.frost.material.opacity = 0.55 * s, this.frost.scale.setScalar(0.9 + 0.25 * e), this.dustMat.uniforms.uCrack.value = r, this.dustMat.uniforms.uTime.value = this.time;
  }
}
const L = 2, q = { low: 0.35, medium: 0.65, high: 1 }, X = {
  fire: (d, t) => new V(d, t),
  thunder: (d, t) => new D(d, t),
  grass: (d, t) => new H(d, t),
  ice: (d, t) => new j(d, t)
};
class J {
  constructor(t, e = {}) {
    if (this.pools = /* @__PURE__ */ new Map(), this.playing = /* @__PURE__ */ new Map(), this.disposed = !1, this.parent = t, this.density = q[e.quality ?? "high"], !this.density) throw new Error("Unknown effect quality");
    this.pixelRatio = this.validatePixelRatio(e.pixelRatio ?? 1), this.camera = e.camera;
  }
  play(t, e = {}) {
    this.assertAlive();
    const r = X[t];
    if (!r) throw new Error(`Unknown pocket effect: ${String(t)}`);
    const s = e.radius ?? w;
    if (!Number.isFinite(s) || s <= 0) throw new Error("radius must be a positive finite number");
    if (e.duration !== void 0 && (!Number.isFinite(e.duration) || e.duration <= 0))
      throw new Error("duration must be a positive finite number");
    if (e.rotation !== void 0 && !Number.isFinite(e.rotation)) throw new Error("rotation must be finite");
    if (e.position && ![e.position.x, e.position.y, e.position.z].every(Number.isFinite))
      throw new Error("position must contain finite x, y and z values");
    let o = this.pools.get(t);
    o || (o = [], this.pools.set(t, o));
    let n = o.find((f) => !this.playing.has(f));
    n || (n = r(this.parent, this.density), n.onResize(this.pixelRatio), o.push(n));
    const i = e.position ?? { x: 0, y: 0, z: 0 };
    n.group.position.set(i.x, i.y, i.z), n.group.rotation.set(0, e.rotation ?? 0, 0), n.group.scale.setScalar(s / w), n.onCamera(this.camera);
    const h = { effect: n, speed: n.duration / (e.duration ?? L), onComplete: e.onComplete };
    this.playing.set(n, h), n.play();
    const u = this;
    return {
      stop() {
        u.playing.get(h.effect) === h && (u.playing.delete(h.effect), h.effect.stop());
      },
      get active() {
        return u.playing.get(h.effect) === h;
      }
    };
  }
  /** Advance all effects in seconds. Use the same delta as your game loop. */
  update(t) {
    if (this.assertAlive(), !Number.isFinite(t) || t < 0) throw new Error("deltaSeconds must be a non-negative finite number");
    const e = [];
    for (const [r, s] of Array.from(this.playing.entries()))
      this.playing.get(r) === s && (r.onCamera(this.camera), r.tick(t * s.speed) && (this.playing.delete(r), s.onComplete && e.push(s.onComplete)));
    e.forEach((r) => r());
  }
  setCamera(t) {
    this.assertAlive(), this.camera = t;
  }
  /** Call when your renderer's pixel ratio changes. */
  setPixelRatio(t) {
    this.assertAlive(), this.pixelRatio = this.validatePixelRatio(t);
    for (const e of this.pools.values()) for (const r of e) r.onResize(this.pixelRatio);
  }
  /** Stop all effects, detach them, and free owned geometry, materials and textures. */
  dispose() {
    if (this.disposed) return;
    this.disposed = !0, this.playing.clear();
    const t = /* @__PURE__ */ new Set(), e = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
    for (const s of this.pools.values()) for (const o of s)
      o.stop(), o.group.traverse((n) => {
        const i = n;
        if (i.geometry && !n.isSprite && t.add(i.geometry), i.material) {
          const h = Array.isArray(i.material) ? i.material : [i.material];
          for (const u of h) {
            e.add(u);
            for (const f of Object.values(u)) f instanceof a.Texture && r.add(f);
            if (u instanceof a.ShaderMaterial)
              for (const f of Object.values(u.uniforms)) f.value instanceof a.Texture && r.add(f.value);
          }
        }
      }), o.group.removeFromParent();
    t.forEach((s) => s.dispose()), e.forEach((s) => s.dispose()), r.forEach((s) => s.dispose()), this.pools.clear();
  }
  validatePixelRatio(t) {
    if (!Number.isFinite(t) || t <= 0) throw new Error("pixelRatio must be a positive finite number");
    return t;
  }
  assertAlive() {
    if (this.disposed) throw new Error("PocketEffects has been disposed");
  }
}
export {
  J as PocketEffects
};
