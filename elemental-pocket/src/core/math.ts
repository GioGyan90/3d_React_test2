export const TAU = Math.PI * 2;
export const RING_R = 0.46;
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const smooth01 = (v: number): number => { const t = clamp01(v); return t * t * (3 - 2 * t); };
export const easeIn = (v: number): number => { const t = clamp01(v); return t * t; };
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
