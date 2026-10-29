import * as a from "three";
const w = Math.PI * 2, g = 0.46, M = (d) => Math.max(0, Math.min(1, d)), v = (d) => {
  const t = M(d);
  return t * t * (3 - 2 * t);
}, T = (d) => {
  const t = M(d);
  return t * t;
}, f = (d, t) => d + Math.random() * (t - d);
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
function C(d, t = 256) {
  const e = document.createElement("canvas");
  e.width = e.height = t;
  const r = e.getContext("2d");
  if (!r) throw new Error("Canvas 2D is not available");
  const i = r.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  for (const [o, n] of d) i.addColorStop(o, n);
  r.fillStyle = i, r.fillRect(0, 0, t, t);
  const s = new a.CanvasTexture(e);
  return s.colorSpace = a.SRGBColorSpace, s;
}
function k(d = 512) {
  const t = document.createElement("canvas");
  t.width = t.height = d;
  const e = t.getContext("2d");
  if (!e) throw new Error("Canvas 2D is not available");
  const r = d / 2, i = d / 2, s = e.createRadialGradient(r, i, d * 0.08, r, i, d * 0.5);
  s.addColorStop(0, "rgba(185,238,255,0.55)"), s.addColorStop(0.5, "rgba(120,200,255,0.20)"), s.addColorStop(1, "rgba(120,200,255,0)"), e.fillStyle = s, e.fillRect(0, 0, d, d), e.globalCompositeOperation = "lighter";
  for (let n = 0; n < 110; n++) {
    const h = Math.random() * w, u = d * 0.1 + Math.random() * d * 0.12, c = u + d * 0.06 + Math.random() * d * 0.2;
    e.strokeStyle = `rgba(205,246,255,${f(0.08, 0.3)})`, e.lineWidth = f(0.8, 2.6), e.beginPath(), e.moveTo(r + Math.cos(h) * u, i + Math.sin(h) * u);
    for (let l = 1; l <= 3; l++) {
      const m = u + (c - u) * (l / 3), p = h + f(-0.09, 0.09);
      e.lineTo(r + Math.cos(p) * m, i + Math.sin(p) * m);
    }
    e.stroke();
  }
  const o = new a.CanvasTexture(t);
  return o.colorSpace = a.SRGBColorSpace, o;
}
const B = (
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
), G = (
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
class E extends S {
  constructor(t, e) {
    super(t, 3.9), this.mats = [];
    const r = C([
      [0, "rgba(255,255,255,1)"],
      [0.3, "rgba(255,255,255,0.50)"],
      [0.65, "rgba(255,255,255,0.10)"],
      [1, "rgba(255,255,255,0)"]
    ]);
    this.lickMat = this.makePointMat(
      1,
      0.5,
      [1, 0.88, 0.58],
      [1, 0.42, 0.08],
      [0.8, 0.1, 0.02]
    ), this.licks = this.makeLayer(Math.round(950 * e), 7, 20, this.lickMat), this.glowMat = this.makePointMat(
      1.95,
      0.12,
      [1, 0.72, 0.36],
      [1, 0.34, 0.05],
      [0.62, 0.05, 0.01]
    ), this.glow = this.makeLayer(Math.round(240 * e), 16, 40, this.glowMat), this.core = new a.Sprite(new a.SpriteMaterial({
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
  makePointMat(t, e, r, i, s) {
    const o = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: g },
        uPixelRatio: { value: 1 },
        uSizeMul: { value: t },
        uAlpha: { value: e },
        uC1: { value: new a.Vector3(r[0], r[1], r[2]) },
        uC2: { value: new a.Vector3(i[0], i[1], i[2]) },
        uC3: { value: new a.Vector3(s[0], s[1], s[2]) }
      },
      vertexShader: B,
      fragmentShader: G,
      transparent: !0,
      depthWrite: !1,
      blending: a.AdditiveBlending
    });
    return this.mats.push(o), o;
  }
  makeLayer(t, e, r, i) {
    const s = new a.BufferGeometry(), o = new Float32Array(t), n = new Float32Array(t), h = new Float32Array(t), u = new Float32Array(t), c = new Float32Array(t);
    for (let m = 0; m < t; m++)
      o[m] = Math.random(), n[m] = Math.random() * w, h[m] = Math.random(), u[m] = 0.6 + Math.random() * 0.85, c[m] = f(e, r);
    s.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(t * 3), 3)), s.setAttribute("aSeed", new a.Float32BufferAttribute(o, 1)), s.setAttribute("aAng", new a.Float32BufferAttribute(n, 1)), s.setAttribute("aRad", new a.Float32BufferAttribute(h, 1)), s.setAttribute("aHeight", new a.Float32BufferAttribute(u, 1)), s.setAttribute("aSize", new a.Float32BufferAttribute(c, 1));
    const l = new a.Points(s, i);
    return l.frustumCulled = !1, this.group.add(l), l;
  }
  onResize(t) {
    for (const e of this.mats) e.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = this.t;
    let e, r;
    t < 0 ? (e = 0.13 + 0.03 * Math.sin(this.time * 1.8), r = 0) : (e = v(t / 0.65), r = v((t - 2.45) / 1.05));
    for (const o of this.mats)
      o.uniforms.uTime.value = this.time, o.uniforms.uGrow.value = e, o.uniforms.uContract.value = r;
    const i = 0.86 + 0.14 * Math.sin(this.time * 9) * Math.sin(this.time * 3.7), s = 1 - r;
    this.core.material.opacity = 0.4 * e * s * i, this.core.scale.setScalar((0.52 + 0.38 * e) * (1 - r * 0.9)), this.core.position.y = 0.14 + 0.06 * e, this.groundGlow.material.opacity = 0.27 * e * s * i, this.groundGlow.scale.setScalar(0.85 + 0.55 * e);
  }
}
function P(d, t, e, r) {
  let i = [d.clone(), t.clone()], s = d.distanceTo(t) * r;
  for (let o = 0; o < e; o++) {
    const n = [i[0]];
    for (let h = 0; h < i.length - 1; h++) {
      const u = i[h], c = i[h + 1], l = u.clone().add(c).multiplyScalar(0.5);
      l.x += f(-0.5, 0.5) * s, l.z += f(-0.5, 0.5) * s, l.y += f(-0.5, 0.5) * s * 0.25, n.push(l, c);
    }
    i = n, s *= 0.55;
  }
  return i;
}
const z = (
  /* glsl */
  `
  attribute float aSide;
  varying float vSide;
  void main() {
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
), I = (
  /* glsl */
  `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vSide;

  void main() {
    float d = abs(vSide);
    float a = pow(1.0 - d, 2.2);
    vec3 col = mix(uColor, vec3(1.0), pow(1.0 - d, 9.0));
    gl_FragColor = vec4(col, a * uAlpha);
  }
`
);
class x {
  constructor(t) {
    this.maxPts = t, this.pos = new Float32Array(t * 2 * 3);
    const e = new Float32Array(t * 2);
    for (let s = 0; s < t; s++)
      e[s * 2] = -1, e[s * 2 + 1] = 1;
    const r = [];
    for (let s = 0; s < t - 1; s++) {
      const o = s * 2;
      r.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    const i = new a.BufferGeometry();
    i.setAttribute("position", new a.BufferAttribute(this.pos, 3)), i.setAttribute("aSide", new a.BufferAttribute(e, 1)), i.setIndex(r), this.geo = i, this.material = new a.ShaderMaterial({
      uniforms: {
        uColor: { value: new a.Vector3(0.55, 0.78, 1) },
        uAlpha: { value: 0 }
      },
      vertexShader: z,
      fragmentShader: I,
      transparent: !0,
      depthWrite: !1,
      side: a.DoubleSide,
      blending: a.AdditiveBlending
    }), this.mesh = new a.Mesh(i, this.material), this.mesh.frustumCulled = !1;
  }
  setPath(t, e, r) {
    const i = Math.min(t.length, this.maxPts), s = new a.Vector3(), o = new a.Vector3();
    for (let n = 0; n < i; n++) {
      const h = t[n], u = t[Math.max(0, n - 1)], c = t[Math.min(t.length - 1, n + 1)];
      s.subVectors(c, u), s.lengthSq() < 1e-9 && s.set(0, 1, 0), s.normalize(), o.crossVectors(s, r), o.lengthSq() < 1e-9 && o.set(1, 0, 0), o.normalize().multiplyScalar(e);
      const l = n * 6;
      this.pos[l] = h.x + o.x, this.pos[l + 1] = h.y + o.y, this.pos[l + 2] = h.z + o.z, this.pos[l + 3] = h.x - o.x, this.pos[l + 4] = h.y - o.y, this.pos[l + 5] = h.z - o.z;
    }
    this.geo.setDrawRange(0, (i - 1) * 6), this.geo.attributes.position.needsUpdate = !0;
  }
}
class _ extends S {
  constructor(t, e) {
    super(t, 3.6), this.viewDir = new a.Vector3(0, 0.24, 1).normalize();
    const r = C([
      [0, "rgba(255,255,255,1)"],
      [0.25, "rgba(200,225,255,0.55)"],
      [0.62, "rgba(150,190,255,0.12)"],
      [1, "rgba(150,190,255,0)"]
    ]);
    this.mainBolt = new x(64), this.branchA = new x(32), this.branchB = new x(32), this.group.add(this.mainBolt.mesh, this.branchA.mesh, this.branchB.mesh), this.arcs = [];
    for (let l = 0; l < 3; l++) {
      const m = new x(12);
      m.material.uniforms.uColor.value.set(0.5, 0.75, 1), this.group.add(m.mesh), this.arcs.push(m);
    }
    const i = Math.round(620 * e), s = new a.BufferGeometry(), o = new Float32Array(i), n = new Float32Array(i), h = new Float32Array(i), u = new Float32Array(i), c = new Float32Array(i);
    for (let l = 0; l < i; l++)
      o[l] = Math.random(), n[l] = Math.random() * w, h[l] = Math.random(), u[l] = Math.random(), c[l] = f(3.5, 11);
    s.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(i * 3), 3)), s.setAttribute("aSeed", new a.Float32BufferAttribute(o, 1)), s.setAttribute("aAng", new a.Float32BufferAttribute(n, 1)), s.setAttribute("aRad", new a.Float32BufferAttribute(h, 1)), s.setAttribute("aHeight", new a.Float32BufferAttribute(u, 1)), s.setAttribute("aSize", new a.Float32BufferAttribute(c, 1)), this.sparkMat = new a.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uContract: { value: 0 },
        uRadius: { value: g },
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
    }), this.sparks = new a.Points(s, this.sparkMat), this.sparks.frustumCulled = !1, this.group.add(this.sparks), this.ringMat = new a.ShaderMaterial({
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
      new a.TorusGeometry(g, 0.012, 8, 220),
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
    this.strikeTimer = 0.1, this.boltAge = 999, this.arcTimer = 0, this.flashPeak = 0;
    for (const t of [this.mainBolt, this.branchA, this.branchB]) t.material.uniforms.uAlpha.value = 0;
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
    const t = new a.Vector3(f(-0.8, 0.8), f(1.9, 2.5), f(-0.85, 0.75)), e = new a.Vector3(f(-0.1, 0.1), 0.02, f(-0.1, 0.1)), r = P(t, e, 5, 0.2);
    this.mainBolt.setPath(r, 0.026, this.viewDir);
    const i = (s) => {
      const o = Math.floor(f(r.length * 0.15, r.length * 0.6)), n = r[o].clone(), h = new a.Vector3(f(-1, 1), f(-0.75, 0.25), f(-1, 1)).normalize(), u = n.clone().addScaledVector(h, f(0.35, 0.95));
      s.setPath(P(n, u, 4, 0.28), 0.018, this.viewDir);
    };
    i(this.branchA), i(this.branchB), this.boltAge = 0, this.flashPeak = 1, this.flash.position.copy(t), this.flash.scale.setScalar(f(1.3, 2.3));
  }
  buildArc(t) {
    const e = Math.random() * w, r = f(0.35, 0.95), i = [], s = 6;
    for (let o = 0; o <= s; o++) {
      const n = e + r * (o / s), h = g * f(0.94, 1.14);
      i.push(new a.Vector3(
        Math.cos(n) * h,
        f(0, 0.16),
        Math.sin(n) * h
      ));
    }
    t.setPath(i, 0.012, this.viewDir), t.material.uniforms.uAlpha.value = 1, t.mesh.visible = !0;
  }
  update(t) {
    const e = this.t;
    let r, i;
    e < 0 ? (r = 0.34 + 0.05 * Math.sin(this.time * 2.4), i = 0) : (r = v(e / 0.45), i = v((e - 2.45) / 0.95)), e >= 0 && e < 2.5 && (this.strikeTimer -= t, this.strikeTimer <= 0 && (this.strike(), this.strikeTimer = f(0.42, 0.66))), this.boltAge += t;
    const s = 1 - M(this.boltAge / 0.16), o = 0.62 + 0.38 * Math.random(), n = s * o * (1 - i) * (e >= 0 ? 1 : 0);
    for (const h of [this.mainBolt, this.branchA, this.branchB])
      h.material.uniforms.uAlpha.value = n;
    if (this.arcTimer -= t, this.arcTimer <= 0) {
      this.arcTimer = 0.13;
      for (const h of this.arcs)
        e >= 0 && Math.random() < 0.55 && i < 0.9 ? this.buildArc(h) : (h.mesh.visible = !1, h.material.uniforms.uAlpha.value = 0);
    }
    this.flashPeak = Math.max(0, this.flashPeak - t * 5.5), this.flash.material.opacity = this.flashPeak * 0.65, this.groundFlash.material.opacity = this.flashPeak * 0.34, this.groundFlash.scale.setScalar(0.8 + this.flashPeak * 0.6), this.sparkMat.uniforms.uTime.value = this.time, this.sparkMat.uniforms.uGrow.value = r, this.sparkMat.uniforms.uContract.value = i, this.ringMat.uniforms.uTime.value = this.time, this.ringMat.uniforms.uGrow.value = r, this.ringMat.uniforms.uContract.value = i, this.ring.scale.setScalar(1 - i * 0.35);
  }
}
function V() {
  const r = [], i = [], s = [], o = new a.Color(2914877), n = new a.Color(6473066), h = new a.Color(11135645);
  for (let c = 0; c <= 14; c++) {
    const l = c / 14, m = Math.sin(Math.PI * Math.pow(l, 0.68)) * 0.085 * (1 - 0.22 * l) + 12e-4, p = Math.sin(Math.PI * l) * 0.022, y = l * 0.28, b = o.clone().lerp(n, l).lerp(h, l * l).multiplyScalar(0.7), A = o.clone().lerp(n, l).lerp(h, l * l);
    r.push(-m, y, p), i.push(b.r, b.g, b.b), r.push(0, y, p + 8e-3), i.push(A.r, A.g, A.b), r.push(m, y, p), i.push(b.r, b.g, b.b);
  }
  for (let c = 0; c < 14; c++) {
    const l = c * 3, m = l + 3;
    s.push(l, m, l + 1, l + 1, m, m + 1), s.push(l + 1, m + 1, l + 2, l + 2, m + 1, m + 2);
  }
  const u = new a.BufferGeometry();
  return u.setAttribute("position", new a.Float32BufferAttribute(r, 3)), u.setAttribute("color", new a.Float32BufferAttribute(i, 3)), u.setIndex(s), u.computeVertexNormals(), u;
}
class O extends S {
  constructor(t, e) {
    super(t, 4.1), this.count = Math.max(12, Math.round(38 * e)), this.dummy = new a.Object3D();
    const r = V(), i = new a.MeshBasicMaterial({
      vertexColors: !0,
      side: a.DoubleSide
    });
    this.mesh = new a.InstancedMesh(r, i, this.count), this.mesh.frustumCulled = !1, this.group.add(this.mesh), this.leaves = [];
    const s = [10477706, 7327866, 13168778, 5551466, 11065706];
    for (let n = 0; n < this.count; n++)
      this.leaves.push({
        ang: n / this.count * w + f(-0.22, 0.22),
        r: g * f(0.8, 1.38),
        y: f(0.1, 0.78),
        size: f(0.72, 1.55),
        dir: Math.random() < 0.5 ? -1 : 1,
        spinSpd: f(0.35, 0.95),
        bobF: f(1.4, 2.8),
        bobP: Math.random() * w,
        flapF: f(2, 4.2),
        flapP: Math.random() * w,
        tilt: f(-0.5, 0.5),
        spin: f(-1.2, 1.2)
      }), this.mesh.setColorAt(n, new a.Color(s[n % s.length]).multiplyScalar(f(0.85, 1.12)));
    this.mesh.instanceColor.needsUpdate = !0;
    const o = C([
      [0, "rgba(150,240,150,0.35)"],
      [0.5, "rgba(90,200,110,0.12)"],
      [1, "rgba(90,200,110,0)"]
    ]);
    this.groundGlow = new a.Mesh(
      new a.PlaneGeometry(1.8, 1.8),
      new a.MeshBasicMaterial({
        map: o,
        transparent: !0,
        blending: a.AdditiveBlending,
        depthWrite: !1,
        opacity: 0
      })
    ), this.groundGlow.rotation.x = -Math.PI / 2, this.groundGlow.position.y = 4e-3, this.group.add(this.groundGlow);
  }
  update() {
    const t = this.t, e = 2.55, r = 1.45;
    let i;
    t < 0 ? i = 0.62 : i = 1;
    for (let o = 0; o < this.count; o++) {
      const n = this.leaves[o], h = o / this.count, u = t < 0 ? 0.62 : v((t - h * 0.3) / 0.45);
      let c = 0;
      t >= e && (c = M((t - e - h * 0.5 * r) / (0.5 * r)));
      const l = T(c), m = n.r * (1 - l * 0.995), p = n.ang + this.time * n.spinSpd * n.dir * (1 + l * 4), y = Math.cos(p) * m, b = Math.sin(p) * m, A = Math.sin(this.time * n.bobF + n.bobP) * 0.055, F = (n.y + A) * (1 - l) + -0.14 * l, R = n.size * u * (1 - l * l) * i;
      this.dummy.position.set(y, F, b), this.dummy.rotation.set(
        n.tilt + Math.sin(this.time * n.flapF + n.flapP) * 0.55 + l * 2.2,
        p + Math.PI * 0.5 + this.time * n.spin * (1 + l * 2),
        Math.sin(this.time * n.flapF * 0.7 + n.flapP) * 0.65
      ), this.dummy.scale.setScalar(R), this.dummy.updateMatrix(), this.mesh.setMatrixAt(o, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = !0;
    const s = t < 0 ? 0.18 : v(t / 0.7) * (1 - v((t - e) / r));
    this.groundGlow.material.opacity = 0.3 * s;
  }
}
function D(d, t, e, r) {
  const i = [], s = [], o = [];
  for (let h = 0; h <= e; h++) {
    const u = h / e, c = -1 * u * w + Math.PI * 0.5, l = Math.cos(c), m = Math.sin(c);
    i.push(l * d, 0, m * d, l * t, 0, m * t), s.push(u, 0, u, 1);
  }
  for (let h = 0; h < e; h++) {
    const u = h * 2;
    o.push(u, u + 2, u + 1, u + 1, u + 2, u + 3);
  }
  const n = new a.BufferGeometry();
  return n.setAttribute("position", new a.Float32BufferAttribute(i, 3)), n.setAttribute("uv", new a.Float32BufferAttribute(s, 2)), n.setIndex(o), n;
}
class U extends S {
  constructor(t, e) {
    super(t, 3.9), this.count = Math.max(24, Math.round(84 * e)), this.freezeDur = 1.65, this.holdEnd = 2.3, this.dummy = new a.Object3D();
    const r = new a.OctahedronGeometry(1, 0);
    r.scale(0.055, 0.155, 0.055);
    const i = new a.MeshBasicMaterial({
      color: 13168639,
      transparent: !0,
      opacity: 0.95
    });
    this.shards = new a.InstancedMesh(r, i, this.count), this.shards.frustumCulled = !1, this.group.add(this.shards), this.shardParams = [];
    const s = [12446463, 10475775, 14874879, 8833518];
    for (let l = 0; l < this.count; l++)
      this.shardParams.push({
        rj: f(-0.05, 0.06),
        y: f(0, 0.1),
        sx: f(0.75, 1.45),
        sy: f(0.65, 1.75),
        sz: f(0.75, 1.45),
        rx: f(-0.35, 0.35),
        rz: f(-0.35, 0.35),
        spin: f(-1.1, 1.1)
      }), this.shards.setColorAt(l, new a.Color(s[l % s.length]));
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
      D(g * 0.74, g * 1.26, 160),
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
    const o = Math.round(900 * e), n = new a.BufferGeometry(), h = new Float32Array(o), u = new Float32Array(o), c = new Float32Array(o * 3);
    for (let l = 0; l < o; l++)
      h[l] = Math.floor(Math.random() * this.count) / this.count, u[l] = Math.random(), c[l * 3] = f(-0.09, 0.09), c[l * 3 + 1] = f(0, 0.22), c[l * 3 + 2] = f(-0.09, 0.09);
    n.setAttribute("position", new a.Float32BufferAttribute(new Float32Array(o * 3), 3)), n.setAttribute("aShard", new a.Float32BufferAttribute(h, 1)), n.setAttribute("aSeed", new a.Float32BufferAttribute(u, 1)), n.setAttribute("aOff", new a.Float32BufferAttribute(c, 3)), this.dustMat = new a.ShaderMaterial({
      uniforms: {
        uCrack: { value: 0 },
        uRadius: { value: g },
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
    }), this.dust = new a.Points(n, this.dustMat), this.dust.frustumCulled = !1, this.group.add(this.dust);
  }
  onResize(t) {
    this.dustMat.uniforms.uPixelRatio.value = t;
  }
  update() {
    const t = this.t;
    let e, r;
    t < 0 ? (e = 0.22 + 0.04 * Math.sin(this.time * 1.6), r = 0) : (e = v(t / this.freezeDur), r = v((t - this.holdEnd) / 1.25) * 1.14);
    for (let s = 0; s < this.count; s++) {
      const o = s / this.count, n = Math.PI * 0.5 - o * w, h = this.shardParams[s], u = M((e - o) / 0.045), c = v((r - o) / 0.12), l = 1 + 0.42 * Math.sin(M((e - o) / 0.14) * Math.PI), m = 0.88 + 0.12 * Math.sin(this.time * 3.1 + s), p = u * (1 - c) * l * m;
      this.dummy.position.set(
        Math.cos(n) * (g + h.rj) * (1 - c * 0.8),
        (0.02 + h.y * u) * (1 - c) - c * 0.12,
        Math.sin(n) * (g + h.rj) * (1 - c * 0.8)
      ), this.dummy.rotation.set(
        h.rx + this.time * h.spin * 0.35,
        -n + this.time * h.spin,
        h.rz
      ), this.dummy.scale.set(h.sx * p, h.sy * p, h.sz * p), this.dummy.updateMatrix(), this.shards.setMatrixAt(s, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = !0, this.sweepMat.uniforms.uFront.value = e, this.sweepMat.uniforms.uCrack.value = r, this.sweepMat.uniforms.uTime.value = this.time, this.sweepMat.uniforms.uOpacity.value = 1 - v(r * 1.15);
    const i = t < 0 ? 0.1 : v(e) * (1 - v(r));
    this.frost.material.opacity = 0.55 * i, this.frost.scale.setScalar(0.9 + 0.25 * e), this.dustMat.uniforms.uCrack.value = r, this.dustMat.uniforms.uTime.value = this.time;
  }
}
const W = { low: 0.35, medium: 0.65, high: 1 }, N = {
  fire: (d, t) => new E(d, t),
  thunder: (d, t) => new _(d, t),
  grass: (d, t) => new O(d, t),
  ice: (d, t) => new U(d, t)
};
class H {
  constructor(t, e = {}) {
    if (this.pools = /* @__PURE__ */ new Map(), this.playing = /* @__PURE__ */ new Map(), this.disposed = !1, this.parent = t, this.density = W[e.quality ?? "high"], !this.density) throw new Error("Unknown effect quality");
    this.pixelRatio = this.validatePixelRatio(e.pixelRatio ?? 1), this.camera = e.camera;
  }
  play(t, e = {}) {
    this.assertAlive();
    const r = N[t];
    if (!r) throw new Error(`Unknown pocket effect: ${String(t)}`);
    const i = e.radius ?? g;
    if (!Number.isFinite(i) || i <= 0) throw new Error("radius must be a positive finite number");
    if (e.duration !== void 0 && (!Number.isFinite(e.duration) || e.duration <= 0))
      throw new Error("duration must be a positive finite number");
    if (e.rotation !== void 0 && !Number.isFinite(e.rotation)) throw new Error("rotation must be finite");
    if (e.position && ![e.position.x, e.position.y, e.position.z].every(Number.isFinite))
      throw new Error("position must contain finite x, y and z values");
    let s = this.pools.get(t);
    s || (s = [], this.pools.set(t, s));
    let o = s.find((c) => !this.playing.has(c));
    o || (o = r(this.parent, this.density), o.onResize(this.pixelRatio), s.push(o));
    const n = e.position ?? { x: 0, y: 0, z: 0 };
    o.group.position.set(n.x, n.y, n.z), o.group.rotation.set(0, e.rotation ?? 0, 0), o.group.scale.setScalar(i / g), o.onCamera(this.camera);
    const h = { effect: o, speed: o.duration / (e.duration ?? o.duration), onComplete: e.onComplete };
    this.playing.set(o, h), o.play();
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
    for (const [r, i] of Array.from(this.playing.entries()))
      this.playing.get(r) === i && (r.onCamera(this.camera), r.tick(t * i.speed) && (this.playing.delete(r), i.onComplete && e.push(i.onComplete)));
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
    for (const i of this.pools.values()) for (const s of i)
      s.stop(), s.group.traverse((o) => {
        const n = o;
        if (n.geometry && !o.isSprite && t.add(n.geometry), n.material) {
          const h = Array.isArray(n.material) ? n.material : [n.material];
          for (const u of h) {
            e.add(u);
            for (const c of Object.values(u)) c instanceof a.Texture && r.add(c);
            if (u instanceof a.ShaderMaterial)
              for (const c of Object.values(u.uniforms)) c.value instanceof a.Texture && r.add(c.value);
          }
        }
      }), s.group.removeFromParent();
    t.forEach((i) => i.dispose()), e.forEach((i) => i.dispose()), r.forEach((i) => i.dispose()), this.pools.clear();
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
  H as PocketEffects
};
