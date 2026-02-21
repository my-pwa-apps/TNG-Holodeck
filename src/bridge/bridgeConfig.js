/**
 * bridgeConfig.js — Enterprise-D bridge layout constants.
 * All measurements in metres.  Angles in degrees using the ship convention:
 *   0° = forward (-Z, viewscreen)   90° = starboard (+X)
 * 180° = aft (+Z, turbolifts)      270° = port (-X)
 */

export const DEG = Math.PI / 180;

/** Convert ship-convention degrees + radius → world XZ position. */
export function ringXZ(deg, r) {
  const a = deg * DEG;
  return [Math.sin(a) * r, -Math.cos(a) * r];
}

export const BRIDGE = {
  // ── Room envelope ──────────────────────────────────────────────────────
  room: {
    radius:     7.0,        // outer wall radius
    wallHeight: 3.2,        // vertical wall before dome begins
    domeApex:   4.8,        // dome peak
    segments:   64,         // tessellation
  },

  // ── Command pit ────────────────────────────────────────────────────────
  pit: {
    radius: 3.0,            // inner circle
    depth:  0.25,           // drop below outer floor
  },

  // ── Horseshoe console arc ──────────────────────────────────────────────
  horseshoe: {
    innerR:     4.2,
    outerR:     4.85,
    arcDeg:     220,        // opening faces forward
    count:      11,         // instanced segment count
    height:     0.95,       // console surface height
    screenTilt: 25 * DEG,   // LCARS tilt from horizontal
    railY:      1.12,       // wooden rail height
  },

  // ── Seating (x, z in pit coords, y = -pit.depth) ──────────────────────
  captain: { x: 0,    z: 0.8  },
  conn:    { x: 1.2,  z: -1.5 },
  ops:     { x: -1.2, z: -1.5 },

  // ── Standing consoles behind captain ───────────────────────────────────
  rearConsoles: [
    { x: -1.4, z: 2.2, label: 'SECURITY' },
    { x:  1.4, z: 2.2, label: 'TACTICAL' },
  ],

  // ── Viewscreen ─────────────────────────────────────────────────────────
  viewscreen: { w: 6.4, h: 3.0, z: -6.65 },

  // ── Doors (ship-angle degrees) ─────────────────────────────────────────
  doors: [
    { deg: 210, label: 'TURBOLIFT 1' },
    { deg: 150, label: 'TURBOLIFT 2' },
    { deg: 310, label: 'READY ROOM' },
    { deg:  50, label: 'OBSERVATION' },
  ],

  // ── Aft wall stations ──────────────────────────────────────────────────
  aftStations: [
    { deg: 232, label: 'SCIENCE I' },
    { deg: 218, label: 'SCIENCE II' },
    { deg: 197, label: 'ENVIRONMENT' },
    { deg: 163, label: 'ENGINEERING' },
    { deg: 142, label: 'MISSION OPS' },
    { deg: 128, label: 'TACTICAL II' },
  ],

  // ── Colour palette (TNG warm beige / matte) ───────────────────────────
  palette: {
    carpet:     0xB8B8BA,
    wall:       0xCDBFA0,
    wallPanel:  0xA89878,
    wallBand:   0x776644,
    ceiling:    0xD5CEBC,
    domeGlow:   0xFFF4DD,
    console:    0x2A2A3E,
    wood:       0x6B4226,
    seat:       0xAA2222,
    frame:      0x333333,
    metal:      0xBBBBBB,
    doorFrame:  0x444444,
    doorPanel:  0xC8A882,
    vsFrame:    0x1A1A1A,
    vsSurround: 0xCDBFA0,
  },
};
