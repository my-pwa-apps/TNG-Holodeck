import * as THREE from 'three';
import { RING }              from '../corridorRing/ringConfig.js';
import { buildCorridorRing } from '../corridorRing/ringBuilder.js';
import { clampToRing }       from '../corridorRing/ringClamp.js';

/**
 * CorridorScene — Enterprise-D Deck 7 Circular Corridor Ring
 *
 * Thin wrapper around the modular corridorRing builder.
 * Manages:
 *   • Scene lifecycle (load / unload)
 *   • Player rig clamping to the ring band
 *   • Door proximity slide animation
 *   • Red alert ceiling-light pulsing
 *   • Debug toggles (G = grid, H = inner/outer radius helpers)
 */
export class CorridorScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root  = null;
    this._res   = null;

    this._redAlertMode = false;
    this._redAlertTime = 0;

    // Debug helpers
    this._gridHelper    = null;
    this._radiusHelpers = null;
    this._onKeyDown     = null;

    // Pre-allocated scratch vector (avoids per-frame GC)
    this._camWorldPos = new THREE.Vector3();
  }

  // ── Load ──────────────────────────────────────────────────────────────

  load() {
    this._scene.fog = null;

    // Teleport player onto the ring centreline
    const cam = this._scene.userData.camera;
    if (cam) {
      // In desktop mode, camera starts at local (0, 1.6, 3).
      // Reset Z to 0 so it sits directly above the rig — prevents the
      // 3 m offset from pushing the camera outside the narrow corridor.
      cam.position.set(0, 1.6, 0);

      if (cam.parent) {
        // Place rig on the +X side of the ring.
        // Camera default look is -Z, which runs tangent to the ring here.
        cam.parent.position.set(RING.radius, 0, 0);
      }
    }

    const { root, resources } = buildCorridorRing();
    this._root = root;
    this._res  = resources;

    // Debug keyboard toggles
    this._onKeyDown = (e) => {
      if (e.key === 'g' || e.key === 'G') this._toggleGrid();
      if (e.key === 'h' || e.key === 'H') this._toggleRadiusHelpers();
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

    // Restore default desktop camera offset
    const cam = this._scene.userData.camera;
    if (cam) cam.position.set(0, 1.6, 3);

    this._removeGrid();
    this._removeRadiusHelpers();

    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._root = null;
    this._res  = null;
    this._redAlertMode = false;
  }

  // ── Per-frame update ──────────────────────────────────────────────────

  update(dt, elapsed) {
    if (!this._res) return;

    // ── Ring clamp (keeps player inside corridor band) ──────────
    const cam = this._scene.userData.camera;
    if (cam && cam.parent) {
      clampToRing(cam.parent.position);
    }

    // ── Door slide animation (keypad-driven, no proximity) ──────
    if (this._res?.doors?.length) {
      for (const door of this._res.doors) {
        const target = door.open ? 1 : 0;
        door.t += (target - door.t) * 8 * dt;
        door.t  = Math.max(0, Math.min(1, door.t));
        const slide = 0.68 * door.t;
        door.leftPanel.position.x  = -0.40 - slide;
        door.rightPanel.position.x =  0.40 + slide;
      }
    }

    // ── Red alert pulsing ───────────────────────────────────────
    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const on  = (this._redAlertTime % 1.0) < 0.4;
      const clm = this._res.ceilLightMat;
      if (clm) {
        clm.emissive.setHex(on ? 0xFF1100 : 0x330000);
        clm.emissiveIntensity = on ? 2.5 : 0.2;
      }
      this._res.accentLights.forEach(l => {
        l.color.setHex(on ? 0xFF1100 : 0x442200);
        l.intensity = on ? 3.0 : 0.5;
      });
    }
  }

  // ── Door keypad interaction ───────────────────────────────────────────

  toggleDoor(index) {
    const door = this._res?.doors?.[index];
    if (!door) return;
    door.open = !door.open;
    this._audio.play?.('door_slide');
  }

  // ── Red Alert toggle ──────────────────────────────────────────────────

  activateRedAlert() {
    this._redAlertMode = !this._redAlertMode;
    this._redAlertTime = 0;

    if (!this._redAlertMode && this._res) {
      // Restore normal lighting
      const clm = this._res.ceilLightMat;
      if (clm) {
        clm.emissive.setHex(RING.palette.ceilLight);
        clm.emissiveIntensity = 1.2;
      }
      this._res.accentLights.forEach(l => {
        l.color.setHex(0xFFE8CC);
        l.intensity = 2.0;
      });
    }
    this._audio.play?.('computer_ack');
  }

  // ── Warp (stub — corridors don't have viewscreens) ────────────────────

  activateWarp() {
    this._audio.play?.('computer_ack');
  }

  // ── Debug helpers ─────────────────────────────────────────────────────

  _toggleGrid() {
    if (this._gridHelper) { this._removeGrid(); return; }
    this._gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x333333);
    this._gridHelper.position.y = 0.02;
    this._root.add(this._gridHelper);
  }
  _removeGrid() {
    if (!this._gridHelper) return;
    this._root.remove(this._gridHelper);
    this._gridHelper.dispose();
    this._gridHelper = null;
  }

  _toggleRadiusHelpers() {
    if (this._radiusHelpers) { this._removeRadiusHelpers(); return; }
    this._radiusHelpers = [];
    const colors = [0xFF0000, 0x00FF00, 0x0000FF]; // inner, centre, outer
    [RING.innerR, RING.radius, RING.outerR].forEach((r, i) => {
      const geo = new THREE.RingGeometry(r - 0.03, r + 0.03, 64);
      geo.rotateX(-Math.PI / 2);
      const mat  = new THREE.MeshBasicMaterial({
        color: colors[i], transparent: true, opacity: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.03;
      this._root.add(mesh);
      this._radiusHelpers.push(mesh);
    });
  }
  _removeRadiusHelpers() {
    if (!this._radiusHelpers) return;
    this._radiusHelpers.forEach(h => {
      this._root.remove(h);
      h.geometry.dispose();
      h.material.dispose();
    });
    this._radiusHelpers = null;
  }
}
