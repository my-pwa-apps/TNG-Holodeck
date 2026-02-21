// Holodeck Grid Room - Fragment Shader
// Iconic black room with amber (#FFB300) grid lines
uniform float uTime;
uniform float uGridDensity;   // tiles per axis
uniform float uLineWidth;     // 0.0 - 1.0, fraction of cell
uniform float uNodeBrightness;
uniform vec3  uLineColor;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec2 cell = fract(vUv * uGridDensity);

  // ── Lines ───────────────────────────────────────────────
  float lineX = step(1.0 - uLineWidth, cell.x) + step(cell.x, uLineWidth);
  float lineY = step(1.0 - uLineWidth, cell.y) + step(cell.y, uLineWidth);
  float line  = clamp(lineX + lineY, 0.0, 1.0);

  // ── Intersection nodes ─────────────────────────────────
  float nodeW  = uLineWidth * 2.5;
  float nodeX  = step(1.0 - nodeW, cell.x) + step(cell.x, nodeW);
  float nodeY  = step(1.0 - nodeW, cell.y) + step(cell.y, nodeW);
  float node   = clamp(nodeX * nodeY, 0.0, 1.0);

  // ── Animations ─────────────────────────────────────────
  float pulse     = 0.82 + 0.18 * sin(uTime * 1.4);
  float nodePulse = 1.0  + 0.6  * sin(uTime * 2.1 + vUv.x * 8.0 + vUv.y * 8.0);

  // ── Colour ─────────────────────────────────────────────
  vec3 lineCol = uLineColor * pulse;
  vec3 nodeCol = uLineColor * uNodeBrightness * nodePulse;
  vec3 color   = mix(lineCol, nodeCol, node) * line;

  if (line < 0.01) discard;

  gl_FragColor = vec4(color, line);
}
