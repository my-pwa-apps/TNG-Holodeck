// Holographic Material - Vertex Shader
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPos  = modelMatrix * vec4(position, 1.0);
  vWorldPos      = worldPos.xyz;
  vNormal        = normalize(normalMatrix * normal);
  vViewDir       = normalize(cameraPosition - worldPos.xyz);
  gl_Position    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
