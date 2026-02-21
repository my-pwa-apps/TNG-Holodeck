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
    // TNG grid: ~1 yard (0.914m) squares → 10 cells across 9.144m
    // Inner box is opaque (black bg + amber lines) — no floor plane needed.
    // Three progressive outer shells give the infinite-corridor illusion
    // without scaling so large that grid proportions look wrong.
    this._material = new THREE.ShaderMaterial({
      vertexShader:   gridVert,
      fragmentShader: gridFrag,
      side:           THREE.BackSide,
      transparent:    false,
      depthWrite:     true,
      uniforms: {
        uTime:          { value: 0 },
        uGridDensity:   { value: 10 },       // TNG 1-yard grid squares
        uLineWidth:     { value: 0.022 },    // thin, crisp lines
        uNodeBrightness:{ value: 2.8 },      // bright intersection nodes
        uLineColor:     { value: new THREE.Color(0xFFB300) },
        uSolid:         { value: 1.0 },      // 1 = black bg, 0 = discard bg
      },
    });

    // ── Inner room (all 6 faces show grid — including floor & ceiling) ───
    const innerGeo = new THREE.BoxGeometry(W, H, D);
    const inner    = new THREE.Mesh(innerGeo, this._material);
    inner.position.y = H / 2;
    this._group.add(inner);

    // ── Progressive outer shells for infinite-corridor illusion ──────────
    // Shell 1: 2× — fades edges of the inner room
    // Shell 2: 4× — mid-distance corridors
    // Shell 3: 8× — deep background
    const outerScales    = [2.0, 4.0, 8.0];
    const outerWidths    = [0.020, 0.014, 0.010];
    const outerNodes     = [2.0,  1.6,   1.2];
    this._outerMats = [];

    outerScales.forEach((s, i) => {
      const mat = this._material.clone();
      mat.transparent = true;
      mat.depthWrite  = false;
      mat.uniforms    = THREE.UniformsUtils.clone(this._material.uniforms);
      mat.uniforms.uGridDensity.value    = 10;
      mat.uniforms.uLineWidth.value      = outerWidths[i];
      mat.uniforms.uNodeBrightness.value = outerNodes[i];
      mat.uniforms.uLineColor.value      = new THREE.Color(0xFFB300);
      mat.uniforms.uSolid.value          = 0.0; // discard background

      const geo  = new THREE.BoxGeometry(W * s, H * s, D * s);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = (H * s) / 2;
      this._group.add(mesh);
      this._outerMats.push(mat);
    });
  }

  update(elapsed) {
    if (this._material) {
      this._material.uniforms.uTime.value = elapsed;
    }
    this._outerMats?.forEach(m => {
      m.uniforms.uTime.value = elapsed;
    });
  }

  dispose() {
    this._scene.remove(this._group);
    this._material?.dispose();
    this._outerMats?.forEach(m => m.dispose());
  }
}
