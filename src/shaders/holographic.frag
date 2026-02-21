// Holographic Material - Fragment Shader
// Scanlines + Fresnel edge glow + subtle glitch + desaturation
uniform float uTime;
uniform vec3  uBaseColor;
uniform float uScanlineFreq;    // e.g. 80.0
uniform float uFresnelPower;    // e.g. 2.5
uniform float uGlitchIntensity; // e.g. 1.0
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // ── Fresnel ───────────────────────────────────────────
  float ndv     = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
  float fresnel = pow(1.0 - ndv, uFresnelPower);

  // ── Scanlines ─────────────────────────────────────────
  float scan = 1.0 + 0.045 * sin(vWorldPos.y * uScanlineFreq + uTime * 3.0);

  // ── Glitch ────────────────────────────────────────────
  float gSlot  = floor(uTime * 0.4);
  float gRand  = hash(vec2(gSlot, 0.3));
  float gRow   = hash(vec2(gSlot, floor(vUv.y * 24.0)));
  float glitch = step(0.96, gRand) * step(0.55, gRow) * uGlitchIntensity;

  // ── Desaturate + luminance boost ─────────────────────
  float luma      = dot(uBaseColor, vec3(0.299, 0.587, 0.114));
  vec3  desat     = mix(uBaseColor, vec3(luma), 0.25) * 1.35;

  // ── Edge glow (blue-cyan) ─────────────────────────────
  vec3  edgeCol   = vec3(0.18, 0.55, 1.0) * fresnel * 2.2;

  // ── Final ─────────────────────────────────────────────
  vec3  col   = (desat + vec3(glitch * 0.03, 0.0, 0.0)) * scan + edgeCol;
  float alpha = uOpacity + fresnel * 0.15;

  gl_FragColor = vec4(col, alpha);
}
