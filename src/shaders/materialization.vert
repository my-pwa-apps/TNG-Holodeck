// Materialization particle system - Vertex Shader
attribute vec3  aTargetPosition;

uniform float   uProgress;  // 0 → 1 (materialize) or 1 → 0 (dematerialize)
uniform float   uTime;
uniform float   uMinY;
uniform float   uMaxY;
uniform float   uDirection; // 1.0 or -1.0

varying vec3    vColor;
varying float   vAlpha;

void main() {
  vec3 pos = aTargetPosition;
  
  float height = uMaxY - uMinY;
  float scannerY = uMinY + uProgress * height;
  
  // Distance from this particle to the scanner
  // If uDirection is 1.0 (materialize), scanner moves UP.
  // If uDirection is -1.0 (dematerialize), scanner moves DOWN.
  // We multiply dist by uDirection so that negative dist always means "behind the scanner"
  // and positive dist always means "ahead of the scanner".
  float dist = (pos.y - scannerY) * uDirection;
  
  // TNG Holodeck colors: Yellow / Gold grid
  vec3 gold = vec3(1.0, 0.7, 0.1);
  vec3 brightYellow = vec3(1.0, 0.9, 0.4);
  
  vAlpha = 0.0;
  vColor = gold;
  float pSize = 2.0;
  
  if (uProgress > 0.0 && uProgress < 1.0) {
    // Particles are visible just ahead and behind the scanner
    if (dist < 0.0 && dist > -0.8) {
      // Behind scanner (already processed) - fade out quickly
      float fade = 1.0 - (abs(dist) / 0.8);
      vAlpha = fade * 0.6;
      vColor = mix(gold, brightYellow, fade);
      pSize = mix(2.0, 5.0, fade);
    } else if (dist >= 0.0 && dist < 0.2) {
      // Right at the scanner (bright flash)
      vAlpha = 1.0;
      vColor = brightYellow;
      pSize = 8.0;
    } else if (dist >= 0.2 && dist < 1.0) {
      // Ahead of scanner (about to be processed) - fade in
      float fade = 1.0 - ((dist - 0.2) / 0.8);
      vAlpha = fade * 0.4;
      vColor = gold;
      pSize = mix(1.0, 3.0, fade);
    }
  }
  
  // Add some sparkle based on time and position
  float sparkle = sin(uTime * 15.0 + pos.x * 20.0 + pos.z * 20.0) * 0.5 + 0.5;
  vAlpha *= (0.6 + 0.4 * sparkle);

  vec4 mvPos  = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = pSize * (200.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 15.0);
  gl_Position  = projectionMatrix * mvPos;
}
