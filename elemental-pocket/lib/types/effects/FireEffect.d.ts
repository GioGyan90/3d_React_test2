import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
export declare class FireEffect extends BaseEffect {
    private mats;
    private flameMats;
    private lickMat;
    private licks;
    private glowMat;
    private glow;
    private core;
    private groundGlow;
    constructor(scene: THREE.Object3D, quality: number);
    makePointMat(sizeMul: number, alpha: number, c1: number[], c2: number[], c3: number[]): THREE.ShaderMaterial;
    makeLayer(count: number, sizeMin: number, sizeMax: number, material: THREE.ShaderMaterial): THREE.Points<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.ShaderMaterial>;
    onResize(pr: number): void;
    update(): void;
}
