import * as a from "three";
const b = Math.PI * 2, w = 0.46, A = (d) => Math.max(0, Math.min(1, d)), g = (d) => {
  const t = A(d);
  return t * t * (3 - 2 * t);
}, R = (d) => {
  const t = A(d);
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
function P(d, t = 256) {
  const e = document.createElement("canvas");
  e.width = e.height = t;
  const s = e.getContext("2d");
  if (!s) throw new Error("Canvas 2D is not available");
  const i = s.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  for (const [r, n] of d) i.addColorStop(r, n);
  s.fillStyle = i, s.fillRect(0, 0, t, t);
  const o = new a.CanvasTexture(e);
  return o.colorSpace = a.SRGBColorSpace, o;
}
function k(d = 512) {
  const t = document.createElement("canvas");
  t.width = t.height = d;
  const e = t.getContext("2d");
  if (!e) throw new Error("Canvas 2D is not available");
  const s = d / 2, i = d / 2, o = e.createRadialGradient(s, i, d * 0.08, s, i, d * 0.5);
  o.addColorStop(0, "rgba(185,238,255,0.55)"), o.addColorStop(0.5, "rgba(120,200,255,0.20)"), o.addColorStop(1, "rgba(120,200,255,0)"), e.fillStyle = o, e.fillRect(0, 0, d, d), e.globalCompositeOperation = "lighter";
  for (let n = 0; n < 110; n++) {
    const u = Math.random() * b, h = d * 0.1 + Math.random() * d * 0.12, f = h + d * 0.06 + Math.random() * d * 0.2;
    e.strokeStyle = `rgba(205,246,255,${c(0.08, 0.3)})`, e.lineWidth = c(0.8, 2.6), e.beginPath(), e.moveTo(s + Math.cos(u) * h, i + Math.sin(u) * h);
    for (let l = 1; l <= 3; l++) {
      const m = h + (f - h) * (l / 3), p = u + c(-0.09, 0.09);
      e.lineTo(s + Math.cos(p) * m, i + Math.sin(p) * m);
    }
    e.stroke();
  }
  const r = new a.CanvasTexture(t);
  return r.colorSpace = a.SRGBColorSpace, r;
}
function B() {
  const e = [], s = [], i = [];
  for (let r = 0; r <= 18; r++) {
    const n = r / 18;
    for (let u = 0; u <= 112; u++) {
      const h = u / 112, f = h * b;
      if (e.push(Math.cos(f), n, Math.sin(f)), s.push(h, n), r < 18 && u < 112) {
        const l = r * 113 + u;
        i.push(l, l + 112 + 1, l + 1), i.push(l + 1, l + 112 + 1, l + 112 + 2);
      }
    }
  }
  const o = new a.BufferGeometry();
  return o.setAttribute("position", new a.Float32BufferAttribute(e, 3)), o.setAttribute("uv", new a.Float32BufferAttribute(s, 2)), o.setIndex(i), o;
}
const G = (
  /* glsl */
  `
  uniform float uTime, uGrow, uContract, uRadius, uHeight, uPhase;
  varying vec2 vUv;
  varying float vAngle;

  void main() {
    vUv = uv;
    float a = uv.x * 6.28318530718;
    float h = uv.y;
    vAngle = a;
    float curl = (sin(a * 3.0 - uTime * 1.4 + h * 4.0 + uPhase) * 0.10
                + sin(a * 7.0 + uTime * 1.1 + h * 5.0) * 0.035) * h;
    float angle = a + curl + uContract * 1.8;
    float ripple = sin(a * 5.0 + uTime * 2.0 + h * 6.0 + uPhase) * 0.025 * h;
    float radius = (uRadius + ripple) * mix(1.0, 0.04, uContract);
    float y = h * uHeight * uGrow * mix(1.0, 0.15, uContract);
    vec3 p = vec3(cos(angle) * radius, y, sin(angle) * radius);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
), E = (
  /* glsl */
  `
  uniform float uTime, uGrow, uContract, uOpacity, uPhase;
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
    float density = 0.80 - h * 1.38 + (turbulence - 0.50) * 1.20;
    float silhouette = smoothstep(-0.07, 0.16, density);
    float topFade = 1.0 - smoothstep(0.78, 1.0, h);
    float base = smoothstep(0.0, 0.045, h);
    float flicker = 0.86 + 0.14 * sin(uTime * 4.1 + a * 3.0);
    float opacity = silhouette * topFade * base * flicker * uOpacity * uGrow * (1.0 - uContract);
    opacity *= 0.72 + 0.28 * turbulence;
    vec3 deep = vec3(0.86, 0.10, 0.012);
    vec3 amber = vec3(1.0, 0.32, 0.025);
    vec3 gold = vec3(1.0, 0.70, 0.16);
    vec3 color = mix(amber, deep, smoothstep(0.16, 0.75, h));
    float hot = (1.0 - smoothstep(0.04, 0.52, h)) * (0.65 + 0.35 * detail);
    color = mix(color, gold, hot * 0.80);
    gl_FragColor = vec4(color, opacity);
  }
`
);
function z(d) {
  const t = B(), e = [], s = [
    { radius: w * 1.02, height: 1.08, opacity: 0.64, phase: 0 },
    { radius: w * 0.77, height: 0.9, opacity: 0.57, phase: 2.1 }
  ];
  for (const i of s) {
    const o = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: i.radius },
        uHeight: { value: i.height },
        uOpacity: { value: i.opacity },
        uPhase: { value: i.phase }
      },
      vertexShader: G,
      fragmentShader: E,
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide
    }), r = new a.Mesh(t, o);
    r.name = "Continuous flame", r.frustumCulled = !1, d.add(r), e.push(o);
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
    const s = P([
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
      map: s,
      color: 16756838,
      transparent: !0,
      blending: a.AdditiveBlending,
      depthWrite: !1,
      opacity: 0
    })), this.core.position.set(0, 0.16, 0), this.core.scale.setScalar(0.7), this.group.add(this.core), this.groundGlow = new a.Mesh(
      new a.PlaneGeometry(1.9, 1.9),
      new a.MeshBasicMaterial({
        map: s,
        color: 16738846,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundGlow.rotation.x = -Math.PI / 2, this.groundGlow.position.y = 4e-3, this.groundGlow.renderOrder = -1, this.group.add(this.groundGlow);
  }
  makePointMat(t, e, s, i, o) {
    const r = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: w },
        uPixelRatio: { value: 1 },
        uSizeMul: { value: t },
        uAlpha: { value: e },
        uC1: { value: new a.Vector3(s[0], s[1], s[2]) },
        uC2: { value: new a.Vector3(i[0], i[1], i[2]) },
        uC3: { value: new a.Vector3(o[0], o[1], o[2]) }
      },
      vertexShader: I,
      fragmentShader: _,
      transparent: !0,
      depthWrite: !1,
      blending: a.AdditiveBlending
    });
    return this.mats.push(r), r;
  }
  makeLayer(t, e, s, i) {
    const o = new a.BufferGeometry(), r = new Float32Array(t), n = new Float32Array(t), u = new Float32Array(t), h = new Float32Array(t), f = new Float32Array(t);
    for (let m = 0; m < t; m++)
      r[m] = Math.random(), n[m] = Math.random() * b, u[m] = Math.random(), h[m] = 0.6 + Math.random() * 0.85, f[m] = c(e, s);
    o.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(t * 3), 3)), o.setAttribute("aSeed", new a.Float32BufferAttribute(r, 1)), o.setAttribute("aAng", new a.Float32BufferAttribute(n, 1)), o.setAttribute("aRad", new a.Float32BufferAttribute(u, 1)), o.setAttribute("aHeight", new a.Float32BufferAttribute(h, 1)), o.setAttribute("aSize", new a.Float32BufferAttribute(f, 1));
    const l = new a.Points(o, i);
    return l.frustumCulled = !1, this.group.add(l), l;
  }
  onResize(t) {
    for (const e of this.mats) e.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = this.t;
    let e, s;
    t < 0 ? (e = 0.13 + 0.03 * Math.sin(this.time * 1.8), s = 0) : (e = g(t / 0.65), s = g((t - 2.45) / 1.05));
    for (const r of this.mats)
      r.uniforms.uTime.value = this.time, r.uniforms.uGrow.value = e, r.uniforms.uContract.value = s;
    for (const r of this.flameMats)
      r.uniforms.uTime.value = this.time, r.uniforms.uGrow.value = e, r.uniforms.uContract.value = s;
    const i = 0.86 + 0.14 * Math.sin(this.time * 9) * Math.sin(this.time * 3.7), o = 1 - s;
    this.core.material.opacity = 0.4 * e * o * i, this.core.scale.setScalar((0.52 + 0.38 * e) * (1 - s * 0.9)), this.core.position.y = 0.14 + 0.06 * e, this.groundGlow.material.opacity = 0.27 * e * o * i, this.groundGlow.scale.setScalar(0.85 + 0.55 * e);
  }
}
function F(d, t, e, s) {
  let i = [d.clone(), t.clone()], o = d.distanceTo(t) * s;
  for (let r = 0; r < e; r++) {
    const n = [i[0]];
    for (let u = 0; u < i.length - 1; u++) {
      const h = i[u], f = i[u + 1], l = h.clone().add(f).multiplyScalar(0.5);
      l.x += c(-0.5, 0.5) * o, l.z += c(-0.5, 0.5) * o, l.y += c(-0.5, 0.5) * o * 0.25, n.push(l, f);
    }
    i = n, o *= 0.55;
  }
  return i;
}
const O = (
  /* glsl */
  `
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
), U = (
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
class x {
  constructor(t) {
    this.maxPts = t, this.pos = new Float32Array(t * 2 * 3);
    const e = new Float32Array(t * 2);
    for (let o = 0; o < t; o++)
      e[o * 2] = -1, e[o * 2 + 1] = 1;
    const s = [];
    for (let o = 0; o < t - 1; o++) {
      const r = o * 2;
      s.push(r, r + 1, r + 2, r + 1, r + 3, r + 2);
    }
    const i = new a.BufferGeometry();
    i.setAttribute("position", new a.BufferAttribute(this.pos, 3)), i.setAttribute("aSide", new a.BufferAttribute(e, 1)), i.setIndex(s), this.geo = i, this.material = new a.ShaderMaterial({
      uniforms: {
        uColor: { value: new a.Vector3(0.55, 0.78, 1) },
        uAlpha: { value: 0 }
      },
      vertexShader: O,
      fragmentShader: U,
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide,
      blending: a.AdditiveBlending
    }), this.mesh = new a.Mesh(i, this.material), this.mesh.frustumCulled = !1;
  }
  setPath(t, e, s) {
    const i = Math.min(t.length, this.maxPts), o = new a.Vector3(), r = new a.Vector3();
    for (let n = 0; n < i; n++) {
      const u = t[n], h = t[Math.max(0, n - 1)], f = t[Math.min(t.length - 1, n + 1)];
      o.subVectors(f, h), o.lengthSq() < 1e-9 && o.set(0, 1, 0), o.normalize(), r.crossVectors(o, s), r.lengthSq() < 1e-9 && r.set(1, 0, 0), r.normalize().multiplyScalar(e);
      const l = n * 6;
      this.pos[l] = u.x + r.x, this.pos[l + 1] = u.y + r.y, this.pos[l + 2] = u.z + r.z, this.pos[l + 3] = u.x - r.x, this.pos[l + 4] = u.y - r.y, this.pos[l + 5] = u.z - r.z;
    }
    this.geo.setDrawRange(0, (i - 1) * 6), this.geo.attributes.position.needsUpdate = !0;
  }
}
class D extends S {
  constructor(t, e) {
    super(t, 3.6), this.lastImpact = new a.Vector3(0, 0.03, 0), this.viewDir = new a.Vector3(0, 0.24, 1).normalize();
    const s = P([
      [0, "rgba(255,255,255,1)"],
      [0.25, "rgba(200,225,255,0.55)"],
      [0.62, "rgba(150,190,255,0.12)"],
      [1, "rgba(150,190,255,0)"]
    ]);
    this.mainBolt = new x(64), this.mainBolt.mesh.name = "Lightning trunk", this.mainGlow = new x(64), this.mainGlow.material.uniforms.uColor.value.set(0.3, 0.48, 1), this.branchA = new x(32), this.branchB = new x(32), this.group.add(this.mainGlow.mesh, this.mainBolt.mesh, this.branchA.mesh, this.branchB.mesh), this.arcs = [];
    for (let l = 0; l < 3; l++) {
      const m = new x(32);
      m.mesh.name = "Connected ground arc", m.material.uniforms.uColor.value.set(0.45, 0.68, 1), this.group.add(m.mesh), this.arcs.push(m);
    }
    const i = Math.round(180 * e), o = new a.BufferGeometry(), r = new Float32Array(i), n = new Float32Array(i), u = new Float32Array(i), h = new Float32Array(i), f = new Float32Array(i);
    for (let l = 0; l < i; l++)
      r[l] = Math.random(), n[l] = Math.random() * b, u[l] = Math.random(), h[l] = Math.random(), f[l] = c(2, 7);
    o.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(i * 3), 3)), o.setAttribute("aSeed", new a.Float32BufferAttribute(r, 1)), o.setAttribute("aAng", new a.Float32BufferAttribute(n, 1)), o.setAttribute("aRad", new a.Float32BufferAttribute(u, 1)), o.setAttribute("aHeight", new a.Float32BufferAttribute(h, 1)), o.setAttribute("aSize", new a.Float32BufferAttribute(f, 1)), this.sparkMat = new a.ShaderMaterial({
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
      map: s,
      color: 13624063,
      transparent: !0,
      blending: a.AdditiveBlending,
      depthWrite: !1,
      opacity: 0
    })), this.flash.position.set(0, 1.4, 0), this.flash.scale.setScalar(1.6), this.group.add(this.flash), this.groundFlash = new a.Mesh(
      new a.PlaneGeometry(2, 2),
      new a.MeshBasicMaterial({
        map: s,
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
    const t = new a.Vector3(c(-0.8, 0.8), c(1.9, 2.5), c(-0.85, 0.75)), e = new a.Vector3(c(-0.1, 0.1), 0.02, c(-0.1, 0.1)), s = F(t, e, 5, 0.2);
    this.lastImpact.copy(e), this.arcTimer = 0, this.mainBolt.setPath(s, 0.041, this.viewDir), this.mainGlow.setPath(s, 0.105, this.viewDir);
    const i = (o) => {
      const r = Math.floor(c(s.length * 0.15, s.length * 0.6)), n = s[r].clone(), u = new a.Vector3(c(-1, 1), c(-0.75, 0.25), c(-1, 1)).normalize(), h = n.clone().addScaledVector(u, c(0.45, 1.05));
      o.setPath(F(n, h, 4, 0.28), 0.026, this.viewDir);
    };
    i(this.branchA), i(this.branchB), this.boltAge = 0, this.flashPeak = 1, this.flash.position.copy(t), this.flash.scale.setScalar(c(1.3, 2.3));
  }
  /** Every arc starts at the strike point and runs outward into a jagged ring. */
  buildArc(t, e) {
    const s = e / this.arcs.length * b + c(-0.42, 0.42), i = c(0.85, 2) * (e === 1 ? -1 : 1), o = w * c(0.9, 1.2), r = new a.Vector3(Math.cos(s) * o, c(0.03, 0.1), Math.sin(s) * o), n = this.lastImpact.clone().lerp(r, c(0.45, 0.65));
    n.y += c(0.05, 0.16), n.x += c(-0.05, 0.05), n.z += c(-0.05, 0.05);
    const u = [this.lastImpact.clone(), n, r];
    for (let h = 1; h <= 13; h++) {
      const f = s + i * (h / 13), l = o * c(0.92, 1.08);
      u.push(new a.Vector3(Math.cos(f) * l, c(0.02, 0.14), Math.sin(f) * l));
    }
    t.setPath(u, c(0.026, 0.037), this.viewDir);
  }
  update(t) {
    const e = this.t;
    let s, i;
    e < 0 ? (s = 0.34 + 0.05 * Math.sin(this.time * 2.4), i = 0) : (s = g(e / 0.45), i = g((e - 2.45) / 0.95)), e >= 0 && e < 2.5 && (this.strikeTimer -= t, this.strikeTimer <= 0 && (this.strike(), this.strikeTimer = c(0.52, 0.8))), this.boltAge += t;
    const o = 1 - g(this.boltAge / 0.3), r = 0.78 + 0.22 * Math.sin(this.time * 32), n = o * r * (1 - i) * (e >= 0 ? 1 : 0);
    for (const u of [this.mainBolt, this.branchA, this.branchB])
      u.material.uniforms.uAlpha.value = n;
    this.mainGlow.material.uniforms.uAlpha.value = n * 0.28, this.arcTimer -= t, this.arcTimer <= 0 && (this.arcTimer = c(0.2, 0.3), this.arcs.forEach((u, h) => this.buildArc(u, h))), this.arcs.forEach((u, h) => {
      const f = 0.72 + 0.28 * Math.sin(this.time * 17 + h * 2.1);
      u.material.uniforms.uAlpha.value = s * (1 - i) * f, u.mesh.scale.setScalar(1 - i * 0.88);
    }), this.flashPeak = Math.max(0, this.flashPeak - t * 5.5), this.flash.material.opacity = this.flashPeak * 0.65, this.groundFlash.material.opacity = this.flashPeak * 0.34, this.groundFlash.scale.setScalar(0.8 + this.flashPeak * 0.6), this.sparkMat.uniforms.uTime.value = this.time, this.sparkMat.uniforms.uGrow.value = s, this.sparkMat.uniforms.uContract.value = i, this.ringMat.uniforms.uTime.value = this.time, this.ringMat.uniforms.uGrow.value = s, this.ringMat.uniforms.uContract.value = i, this.ring.scale.setScalar(1 - i * 0.35);
  }
}
function H() {
  const s = [], i = [], o = [], r = new a.Color(2914877), n = new a.Color(6473066), u = new a.Color(11135645);
  for (let f = 0; f <= 14; f++) {
    const l = f / 14, m = Math.sin(Math.PI * Math.pow(l, 0.68)) * 0.085 * (1 - 0.22 * l) + 12e-4, p = Math.sin(Math.PI * l) * 0.022, y = l * 0.28, v = r.clone().lerp(n, l).lerp(u, l * l).multiplyScalar(0.7), M = r.clone().lerp(n, l).lerp(u, l * l);
    s.push(-m, y, p), i.push(v.r, v.g, v.b), s.push(0, y, p + 8e-3), i.push(M.r, M.g, M.b), s.push(m, y, p), i.push(v.r, v.g, v.b);
  }
  for (let f = 0; f < 14; f++) {
    const l = f * 3, m = l + 3;
    o.push(l, m, l + 1, l + 1, m, m + 1), o.push(l + 1, m + 1, l + 2, l + 2, m + 1, m + 2);
  }
  const h = new a.BufferGeometry();
  return h.setAttribute("position", new a.Float32BufferAttribute(s, 3)), h.setAttribute("color", new a.Float32BufferAttribute(i, 3)), h.setIndex(o), h.computeVertexNormals(), h;
}
class W extends S {
  constructor(t, e) {
    super(t, 4.1), this.count = Math.max(12, Math.round(38 * e)), this.dummy = new a.Object3D();
    const s = H(), i = new a.MeshBasicMaterial({
      vertexColors: !0,
      side: a.DoubleSide
    });
    this.mesh = new a.InstancedMesh(s, i, this.count), this.mesh.frustumCulled = !1, this.group.add(this.mesh), this.leaves = [];
    const o = [10477706, 7327866, 13168778, 5551466, 11065706];
    for (let n = 0; n < this.count; n++) {
      const u = n % 11 === 1 || n % 17 === 4 ? c(1.65, 2.1) : n % 4 === 0 ? c(0.95, 1.3) : c(0.36, 0.72);
      this.leaves.push({
        ang: Math.random() * b,
        r: w * c(0.65, 1.55),
        y: c(0.06, 0.82),
        size: u,
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
      }), this.mesh.setColorAt(n, new a.Color(o[n % o.length]).multiplyScalar(c(0.85, 1.12)));
    }
    this.mesh.instanceColor.needsUpdate = !0;
    const r = P([
      [0, "rgba(150,240,150,0.35)"],
      [0.5, "rgba(90,200,110,0.12)"],
      [1, "rgba(90,200,110,0)"]
    ]);
    this.groundGlow = new a.Mesh(
      new a.PlaneGeometry(1.8, 1.8),
      new a.MeshBasicMaterial({
        map: r,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundGlow.rotation.x = -Math.PI / 2, this.groundGlow.position.y = 4e-3, this.group.add(this.groundGlow);
  }
  update() {
    const t = this.t, e = 2.55, s = 1.45;
    let i;
    t < 0 ? i = 0.62 : i = 1;
    for (let r = 0; r < this.count; r++) {
      const n = this.leaves[r], u = r / this.count, h = t < 0 ? 0.62 : g((t - u * 0.3) / 0.45);
      let f = 0;
      t >= e && (f = A((t - e - u * 0.5 * s) / (0.5 * s)));
      const l = R(f), m = n.r * (1 - l * 0.995), p = n.ang + this.time * n.spinSpd * n.dir * (1 + l * 4), y = Math.cos(p) * m, v = Math.sin(p) * m, M = Math.sin(this.time * n.bobF + n.bobP) * 0.055, T = (n.y + M) * (1 - l) + -0.14 * l, C = n.size * h * (1 - l * l) * i;
      this.dummy.position.set(y, T, v), this.dummy.rotation.set(
        n.tilt + Math.sin(this.time * n.flapF + n.flapP) * 0.55 + l * 2.2,
        p + n.heading + this.time * n.spin * (1 + l * 2),
        n.roll + Math.sin(this.time * n.flapF * 0.7 + n.flapP) * 0.4
      ), this.dummy.scale.set(C * n.width, C * n.length, C), this.dummy.updateMatrix(), this.mesh.setMatrixAt(r, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = !0;
    const o = t < 0 ? 0.18 : g(t / 0.7) * (1 - g((t - e) / s));
    this.groundGlow.material.opacity = 0.3 * o;
  }
}
function N(d, t, e, s) {
  const i = [], o = [], r = [];
  for (let u = 0; u <= e; u++) {
    const h = u / e, f = -1 * h * b + Math.PI * 0.5, l = Math.cos(f), m = Math.sin(f);
    i.push(l * d, 0, m * d, l * t, 0, m * t), o.push(h, 0, h, 1);
  }
  for (let u = 0; u < e; u++) {
    const h = u * 2;
    r.push(h, h + 2, h + 1, h + 1, h + 2, h + 3);
  }
  const n = new a.BufferGeometry();
  return n.setAttribute("position", new a.Float32BufferAttribute(i, 3)), n.setAttribute("uv", new a.Float32BufferAttribute(o, 2)), n.setIndex(r), n;
}
class j extends S {
  constructor(t, e) {
    super(t, 3.9), this.count = Math.max(16, Math.round(42 * e)), this.freezeDur = 1.65, this.holdEnd = 2.3, this.dummy = new a.Object3D();
    const s = new a.OctahedronGeometry(1, 0);
    s.scale(0.06, 0.155, 0.06);
    const i = [], o = s.getAttribute("position");
    for (let p = 0; p < o.count; p += 3) {
      const y = 0.67 + p / 3 % 4 * 0.1;
      for (let v = 0; v < 3; v++) i.push(y * 0.8, y * 0.93, y);
    }
    s.setAttribute("color", new a.Float32BufferAttribute(i, 3));
    const r = new a.MeshBasicMaterial({
      color: 14086911,
      vertexColors: !0,
      transparent: !0,
      opacity: 0.96
    });
    this.shards = new a.InstancedMesh(s, r, this.count), this.shards.frustumCulled = !1, this.group.add(this.shards), this.shardParams = [];
    const n = [12446463, 10475775, 14874879, 8833518];
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
      }), this.shards.setColorAt(p, new a.Color(n[p % n.length]));
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
      N(w * 0.74, w * 1.26, 160),
      this.sweepMat
    ), this.sweep.position.y = 8e-3, this.group.add(this.sweep), this.frost = new a.Mesh(
      new a.PlaneGeometry(1.85, 1.85),
      new a.MeshBasicMaterial({
        map: k(),
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.frost.rotation.x = -Math.PI / 2, this.frost.position.y = 3e-3, this.group.add(this.frost);
    const u = Math.round(350 * e), h = new a.BufferGeometry(), f = new Float32Array(u), l = new Float32Array(u), m = new Float32Array(u * 3);
    for (let p = 0; p < u; p++)
      f[p] = Math.floor(Math.random() * this.count) / this.count, l[p] = Math.random(), m[p * 3] = c(-0.09, 0.09), m[p * 3 + 1] = c(0, 0.22), m[p * 3 + 2] = c(-0.09, 0.09);
    h.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(u * 3), 3)), h.setAttribute("aShard", new a.Float32BufferAttribute(f, 1)), h.setAttribute("aSeed", new a.Float32BufferAttribute(l, 1)), h.setAttribute("aOff", new a.Float32BufferAttribute(m, 3)), this.dustMat = new a.ShaderMaterial({
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
    }), this.dust = new a.Points(h, this.dustMat), this.dust.frustumCulled = !1, this.group.add(this.dust);
  }
  onResize(t) {
    this.dustMat.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = this.t;
    let e, s;
    t < 0 ? (e = 0.22 + 0.04 * Math.sin(this.time * 1.6), s = 0) : (e = g(t / this.freezeDur), s = g((t - this.holdEnd) / 1.25) * 1.14);
    for (let o = 0; o < this.count; o++) {
      const r = o / this.count, n = this.shardParams[o], u = Math.PI * 0.5 - r * b + n.angleJitter, h = A((e - r) / 0.045), f = g((s - r) / 0.12), l = 1 + 0.42 * Math.sin(A((e - r) / 0.14) * Math.PI), m = 0.88 + 0.12 * Math.sin(this.time * 3.1 + o), p = h * (1 - f) * l * m;
      this.dummy.position.set(
        Math.cos(u) * (w + n.rj) * (1 - f * 0.8),
        (0.02 + n.y * h) * (1 - f) - f * 0.12,
        Math.sin(u) * (w + n.rj) * (1 - f * 0.8)
      ), this.dummy.rotation.set(
        n.rx + f * n.spin * 1.4,
        -u + n.ry + f * n.spin * 2,
        n.rz + f * n.spin
      ), this.dummy.scale.set(n.sx * p, n.sy * p, n.sz * p), this.dummy.updateMatrix(), this.shards.setMatrixAt(o, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = !0, this.sweepMat.uniforms.uFront.value = e, this.sweepMat.uniforms.uCrack.value = s, this.sweepMat.uniforms.uTime.value = this.time, this.sweepMat.uniforms.uOpacity.value = 1 - g(s * 1.15);
    const i = t < 0 ? 0.1 : g(e) * (1 - g(s));
    this.frost.material.opacity = 0.55 * i, this.frost.scale.setScalar(0.9 + 0.25 * e), this.dustMat.uniforms.uCrack.value = s, this.dustMat.uniforms.uTime.value = this.time;
  }
}
const L = { low: 0.35, medium: 0.65, high: 1 }, q = {
  fire: (d, t) => new V(d, t),
  thunder: (d, t) => new D(d, t),
  grass: (d, t) => new W(d, t),
  ice: (d, t) => new j(d, t)
};
class X {
  constructor(t, e = {}) {
    if (this.pools = /* @__PURE__ */ new Map(), this.playing = /* @__PURE__ */ new Map(), this.disposed = !1, this.parent = t, this.density = L[e.quality ?? "high"], !this.density) throw new Error("Unknown effect quality");
    this.pixelRatio = this.validatePixelRatio(e.pixelRatio ?? 1), this.camera = e.camera;
  }
  play(t, e = {}) {
    this.assertAlive();
    const s = q[t];
    if (!s) throw new Error(`Unknown pocket effect: ${String(t)}`);
    const i = e.radius ?? w;
    if (!Number.isFinite(i) || i <= 0) throw new Error("radius must be a positive finite number");
    if (e.duration !== void 0 && (!Number.isFinite(e.duration) || e.duration <= 0))
      throw new Error("duration must be a positive finite number");
    if (e.rotation !== void 0 && !Number.isFinite(e.rotation)) throw new Error("rotation must be finite");
    if (e.position && ![e.position.x, e.position.y, e.position.z].every(Number.isFinite))
      throw new Error("position must contain finite x, y and z values");
    let o = this.pools.get(t);
    o || (o = [], this.pools.set(t, o));
    let r = o.find((f) => !this.playing.has(f));
    r || (r = s(this.parent, this.density), r.onResize(this.pixelRatio), o.push(r));
    const n = e.position ?? { x: 0, y: 0, z: 0 };
    r.group.position.set(n.x, n.y, n.z), r.group.rotation.set(0, e.rotation ?? 0, 0), r.group.scale.setScalar(i / w), r.onCamera(this.camera);
    const u = { effect: r, speed: r.duration / (e.duration ?? r.duration), onComplete: e.onComplete };
    this.playing.set(r, u), r.play();
    const h = this;
    return {
      stop() {
        h.playing.get(u.effect) === u && (h.playing.delete(u.effect), u.effect.stop());
      },
      get active() {
        return h.playing.get(u.effect) === u;
      }
    };
  }
  /** Advance all effects in seconds. Use the same delta as your game loop. */
  update(t) {
    if (this.assertAlive(), !Number.isFinite(t) || t < 0) throw new Error("deltaSeconds must be a non-negative finite number");
    const e = [];
    for (const [s, i] of Array.from(this.playing.entries()))
      this.playing.get(s) === i && (s.onCamera(this.camera), s.tick(t * i.speed) && (this.playing.delete(s), i.onComplete && e.push(i.onComplete)));
    e.forEach((s) => s());
  }
  setCamera(t) {
    this.assertAlive(), this.camera = t;
  }
  /** Call when your renderer's pixel ratio changes. */
  setPixelRatio(t) {
    this.assertAlive(), this.pixelRatio = this.validatePixelRatio(t);
    for (const e of this.pools.values()) for (const s of e) s.onResize(this.pixelRatio);
  }
  /** Stop all effects, detach them, and free owned geometry, materials and textures. */
  dispose() {
    if (this.disposed) return;
    this.disposed = !0, this.playing.clear();
    const t = /* @__PURE__ */ new Set(), e = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
    for (const i of this.pools.values()) for (const o of i)
      o.stop(), o.group.traverse((r) => {
        const n = r;
        if (n.geometry && !r.isSprite && t.add(n.geometry), n.material) {
          const u = Array.isArray(n.material) ? n.material : [n.material];
          for (const h of u) {
            e.add(h);
            for (const f of Object.values(h)) f instanceof a.Texture && s.add(f);
            if (h instanceof a.ShaderMaterial)
              for (const f of Object.values(h.uniforms)) f.value instanceof a.Texture && s.add(f.value);
          }
        }
      }), o.group.removeFromParent();
    t.forEach((i) => i.dispose()), e.forEach((i) => i.dispose()), s.forEach((i) => i.dispose()), this.pools.clear();
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
  X as PocketEffects
};
