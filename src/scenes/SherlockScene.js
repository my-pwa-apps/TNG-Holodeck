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
    this._scene.fog = new THREE.FogExp2(0x110b06, 0.038);

    // ── Ambient light — raised so ACES doesn't crush the dark surfaces ─────
    // A warm candlelight tint at decent intensity; gas lamps add the local fill.
    this._ambient = new THREE.AmbientLight(0x5c3010, 1.2);
    this._root.add(this._ambient);
    // Cool night-sky fill to keep deep shadows blue-tinted
    this._root.add(new THREE.AmbientLight(0x0c1020, 0.4));

    // ── Cobblestone floor ─────────────────────────────────────────────────
    this._root.add(this._buildFloor());

    // ── Brick walls ───────────────────────────────────────────────────────
    this._root.add(this._buildWalls());

    // ── Window glows ──────────────────────────────────────────────────────
    this._root.add(this._buildWindows());

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

    // ── NPCs (three hooded figures, varying speeds and ranges) ────────────
    [
      { x: 0,    z: -3,   speed: 0.40, range: 2.5 },
      { x: -3.5, z:  1.5, speed: 0.30, range: 3.0 },
      { x:  3.0, z: -1.5, speed: 0.45, range: 2.0 },
    ].forEach(({ x, z, speed, range }) => {
      const npc = this._buildNPC(x, 0, z, speed, range);
      this._npcs.push(npc);
      this._root.add(npc.mesh);
    });

    this._scene.add(this._root);
    return this._root;
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(20, 20, 40, 40);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x4a3828);
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, (Math.random() - 0.5) * 0.04);
      // Slight per-vertex colour variation — makes individual cobblestones readable
      const v = 0.7 + Math.random() * 0.55;
      cols[i * 3]     = base.r * v;
      cols[i * 3 + 1] = base.g * v;
      cols[i * 3 + 2] = base.b * v;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness:    0.35,   // wet cobblestones — specular gloss
      metalness:    0.06,
    }));
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

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.5, 8), ironMat);
    pole.position.y = 1.75;
    group.add(pole);

    // Horizontal arm bracket
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), ironMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.275, 3.3, 0);
    group.add(arm);

    // Lantern glass
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xFFCC55, emissive: new THREE.Color(0xFFAA22),
        emissiveIntensity: 1.8, transparent: true, opacity: 0.85,
      })
    );
    glass.position.set(0.55, 3.6, 0);
    group.add(glass);

    // Point light at lantern position
    const light = new THREE.PointLight(0xFFAA33, 5.0, 10, 2);
    light.position.set(0.55, 3.7, 0);
    light.castShadow = true;
    group.add(light);

    return { group, light, glass, phase };
  }

  _buildNPC(x, y, z, speed = 0.4, range = 2.5) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.5, 8), mat);
    body.position.y = 0.75;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
    head.position.y = 1.7;
    group.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), mat);
    hood.position.y = 1.95;
    group.add(hood);
    group.userData.interactable = true;
    let t = 0;
    const update = (dt) => {
      t += dt;
      group.position.z = z + Math.sin(t * speed) * range;
      group.rotation.y = Math.sin(t * speed) > 0 ? 0 : Math.PI;
    };
    return { mesh: group, update };
  }

  _buildWindows() {
    const group  = new THREE.Group();
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xFFCC44, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    // Four window positions on front and left walls
    const windows = [
      { pos: [-2.5, 2.5, -9.75], ry: 0   },
      { pos: [ 2.5, 2.5, -9.75], ry: 0   },
      { pos: [-9.75, 2.5, -2.5], ry: Math.PI / 2 },
      { pos: [-9.75, 2.5,  2.5], ry: Math.PI / 2 },
    ];
    windows.forEach(({ pos, ry }) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), glowMat);
      pane.position.set(...pos);
      pane.rotation.y = ry;
      group.add(pane);
      // Warm point light from each window
      const wl = new THREE.PointLight(0xFFCC44, 0.6, 4);
      wl.position.set(...pos);
      group.add(wl);
    });
    return group;
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
      light.intensity  = 5.0 * flicker;
      glass.material.emissiveIntensity = 2.2 * flicker;
    });

    // Walk NPCs
    this._npcs.forEach(n => n.update(dt));
  }
}
