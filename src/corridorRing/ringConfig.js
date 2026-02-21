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

  // ── Modular segments (rib spacing) ────────────────────────────────────
  segArc:    2.4,           // slightly tighter rib spacing (was 2.7)
  get segCount() { return Math.ceil(TAU * this.radius / this.segArc); },

  lcarsEvery:  5,
  doorEvery:   7,

  // ── Wall section heights ────────────────────────────────────────────────
  baseH:    0.32,           // large luminous base panel height
  railH:    0.85,           // handrail height
  bandLow:  1.20,           // black band bottom
  bandHigh: 1.80,           // black band top

  // ── Door labels (cycled) ───────────────────────────────────────────────
  doorLabels: [
    'ENGINEERING', 'SCIENCE LAB', 'TURBOLIFT',
    'MEDICAL', 'CREW QUARTERS', 'CARGO BAY',
  ],

  // ── Colour palette (Ref: TNG Engineering/Lower Deck corridor) ─────────
  palette: {
    // Floor: Blue centre path, pink/mauve edges
    carpetMain:    0xB09CA6,   // pink/mauve (now the outer main carpet)
    carpetStripe:  0x6E7D96,   // blue-grey (now the centre path)

    // Walls
    wallPanel:     0x999DA0,   // light cool grey panels (glossy plastic look)
    wallBlack:     0x080808,   // deep black recessed band

    // Baseboard light (large, bright white)
    baseboard:     0xFFFFFF,

    // Structural elements
    rib:           0xD4C4A0,   // tan/beige structural frames
    handrail:      0x4A2510,   // dark reddish-mahogany

    // Ceiling
    ceiling:       0xCCCCCC,   // structural ceiling background
    ceilPanel:     0xFFF8F0,   // bright white ceiling light panels

    // Doors
    doorFrame:     0xD4C4A0,   // matches ribs
    doorPanel:     0xB0B0B0,   // metallic grey
  },
};
