import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';

const vertexShader = `
  uniform float uTime;
  uniform float uWind;
  uniform float uAspect;
  uniform float uDpr;
  attribute float aPhase;
  varying float vOpacity;

  void main() {
    float depth = clamp((position.z + 2.6) / 4.8, 0.0, 1.0);
    float distance = 9.0 - position.z;
    float halfHeight = distance * 0.364;
    float wind = uWind * (0.65 + depth * 0.87);
    float fall = uTime * (0.31 + depth * 0.32 + aPhase * 0.13);
    float sway = sin(aPhase * 6.283 + uTime * (1.01 + aPhase)) * 0.052;
    vec2 flake = mod(position.xy + vec2(wind + sway, -fall) + 1.12, 2.24) - 1.12;
    flake *= vec2(halfHeight * uAspect, halfHeight);
    vec4 view = modelViewMatrix * vec4(flake, position.z, 1.0);
    vOpacity = 0.32 + depth * 0.35 + aPhase * 0.21;
    gl_Position = projectionMatrix * view;
    gl_PointSize = (2.5 + 6.0 * depth + 1.6 * aPhase) * uDpr;
  }
`;

const fragmentShader = `
  varying float vOpacity;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    vec2 axes = vec2(dot(p, vec2(0.84, 0.54)), dot(p, vec2(-0.54, 0.84)));
    float radius = length(axes * vec2(2.35, 4.3));
    float flake = 1.0 - smoothstep(0.20, 0.93, radius);
    gl_FragColor = vec4(0.88, 0.94, 1.0, flake * vOpacity);
  }
`;

export function mountLandscape(figure) {
  const container = figure.querySelector('.landscape-live');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false });
  if (!context) return undefined;

  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.z = 9;
  const scene = new THREE.Scene();

  const compact = window.matchMedia('(max-width: 690px)');
  const count = compact.matches ? 89 : 183;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  let seed = 625001;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  }
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * 2.24;
    positions[i * 3 + 1] = (random() - 0.5) * 2.24;
    positions[i * 3 + 2] = -2.6 + random() * 4.8;
    phases[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0 }, uAspect: { value: 1 }, uDpr: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  scene.add(particles);

  let lost = false;
  let nearX = 0;
  let nearY = 0;

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height || lost) return;
    const dpr = Math.min(window.devicePixelRatio || 1, compact.matches ? 1.35 : 1.6);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
    uniforms.uDpr.value = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  }

  function steer(event) {
    if (event.pointerType === 'touch') return;
    const { left, top, width, height } = figure.getBoundingClientRect();
    nearX = ((event.clientX - left) / width - 0.5) * 0.34;
    nearY = ((event.clientY - top) / height - 0.5) * -0.18;
  }

  function reset() {
    nearX = 0;
    nearY = 0;
  }

  function lose(event) {
    event.preventDefault();
    lost = true;
    figure.classList.remove('has-depth');
  }

  function restore() {
    lost = false;
    resize();
    figure.classList.add('has-depth');
  }

  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  container.append(canvas);
  figure.addEventListener('pointermove', steer);
  figure.addEventListener('pointerleave', reset);
  canvas.addEventListener('webglcontextlost', lose);
  canvas.addEventListener('webglcontextrestored', restore);
  resize();
  figure.classList.add('has-depth');

  return {
    draw(time, windDistance, delta) {
      if (lost) return;
      uniforms.uTime.value = time;
      uniforms.uWind.value = windDistance;
      const reach = 1 - Math.exp(-3.6 * delta);
      camera.position.x += (nearX - camera.position.x) * reach;
      camera.position.y += (nearY - camera.position.y) * reach;
      renderer.render(scene, camera);
    },
    dispose() {
      resizer.disconnect();
      figure.removeEventListener('pointermove', steer);
      figure.removeEventListener('pointerleave', reset);
      canvas.removeEventListener('webglcontextlost', lose);
      canvas.removeEventListener('webglcontextrestored', restore);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
      figure.classList.remove('has-depth');
    },
  };
}
