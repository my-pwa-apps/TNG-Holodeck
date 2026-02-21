import * as THREE from 'three';

/**
 * AlienScene — Alien planet with heightmap terrain, two suns,
 * bioluminescent flora, and atmospheric scattering fog.
 */
export class AlienScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root  = new THREE.Group();
    this._flora = [];
    this._sunLights = [];
    this._sporesMesh = null;
  }

  load() {
    // ── Atmospheric fog ───────────────────────────────────────────────────
    this._scene.fog = new THREE.FogExp2(0x1a0033, 0.035);

    // ── Sky dome ──────────────────────────────────────────────────────────
    this._root.add(this._buildSky());

    // ── Terrain ───────────────────────────────────────────────────────────
    this._root.add(this._buildTerrain());

    // ── Two suns ──────────────────────────────────────────────────────────
    this._root.add(this._buildSuns());

    // ── Bioluminescent flora ──────────────────────────────────────────────
    this._root.add(this._buildFlora());

    // ── Ambient ───────────────────────────────────────────────────────────
    // Raised so purple terrain isn't crushed to black by ACESFilmic.
    this._root.add(new THREE.AmbientLight(0x441166, 1.0));

    // Extra details
    this._root.add(this._buildRocks());
    this._root.add(this._buildCrystals());
    this._root.add(this._buildSpores());

    this._scene.add(this._root);
    return this._root;
  }

  _buildSky() {
    // Large dome with gradient shader via vertex colours
    const geo = new THREE.SphereGeometry(80, 32, 16);
    geo.scale(-1, -1, -1); // invert normals

    // Paint vertex colours: bottom purple → top deep blue
    const col  = new THREE.Color();
    const cols = [];
    const pos  = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = (pos.getY(i) / 80 + 1) / 2; // 0..1
      col.setRGB(
        0.05 + y * 0.02,
        0.00 + y * 0.01,
        0.12 + y * 0.08
      );
      cols.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: false,
    });

    // Sun discs painted onto a canvas texture
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = sunCanvas.height = 512;
    const sctx = sunCanvas.getContext('2d');
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, 512, 512);
    // Sun 1 — warm orange
    const g1 = sctx.createRadialGradient(130, 120, 0, 130, 120, 50);
    g1.addColorStop(0, 'rgba(255,230,160,1)');
    g1.addColorStop(0.4, 'rgba(255,160,40,0.6)');
    g1.addColorStop(1, 'rgba(255,80,0,0)');
    sctx.fillStyle = g1; sctx.fillRect(0, 0, 512, 512);
    // Sun 2 — blue-white
    const g2 = sctx.createRadialGradient(380, 90, 0, 380, 90, 30);
    g2.addColorStop(0, 'rgba(200,220,255,1)');
    g2.addColorStop(0.5, 'rgba(100,150,255,0.4)');
    g2.addColorStop(1, 'rgba(0,80,255,0)');
    sctx.fillStyle = g2; sctx.fillRect(0, 0, 512, 512);

    mat.map = new THREE.CanvasTexture(sunCanvas);
    mat.map.needsUpdate = true;

    return new THREE.Mesh(geo, mat);
  }

  _buildTerrain() {
    const res = 128;
    const size = 40;
    const geo  = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
    geo.rotateX(-Math.PI / 2);

    // Generate heightmap using layered noise
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this._noise(x * 0.15, z * 0.15) * 2.0
              + this._noise(x * 0.4,  z * 0.4)  * 0.7
              + this._noise(x * 1.0,  z * 1.0)  * 0.2;
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color:     0x2d0a4e,
      roughness: 0.85,
      metalness: 0.1,
      emissive:  new THREE.Color(0x110022),
      emissiveIntensity: 0.3,
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    return terrain;
  }

  _noise(x, y) {
    // Simple smooth noise approximation
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi,        yf = y - yi;
    const h = (a, b) => Math.sin(a * 127.1 + b * 311.7) * 43758.5453 % 1;
    const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    return lerp(
      lerp(h(xi, yi), h(xi + 1, yi), xf),
      lerp(h(xi, yi + 1), h(xi + 1, yi + 1), xf),
      yf
    );
  }

  _buildSuns() {
    const group = new THREE.Group();

    // Warm sun (dominant)
    const sun1 = new THREE.DirectionalLight(0xFFD080, 3.0);
    sun1.position.set(-15, 20, -20);
    sun1.castShadow  = true;
    sun1.shadow.mapSize.width  = 1024;
    sun1.shadow.mapSize.height = 1024;
    group.add(sun1);
    this._sunLights.push(sun1);

    // Cool sun (secondary, blue-white)
    const sun2 = new THREE.DirectionalLight(0x99AAFF, 1.2);
    sun2.position.set(20, 12, -10);
    group.add(sun2);
    this._sunLights.push(sun2);

    return group;
  }

  _buildFlora() {
    const group = new THREE.Group();
    const positions = [];

    // Scatter 120 flora in a grid+random pattern
    for (let i = 0; i < 120; i++) {
      positions.push([
        (Math.random() - 0.5) * 28,
        0,
        (Math.random() - 0.5) * 28,
      ]);
    }

    const colors = [0x00FFAA, 0xFF00FF, 0x00FFFF, 0xAAFF00];

    positions.forEach((pos, idx) => {
      const h    = 0.4 + Math.random() * 1.6;
      const col  = colors[idx % colors.length];
      const mesh = this._buildFloraItem(h, col);
      mesh.position.set(...pos);
      group.add(mesh);
      this._flora.push({ mesh, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.2, color: col });
    });

    return group;
  }

  _buildFloraItem(height, colorHex) {
    const col  = new THREE.Color(colorHex);
    const mat  = new THREE.MeshStandardMaterial({
      color:             col,
      emissive:          col,
      emissiveIntensity: 0.6,
      roughness:         0.4,
      transparent:       true,
      opacity:           0.85,
    });

    const group = new THREE.Group();

    // Stalk
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.04, height, 5),
      mat
    );
    stalk.position.y = height / 2;
    group.add(stalk);

    // Tip blob
    const tip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12 + Math.random() * 0.1, 1),
      mat
    );
    tip.position.y = height + 0.1;
    group.add(tip);

    group.userData.interactable = true;
    return group;
  }

  unload() {
    this._scene.fog = null;
    if (this._sporesMesh) {
      this._sporesMesh.geometry?.dispose();
      this._sporesMesh.material?.dispose();
      this._sporesMesh = null;
    }
    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._flora = [];
  }

  getObjects() { return [this._root]; }

  update(dt, elapsed) {
    this._flora.forEach(({ mesh, phase, speed }) => {
      const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(elapsed * speed + phase));
      mesh.traverse(o => {
        if (o.isMesh && o.material?.emissive) o.material.emissiveIntensity = pulse;
      });
      mesh.rotation.z = 0.08 * Math.sin(elapsed * speed * 0.5 + phase);
    });

    // Float spores upward, wrap at y = 5
    if (this._sporesMesh) {
      const pos = this._sporesMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (0.04 + 0.02 * Math.sin(elapsed + i));
        if (y > 5) y -= 5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }

  // ── Rocks ──────────────────────────────────────────────────
  _buildRocks() {
    const group = new THREE.Group();
    const mat   = new THREE.MeshStandardMaterial({
      color: 0x2a1a35, roughness: 0.9, metalness: 0.1,
    });
    for (let i = 0; i < 16; i++) {
      const scale = 0.3 + Math.random() * 0.9;
      const geo   = new THREE.IcosahedronGeometry(scale, 1);
      // Deform vertices slightly for organic look
      const pos   = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        pos.setXYZ(v,
          pos.getX(v) * (0.85 + Math.random() * 0.3),
          pos.getY(v) * (0.7  + Math.random() * 0.3),
          pos.getZ(v) * (0.85 + Math.random() * 0.3)
        );
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(
        (Math.random() - 0.5) * 24,
        -scale * 0.4,
        (Math.random() - 0.5) * 24
      );
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      group.add(rock);
    }
    return group;
  }

  // ── Crystal spires ──────────────────────────────────────────
  _buildCrystals() {
    const group  = new THREE.Group();
    const colors = [0x00EEFF, 0xFF00CC, 0xAA00FF, 0x00FFCC];
    for (let i = 0; i < 10; i++) {
      const col  = colors[i % colors.length];
      const c    = new THREE.Color(col);
      const mat  = new THREE.MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.75, roughness: 0.1,
      });
      const h    = 0.8 + Math.random() * 2.4;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 5), mat);
      spire.position.set(
        (Math.random() - 0.5) * 22,
        h / 2,
        (Math.random() - 0.5) * 22
      );
      spire.rotation.y = Math.random() * Math.PI;
      group.add(spire);
      // Two smaller sub-crystals
      for (let s = 0; s < 2; s++) {
        const sh = h * 0.5;
        const sub = new THREE.Mesh(new THREE.ConeGeometry(0.07, sh, 5), mat);
        sub.position.set(
          spire.position.x + (Math.random() - 0.5) * 0.35,
          sh / 2,
          spire.position.z + (Math.random() - 0.5) * 0.35
        );
        sub.rotation.y = Math.random() * Math.PI;
        sub.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(sub);
      }
    }
    return group;
  }

  // ── Floating spores ──────────────────────────────────────────
  _buildSpores() {
    const COUNT = 600;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color:    0xAAFFCC,
      size:     0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity:  0.7,
    });
    this._sporesMesh = new THREE.Points(geo, mat);
    return this._sporesMesh;
  }}