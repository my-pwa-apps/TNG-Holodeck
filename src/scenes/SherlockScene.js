import * as THREE from 'three';

/**
 * SherlockScene — Victorian London, 221B Baker Street area.
 * Cobblestone street, gas lamps, fog, brick walls.
 */
export class SherlockScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root  = new THREE.Group();
    this._lamps = []; // {light, meshTop, phase}
    this._npcs  = [];
  }

  load() {
    this._scene.fog = new THREE.FogExp2(0x110b06, 0.045);

    // ── Ambient light (very dim — just gas lamp glow) ─────────────────────
    this._ambient = new THREE.AmbientLight(0x221508, 0.4);
    this._root.add(this._ambient);

    // ── Cobblestone floor ─────────────────────────────────────────────────
    this._root.add(this._buildFloor());

    // ── Brick walls ───────────────────────────────────────────────────────
    this._root.add(this._buildWalls());

    // ── Gas lamps ─────────────────────────────────────────────────────────
    const lampPositions = [
      [-3.5, 0, -4], [3.5, 0, -4],
      [-3.5, 0,  4], [3.5, 0,  4],
    ];
    lampPositions.forEach((pos, i) => {
      const lamp = this._buildLamp(pos, i * 1.1);
      this._root.add(lamp.group);
      this._lamps.push(lamp);
    });

    // ── NPC (simple hooded figure) ────────────────────────────────────────
    this._npcs.push(this._buildNPC(0, 0, -3));
    this._npcs.forEach(n => this._root.add(n.mesh));

    this._scene.add(this._root);
    return this._root;
  }

  _buildFloor() {
    // Procedural cobblestone via vertex colour noise
    const geo = new THREE.PlaneGeometry(20, 20, 40, 40);
    geo.rotateX(-Math.PI / 2);

    // Randomly displace cobblestone vertices slightly
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, (Math.random() - 0.5) * 0.04);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a3828,
      roughness: 0.95,
      metalness: 0.0,
    });
    return new THREE.Mesh(geo, mat);
  }

  _buildWalls() {
    const group = new THREE.Group();
    const mat   = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.9 });
    const H     = 5, W = 20, T = 0.4;

    [
      { pos: [0, H / 2, -10], rot: [0, 0, 0] },
      { pos: [0, H / 2,  10], rot: [0, Math.PI, 0] },
      { pos: [-10, H / 2, 0], rot: [0,  Math.PI / 2, 0] },
      { pos: [ 10, H / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ].forEach(({ pos, rot }) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      group.add(mesh);
    });
    return group;
  }

  _buildLamp(position, phase) {
    const group = new THREE.Group();
    group.position.set(...position);

    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 3.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })
    );
    pole.position.y = 1.75;
    group.add(pole);

    // Lantern glass
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color:           0xFFCC55,
        emissive:        new THREE.Color(0xFFAA22),
        emissiveIntensity: 1.8,
        transparent:     true,
        opacity:         0.85,
      })
    );
    glass.position.y = 3.6;
    group.add(glass);

    // Point light
    const light = new THREE.PointLight(0xFFAA33, 2.0, 8, 2);
    light.position.y = 3.7;
    light.castShadow  = true;
    group.add(light);

    return { group, light, glass, phase };
  }

  _buildNPC(x, y, z) {
    // Simple hooded figure from primitives
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9 });

    // Body (cloak)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.5, 8), mat);
    body.position.y = 0.75;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
    head.position.y = 1.7;
    group.add(head);

    // Hood
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), mat);
    hood.position.y = 1.95;
    group.add(hood);

    group.userData.interactable = true;

    let t = 0;
    const update = (dt) => {
      t += dt;
      group.position.z = z + Math.sin(t * 0.4) * 2.5;
      group.rotation.y = Math.sin(t * 0.4) > 0 ? 0 : Math.PI;
    };

    return { mesh: group, update };
  }

  unload() {
    this._scene.fog = null;
    if (this._ambient) this._ambient.dispose?.();
    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._lamps = [];
    this._npcs  = [];
  }

  getObjects() { return [this._root]; }

  update(dt, elapsed) {
    // Flicker gas lamps
    this._lamps.forEach(({ light, glass, phase }) => {
      const flicker = 0.8 + 0.2 * Math.sin(elapsed * 12 + phase)
                    + 0.05 * (Math.random() - 0.5);
      light.intensity  = 2.0 * flicker;
      glass.material.emissiveIntensity = 1.8 * flicker;
    });

    // Walk NPCs
    this._npcs.forEach(n => n.update(dt));
  }
}
