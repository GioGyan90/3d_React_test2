import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
export declare class GrassEffect extends BaseEffect {
    private count;
    private dummy;
    private mesh;
    private leaves;
    private groundGlow;
    constructor(scene: THREE.Object3D, quality: number);
    update(): void;
}
