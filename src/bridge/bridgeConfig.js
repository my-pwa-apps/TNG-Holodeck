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

  // ── Colour palette (TNG Season 2-7 bridge — reference image matched) ──
  palette: {
    // Floor
    carpet:     0x5C3848,   // deep burgundy/plum outer ring carpet
    carpetPit:  0xBFB9AC,   // light warm-grey pit centre floor

    // Walls
    wall:       0xD4C8A8,   // warm cream-beige (primary wall surface)
    wallPanel:  0xC4B898,   // slightly darker warm panel variant
    wallBand:   0x8A7862,   // medium warm-brown accent bands

    // Ceiling dome
    ceiling:    0xE2DBC8,   // warm off-white dome surface
    domeGlow:   0xFFF8F0,   // near-white backlit panel glow
    domeRib:    0xC8B880,   // tan/gold structural dome ribs

    // Consoles
    console:    0x5A5A62,   // warm charcoal console body (not so navy-dark)
    wood:       0x7C4A28,   // rich mahogany handrail / trim

    // Seating — cream/ivory (NOT red)
    seat:       0xD8CAA0,   // warm cream upholstered chairs

    // Misc
    frame:      0x3C3C3C,
    metal:      0xC0C0C0,
    doorFrame:  0x444444,
    doorPanel:  0x787878,   // charcoal grey sliding panels
    vsFrame:    0x1A1A1A,
    vsSurround: 0xD4C8A8,   // match wall
  },
};
