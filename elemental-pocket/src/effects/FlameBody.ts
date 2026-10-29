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

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x);
    float b = mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x);
    float c = mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x);
    float d = mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }

  void main() {
    float a = vAngle;
    float h = vUv.y;
    // Circular coordinates keep the rolling noise continuous at the seam.
    vec3 flow = vec3(cos(a) * 2.15, sin(a) * 2.15, h * 2.9 - uTime * 1.10);
    flow += vec3(2.2 + uPhase, 4.1, uPhase * 0.37);
    float large = noise3(flow);
    float detail = noise3(flow * 2.1 + vec3(3.1, 6.4, uTime * 0.18));
    float turbulence = large * 0.72 + detail * 0.28;
    // The lower flame stays connected; rising turbulence breaks into soft, uneven tips.
    float density = 0.80 - h * 1.38 + (turbulence - 0.50) * 1.20;
    float silhouette = smoothstep(-0.07, 0.16, density);
    float topFade = 1.0 - smoothstep(0.78, 1.0, h);
    float base = smoothstep(0.0, 0.045, h);
    float flicker = 0.86 + 0.14 * sin(uTime * 4.1 + a * 3.0);
    float opacity = silhouette * topFade * base * flicker * uOpacity * uGrow * (1.0 - uContract);
    opacity *= 0.72 + 0.28 * turbulence;
    vec3 deep = vec3(0.86, 0.10, 0.012);
    vec3 amber = vec3(1.0, 0.32, 0.025);
    vec3 gold = vec3(1.0, 0.70, 0.16);
    vec3 color = mix(amber, deep, smoothstep(0.16, 0.75, h));
    float hot = (1.0 - smoothstep(0.04, 0.52, h)) * (0.65 + 0.35 * detail);
    color = mix(color, gold, hot * 0.80);
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
