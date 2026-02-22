/**
 * textureUtils.js — shared THREE.TextureLoader with caching.
 *
 * All textures in public/textures/ are CC0 from Poly Haven.
 * Normal maps are loaded as LinearSRGB (not sRGB) so Three.js
 * interprets the XYZ channels correctly.
 */
import * as THREE from 'three';

const _loader = new THREE.TextureLoader();
const _cache  = new Map();

function load(filename, { repeat = 1, isNormal = false } = {}) {
  const key = `${filename}:${repeat}`;
  if (_cache.has(key)) return _cache.get(key);

  const url = import.meta.env.BASE_URL + 'textures/' + filename;
  const tex = _loader.load(url);
  tex.wrapS     = THREE.RepeatWrapping;
  tex.wrapT     = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  // Normal maps store linear XYZ — keep out of sRGB pipeline
  if (isNormal) tex.colorSpace = THREE.NoColorSpace;

  _cache.set(key, tex);
  return tex;
}

// ── Public API ────────────────────────────────────────────────────────────

/** Woven-fabric normal map — good for carpet, upholstery */
export function fabricNormal(repeat = 4) {
  return load('fabric_pattern_07_nor_gl_1k.jpg', { repeat, isNormal: true });
}

/** Metal-plate normal map — good for consoles, door panels, ribs */
export function metalNormal(repeat = 2) {
  return load('metal_plate_nor_gl_1k.jpg', { repeat, isNormal: true });
}

/** Metal-plate roughness map — multiplied with material roughness value */
export function metalRoughness(repeat = 2) {
  return load('metal_plate_rough_1k.jpg', { repeat });
}
