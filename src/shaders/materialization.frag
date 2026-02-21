// Materialization particle system - Fragment Shader
varying vec3  vColor;
varying float vAlpha;

void main() {
  // Soft circular point sprite
  vec2 coord = gl_PointCoord - 0.5;
  float r    = length(coord);
  if (r > 0.5) discard;

  // Soft edge
  float softness = 1.0 - smoothstep(0.35, 0.5, r);
  gl_FragColor = vec4(vColor, vAlpha * softness);
}
