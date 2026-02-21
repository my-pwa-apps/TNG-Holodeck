import * as THREE from 'three';
import matVert from '../shaders/materialization.vert';
import matFrag from '../shaders/materialization.frag';

const PARTICLE_COUNT_DESKTOP = 20_000;  // desktop / high-end
const PARTICLE_COUNT_XR      = 8_000;   // Quest 3S standalone budget
const DURATION_IN    = 2.5;  // seconds
const DURATION_OUT   = 1.8;

/**
 * MaterializationSystem
 * Creates a TNG Holodeck-style materialization effect.
 * A 3D grid of yellow/gold particles appears and a scanning plane
 * moves vertically, revealing the scene objects via clipping planes.
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
    
    this._objects   = [];
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this._minY      = 0;
    this._maxY      = 3;

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

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',       new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTargetPosition',new THREE.BufferAttribute(targets,   3));

    this._material = new THREE.ShaderMaterial({
      vertexShader:   matVert,
      fragmentShader: matFrag,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
      uniforms: {
        uProgress:  { value: 0.0 },
        uTime:      { value: 0.0 },
        uMinY:      { value: 0.0 },
        uMaxY:      { value: 3.0 },
        uDirection: { value: 1.0 },
      },
    });

    this._particles = new THREE.Points(geo, this._material);
    this._particles.visible = false;
    this._particles.frustumCulled = false;
    this._scene.add(this._particles);
  }

  /**
   * Arrange particles in a 3D grid matching the bounding box of the given objects,
   * then animate them and the clipping plane (progress 0→1).
   */
  materialize(objects = [], onComplete) {
    this._removeClippingPlane();
    this._objects = objects;
    this._setTargets(objects);
    this._progress  = 0;
    this._direction = 1;
    this._active    = true;
    this._onComplete = onComplete;
    this._particles.visible = true;
    this._material.uniforms.uProgress.value = 0;
    this._material.uniforms.uDirection.value = 1.0;
    this._applyClippingPlane();
    this._updateClippingPlane();
  }

  /**
   * Animate particles and clipping plane (progress 1→0), call onComplete when done.
   */
  dematerialize(objects = [], onComplete) {
    this._removeClippingPlane();
    this._objects = objects;
    this._setTargets(objects);
    this._progress  = 1;
    this._direction = -1;
    this._active    = true;
    this._onComplete = onComplete;
    this._particles.visible = true;
    this._material.uniforms.uProgress.value = 1;
    this._material.uniforms.uDirection.value = -1.0;
    this._applyClippingPlane();
    this._updateClippingPlane();
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

    // Add a little padding
    size.addScalar(0.5);

    this._minY = center.y - size.y / 2 - 0.1;
    this._maxY = center.y + size.y / 2 + 0.1;

    this._material.uniforms.uMinY.value = this._minY;
    this._material.uniforms.uMaxY.value = this._maxY;

    const PARTICLE_COUNT = this._particleCount;
    const targets = this._particles.geometry.attributes.aTargetPosition;
    
    // Arrange particles in a 3D grid
    const volume = Math.max(0.1, size.x * size.y * size.z);
    const density = PARTICLE_COUNT / volume;
    const spacing = Math.pow(1 / density, 1/3);
    
    const nx = Math.max(1, Math.floor(size.x / spacing));
    const ny = Math.max(1, Math.floor(size.y / spacing));
    const nz = Math.max(1, Math.floor(size.z / spacing));
    
    const sx = size.x / nx;
    const sy = size.y / ny;
    const sz = size.z / nz;
    
    const startX = center.x - size.x / 2 + sx / 2;
    const startY = center.y - size.y / 2 + sy / 2;
    const startZ = center.z - size.z / 2 + sz / 2;

    let pIdx = 0;
    
    for (let x = 0; x < nx && pIdx < PARTICLE_COUNT; x++) {
      for (let y = 0; y < ny && pIdx < PARTICLE_COUNT; y++) {
        for (let z = 0; z < nz && pIdx < PARTICLE_COUNT; z++) {
          const i3 = pIdx * 3;
          targets.array[i3]     = startX + x * sx;
          targets.array[i3 + 1] = startY + y * sy;
          targets.array[i3 + 2] = startZ + z * sz;
          pIdx++;
        }
      }
    }
    
    // Fill remainder randomly within the box
    for (; pIdx < PARTICLE_COUNT; pIdx++) {
      const i3 = pIdx * 3;
      targets.array[i3]     = center.x + (Math.random() - 0.5) * size.x;
      targets.array[i3 + 1] = center.y + (Math.random() - 0.5) * size.y;
      targets.array[i3 + 2] = center.z + (Math.random() - 0.5) * size.z;
    }
    
    targets.needsUpdate = true;
  }

  _applyClippingPlane() {
    this._objects.forEach(obj => {
      obj.traverse(child => {
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            if (!mat.clippingPlanes) mat.clippingPlanes = [];
            if (!mat.clippingPlanes.includes(this._clipPlane)) {
              mat.clippingPlanes.push(this._clipPlane);
              if (mat.isShaderMaterial) mat.clipping = true;
              mat.needsUpdate = true;
            }
          });
        }
      });
    });
  }

  _removeClippingPlane() {
    this._objects.forEach(obj => {
      obj.traverse(child => {
        if (child.material && child.material.clippingPlanes) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            const idx = mat.clippingPlanes.indexOf(this._clipPlane);
            if (idx !== -1) {
              mat.clippingPlanes.splice(idx, 1);
              if (mat.isShaderMaterial && mat.clippingPlanes.length === 0) mat.clipping = false;
              mat.needsUpdate = true;
            }
          });
        }
      });
    });
  }

  _updateClippingPlane() {
    // uProgress goes from 0 to 1.
    // When progress is 0, scanner is at minY. Everything above minY is clipped.
    // When progress is 1, scanner is at maxY. Everything above maxY is clipped (nothing).
    const y = THREE.MathUtils.lerp(this._minY, this._maxY, this._progress);
    this._clipPlane.constant = y;
  }

  update(dt, elapsed = 0) {
    // Keep uTime ticking regardless of active state (shader uses it for sparkle)
    if (this._material) this._material.uniforms.uTime.value = elapsed;

    if (!this._active) return;

    const speed = 1 / (this._direction > 0 ? DURATION_IN : DURATION_OUT);
    this._progress += this._direction * dt * speed;
    this._progress   = Math.max(0, Math.min(1, this._progress));

    this._material.uniforms.uProgress.value = this._progress;
    this._updateClippingPlane();

    // Done
    if (this._direction > 0 && this._progress >= 1) {
      this._active = false;
      this._particles.visible = false;
      this._removeClippingPlane();
      if (this._onComplete) {
        this._onComplete();
        this._onComplete = null;
      }
    } else if (this._direction < 0 && this._progress <= 0) {
      this._active = false;
      this._particles.visible = false;
      this._removeClippingPlane();
      if (this._onComplete) {
        this._onComplete();
        this._onComplete = null;
      }
    }
  }

  dispose() {
    this._removeClippingPlane();
    this._scene.remove(this._particles);
    this._particles.geometry.dispose();
    this._material.dispose();
  }
}
