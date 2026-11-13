/**
 * Power Charge · inverted trapezoid charge-meter effect.
 * Standalone Canvas 2D HUD (no WebGL context or external dependencies).
 *
 * Usage in another page:
 *   import { PowerChargeMeter } from './charge-meter.js';
 *   const meter = new PowerChargeMeter({
 *     canvas: document.querySelector('canvas'),
 *     surface: document.querySelector('.energy-slot'),
 *     onUpdate: ({ progress, phase, remaining }) => {},
 *     onPhaseChange: (phase) => {},
 *   });
 *   meter.setCharge(0.5); // range 0–1
 *   meter.autoCharge();
 *   meter.reset();
 *   meter.destroy();
 */
const W = 320;
const H = 680;
const TOP = 24;
const BOTTOM = 656;
const SPAN = BOTTOM - TOP;
const SEGMENTS = 10;
const SEGMENT_GAP = 9;
const SEGMENT_HEIGHT = SPAN / SEGMENTS;
// Always-visible cool-to-warm palette. Each cell has its own gap and frame.
const SEGMENT_COLORS = [
  '#77f8e6', '#53e0f0', '#37bbeb', '#488ee0', '#687bcd',
  '#a276bb', '#cc8b9f', '#e5a47b', '#f69155', '#fa6147',
];
const HOLD_MS = 1500;
const BURST_MS = 1450;
const RESET_MS = 480;
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const random = (a, b) => a + Math.random() * (b - a);

function halfWidthAt(y) {
  return 22.5 + 27.5 * clamp((y - TOP) / SPAN);
}

function segmentBounds(i) {
  const y1 = TOP + i * SEGMENT_HEIGHT + (i === 0 ? 0 : SEGMENT_GAP / 2);
  const y2 = TOP + (i + 1) * SEGMENT_HEIGHT - (i === SEGMENTS - 1 ? 0 : SEGMENT_GAP / 2);
  return { y1, y2, left1: W / 2 - halfWidthAt(y1), right1: W / 2 + halfWidthAt(y1),
    left2: W / 2 - halfWidthAt(y2), right2: W / 2 + halfWidthAt(y2) };
}

function addSegmentPath(ctx, i) {
  const { y1, y2, left1, right1, left2, right2 } = segmentBounds(i);
  ctx.moveTo(left1, y1);
  ctx.lineTo(right1, y1);
  ctx.lineTo(right2, y2);
  ctx.lineTo(left2, y2);
  ctx.closePath();
}

function segmentedPath(ctx) {
  ctx.beginPath();
  for (let i = 0; i < SEGMENTS; i++) addSegmentPath(ctx, i);
}

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * TAU + random(-0.14, 0.14),
    speed: random(200, 730),
    start: random(0, 0.17),
    size: random(1.5, 5.9),
    hue: random(10, 54),
    bend: random(-45, 45),
    flare: Math.random() > 0.66,
  }));
}

export class PowerChargeMeter {
  constructor({ canvas, surface, burstCanvas = null, onUpdate = () => {}, onPhaseChange = () => {} }) {
    if (!(canvas instanceof HTMLCanvasElement) || !(surface instanceof HTMLElement)) {
      throw new TypeError('PowerChargeMeter requires a canvas and an interaction surface.');
    }
    this.canvas = canvas;
    this.surface = surface;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('This browser does not support Canvas 2D.');
    this.burstCanvas = burstCanvas instanceof HTMLCanvasElement ? burstCanvas : null;
    this.burstCtx = this.burstCanvas?.getContext('2d', { alpha: true }) ?? null;
    this.onUpdate = onUpdate;
    this.onPhaseChange = onPhaseChange;
    this.progress = 0;
    this.phase = 'idle'; // idle | charging | hold | burst | clearing
    this.holdElapsed = 0;
    this.burstElapsed = 0;
    this.resetElapsed = 0;
    this.auto = null;
    this.dragging = false;
    this.pointerId = null;
    this.clock = 0;
    this.lastFrame = performance.now();
    this.disposed = false;
    this.particles = makeParticles(240);
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.handleDown = this.pointerDown.bind(this);
    this.handleMove = this.pointerMove.bind(this);
    this.handleUp = this.pointerUp.bind(this);
    this.handleKey = this.keyDown.bind(this);
    this.handleResize = this.resize.bind(this);
    this.handleVisibility = () => { this.lastFrame = performance.now(); };
    surface.addEventListener('pointerdown', this.handleDown);
    surface.addEventListener('pointermove', this.handleMove);
    surface.addEventListener('pointerup', this.handleUp);
    surface.addEventListener('pointercancel', this.handleUp);
    surface.addEventListener('lostpointercapture', this.handleUp);
    surface.addEventListener('keydown', this.handleKey);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.resize();
    this.loop = this.loop.bind(this);
    this.frameId = requestAnimationFrame(this.loop);
    this.publish();
  }

  get remaining() {
    return this.phase === 'hold' ? Math.max(0, HOLD_MS - this.holdElapsed) / 1000 : 1.5;
  }

  get locked() {
    return this.phase === 'hold' || this.phase === 'burst' || this.phase === 'clearing';
  }

  changePhase(next) {
    if (next === this.phase) return;
    this.phase = next;
    this.surface.classList.toggle('is-overdrive', next === 'hold');
    this.surface.classList.toggle('is-burst', next === 'burst');
    this.surface.closest('.visual-body')?.classList.toggle('is-blasting', next === 'burst');
    this.onPhaseChange(next);
  }

  releasePointer() {
    if (this.pointerId !== null && this.surface.hasPointerCapture(this.pointerId)) {
      this.surface.releasePointerCapture(this.pointerId);
    }
    this.dragging = false;
    this.pointerId = null;
  }

  setCharge(value) {
    if (this.locked || this.disposed) return false;
    this.progress = clamp(Number(value) || 0);
    this.changePhase(this.progress > 0 ? 'charging' : 'idle');
    if (this.progress >= 1) {
      this.progress = 1;
      this.auto = null;
      this.releasePointer();
      this.holdElapsed = 0;
      this.changePhase('hold');
    }
    this.publish();
    return true;
  }

  autoCharge() {
    if (this.locked || this.disposed) return false;
    this.releasePointer();
    this.auto = {
      start: this.progress,
      elapsed: 0,
      duration: Math.max(300, 1500 * (1 - this.progress)),
    };
    this.changePhase('charging');
    return true;
  }

  reset() {
    if (this.disposed) return;
    this.releasePointer();
    this.auto = null;
    this.progress = 0;
    this.holdElapsed = 0;
    this.burstElapsed = 0;
    this.resetElapsed = 0;
    this.changePhase('idle');
    this.publish();
  }

  pointerDown(e) {
    if (this.locked || this.disposed || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    this.auto = null;
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.dragStartY = e.clientY;
    this.dragStartValue = this.progress;
    // Use the top of the lowest red cell as the physical end of the gesture.
    // Starting a drag in that cell is an immediate 100% charge.
    const bounds = this.surface.getBoundingClientRect();
    this.dragFinishY = bounds.top + bounds.height * segmentBounds(SEGMENTS - 1).y1 / H;
    // Pointer input should not produce a rectangular focus outline around the canvas.
    // The slider remains keyboard-focusable via Tab and its arrow-key controls.
    this.surface.setPointerCapture(e.pointerId);
    this.changePhase('charging');
    if (e.clientY >= this.dragFinishY) this.setCharge(1);
  }

  pointerMove(e) {
    if (!this.dragging || this.pointerId !== e.pointerId) return;
    e.preventDefault();
    // Reaching any point in the lowest (red) segment completes the charge.
    // This removes the need to drag past the segment to the canvas bottom.
    const travel = Math.max(1, this.dragFinishY - this.dragStartY);
    const fraction = (e.clientY - this.dragStartY) / travel;
    this.setCharge(this.dragStartValue + (1 - this.dragStartValue) * fraction);
  }

  pointerUp(e) {
    if (this.pointerId !== e.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    if (this.surface.hasPointerCapture(e.pointerId)) this.surface.releasePointerCapture(e.pointerId);
    if (this.progress === 0 && this.phase === 'charging' && !this.auto) this.changePhase('idle');
  }

  keyDown(e) {
    if (this.locked) return;
    let value = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') value = this.progress + 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') value = this.progress - 0.05;
    if (e.key === 'PageDown') value = this.progress + 0.2;
    if (e.key === 'PageUp') value = this.progress - 0.2;
    if (e.key === 'Home') value = 0;
    if (e.key === 'End') value = 1;
    if (value !== null) {
      e.preventDefault();
      this.auto = null;
      this.setCharge(value);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.autoCharge();
    }
  }

  resize() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    this.canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    this.ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    if (this.burstCtx) {
      const overlay = this.burstCanvas.getBoundingClientRect();
      this.burstCanvas.width = Math.max(1, Math.round(overlay.width * dpr));
      this.burstCanvas.height = Math.max(1, Math.round(overlay.height * dpr));
      this.burstCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  publish() {
    const percent = Math.round(this.progress * 100);
    this.surface.setAttribute('aria-valuenow', String(percent));
    this.surface.setAttribute('aria-valuetext',
      this.phase === 'hold'
        ? '满槽震动，剩余 ' + this.remaining.toFixed(1) + ' 秒'
        : this.phase === 'burst' ? '能量正在爆炸'
        : this.phase === 'clearing' ? '能量清空中'
        : percent + '% 力量');
    this.onUpdate({ progress: this.progress, percent, phase: this.phase, remaining: this.remaining, holdElapsed: this.holdElapsed });
  }

  loop(now) {
    if (this.disposed) return;
    const delta = document.hidden ? 0 : Math.max(0, Math.min(now - this.lastFrame, 60));
    this.lastFrame = now;
    this.clock += delta;

    if (this.auto && this.phase === 'charging') {
      this.auto.elapsed += delta;
      const t = clamp(this.auto.elapsed / this.auto.duration);
      const value = this.auto.start + (1 - this.auto.start) * smooth(t);
      this.setCharge(t === 1 ? 1 : value);
    } else if (this.phase === 'hold') {
      this.holdElapsed += delta;
      if (this.holdElapsed >= HOLD_MS) {
        this.holdElapsed = HOLD_MS;
        this.burstElapsed = 0;
        this.particles = makeParticles(this.reduceMotion ? 55 : 240);
        this.changePhase('burst');
      }
    } else if (this.phase === 'burst') {
      this.burstElapsed += delta;
      if (this.burstElapsed >= BURST_MS) {
        this.burstElapsed = BURST_MS;
        this.resetElapsed = 0;
        this.changePhase('clearing');
      }
    } else if (this.phase === 'clearing') {
      this.resetElapsed += delta;
      this.progress = 1 - smooth(this.resetElapsed / RESET_MS);
      if (this.resetElapsed >= RESET_MS) {
        this.progress = 0;
        this.changePhase('idle');
      }
    }
    this.paint();
    this.publish();
    this.frameId = requestAnimationFrame(this.loop);
  }

  paint() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    const time = this.clock / 1000;

    // Ten disjoint trapezoid cells form a single clipping mask.
    // This also keeps the explosion *inside* the cells and off their gaps.
    ctx.save();
    segmentedPath(ctx);
    ctx.shadowColor = '#00eadc';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#111c25';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();

    // Even at zero power, the ten colored levels are visible in a muted state.
    // Charging simply lights the same cool-to-warm cells at higher intensity.
    for (let i = 0; i < SEGMENTS; i++) {
      const { y1, y2 } = segmentBounds(i);
      ctx.save();
      ctx.beginPath();
      addSegmentPath(ctx, i);
      const idle = ctx.createLinearGradient(0, y1, 0, y2);
      idle.addColorStop(0, SEGMENT_COLORS[i]);
      idle.addColorStop(1, '#12202a');
      ctx.fillStyle = idle;
      ctx.globalAlpha = .36;
      ctx.fill();
      ctx.restore();
    }

    if (this.progress > 0) this.paintCharge(ctx, time);
    if (this.phase === 'hold') this.paintOverdrive(ctx, time);
    if (this.phase === 'burst') this.paintBurst(ctx);
    if (this.phase === 'clearing') {
      ctx.fillStyle = 'rgba(6,17,23,' + (0.45 * smooth(this.resetElapsed / RESET_MS)) + ')';
      ctx.fillRect(0, TOP, W, SPAN);
    }
    ctx.restore();

    // Independent faceted outlines emphasize the ten distinct cells.
    // No continuous outside rim: the small dark gaps must remain obvious.
    ctx.save();
    for (let i = 0; i < SEGMENTS; i++) {
      const isLit = this.progress > i / SEGMENTS;
      const isHot = this.phase === 'hold' || this.phase === 'burst';
      ctx.beginPath();
      addSegmentPath(ctx, i);
      ctx.lineWidth = isLit ? 2.8 : 1.8;
      ctx.strokeStyle = isHot ? '#ffcf99' : isLit ? SEGMENT_COLORS[i] : 'rgba(148,196,202,.57)';
      ctx.shadowColor = isHot ? '#ff905c' : SEGMENT_COLORS[i];
      ctx.shadowBlur = isHot ? 18 : isLit ? 9 : 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isLit ? 'rgba(255,255,255,.35)' : 'rgba(228,248,255,.09)';
      ctx.lineWidth = .8;
      ctx.stroke();
    }
    ctx.restore();
    // Burst graphics are drawn in the full-scene overlay, not the segmented mask.
    // In embedded HUDs without an overlay, still allow a smaller outward blast.
    if (this.phase === 'burst' && !this.burstCtx) this.paintExteriorBurst(ctx, W / 2, 398, .6);
    this.paintOverlay();
  }

  paintCharge(ctx, time) {
    // No rectangular progress clip or illuminated rectangular moving boundary.
    // Each of the ten trapezoid cells brightens independently. The geometry
    // remains segmented even at fractional charge values.
    const count = this.reduceMotion ? 3 : 8;
    for (let i = 0; i < SEGMENTS; i++) {
      const power = clamp(this.progress * SEGMENTS - i);
      if (!power) continue;
      const { y1, y2 } = segmentBounds(i);
      ctx.save();
      ctx.beginPath();
      addSegmentPath(ctx, i);
      ctx.clip();
      const light = ctx.createLinearGradient(0, y1, 0, y2);
      light.addColorStop(0, '#ffffff');
      light.addColorStop(.22, SEGMENT_COLORS[i]);
      light.addColorStop(1, SEGMENT_COLORS[i]);
      ctx.globalAlpha = power * (.75 + .08 * Math.sin(time * 11 + i));
      ctx.fillStyle = light;
      ctx.fill();
      ctx.globalAlpha = .38 * power;
      ctx.globalCompositeOperation = 'screen';
      const sweep = y1 + ((time * 50 + i * 29) % Math.max(1, y2 - y1));
      ctx.fillStyle = 'rgba(244,255,246,.42)';
      ctx.fillRect(W / 2 - halfWidthAt(sweep), sweep, halfWidthAt(sweep) * 2, 1.2);
      ctx.globalAlpha = .78 * power;
      for (let j = 0; j < count; j++) {
        const seed = j * 24.37 + i * 53.1;
        const y = y1 + ((j * 17 + time * (24 + j * 9)) % (y2 - y1));
        const x = W / 2 + Math.sin(seed + time * (1 + j % 3)) * halfWidthAt(y) * .68;
        ctx.fillStyle = 'rgba(255,255,228,.85)';
        ctx.fillRect(x, y, 1.3, 2 + j % 3);
      }
      ctx.restore();
    }
  }

  paintOverdrive(ctx, time) {
    const sec = this.holdElapsed / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(time * 32);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bright = ctx.createRadialGradient(160, 401, 5, 160, 401, 260);
    bright.addColorStop(0, 'rgba(255,255,232,' + (0.26 + pulse * 0.46) + ')');
    bright.addColorStop(.5, 'rgba(255,161,59,' + (0.16 + pulse * .24) + ')');
    bright.addColorStop(1, 'rgba(255,71,23,0)');
    ctx.fillStyle = bright;
    ctx.fillRect(0, TOP, W, SPAN);

    // Increasingly unstable electrical strokes, but always clipped to the slot.
    const lines = this.reduceMotion ? 5 : 16;
    for (let i = 0; i < lines; i++) {
      const seed = i * 1.79;
      const sy = TOP + (i / lines) * SPAN + Math.sin(time * 18 + seed) * 12;
      let x = 160 + Math.sin(seed * 13 + time * 5) * 35;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      for (let j = 0; j < 5; j++) {
        x += Math.sin(seed * 2 + j * 7 + time * 19) * 18;
        ctx.lineTo(x, sy + j * 12);
      }
      ctx.strokeStyle = i % 3 ? 'rgba(255,233,164,.46)' : 'rgba(255,255,255,.85)';
      ctx.lineWidth = i % 5 ? 1 : 2.5;
      ctx.stroke();
    }
    if (sec > 1.0) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((sec - 1.0) / 0.5 * 0.27) + ')';
      ctx.fillRect(0, TOP, W, SPAN);
    }
    ctx.restore();
  }

  paintBurst(ctx) {
    const t = clamp(this.burstElapsed / BURST_MS);
    const cx = 160, cy = 401;
    const fade = 1 - smooth((t - 0.27) / 0.73);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Flash, incandescent core, two shock rings and radial debris.
    const flash = Math.pow(1 - t, 8);
    ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.82) + ')';
    ctx.fillRect(0, TOP, W, SPAN);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280 * easeOut(t) + 3);
    core.addColorStop(0, 'rgba(255,255,239,' + fade + ')');
    core.addColorStop(.20, 'rgba(255,219,115,' + fade * .88 + ')');
    core.addColorStop(.48, 'rgba(255,93,38,' + fade * .72 + ')');
    core.addColorStop(1, 'rgba(255,40,37,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, TOP, W, SPAN);

    for (let k = 0; k < 2; k++) {
      const r = (t * 400 - k * 92);
      if (r <= 0) continue;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * .88, r * 1.25, 0, 0, TAU);
      ctx.lineWidth = (1 - t) * (k ? 6 : 11) + 1;
      ctx.strokeStyle = 'rgba(255,' + (k ? '235,169' : '250,218') + ',' + (fade * (k ? .74 : 1)) + ')';
      ctx.shadowColor = '#ffa64e';
      ctx.shadowBlur = 20;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const amount = this.reduceMotion ? 55 : this.particles.length;
    for (let i = 0; i < amount; i++) {
      const p = this.particles[i];
      const life = clamp((t - p.start) / (1 - p.start));
      if (!life || life >= 1) continue;
      const d = p.speed * life * 1.35;
      const x = cx + Math.cos(p.angle) * d + p.bend * life * life;
      const y = cy + Math.sin(p.angle) * d * 1.55 + 30 * life * life;
      const opacity = Math.pow(1 - life, 1.3) * fade;
      const tail = 10 + 34 * (1 - life);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(p.angle) * tail, y - Math.sin(p.angle) * tail * 1.4);
      ctx.strokeStyle = 'hsla(' + p.hue + ',100%,' + (p.flare ? 92 : 66) + '%,' + opacity + ')';
      ctx.lineWidth = p.size * (1 - life * .6);
      ctx.stroke();
      if (p.flare) {
        ctx.beginPath();
        ctx.arc(x, y, p.size * .75, 0, TAU);
        ctx.fillStyle = 'rgba(255,253,219,' + opacity + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  paintOverlay() {
    if (!this.burstCtx) return;
    const ctx = this.burstCtx;
    const r = this.burstCanvas.getBoundingClientRect();
    // Pixel sizes are scaled by resize() to the current devicePixelRatio.
    ctx.clearRect(0, 0, r.width, r.height);
    if (this.phase !== 'burst') return;
    const meter = this.surface.getBoundingClientRect();
    const centerX = meter.left - r.left + meter.width * .5;
    const centerY = meter.top - r.top + meter.height * (398 / H);
    this.paintExteriorBurst(ctx, centerX, centerY, Math.max(.7, Math.min(1.3, r.width / 670)));
  }

  paintExteriorBurst(ctx, cx, cy, scale) {
    const t = clamp(this.burstElapsed / BURST_MS);
    const fade = 1 - smooth((t - .31) / .69);
    const entry = easeOut(t);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Oversized orange-white blast halo, extending far beyond the narrow meter.
    const glowRadius = (85 + 320 * entry) * scale;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    halo.addColorStop(0, 'rgba(255,255,241,' + (.94 * fade) + ')');
    halo.addColorStop(.12, 'rgba(255,229,146,' + (.76 * fade) + ')');
    halo.addColorStop(.37, 'rgba(255,131,47,' + (.56 * fade) + ')');
    halo.addColorStop(.72, 'rgba(245,43,39,' + (.27 * fade) + ')');
    halo.addColorStop(1, 'rgba(250,42,35,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2);

    // Three huge expanding rings. No clipping: these pass into the surroundings.
    for (let ring = 0; ring < 3; ring++) {
      const p = clamp((t - ring * .09) / (1 - ring * .09));
      if (t < ring * .09) continue;
      const radius = (24 + easeOut(p) * (280 + ring * 85)) * scale;
      const opacity = (1 - smooth(p)) * (ring === 0 ? .95 : .7);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.lineWidth = (8 - ring * 1.6) * (1 - p * .68) * scale;
      ctx.strokeStyle = 'rgba(255,' + (ring === 1 ? '244,173' : '167,75') + ',' + opacity + ')';
      ctx.shadowColor = '#ff7f36';
      ctx.shadowBlur = 25 * scale;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Long flame-like radial spikes add a strong outward impact silhouette.
    const rays = this.reduceMotion ? 10 : 22;
    for (let i = 0; i < rays; i++) {
      const a = i / rays * TAU + Math.sin(i * 71.1) * .09;
      const inner = (9 + 24 * entry) * scale;
      const outer = (85 + (180 + (i * 37) % 190) * entry) * scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a + .01) * outer, cy + Math.sin(a + .01) * outer);
      ctx.lineWidth = (1 + i % 4 * 1.2) * (1 - t * .55) * scale;
      ctx.strokeStyle = 'rgba(255,' + (i % 3 ? '177,69' : '253,198') + ',' + (fade * (i % 3 ? .78 : 1)) + ')';
      ctx.stroke();
    }

    // Ejected debris travels outside the cell mask with fading fiery trails.
    const particles = this.reduceMotion ? 55 : this.particles.length;
    for (let i = 0; i < particles; i++) {
      const p = this.particles[i];
      const life = clamp((t - p.start) / (1 - p.start));
      if (life <= 0 || life >= 1) continue;
      const speed = p.speed * life * 1.2 * scale;
      const x = cx + Math.cos(p.angle) * speed + p.bend * life * life;
      const y = cy + Math.sin(p.angle) * speed * .92 + p.bend * .2 * life;
      const opacity = Math.pow(1 - life, 1.5) * fade;
      const trail = (12 + 65 * (1 - life)) * scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(p.angle) * trail, y - Math.sin(p.angle) * trail * .92);
      ctx.lineWidth = p.size * (1 - life * .67) * scale;
      ctx.strokeStyle = 'hsla(' + p.hue + ',100%,' + (p.flare ? 94 : 67) + '%,' + opacity + ')';
      ctx.stroke();
    }
    ctx.restore();
  }

  destroy() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.surface.removeEventListener('pointerdown', this.handleDown);
    this.surface.removeEventListener('pointermove', this.handleMove);
    this.surface.removeEventListener('pointerup', this.handleUp);
    this.surface.removeEventListener('pointercancel', this.handleUp);
    this.surface.removeEventListener('lostpointercapture', this.handleUp);
    this.surface.removeEventListener('keydown', this.handleKey);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}

// Page wiring. Importing this module into another app without these demo
// elements leaves the reusable class untouched.
const canvas = document.querySelector('#energy-canvas');
const surface = document.querySelector('#energy-slot');
if (canvas && surface) {
  const percent = document.querySelector('#percent');
  const status = document.querySelector('#status');
  const stageCode = document.querySelector('#stage-code');
  const countdown = document.querySelector('#countdown');
  const holdLabel = document.querySelector('#hold-label');
  const timeProgress = document.querySelector('#time-progress');
  const instruction = document.querySelector('#visual-instruction');
  const hint = document.querySelector('#drag-hint');
  const liveStatus = document.querySelector('#live-status');
  const autoButton = document.querySelector('#auto-demo');
  const resetButton = document.querySelector('#reset');
  const phases = [...document.querySelectorAll('.phase')];
  const text = {
    idle: ['等待蓄力', 'STANDBY', '向下拖动 · 注入能量'],
    charging: ['能量注入中', 'CHARGING', '继续下拉 · 直至 100%'],
    hold: ['超载临界！', 'OVERDRIVE', '临界震动 · 1.5 秒后爆炸'],
    burst: ['能量爆炸！', 'DETONATION', '冲击波爆发 · 向槽外扩散'],
    clearing: ['清空复位', 'RESETTING', '能量归零 · 准备下一击'],
  };
  const names = ['charge', 'hold', 'burst', 'clear'];
  const current = { idle: 0, charging: 0, hold: 1, burst: 2, clearing: 3 };
  let previousPhase = 'idle';

  const meter = new PowerChargeMeter({
    canvas,
    surface,
    burstCanvas: document.querySelector('#burst-canvas'),
    onUpdate({ progress, percent: p, phase, remaining, holdElapsed }) {
      percent.textContent = String(p).padStart(3, '0');
      status.textContent = text[phase][0];
      stageCode.textContent = text[phase][1];
      instruction.textContent = text[phase][2];
      holdLabel.textContent = phase === 'hold' ? '高能锁定 / 即将释放' : phase === 'burst' ? '检测到能量爆裂' : '满槽后自动倒计时';
      countdown.innerHTML = (phase === 'hold' ? remaining.toFixed(1) : '1.5') + '<span>S</span>';
      timeProgress.style.width = (phase === 'hold' ? (holdElapsed / HOLD_MS) * 100 : phase === 'burst' ? 100 : 0) + '%';
      phases.forEach((el, index) => {
        el.classList.toggle('active', index === current[phase]);
        el.classList.toggle('passed', phase !== 'idle' && index < current[phase]);
      });
      hint.classList.toggle('is-hidden', progress > .015 || phase === 'hold' || phase === 'burst' || phase === 'clearing');
      autoButton.disabled = phase === 'hold' || phase === 'burst' || phase === 'clearing';
      if (phase !== previousPhase) {
        previousPhase = phase;
        liveStatus.textContent = text[phase][0];
      }
    }
  });

  autoButton.addEventListener('click', () => meter.autoCharge());
  resetButton.addEventListener('click', () => meter.reset());
  // Expose a convenient opt-in reference for game prototype debugging.
  window.powerChargeDemo = meter;
}
