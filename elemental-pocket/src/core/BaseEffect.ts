import * as THREE from 'three';

/** Internal animation instance. The manager owns its lifetime and its parent group. */
export abstract class BaseEffect {
  readonly group = new THREE.Group();
  readonly duration: number;
  protected t = -1;
  protected time = 0;

  constructor(parent: THREE.Object3D, duration: number) {
    this.duration = duration;
    this.group.visible = false;
    parent.add(this.group);
  }
  get active(): boolean { return this.t >= 0; }
  play(): void {
    this.time = 0;
    this.t = 0;
    this.group.visible = true;
    this.onPlay();
    this.update(0);
  }
  tick(dt: number): boolean {
    if (!this.active) return false;
    this.time += dt;
    const elapsed = this.t + dt;
    this.t = elapsed + 1e-8 >= this.duration ? this.duration : elapsed;
    this.update(dt);
    if (this.t >= this.duration) { this.stop(); return true; }
    return false;
  }
  stop(): void { this.t = -1; this.group.visible = false; }
  onPlay(): void {}
  onResize(_pixelRatio: number): void {}
  onCamera(_camera: THREE.Camera | undefined): void {}
  abstract update(dt: number): void;
}
