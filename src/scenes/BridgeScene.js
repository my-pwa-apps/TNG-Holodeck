import * as THREE from 'three';
import { buildBridge }    from '../bridge/bridgeGenerator.js';
import { drawLCARS }      from '../bridge/lcarsTexture.js';
import { drawStarfield }  from '../bridge/lcarsTexture.js';

/**
 * BridgeScene — TNG Enterprise-D Main Bridge
 *
 * Uses modular bridgeGenerator for all geometry construction.
 * This wrapper manages:
 *   • Scene lifecycle (load / unload)
 *   • Per-frame animation (LCARS, starfield, warp, red alert)
 *   • Debug toggles (G = grid, B = bounding helpers)
 */
export class BridgeScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root  = null;
    this._res   = null;          // resources from buildBridge()

    this._warpActive   = false;
    this._warpProgress = 0;
    this._redAlertMode = false;
    this._redAlertTime = 0;
    this._starAccum    = 0;      // starfield canvas update throttle
    this._lcarsAccum   = 0;      // LCARS canvas update throttle
    this._lcarsT       = 0;      // animated LCARS elapsed time

    // Debug helpers
    this._gridHelper   = null;
    this._boundsHelper = null;
    this._onKeyDown    = null;
  }

  // ── Load ──────────────────────────────────────────────────────────────

  load() {
    this._scene.fog = null;

    const { root, resources } = buildBridge();
    this._root = root;
    this._res  = resources;

    // Initial draw so canvases aren't blank on first frame
    const al = resources.animLcars;
    drawLCARS(al.ctx, al.canvas.width, al.canvas.height, 0, 'BRIDGE');
    al.texture.needsUpdate = true;

    const sf = resources.starfield;
    drawStarfield(sf.ctx, sf.canvas.width, sf.canvas.height, sf.stars, 0, false, 0);
    sf.texture.needsUpdate = true;

    // Debug keyboard toggles
    this._onKeyDown = (e) => {
      if (e.key === 'g' || e.key === 'G') this._toggleGrid();
      if (e.key === 'b' || e.key === 'B') this._toggleBounds();
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._scene.add(this._root);
    return this._root;
  }

  // ── Unload ────────────────────────────────────────────────────────────

  unload() {
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this._removeGrid();
    this._removeBounds();
    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._root = null;
    this._res  = null;
  }

  // ── Per-frame update ──────────────────────────────────────────────────

  update(dt, elapsed) {
    const res = this._res;
    if (!res) return;

    // ── Animated LCARS (throttled ~15 fps) ───────────────────────────
    this._lcarsAccum += dt;
    if (this._lcarsAccum >= 0.066) {
      this._lcarsT += this._lcarsAccum;
      const al = res.animLcars;
      drawLCARS(al.ctx, al.canvas.width, al.canvas.height, this._lcarsT, 'BRIDGE');
      al.texture.needsUpdate = true;
      this._lcarsAccum = 0;
    }

    // ── Animated starfield (throttled ~20 fps) ──────────────────────
    this._starAccum += dt;
    if (this._starAccum >= 0.05) {
      const sf = res.starfield;
      drawStarfield(
        sf.ctx, sf.canvas.width, sf.canvas.height,
        sf.stars, elapsed,
        this._warpActive, this._warpProgress,
      );
      sf.texture.needsUpdate = true;
      this._starAccum = 0;
    }

    // ── Warp ramp ───────────────────────────────────────────────────
    if (this._warpActive) {
      this._warpProgress = Math.min(1, this._warpProgress + dt * 0.5);
      if (this._warpProgress >= 1) {
        setTimeout(() => { this._warpActive = false; this._warpProgress = 0; }, 2000);
      }
    }

    // ── Red alert pulsing ───────────────────────────────────────────
    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const on = (this._redAlertTime % 1.0) < 0.4;
      res.accentLights.forEach(l => {
        l.color.setHex(on ? 0xFF1100 : 0x330000);
        l.intensity = on ? 3.0 : 0.3;
      });
      if (res.ceilLightMat) {
        res.ceilLightMat.emissive.setHex(on ? 0xFF1100 : 0x330000);
        res.ceilLightMat.emissiveIntensity = on ? 3.5 : 0.3;
      }
    }
  }

  // ── Red Alert toggle ──────────────────────────────────────────────────

  activateRedAlert() {
    this._redAlertMode = !this._redAlertMode;
    this._redAlertTime = 0;
    if (!this._redAlertMode && this._res) {
      // Restore normal lighting
      this._res.accentLights.forEach(l => {
        l.color.setHex(0xFFEECC);
        l.intensity = l._origIntensity ?? 2.0;
      });
      if (this._res.ceilLightMat) {
        this._res.ceilLightMat.emissive.setHex(0xFFF8F0);
        this._res.ceilLightMat.emissiveIntensity = 2.4;
      }
    }
    this._audio.play?.('computer_ack');
  }

  // ── Warp trigger ──────────────────────────────────────────────────────

  activateWarp() {
    this._warpActive   = true;
    this._warpProgress = 0;
    this._audio.play?.('computer_ack');
  }

  // ── Debug helpers ─────────────────────────────────────────────────────

  _toggleGrid() {
    if (this._gridHelper) { this._removeGrid(); return; }
    this._gridHelper = new THREE.GridHelper(14, 28, 0x444444, 0x333333);
    this._gridHelper.position.y = 0.02;
    this._root.add(this._gridHelper);
  }
  _removeGrid() {
    if (!this._gridHelper) return;
    this._root.remove(this._gridHelper);
    this._gridHelper.dispose();
    this._gridHelper = null;
  }

  _toggleBounds() {
    if (this._boundsHelper) { this._removeBounds(); return; }
    this._boundsHelper = new THREE.BoxHelper(this._root, 0x00ff00);
    this._root.add(this._boundsHelper);
  }
  _removeBounds() {
    if (!this._boundsHelper) return;
    this._root.remove(this._boundsHelper);
    this._boundsHelper.dispose();
    this._boundsHelper = null;
  }
}
