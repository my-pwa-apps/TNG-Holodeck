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
  // Image: ~0.20m bright baseboard, black band at ~1.0–1.32m, flat ceiling at ~2.5m
  baseH:    0.20,           // luminous white baseboard (0 → baseH)
  bandLow:  0.98,           // black recessed band bottom
  bandHigh: 1.30,           // black recessed band top
  railH:    1.08,           // handrail centre height (upper edge of black band)
  wallHeight: 2.50,         // flat ceiling height (overrides room.wallHeight)

  // ── Door labels (cycled) ───────────────────────────────────────────────
  doorLabels: [
    'CREW QUARTERS', 'SCIENCE LAB', 'TURBOLIFT',
    'SICKBAY', 'ENGINEERING', 'CARGO BAY',
  ],

  // ── Colour palette (matched to reference render) ──────────────────────
  palette: {
    // Floor — blue-grey centre, pink/mauve edges
    carpetMain:    0xB09090,   // pink/mauve side panels
    carpetStripe:  0x7888A0,   // blue-grey centre path

    // Walls (symmetric both sides)
    wallPanel:     0x7A7E84,   // medium-dark cool grey (horizontal panels)
    wallBlack:     0x080808,   // deep black recessed horizontal band

    // Bright white luminous baseboard strip
    baseboard:     0xF4F4F4,

    // Structural portal frames (warm tan/sandy beige)
    rib:           0xC8B898,

    // Multi-rail mahogany handrail (outer wall)
    handrail:      0x3C1A08,

    // Ceiling — flat ceiling surface + bright light panels
    ceiling:       0xA8AAAC,   // cool grey ceiling structural surface
    ceilPanel:     0xF8F8F8,   // bright white recessed ceiling light tiles

    // Doors
    doorFrame:     0xC8B898,   // match ribs
    doorPanel:     0x8A8E94,   // dark grey sliding panels
  },
};
