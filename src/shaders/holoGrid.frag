// Holodeck Grid Room - Fragment Shader (TNG-accurate)
// uSolid=1.0  → inner box:  black background, writes to depth buffer
// uSolid=0.0  → outer shells: transparent, background fragments discarded
uniform float uTime;
uniform float uGridDensity;
uniform float uLineWidth;
uniform float uNodeBrightness;
uniform vec3  uLineColor;
uniform float uSolid;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec2 cell = fract(vUv * uGridDensity);

  // ── Lines (step-based, consistent across XR hardware) ──────────────
  float lX   = step(1.0 - uLineWidth, cell.x) + step(cell.x, uLineWidth);
  float lY   = step(1.0 - uLineWidth, cell.y) + step(cell.y, uLineWidth);
  float line = clamp(lX + lY, 0.0, 1.0);

  // ── Intersection nodes: 2.5× line width ────────────────────────────
  float nW    = uLineWidth * 2.5;
  float nodeX = step(1.0 - nW, cell.x) + step(cell.x, nW);
  float nodeY = step(1.0 - nW, cell.y) + step(cell.y, nW);
  float node  = clamp(nodeX * nodeY, 0.0, 1.0);

  // ── TNG-accurate animation: barely-visible steady breathe ──────────
  // Measured from TNG episodes: grid variation is ~3-5%, not 18%
  float pulse     = 0.97 + 0.03 * sin(uTime * 1.05);
  float nodePulse = 1.0  + 0.10 * sin(uTime * 1.6 + vUv.x * 6.28 + vUv.y * 6.28);

  // ── Colour ──────────────────────────────────────────────────────────
  vec3 lineCol = uLineColor * pulse * 1.15;
  vec3 nodeCol = uLineColor * uNodeBrightness * nodePulse;
  vec3 color   = mix(lineCol, nodeCol, node) * line;

  // ── Output ──────────────────────────────────────────────────────────
  if (line < 0.01) {
    if (uSolid > 0.5) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // solid black, correct depth
    } else {
      discard; // outer shells: show inner geometry through them
    }
    return;
  }

  gl_FragColor = vec4(color, 1.0);
}
