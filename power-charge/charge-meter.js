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
const H = 520;
const TOP = 26;
const BOTTOM = 494;
const SPAN = BOTTOM - TOP;
const HOLD_MS = 3000;
const BURST_MS = 1200;
const RESET_MS = 480;
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const random = (a, b) => a + Math.random() * (b - a);

function trapezoid(ctx) {
  ctx.beginPath();
  ctx.moveTo(116, TOP);
  ctx.lineTo(204, TOP);
  ctx.lineTo(294, BOTTOM);
  ctx.lineTo(26, BOTTOM);
  ctx.closePath();
}

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * TAU + random(-0.14, 0.14),
    speed: random(95, 400),
    start: random(0, 0.17),
    size: random(1.1, 4.8),
    hue: random(10, 54),
    bend: random(-45, 45),
    flare: Math.random() > 0.66,
  }));
}

export class PowerChargeMeter {
  constructor({ canvas, surface, onUpdate = () => {}, onPhaseChange = () => {} }) {
    if (!(canvas instanceof HTMLCanvasElement) || !(surface instanceof HTMLElement)) {
      throw new TypeError('PowerChargeMeter requires a canvas and an interaction surface.');
    }
    this.canvas = canvas;
    this.surface = surface;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('This browser does not support Canvas 2D.');
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
    this.particles = makeParticles(140);
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
    return this.phase === 'hold' ? Math.max(0, HOLD_MS - this.holdElapsed) / 1000 : 3;
  }

  get locked() {
    return this.phase === 'hold' || this.phase === 'burst' || this.phase === 'clearing';
  }

  changePhase(next) {
    if (next === this.phase) return;
    this.phase = next;
    this.surface.classList.toggle('is-overdrive', next === 'hold');
    this.surface.classList.toggle('is-burst', next === 'burst');
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
      duration: Math.max(400, 1750 * (1 - this.progress)),
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
    this.surface.focus({ preventScroll: true });
    this.surface.setPointerCapture(e.pointerId);
    this.changePhase('charging');
  }

  pointerMove(e) {
    if (!this.dragging || this.pointerId !== e.pointerId) return;
    e.preventDefault();
    const travel = this.surface.getBoundingClientRect().height || 1;
    this.setCharge(this.dragStartValue + (e.clientY - this.dragStartY) / travel);
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
        this.particles = makeParticles(this.reduceMotion ? 36 : 140);
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

    // Background recess and interior geometry.
    ctx.save();
    trapezoid(ctx);
    ctx.shadowColor = '#00eadc';
    ctx.shadowBlur = 13;
    ctx.fillStyle = '#142831';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();

    const darkness = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
    darkness.addColorStop(0, '#0b1b23');
    darkness.addColorStop(0.5, '#13262f');
    darkness.addColorStop(1, '#101620');
    ctx.fillStyle = darkness;
    ctx.fillRect(0, TOP, W, SPAN);

    // Faint etched technical lines always visible below the charge front.
    ctx.strokeStyle = 'rgba(146,211,212,.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 18; i++) {
      const y = TOP + i * SPAN / 18;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      const x = W / 2 + i * 34;
      ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, BOTTOM); ctx.stroke();
    }

    if (this.progress > 0) this.paintCharge(ctx, time);
    if (this.phase === 'hold') this.paintOverdrive(ctx, time);
    if (this.phase === 'burst') this.paintBurst(ctx);
    if (this.phase === 'clearing') {
      ctx.fillStyle = 'rgba(6,17,23,' + (0.45 * smooth(this.resetElapsed / RESET_MS)) + ')';
      ctx.fillRect(0, TOP, W, SPAN);
    }
    ctx.restore();

    // The beveled glass frame is painted on top of the clipped energy.
    ctx.save();
    trapezoid(ctx);
    const rim = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
    rim.addColorStop(0, '#b7fff5');
    rim.addColorStop(0.40, '#61bdc4');
    rim.addColorStop(0.75, '#79a6b9');
    rim.addColorStop(1, this.locked ? '#ffca8c' : '#8bb8bd');
    ctx.lineWidth = 4;
    ctx.shadowColor = this.locked ? '#ff9567' : '#51c7c7';
    ctx.shadowBlur = this.locked ? 22 : 12;
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.46)';
    ctx.stroke();
    ctx.restore();

    // Inset corners and cap bolts.
    for (const [x,y] of [[116,TOP],[204,TOP],[26,BOTTOM],[294,BOTTOM]]) {
      ctx.beginPath();
      ctx.arc(x,y,2.5,0,TAU);
      ctx.fillStyle = '#e2fff7';
      ctx.fill();
    }
  }

  paintCharge(ctx, time) {
    const front = TOP + SPAN * this.progress;
    const halfWidth = 44 + 90 * this.progress;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP, W, front - TOP);
    ctx.clip();

    // Layered gradient: cool entry energy heats to amber and incandescent orange.
    const energy = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
    energy.addColorStop(0, '#72f7ea');
    energy.addColorStop(0.24, '#39d6e8');
    energy.addColorStop(0.49, '#418db9');
    energy.addColorStop(0.70, '#f3c676');
    energy.addColorStop(0.90, '#ff823e');
    energy.addColorStop(1, '#ff462d');
    ctx.fillStyle = energy;
    ctx.globalAlpha = 0.83 + 0.07 * Math.sin(time * 9);
    ctx.fillRect(0, TOP, W, SPAN);
    ctx.globalAlpha = 1;

    const glow = ctx.createLinearGradient(0, front - 92, 0, front + 20);
    glow.addColorStop(0, 'rgba(247,255,240,0)');
    glow.addColorStop(0.75, 'rgba(229,255,220,.18)');
    glow.addColorStop(1, 'rgba(255,245,201,.85)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, Math.max(TOP, front - 92), W, 115);

    // Cellular energy ribs, diagonal currents and drifting micro-sparks.
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = TOP + i * 28 + (time * 22) % 28;
      ctx.strokeStyle = i % 2 ? 'rgba(184,255,250,.13)' : 'rgba(255,255,255,.21)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y - 21);
      ctx.stroke();
    }
    const count = this.reduceMotion ? 16 : 48;
    for (let i = 0; i < count; i++) {
      const seed = i * 71.39;
      const y = TOP + ((i * 53 + time * (70 + i % 5 * 25)) % SPAN);
      const x = 160 + Math.sin(seed + time * (1 + i % 7)) * (30 + i % 6 * 20);
      const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time * 3 + seed));
      ctx.fillStyle = 'rgba(236,255,226,' + alpha.toFixed(2) + ')';
      ctx.fillRect(x, y, i % 7 ? 1.6 : 3.2, i % 4 ? 5 : 13);
    }
    ctx.restore();

    // Energy leading edge has an illuminated horizontal contact surface.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfWidth, front);
    ctx.lineTo(W / 2 + halfWidth, front);
    ctx.strokeStyle = this.progress > 0.75 ? '#ffe5a5' : '#d0fff9';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.progress > 0.75 ? '#ffbd63' : '#50f7e9';
    ctx.shadowBlur = 17;
    ctx.stroke();
    ctx.restore();
  }

  paintOverdrive(ctx, time) {
    const sec = this.holdElapsed / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(time * 32);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bright = ctx.createRadialGradient(160, 320, 5, 160, 320, 210);
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
    if (sec > 2.3) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((sec - 2.3) / 0.7 * 0.21) + ')';
      ctx.fillRect(0, TOP, W, SPAN);
    }
    ctx.restore();
  }

  paintBurst(ctx) {
    const t = clamp(this.burstElapsed / BURST_MS);
    const cx = 160, cy = 326;
    const fade = 1 - smooth((t - 0.27) / 0.73);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Flash, incandescent core, two shock rings and radial debris.
    const flash = Math.pow(1 - t, 8);
    ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.82) + ')';
    ctx.fillRect(0, TOP, W, SPAN);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 230 * easeOut(t) + 3);
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

    const amount = this.reduceMotion ? 36 : this.particles.length;
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
    hold: ['超载临界！', 'OVERDRIVE', '临界震动 · 保持 3 秒'],
    burst: ['能量爆炸！', 'DETONATION', '冲击波爆发 · 槽内释放'],
    clearing: ['清空复位', 'RESETTING', '能量归零 · 准备下一击'],
  };
  const names = ['charge', 'hold', 'burst', 'clear'];
  const current = { idle: 0, charging: 0, hold: 1, burst: 2, clearing: 3 };
  let previousPhase = 'idle';

  const meter = new PowerChargeMeter({
    canvas,
    surface,
    onUpdate({ progress, percent: p, phase, remaining, holdElapsed }) {
      percent.textContent = String(p).padStart(3, '0');
      status.textContent = text[phase][0];
      stageCode.textContent = text[phase][1];
      instruction.textContent = text[phase][2];
      holdLabel.textContent = phase === 'hold' ? '高能锁定 / 即将释放' : phase === 'burst' ? '检测到能量爆裂' : '满槽后自动倒计时';
      countdown.innerHTML = (phase === 'hold' ? remaining.toFixed(1) : '3.0') + '<span>S</span>';
      timeProgress.style.width = (phase === 'hold' ? (holdElapsed / HOLD_MS) * 100 : phase === 'burst' ? 100 : 0) + '%';
      phases.forEach((el, index) => {
        el.classList.toggle('active', index === current[phase]);
        el.classList.toggle('passed', phase !== 'idle' && index < current[phase]);
      });
      hint.classList.toggle('is-hidden', progress > .015 || phase === 'hold' || phase === 'burst' || phase === 'clearing');
      autoButton.disabled = meter.locked;
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
