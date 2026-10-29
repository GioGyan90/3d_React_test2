import * as THREE from 'three';
/** Internal animation instance. The manager owns its lifetime and its parent group. */
export declare abstract class BaseEffect {
    readonly group: THREE.Group<THREE.Object3DEventMap>;
    readonly duration: number;
    protected t: number;
    protected time: number;
    constructor(parent: THREE.Object3D, duration: number);
    get active(): boolean;
    play(): void;
    tick(dt: number): boolean;
    stop(): void;
    onPlay(): void;
    onResize(_pixelRatio: number): void;
    onCamera(_camera: THREE.Camera | undefined): void;
    abstract update(dt: number): void;
}
