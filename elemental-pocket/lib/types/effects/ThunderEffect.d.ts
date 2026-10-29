import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
/** 面向镜头的带状闪电网格 */
declare class Ribbon {
    maxPts: number;
    pos: Float32Array;
    geo: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    constructor(maxPts: number);
    setPath(points: THREE.Vector3[], width: number, viewDir: THREE.Vector3): void;
}
export declare class ThunderEffect extends BaseEffect {
    private viewDir;
    private mainBolt;
    private mainGlow;
    private lastImpact;
    private branchA;
    private branchB;
    private arcs;
    private sparkMat;
    private sparks;
    private ringMat;
    private ring;
    private flash;
    private groundFlash;
    private strikeTimer;
    private boltAge;
    private arcTimer;
    private flashPeak;
    constructor(scene: THREE.Object3D, quality: number);
    onPlay(): void;
    onResize(pr: number): void;
    onCamera(camera: THREE.Camera | undefined): void;
    strike(): void;
    /** Every arc starts at the strike point and runs outward into a jagged ring. */
    buildArc(ribbon: Ribbon, index: number): void;
    update(dt: number): void;
}
export {};
