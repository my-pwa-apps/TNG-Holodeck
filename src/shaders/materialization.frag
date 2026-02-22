// Materialization particle system - Fragment Shader
varying vec3  vColor;
varying float vAlpha;

void main() {
  // Soft vertical beam/sparkle sprite
  vec2 coord = gl_PointCoord - 0.5;
  
  // Stretch vertically to look like a transporter beam particle
  coord.x *= 3.5; // Make it narrow horizontally
  coord.y *= 0.8; // Slightly stretch vertically
  
  float r = length(coord);
  if (r > 0.5) discard;

  // Soft edge with intense core
  float softness = 1.0 - smoothstep(0.1, 0.5, r);
  
  // Add a bright core
  float core = 1.0 - smoothstep(0.0, 0.15, r);
  vec3 finalColor = mix(vColor, vec3(2.0, 2.0, 2.0), core * 0.5);

  gl_FragColor = vec4(finalColor, vAlpha * softness);
}
