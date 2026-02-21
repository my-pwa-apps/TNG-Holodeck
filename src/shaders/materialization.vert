// Materialization particle system - Vertex Shader
attribute vec3  aTargetPosition;
attribute vec3  aRandomOffset;

uniform float   uProgress;  // 0 → 1 (materialize) or 1 → 0 (dematerialize)
uniform float   uTime;

varying vec3    vColor;
varying float   vAlpha;

void main() {
  // Converge from scattered offset toward target position
  float ease = smoothstep(0.0, 1.0, uProgress);
  vec3  pos  = aTargetPosition + aRandomOffset * (1.0 - ease);

  // Colour: orange → yellow → white
  vec3 orange = vec3(1.00, 0.40, 0.00);
  vec3 yellow = vec3(1.00, 0.70, 0.00);
  vec3 white  = vec3(1.00, 1.00, 1.00);

  if (uProgress < 0.5) {
    vColor = mix(orange, yellow, uProgress * 2.0);
  } else {
    vColor = mix(yellow, white, (uProgress - 0.5) * 2.0);
  }

  vAlpha = (1.0 - uProgress) * 0.9 + 0.1;

  vec4 mvPos  = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = mix(5.0, 1.5, uProgress) * (200.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
  gl_Position  = projectionMatrix * mvPos;
}
