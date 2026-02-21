import * as THREE from 'three';
import matVert from '../shaders/materialization.vert';
import matFrag from '../shaders/materialization.frag';

const PARTICLE_COUNT_DESKTOP = 20_000;  // desktop / high-end
const PARTICLE_COUNT_XR      = 8_000;   // Quest 3S standalone budget
const DURATION_IN    = 2.5;  // seconds
const DURATION_OUT   = 1.8;

/**
 * MaterializationSystem
 * Creates a particle cloud that converges onto (or diverges from)
 * the bounding volume of a given set of scene objects.
 */
export class MaterializationSystem {
  constructor(scene) {
    this._scene     = scene;
    this._particles = null;
    this._material  = null;
    this._progress  = 0;
    this._direction = 1;    // +1 = materialise, -1 = dematerialise
    this._active    = false;
    this._onComplete = null;
    this._particleCount = PARTICLE_COUNT_DESKTOP;
    this._build();
  }

  setXRMode(xr) {
    // Rebuild particle system at the appropriate budget.
    // Called on XR session start/end from HolodeckEngine.
    const newCount = xr ? PARTICLE_COUNT_XR : PARTICLE_COUNT_DESKTOP;
    if (newCount === this._particleCount) return;
    this.dispose();
    this._particleCount = newCount;
    this._build();
  }

  _build() {
    const PARTICLE_COUNT = this._particleCount;
    const positions  = new Float32Array(PARTICLE_COUNT * 3);
    const targets    = new Float32Array(PARTICLE_COUNT * 3);
    const offsets    = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Default: scattered in a 10m cube
      offsets[i3]     = (Math.random() - 0.5) * 10;
      offsets[i3 + 1] = (Math.random() - 0.5) * 10;
      offsets[i3 + 2] = (Math.random() - 0.5) * 10;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',       new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTargetPosition',new THREE.BufferAttribute(targets,   3));
    geo.setAttribute('aRandomOffset',  new THREE.BufferAttribute(offsets,   3));

    this._material = new THREE.ShaderMaterial({
      vertexShader:   matVert,
      fragmentShader: matFrag,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0.0 },
        uTime:     { value: 0.0 },
      },
    });

    this._particles = new THREE.Points(geo, this._material);
    this._particles.visible = false;
    this._particles.frustumCulled = false;
    this._scene.add(this._particles);
  }

  /**
   * Scatter particles to match the bounding box of the given objects,
   * then animate them converging (progress 0→1).
   */
  materialize(objects = []) {
    this._setTargets(objects);
    this._progress  = 0;
    this._direction = 1;
    this._active    = true;
    this._onComplete = null;
    this._particles.visible = true;
    this._material.uniforms.uProgress.value = 0;
  }

  /**
   * Animate particles diverging (progress 1→0), call onComplete when done.
   */
  dematerialize(objects = [], onComplete) {
    this._setTargets(objects);
    this._progress  = 1;
    this._direction = -1;
    this._active    = true;
    this._onComplete = onComplete;
    this._particles.visible = true;
    this._material.uniforms.uProgress.value = 1;
  }

  _setTargets(objects) {
    if (!objects || objects.length === 0) {
      // Default: unit cube
      this._scatterInBox(new THREE.Box3(
        new THREE.Vector3(-5, 0, -5),
        new THREE.Vector3( 5, 3,  5)
      ));
      return;
    }

    const box = new THREE.Box3();
    objects.forEach(o => box.expandByObject(o));
    this._scatterInBox(box);
  }

  _scatterInBox(box) {
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const PARTICLE_COUNT = this._particleCount;
    const targets = this._particles.geometry.attributes.aTargetPosition;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      targets.array[i3]     = center.x + (Math.random() - 0.5) * size.x;
      targets.array[i3 + 1] = center.y + (Math.random() - 0.5) * size.y;
      targets.array[i3 + 2] = center.z + (Math.random() - 0.5) * size.z;
    }
    targets.needsUpdate = true;
  }

  update(dt) {
    if (!this._active) return;

    const speed = 1 / (this._direction > 0 ? DURATION_IN : DURATION_OUT);
    this._progress += this._direction * dt * speed;
    this._progress   = Math.max(0, Math.min(1, this._progress));

    this._material.uniforms.uProgress.value = this._progress;

    // Done
    if (this._direction > 0 && this._progress >= 1) {
      this._active = false;
      this._particles.visible = false;
    } else if (this._direction < 0 && this._progress <= 0) {
      this._active = false;
      this._particles.visible = false;
      if (this._onComplete) {
        this._onComplete();
        this._onComplete = null;
      }
    }
  }

  dispose() {
    this._scene.remove(this._particles);
    this._particles.geometry.dispose();
    this._material.dispose();
  }
}
