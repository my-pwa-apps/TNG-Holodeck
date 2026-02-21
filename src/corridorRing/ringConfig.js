/**
 * ringConfig.js — Enterprise-D circular corridor ring layout constants.
 * All measurements in metres.
 *
 * Angle convention (same as bridgeConfig):
 *   Standard Three.js — theta=0 → position on +Z axis.
 *   Positive theta rotates CCW when viewed from above.
 */

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const RING = {
  // ── Ring geometry ──────────────────────────────────────────────────────
  radius:     10,           // centreline radius
  halfWidth:  1.1,          // corridor half-width → 2.2 m clear width
  wallHeight: 2.4,          // vertical wall height
  archHeight: 0.3,          // additional ceiling arch above wallHeight
  segments:   64,           // ring tessellation (shared by shell geometry)
  archRes:    6,            // ceiling arch cross-section resolution

  // Derived radii
  get innerR()  { return this.radius - this.halfWidth; },   // 8.9 m
  get outerR()  { return this.radius + this.halfWidth; },   // 11.1 m
  get totalH()  { return this.wallHeight + this.archHeight; },

  // ── Modular segments ───────────────────────────────────────────────────
  segArc:    3.0,           // target arc length per module (~3 m)
  get segCount() { return Math.ceil(TAU * this.radius / this.segArc); },  // ~21

  // ── Instanced element frequencies ──────────────────────────────────────
  lcarsEvery:  5,           // LCARS panel every N segments
  doorEvery:   7,           // door frame every N segments

  // ── Trim band heights ─────────────────────────────────────────────────
  trimLow:   0.4,           // lower accent strip
  trimHigh:  1.6,           // upper accent strip

  // ── Door labels (cycled) ───────────────────────────────────────────────
  doorLabels: [
    'CREW QUARTERS', 'SCIENCE LAB', 'TURBOLIFT',
    'SICKBAY', 'ENGINEERING', 'CARGO BAY 2',
  ],

  // ── Colour palette (TNG warm matte) ────────────────────────────────────
  palette: {
    carpet:    0xB0B0B5,    // light grey
    wall:      0xCDBFA0,    // warm beige
    wallTrim:  0x776644,    // dark accent band
    wallPanel: 0xA89878,    // slightly darker panel inset
    ceiling:   0xD5CEBC,    // warm off-white
    ceilLight: 0xFFFFEE,    // emissive ceiling strip
    rib:       0xC8B89A,    // same as bridge rib colour
    doorFrame: 0x444444,
    doorPanel: 0xC8A882,
  },
};
