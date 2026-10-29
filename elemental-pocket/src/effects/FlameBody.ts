import * as THREE from 'three';
import { RING_R, TAU } from '../core/math';

/** A continuous, animated flame curtain. Ember points are only an accent. */
function makeCurtainGeometry(): THREE.BufferGeometry {
  const angularSegments = 112;
  const verticalSegments = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= verticalSegments; y++) {
    const height = y / verticalSegments;
    for (let i = 0; i <= angularSegments; i++) {
      const f = i / angularSegments;
      const a = f * TAU;
      positions.push(Math.cos(a), height, Math.sin(a));
      uvs.push(f, height);
      if (y < verticalSegments && i < angularSegments) {
        const start = y * (angularSegments + 1) + i;
        indices.push(start, start + angularSegments + 1, start + 1);
        indices.push(start + 1, start + angularSegments + 1, start + angularSegments + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

const VERTEX = /* glsl */`
  uniform float uTime, uGrow, uContract, uRadius, uHeight, uPhase;
  varying vec2 vUv;
  varying float vAngle;

  void main() {
    vUv = uv;
    float a = uv.x * 6.28318530718;
    float h = uv.y;
    vAngle = a;
    float curl = (sin(a * 3.0 - uTime * 1.4 + h * 4.0 + uPhase) * 0.10
                + sin(a * 7.0 + uTime * 1.1 + h * 5.0) * 0.035) * h;
    float angle = a + curl + uContract * 1.8;
    float ripple = sin(a * 5.0 + uTime * 2.0 + h * 6.0 + uPhase) * 0.025 * h;
    float radius = (uRadius + ripple) * mix(1.0, 0.04, uContract);
    float y = h * uHeight * uGrow * mix(1.0, 0.15, uContract);
    vec3 p = vec3(cos(angle) * radius, y, sin(angle) * radius);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  uniform float uTime, uGrow, uContract, uOpacity, uPhase;
  varying vec2 vUv;
  varying float vAngle;

  void main() {
    float a = vAngle;
    float h = vUv.y;
    // Several slowly shifting harmonics make broad, unequal, connected tongues.
    float crown = 0.57
      + 0.18 * sin(a * 3.0 + uTime * 1.25 + uPhase)
      + 0.12 * sin(a * 7.0 - uTime * 0.85 + 0.8)
      + 0.06 * sin(a * 11.0 + uTime * 1.7 + 1.3);
    float silhouette = 1.0 - smoothstep(crown - 0.08, crown + 0.045, h);
    float flow = sin(a * 6.0 - h * 9.0 + uTime * 2.7 + uPhase)
               + 0.5 * sin(a * 13.0 + h * 15.0 - uTime * 3.2);
    float flicker = 0.82 + 0.18 * sin(uTime * 5.1 + a * 5.0);
    float base = smoothstep(0.0, 0.06, h);
    float opacity = silhouette * base * flicker * uOpacity * uGrow * (1.0 - uContract);
    opacity *= 0.80 + 0.20 * smoothstep(-1.1, 1.0, flow);
    vec3 deep = vec3(0.88, 0.10, 0.015);
    vec3 amber = vec3(1.0, 0.36, 0.035);
    vec3 gold = vec3(1.0, 0.74, 0.22);
    vec3 color = mix(amber, deep, smoothstep(0.18, 0.80, h));
    float hot = (1.0 - smoothstep(0.08, 0.43, h)) * (0.55 + 0.45 * smoothstep(-0.1, 1.0, flow));
    color = mix(color, gold, hot * 0.74);
    gl_FragColor = vec4(color, opacity);
  }
`;

export function addFlameBody(parent: THREE.Group): THREE.ShaderMaterial[] {
  const geometry = makeCurtainGeometry();
  const materials: THREE.ShaderMaterial[] = [];
  // The two differently moving shells form volume from any game camera angle.
  const shells = [
    { radius: RING_R * 1.02, height: 1.08, opacity: 0.64, phase: 0.0 },
    { radius: RING_R * 0.77, height: 0.90, opacity: 0.57, phase: 2.1 },
  ];
  for (const shell of shells) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uGrow: { value: 0 }, uContract: { value: 0 },
        uRadius: { value: shell.radius }, uHeight: { value: shell.height },
        uOpacity: { value: shell.opacity }, uPhase: { value: shell.phase },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Continuous flame';
    mesh.frustumCulled = false;
    parent.add(mesh);
    materials.push(material);
  }
  return materials;
}
