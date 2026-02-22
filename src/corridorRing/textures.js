/**
 * textures.js — procedural CanvasTexture generators for the corridor ring.
 *
 *  • Carpet noise (light grey, subtle per-pixel variation)
 *  • Wall panel noise (warm beige, subtle vertical grain)
 *  • LCARS panel (static display for door keypads / info panels)
 *
 * All textures ≤ 512 px.  Designed for material reuse.
 */

import * as THREE from 'three';

// ── Carpet noise ─────────────────────────────────────────────────────────

export function createCarpetTexture(color = 0xB0B0B5, size = 256) {
  const canvas  = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const r = (color >> 16) & 0xFF;
  const g = (color >>  8) & 0xFF;
  const b =  color        & 0xFF;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d   = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex   = new THREE.CanvasTexture(canvas);
  tex.wrapS   = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Wall panel noise ─────────────────────────────────────────────────────

export function createWallTexture(color = 0xCDBFA0, size = 256) {
  const canvas  = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const r = (color >> 16) & 0xFF;
  const g = (color >>  8) & 0xFF;
  const b =  color        & 0xFF;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Subtle vertical grain (wood-panel-like streaks)
  const img = ctx.getImageData(0, 0, size, size);
  const d   = img.data;
  for (let x = 0; x < size; x++) {
    const streak = (Math.random() - 0.5) * 6;
    for (let y = 0; y < size; y++) {
      const idx = (y * size + x) * 4;
      const n   = streak + (Math.random() - 0.5) * 4;
      d[idx]     = Math.max(0, Math.min(255, d[idx]     + n));
      d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + n));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + n));
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex   = new THREE.CanvasTexture(canvas);
  tex.wrapS   = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── LCARS panel (static) ─────────────────────────────────────────────────

const LC_COLS = ['#FF9900', '#CC6600', '#3366CC', '#CC77CC', '#3399AA'];

function rrect(ctx, x, y, w, h, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function createLCARSPanelTexture(label = 'DECK 7', size = 256) {
  const canvas  = document.createElement('canvas');
  const h       = size / 2;
  canvas.width  = size;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#040412';
  ctx.fillRect(0, 0, size, h);

  // Header bar — orange pill + secondary blue block
  rrect(ctx, 0, 0, size * 0.60, h * 0.16, [0, 0, 10, 10], LC_COLS[0]);
  rrect(ctx, size * 0.64, 0, size * 0.36, h * 0.16, [0, 0, 0, 10], LC_COLS[2]);
  ctx.fillStyle = '#040412';
  ctx.font = `bold ${Math.round(h * 0.10)}px Arial Narrow, Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(label, size * 0.30, h * 0.12);
  ctx.textAlign = 'left';

  // Left bumper column (stacked tall pills)
  for (let i = 0; i < 3; i++) {
    rrect(ctx, 0, h * (0.22 + i * 0.24), size * 0.075, h * 0.18, 5,
          LC_COLS[(i + 1) % LC_COLS.length]);
  }

  // Content blocks + progress bars
  for (let row = 0; row < 3; row++) {
    const y = h * (0.22 + row * 0.24);
    rrect(ctx, size * 0.10, y, size * 0.22, h * 0.16, 3,
          LC_COLS[(row + 2) % LC_COLS.length]);
    ctx.fillStyle = '#07071A';
    ctx.fillRect(size * 0.36, y + h * 0.04, size * 0.60, h * 0.08);
    const fill = 0.35 + 0.55 * Math.abs(Math.sin(row * 2.3));
    ctx.fillStyle = LC_COLS[(row + 3) % LC_COLS.length];
    ctx.fillRect(size * 0.36, y + h * 0.04, size * 0.60 * fill, h * 0.08);
  }

  // Bottom footer bar
  rrect(ctx, 0, h * 0.90, size, h * 0.10, [5, 5, 0, 0], LC_COLS[1]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
