import * as THREE from 'three';
import { BaseEffect } from '../core/BaseEffect';
export declare class IceEffect extends BaseEffect {
    private count;
    private freezeDur;
    private holdEnd;
    private dummy;
    private shards;
    private shardParams;
    private sweepMat;
    private sweep;
    private frost;
    private dustMat;
    private dust;
    constructor(scene: THREE.Object3D, quality: number);
    onResize(pr: number): void;
    update(): void;
}
