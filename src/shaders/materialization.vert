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
  
  // TNG Holodeck/Transporter colors: Intense bright white core, gold/yellow fringe
  vec3 gold = vec3(1.5, 1.0, 0.2);
  vec3 brightWhite = vec3(2.0, 2.0, 2.0);
  
  vAlpha = 0.0;
  vColor = gold;
  float pSize = 4.0;
  
  // Add vertical streaming motion typical of TNG transporters
  float stream = uTime * 3.0 + pos.x * 12.0 + pos.z * 12.0;
  pos.y += sin(stream) * 0.15;
  
  if (uProgress > 0.0 && uProgress < 1.0) {
    // Particles are visible just ahead and behind the scanner
    if (dist < 0.0 && dist > -1.2) {
      // Behind scanner (already processed) - fade out
      float fade = 1.0 - (abs(dist) / 1.2);
      vAlpha = fade * 0.8;
      vColor = mix(gold, brightWhite, fade * fade);
      pSize = mix(4.0, 12.0, fade);
    } else if (dist >= 0.0 && dist < 0.3) {
      // Right at the scanner (intense bright flash)
      vAlpha = 1.0;
      vColor = brightWhite;
      pSize = 20.0;
    } else if (dist >= 0.3 && dist < 1.2) {
      // Ahead of scanner (about to be processed) - fade in
      float fade = 1.0 - ((dist - 0.3) / 0.9);
      vAlpha = fade * 0.6;
      vColor = mix(gold, brightWhite, fade);
      pSize = mix(2.0, 8.0, fade);
    }
  }
  
  // Hyperrealistic chaotic sparkle
  float sparkle = sin(uTime * 25.0 + pos.y * 30.0 + pos.x * 40.0) * 0.5 + 0.5;
  vAlpha *= (0.3 + 0.7 * pow(sparkle, 2.0));

  vec4 mvPos  = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = pSize * (300.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 2.0, 40.0);
  gl_Position  = projectionMatrix * mvPos;
}
