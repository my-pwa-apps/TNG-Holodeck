import * as THREE from 'three';
import gridVert from '../shaders/holoGrid.vert';
import gridFrag from '../shaders/holoGrid.frag';

// Room dimensions: 30ft × 12ft × 30ft → metres (÷3.281)
const W = 9.144;  // width
const H = 3.658;  // height
const D = 9.144;  // depth

/**
 * HolodeckRoom — the iconic black room with amber (#FFB300) grid lines.
 * Draws the grid on the inside of a box using a custom ShaderMaterial,
 * plus an outer "infinite corridor" box at 10× scale for the illusion of
 * endless space beyond the walls.
 */
export class HolodeckRoom {
  constructor(scene) {
    this._scene    = scene;
    this._material = null;
    this._group    = new THREE.Group();
    this._build();
    scene.add(this._group);
  }

  _build() {
    this._material = new THREE.ShaderMaterial({
      vertexShader:   gridVert,
      fragmentShader: gridFrag,
      side:           THREE.BackSide,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.NormalBlending,
      uniforms: {
        uTime:          { value: 0 },
        uGridDensity:   { value: 8 },        // cells per face
        uLineWidth:     { value: 0.025 },
        uNodeBrightness:{ value: 2.2 },
        uLineColor:     { value: new THREE.Color(0xFFB300) },
      },
    });

    // ── Inner room ───────────────────────────────────────────────────────
    const innerGeo = new THREE.BoxGeometry(W, H, D);
    const inner    = new THREE.Mesh(innerGeo, this._material);
    inner.position.y = H / 2;
    this._group.add(inner);

    // ── Outer "infinite" room — same shader, larger scale ────────────────
    const outerMat = this._material.clone();
    outerMat.uniforms.uLineWidth.value  = 0.015;   // thinner lines far away
    outerMat.uniforms.uNodeBrightness.value = 1.4;

    const outerGeo = new THREE.BoxGeometry(W * 10, H * 10, D * 10);
    const outer    = new THREE.Mesh(outerGeo, outerMat);
    outer.position.y = H / 2;
    this._group.add(outer);

    this._outerMat = outerMat;

    // ── Floor plane (solid black with faint grid) ────────────────────────
    const floorGeo = new THREE.PlaneGeometry(W, D, 1, 1);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this._group.add(floor);
  }

  update(elapsed) {
    if (this._material) {
      this._material.uniforms.uTime.value = elapsed;
    }
    if (this._outerMat) {
      this._outerMat.uniforms.uTime.value = elapsed;
    }
  }

  dispose() {
    this._scene.remove(this._group);
    this._material?.dispose();
    this._outerMat?.dispose();
  }
}
