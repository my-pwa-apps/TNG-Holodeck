/**
 * lcarsTexture.js — procedural CanvasTexture generators for the bridge.
 *
 *  • LCARS console screens (animated + static variants)
 *  • Carpet noise texture
 *  • Starfield viewscreen
 *
 * All textures are 512 px max and designed for material reuse.
 */

import * as THREE from 'three';

// ── LCARS colour constants (TNG accurate) ────────────────────────────────
const LC = {
  orange:     '#FF9900',
  darkOrange: '#CC6600',
  peach:      '#FF9966',
  blue:       '#3366CC',
  teal:       '#3399AA',
  purple:     '#CC77CC',
  lavender:   '#9999CC',
  yellow:     '#FFCC00',
  bg:         '#040412',
};

function rrect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ── Animated LCARS screen ────────────────────────────────────────────────

/**
 * Allocate a canvas + CanvasTexture pair for an animated LCARS panel.
 * Call `drawLCARS()` each frame to update content.
 */
export function createLCARSCanvas(width = 512, height = 256) {
  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx     = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

/**
 * Paint a full LCARS frame with animated system read-outs.
 * @param {number} t  elapsed seconds (drives bars + stardate)
 */
export function drawLCARS(ctx, w, h, t = 0, title = 'SYS') {
  ctx.fillStyle = LC.bg;
  ctx.fillRect(0, 0, w, h);

  // Left bumper column (tall rounded rectangles — TNG LCARS signature)
  [LC.orange, LC.blue, LC.purple, LC.peach].forEach((c, i) => {
    rrect(ctx, 0, 4 + i * 44, 22, 38, 10, c);
  });

  // Top header bar — full width minus bumper column
  rrect(ctx, 26, 0, w - 26, 34, [0, 12, 0, 0], LC.orange);

  // Right-side colour block on header
  rrect(ctx, w - 60, 0, 60, 34, [0, 12, 12, 0], LC.darkOrange);

  // Title + stardate in header
  ctx.fillStyle = LC.bg;
  ctx.font = 'bold 14px Arial Narrow, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(title, 38, 23);
  ctx.textAlign = 'right';
  ctx.fillStyle = LC.bg;
  ctx.font = 'bold 12px Arial Narrow, Arial';
  ctx.fillText('SD ' + (47634 + t * 8.4).toFixed(1), w - 68, 23);
  ctx.textAlign = 'left';

  // System readouts
  const systems = [
    { label: 'SHIELDS',    color: LC.blue        },
    { label: 'WEAPONS',    color: LC.orange       },
    { label: 'PROPULSION', color: LC.purple       },
    { label: 'LIFE SUPP',  color: LC.darkOrange   },
    { label: 'SENSORS',    color: LC.teal         },
  ];

  systems.forEach((sys, i) => {
    const y    = 44 + i * 38;
    const fill = 0.55 + 0.40 * Math.abs(Math.sin(t * 0.7 + i * 1.4));

    // Label block (TNG-style: wide pill on left)
    rrect(ctx, 26, y, 98, 26, 4, sys.color);
    ctx.fillStyle = LC.bg;
    ctx.font = 'bold 10px Arial Narrow, Arial';
    ctx.fillText(sys.label, 32, y + 18);

    // Bar region — dark bg + coloured fill
    ctx.fillStyle = '#07071A';
    ctx.fillRect(128, y + 4, w - 136, 18);
    ctx.fillStyle = sys.color;
    ctx.fillRect(128, y + 4, (w - 136) * fill, 18);

    // Tick marks on bar
    for (let t2 = 0; t2 <= 10; t2++) {
      const tx = 128 + (w - 136) * (t2 / 10);
      ctx.fillStyle = LC.bg;
      ctx.fillRect(tx - 0.8, y + 4, 1.5, 18);
    }

    // Percentage readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(fill * 100) + '%', w - 6, y + 18);
    ctx.textAlign = 'left';
  });

  // Animated scan-line (very subtle)
  const scanY = 40 + ((t * 55) % (h - 50));
  ctx.strokeStyle = 'rgba(255,153,0,0.08)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(26, scanY);
  ctx.lineTo(w, scanY);
  ctx.stroke();
}

// ── Static LCARS (shared by instanced console screens) ───────────────────

/**
 * Return a pre-rendered LCARS CanvasTexture with muted colour blocks.
 * Used by InstancedMesh console surfaces — no per-frame updates needed.
 */
export function createStaticLCARSTexture(variant = 0, size = 512) {
  const canvas  = document.createElement('canvas');
  const h       = size / 2;
  canvas.width   = size;
  canvas.height  = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = LC.bg;
  ctx.fillRect(0, 0, size, h);

  // Colour bank (rotated by variant)
  const palette = [LC.orange, LC.blue, LC.purple, LC.teal,
                    LC.darkOrange, LC.peach, LC.lavender, LC.yellow];
  const pick = i => palette[(i + variant) % palette.length];

  // Header bar
  rrect(ctx, 0, 0, size, h * 0.14, [0, 0, 8, 8], pick(0));
  rrect(ctx, size * 0.62, 0, size * 0.38, h * 0.14, [0, 0, 8, 0], pick(1));

  // Left bumper column (tall stackable pills)
  for (let i = 0; i < 4; i++) {
    rrect(ctx, 0, h * 0.18 + i * h * 0.20, size * 0.055, h * 0.16, 8, pick(i + 1));
  }

  // Bottom footer bar
  rrect(ctx, 0, h * 0.92, size, h * 0.08, [8, 8, 0, 0], pick(2));

  // Content blocks (two columns)
  for (let row = 0; row < 3; row++) {
    const y  = h * 0.18 + row * h * 0.22;
    rrect(ctx, size * 0.07, y, size * 0.20, h * 0.16, 5, pick(row + 2));
    ctx.fillStyle = '#07071A';
    ctx.fillRect(size * 0.30, y + h * 0.03, size * 0.66, h * 0.10);
    const fill = 0.3 + 0.6 * Math.abs(Math.sin(variant + row * 1.7));
    ctx.fillStyle = pick(row + 4);
    ctx.fillRect(size * 0.30, y + h * 0.03, size * 0.66 * fill, h * 0.10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Carpet noise ─────────────────────────────────────────────────────────

export function createCarpetTexture(color = 0xB8B8BA, size = 256) {
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
    const n = (Math.random() - 0.5) * 12;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex   = new THREE.CanvasTexture(canvas);
  tex.wrapS   = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
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

// ── Starfield viewscreen ─────────────────────────────────────────────────

export function createStarfieldCanvas(width = 1024, height = 512) {
  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx     = canvas.getContext('2d');
  const stars   = Array.from({ length: 800 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.5 + 0.3,
    b: Math.random(),
  }));
  const texture = new THREE.CanvasTexture(canvas);
  return { canvas, ctx, stars, texture };
}

/**
 * Render one frame of the starfield (normal stars or warp streaks).
 */
export function drawStarfield(ctx, w, h, stars, t, warpActive, warpProgress) {
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, w, h);

  // Subtle nebula wash
  const grd = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.5);
  grd.addColorStop(0, 'rgba(20,15,40,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  if (warpActive) {
    const wp = warpProgress;
    stars.forEach(s => {
      const cx = w / 2, cy = h / 2;
      const dx = s.x - cx, dy = s.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return;
      const nx = dx / dist, ny = dy / dist;
      ctx.strokeStyle = `rgba(180,210,255,${0.4 + s.b * 0.6})`;
      ctx.lineWidth   = s.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + nx * dist * wp * 3.5, s.y + ny * dist * wp * 3.5);
      ctx.stroke();
    });
  } else {
    stars.forEach(s => {
      const a = s.b * (0.5 + 0.5 * Math.sin(t * 2 + s.x * 0.5));
      ctx.fillStyle = `rgba(200,215,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
