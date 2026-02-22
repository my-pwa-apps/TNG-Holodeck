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

  // ── Modular segments ─────────────────────────────────────────────────
  segArc:    2.6,           // arc length per rib bay (~2.6 m)
  get segCount() { return Math.ceil(TAU * this.radius / this.segArc); },

  lcarsEvery:  5,
  doorEvery:   7,

  // ── Wall section heights (matched to reference image) ─────────────────
  // Image: ~0.25m bright baseboard, black band at ~0.95–1.28m, flat ceiling at ~2.5m
  baseH:      0.25,         // luminous white baseboard (0 → baseH)
  bandLow:    0.95,         // black recessed band bottom
  bandHigh:   1.28,         // black recessed band top
  railH:      1.12,         // handrail centre height (upper edge of black band)
  wallHeight: 2.50,         // flat ceiling height (overrides room.wallHeight)

  // ── Door labels (cycled) ───────────────────────────────────────────────
  doorLabels: [
    'CREW QUARTERS', 'SCIENCE LAB', 'TURBOLIFT',
    'SICKBAY', 'ENGINEERING', 'CARGO BAY',
  ],

  // ── Colour palette (matched to reference render) ──────────────────────
  palette: {
    // Floor — blue-grey centre, pink/mauve edges
    carpetMain:    0x9A8A8A,   // pink/mauve side panels
    carpetStripe:  0x5A6A84,   // blue-grey centre path

    // Walls (symmetric both sides)
    wallPanel:     0x8A9098,   // lighter cool grey (horizontal panels)
    wallBlack:     0x080808,   // deep black recessed horizontal band

    // Bright white luminous baseboard strip
    baseboard:     0xF8F8F8,   // pure white

    // Structural portal frames (warm tan/sandy beige)
    rib:           0xD4B88C,

    // Multi-rail mahogany handrail (outer wall)
    handrail:      0x4A2616,

    // Ceiling — TAN structural surface (same as ribs) + bright white light tiles
    ceiling:       0xD4B88C,   // tan/beige — ceiling frame matches rib colour
    ceilPanel:     0xF6F6F6,   // bright white recessed ceiling light tiles

    // Doors
    doorFrame:     0xD4B88C,   // match ribs
    doorPanel:     0x8A9098,   // match wall panels
  },
};
