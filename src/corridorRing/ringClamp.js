/**
 * ringClamp.js — Keep the player rig within the corridor ring band.
 *
 * Call once per frame from CorridorScene.update().
 * Clamps the cameraRig position so the XZ distance from origin stays
 * between innerR and outerR (with a small margin from the walls).
 * Also anchors Y to floor level (0).
 */

import { RING } from './ringConfig.js';

const MARGIN = 0.2;   // buffer from walls to prevent face-clipping

/**
 * @param {THREE.Vector3} position — typically `cameraRig.position`
 */
export function clampToRing(position) {
  const minR = RING.innerR + MARGIN;
  const maxR = RING.outerR - MARGIN;

  const dist = Math.sqrt(position.x * position.x + position.z * position.z);

  if (dist < minR || dist > maxR) {
    const clamped = Math.max(minR, Math.min(maxR, dist));
    if (dist > 0.001) {
      const s = clamped / dist;
      position.x *= s;
      position.z *= s;
    } else {
      // Degenerate case: at exact origin → push to inner edge, forward
      position.z = -minR;
    }
  }

  // Lock to floor (prevents vertical drift in smooth locomotion)
  position.y = 0;
}
