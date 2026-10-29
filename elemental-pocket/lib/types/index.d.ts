import * as THREE from 'three';
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
    position?: THREE.Vector3 | {
        x: number;
        y: number;
        z: number;
    };
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
/**
 * Owns reusable effect instances in an existing Three.js scene. It never creates
 * a renderer, camera, render loop, or scene lights. Call update once per frame.
 */
export declare class PocketEffects {
    private readonly parent;
    private readonly density;
    private readonly pools;
    private readonly playing;
    private pixelRatio;
    private camera?;
    private disposed;
    constructor(parent: THREE.Object3D, options?: PocketEffectsOptions);
    play(type: ElementType, options?: PlayOptions): EffectHandle;
    /** Advance all effects in seconds. Use the same delta as your game loop. */
    update(deltaSeconds: number): void;
    setCamera(camera?: THREE.Camera): void;
    /** Call when your renderer's pixel ratio changes. */
    setPixelRatio(pixelRatio: number): void;
    /** Stop all effects, detach them, and free owned geometry, materials and textures. */
    dispose(): void;
    private validatePixelRatio;
    private assertAlive;
}
