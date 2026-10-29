import * as THREE from 'three';
import { BaseEffect } from './core/BaseEffect';
import { RING_R } from './core/math';
import { FireEffect } from './effects/FireEffect';
import { ThunderEffect } from './effects/ThunderEffect';
import { GrassEffect } from './effects/GrassEffect';
import { IceEffect } from './effects/IceEffect';

export type ElementType = 'fire' | 'thunder' | 'grass' | 'ice';
export type EffectQuality = 'low' | 'medium' | 'high';

export interface PocketEffectsOptions {
  /** Particle/instance density. Does not change the animation timing. */
  quality?: EffectQuality;
  /** Renderer pixel ratio for point sprites, not the CSS size of a canvas. */
  pixelRatio?: number;
  /** Used to orient lightning ribbons towards the current game camera. */
  camera?: THREE.Camera;
}

export interface PlayOptions {
  /** Position in the coordinate system of the parent supplied to PocketEffects. */
  position?: THREE.Vector3 | { x: number; y: number; z: number };
  /** Ring radius in the parent's units. Defaults to 0.46. */
  radius?: number;
  /** Playback time in seconds; defaults to each effect's natural duration. */
  duration?: number;
  /** Rotation about the Y axis in radians. */
  rotation?: number;
  /** Called once after natural completion; not called when stopped or disposed. */
  onComplete?: () => void;
}

export interface EffectHandle {
  /** Stop this particular playback. Safe to call after it has already finished. */
  stop(): void;
  readonly active: boolean;
}

type Playback = { effect: BaseEffect; speed: number; onComplete?: () => void };
const DENSITY: Record<EffectQuality, number> = { low: 0.35, medium: 0.65, high: 1 };
const FACTORIES: Record<ElementType, (parent: THREE.Object3D, density: number) => BaseEffect> = {
  fire: (parent, density) => new FireEffect(parent, density),
  thunder: (parent, density) => new ThunderEffect(parent, density),
  grass: (parent, density) => new GrassEffect(parent, density),
  ice: (parent, density) => new IceEffect(parent, density),
};

/**
 * Owns reusable effect instances in an existing Three.js scene. It never creates
 * a renderer, camera, render loop, or scene lights. Call update once per frame.
 */
export class PocketEffects {
  private readonly parent: THREE.Object3D;
  private readonly density: number;
  private readonly pools = new Map<ElementType, BaseEffect[]>();
  private readonly playing = new Map<BaseEffect, Playback>();
  private pixelRatio: number;
  private camera?: THREE.Camera;
  private disposed = false;

  constructor(parent: THREE.Object3D, options: PocketEffectsOptions = {}) {
    this.parent = parent;
    this.density = DENSITY[options.quality ?? 'high'];
    if (!this.density) throw new Error('Unknown effect quality');
    this.pixelRatio = this.validatePixelRatio(options.pixelRatio ?? 1);
    this.camera = options.camera;
  }

  play(type: ElementType, options: PlayOptions = {}): EffectHandle {
    this.assertAlive();
    const factory = FACTORIES[type];
    if (!factory) throw new Error(`Unknown pocket effect: ${String(type)}`);
    const radius = options.radius ?? RING_R;
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('radius must be a positive finite number');
    if (options.duration !== undefined && (!Number.isFinite(options.duration) || options.duration <= 0)) {
      throw new Error('duration must be a positive finite number');
    }
    if (options.rotation !== undefined && !Number.isFinite(options.rotation)) throw new Error('rotation must be finite');
    if (options.position && ![options.position.x, options.position.y, options.position.z].every(Number.isFinite)) {
      throw new Error('position must contain finite x, y and z values');
    }
    let pool = this.pools.get(type);
    if (!pool) { pool = []; this.pools.set(type, pool); }
    let effect = pool.find(candidate => !this.playing.has(candidate));
    if (!effect) {
      effect = factory(this.parent, this.density);
      effect.onResize(this.pixelRatio);
      pool.push(effect);
    }
    const position = options.position ?? { x: 0, y: 0, z: 0 };
    effect.group.position.set(position.x, position.y, position.z);
    effect.group.rotation.set(0, options.rotation ?? 0, 0);
    effect.group.scale.setScalar(radius / RING_R);
    effect.onCamera(this.camera);
    const playback: Playback = { effect, speed: effect.duration / (options.duration ?? effect.duration), onComplete: options.onComplete };
    this.playing.set(effect, playback);
    effect.play();
    const manager = this;
    return {
      stop() { if (manager.playing.get(playback.effect) === playback) { manager.playing.delete(playback.effect); playback.effect.stop(); } },
      get active() { return manager.playing.get(playback.effect) === playback; },
    };
  }

  /** Advance all effects in seconds. Use the same delta as your game loop. */
  update(deltaSeconds: number): void {
    this.assertAlive();
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('deltaSeconds must be a non-negative finite number');
    const callbacks: Array<() => void> = [];
    for (const [effect, playback] of Array.from(this.playing.entries())) {
      if (this.playing.get(effect) !== playback) continue;
      effect.onCamera(this.camera);
      if (effect.tick(deltaSeconds * playback.speed)) {
        this.playing.delete(effect);
        if (playback.onComplete) callbacks.push(playback.onComplete);
      }
    }
    callbacks.forEach(callback => callback());
  }

  setCamera(camera?: THREE.Camera): void { this.assertAlive(); this.camera = camera; }

  /** Call when your renderer's pixel ratio changes. */
  setPixelRatio(pixelRatio: number): void {
    this.assertAlive();
    this.pixelRatio = this.validatePixelRatio(pixelRatio);
    for (const pool of this.pools.values()) for (const effect of pool) effect.onResize(this.pixelRatio);
  }

  /** Stop all effects, detach them, and free owned geometry, materials and textures. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing.clear();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const pool of this.pools.values()) for (const effect of pool) {
      effect.stop();
      effect.group.traverse(object => {
        const renderable = object as THREE.Mesh;
        if (renderable.geometry && !(object as THREE.Sprite).isSprite) geometries.add(renderable.geometry);
        if (renderable.material) {
          const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
          for (const material of list) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
            if (material instanceof THREE.ShaderMaterial) {
              for (const uniform of Object.values(material.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
            }
          }
        }
      });
      effect.group.removeFromParent();
    }
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    this.pools.clear();
  }

  private validatePixelRatio(value: number): number {
    if (!Number.isFinite(value) || value <= 0) throw new Error('pixelRatio must be a positive finite number');
    return value;
  }
  private assertAlive(): void { if (this.disposed) throw new Error('PocketEffects has been disposed'); }
}
