/**
 * ringConfig.js — Enterprise-D Deck 7 circular corridor ring layout constants.
 * All measurements in metres.
 *
 * Angle convention: theta=0 → +Z axis; positive theta rotates CCW from above.
 *
 * Reference aesthetics: TNG Enterprise-D corridor —
 *   warm tan/beige structural ribs, cool-grey wall panels, large black
 *   recessed window band mid-wall, bright white LED baseboard strips at
 *   floor level, blue-grey carpet with pink-mauve centre stripe,
 *   dark mahogany handrail, diffuse white recessed ceiling panels.
 */

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const RING = {
  // ── Ring geometry ──────────────────────────────────────────────────────
  radius:     10,           // centreline radius (m)
  halfWidth:  1.1,          // corridor half-width → 2.2 m clear
  wallHeight: 2.45,         // straight wall height before arch begins
  archHeight: 0.36,         // rise of ceiling arch above wallHeight
  segments:   64,           // ring tessellation
  archRes:    8,            // ceiling arch cross-section steps

  // Derived
  get innerR()  { return this.radius - this.halfWidth; },   // 8.90 m
  get outerR()  { return this.radius + this.halfWidth; },   // 11.10 m
  get totalH()  { return this.wallHeight + this.archHeight; },

  // ── Modular segments (rib / door / LCARS spacing) ───────────────────────
  segArc:    2.7,           // arc length per rib bay (~2.7 m)
  get segCount() { return Math.ceil(TAU * this.radius / this.segArc); }, // ~23

  lcarsEvery:  5,
  doorEvery:   7,

  // ── Wall section heights ────────────────────────────────────────────────
  baseH:    0.075,          // baseboard LED strip  (0 → baseH)
  bandLow:  0.78,           // black recessed band bottom
  bandHigh: 1.44,           // black recessed band top
  railH:    0.93,           // handrail centreline height

  // ── Door labels (cycled) ───────────────────────────────────────────────
  doorLabels: [
    'CREW QUARTERS', 'SCIENCE LAB', 'TURBOLIFT',
    'SICKBAY', 'ENGINEERING', 'CARGO BAY 2',
  ],

  // ── Colour palette (TNG Season 2-7 corridor) ───────────────────────────
  palette: {
    // Floor
    carpetMain:    0x6E7D96,   // blue-grey carpet
    carpetStripe:  0xB09CA6,   // pinkish-mauve centre stripe

    // Walls
    wallPanel:     0x888D96,   // cool mid-grey wall sections
    wallBlack:     0x0A0A0C,   // deep black recessed window band

    // LED baseboard strip (very bright emissive)
    baseboard:     0xF2F0EC,

    // Structural ribs (the distinctive TNG tan/beige)
    rib:           0xC8B898,

    // Mahogany handrail
    handrail:      0x3C1E0A,

    // Ceiling
    ceiling:       0xBDBBB4,   // warm light-grey arch ceiling
    ceilPanel:     0xDDD9D0,   // diffuse emissive ceiling light tiles

    // Doors
    doorFrame:     0x3A3A3A,
    doorPanel:     0xC4B488,
  },
};
