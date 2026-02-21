import * as THREE from 'three';

/**
 * CorridorScene — Enterprise-D Deck 7 corridor.
 *
 * Geometry overview:
 *   - D-shaped cross-section: flat floor + vertical side walls + curved ceiling arc
 *   - 22-metre length, running along the Z axis
 *   - Warm beige/tan hull plates with darker accent strips (TNG palette)
 *   - 3 pairs of sliding doors (port + starboard) with LCARS panels
 *   - 1 blue-force containment field spanning the cross-section
 *   - Phaser (Type-II) on a wall bracket — interactable and fireable
 *   - Overhead lighting strips in the ceiling arc
 *
 * Transporter materialization is handled by MaterializationSystem:
 *   load() returns this._root and the engine calls matSys.materialize([root]).
 */
export class CorridorScene {
  constructor(scene, audio) {
    this._scene  = scene;
    this._audio  = audio;
    this._root   = new THREE.Group();

    // Doors — each entry: { left, right, open, t, triggerZ }
    this._doors = [];

    // Containment field
    this._fieldMat   = null;
    this._fieldMesh  = null;

    // Phaser
    this._phaserGroup  = null;
    this._phaserBeam   = null;
    this._beamTimer    = 0;

    // Camera ref (set in update — we get it from the scene's camera)
    this._camera = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  load() {
    // Retrieve camera from scene userData (set by engine)
    this._camera = this._scene.userData.camera ?? null;

    this._buildHull();
    this._buildLights();
    this._buildDoors();
    this._buildContainmentField();
    this._buildPhaser();
    this._buildEndCaps();

    this._scene.add(this._root);
    return this._root;
  }

  unload() {
    this._scene.remove(this._root);
    this._root.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material?.dispose();
      }
    });
    this._fieldMat  = null;
    this._phaserBeam = null;
  }

  update(dt, elapsed) {
    // Animate containment field shimmer
    if (this._fieldMat) {
      this._fieldMat.opacity = 0.18 + 0.10 * Math.abs(Math.sin(elapsed * 3.1));
      this._fieldMat.color.setHSL(0.6, 0.9, 0.5 + 0.12 * Math.sin(elapsed * 5.7));
    }

    // Animate door proximity (use engine camera if available)
    const cam = this._scene.userData.camera;
    if (cam) {
      const cp = cam.getWorldPosition(new THREE.Vector3());
      for (const door of this._doors) {
        const dist = Math.abs(cp.z - door.triggerZ);
        door.open = dist < 2.2;
        door.t   += ((door.open ? 1 : 0) - door.t) * (8 * dt);
        door.left.position.x  = -0.72 * door.t;
        door.right.position.x =  0.72 * door.t;
      }
    }

    // Phaser beam decay
    if (this._beamTimer > 0) {
      this._beamTimer -= dt;
      if (this._phaserBeam) {
        this._phaserBeam.material.opacity = Math.min(1, this._beamTimer * 4);
        if (this._beamTimer <= 0) {
          this._phaserBeam.visible = false;
          this._beamTimer = 0;
        }
      }
    }
  }

  /** Called by engine when trigger / selectstart fires on right controller */
  onPhaserFire(controller) {
    if (!this._phaserBeam) return;
    this._phaserBeam.visible = true;
    this._beamTimer = 0.4;
    this._audio.play?.('computer_ack');   // re-use TNG chirp until dedicated sound
  }

  // ── Hull geometry ───────────────────────────────────────────────────────
  _buildHull() {
    const L = 11;
    const zStart = -L, zEnd = L;

    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x4a5a75, roughness: 0.9 });
    const floorBorderMat = new THREE.MeshStandardMaterial({ color: 0xc8b8b0, roughness: 0.8 });
    const lightStripMat = new THREE.MeshStandardMaterial({ color: 0xddddff, emissive: 0xddddff, emissiveIntensity: 1.5 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xa0a5a9, roughness: 0.5 });
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.4 });
    const blackPanelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
    const ceilingLightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1.2 });

    const pts = [
      { x: 0,    y: 0 },
      { x: 0.8,  y: 0 },
      { x: 1.2,  y: 0 },
      { x: 1.25, y: 0.15 },
      { x: 1.4,  y: 0.7 },
      { x: 1.45, y: 0.7 },
      { x: 1.45, y: 0.85 },
      { x: 1.4,  y: 0.85 },
      { x: 1.4,  y: 1.5 },
      { x: 0.8,  y: 2.4 },
      { x: 0,    y: 2.4 }
    ];
    
    const bands = [
      { p1: pts[0], p2: pts[1], mat: carpetMat },
      { p1: pts[1], p2: pts[2], mat: floorBorderMat },
      { p1: pts[2], p2: pts[3], mat: lightStripMat },
      { p1: pts[3], p2: pts[4], mat: wallMat },
      { p1: pts[4], p2: pts[5], mat: bumperMat },
      { p1: pts[5], p2: pts[6], mat: bumperMat },
      { p1: pts[6], p2: pts[7], mat: bumperMat },
      { p1: pts[7], p2: pts[8], mat: blackPanelMat },
      { p1: pts[8], p2: pts[9], mat: wallMat },
      { p1: pts[9], p2: pts[10], mat: ceilingLightMat },
    ];

    const buildBand = (p1, p2, mat) => {
      const geo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        p1.x, p1.y, zStart,
        p2.x, p2.y, zStart,
        p1.x, p1.y, zEnd,
        p1.x, p1.y, zEnd,
        p2.x, p2.y, zStart,
        p2.x, p2.y, zEnd
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mat.side = THREE.DoubleSide; 
      mesh.receiveShadow = true;
      this._root.add(mesh);
    };

    bands.forEach(b => {
      buildBand(b.p1, b.p2, b.mat);
      buildBand({x: -b.p1.x, y: b.p1.y}, {x: -b.p2.x, y: b.p2.y}, b.mat);
    });

    // ── Structural Ribs ─────────────────────────────────────────────────
    const ribShape = new THREE.Shape();
    ribShape.moveTo(1.2, 0);
    ribShape.lineTo(1.25, 0.15);
    ribShape.lineTo(1.4, 0.7);
    ribShape.lineTo(1.4, 1.5);
    ribShape.lineTo(0.8, 2.4);
    ribShape.lineTo(-0.8, 2.4);
    ribShape.lineTo(-1.4, 1.5);
    ribShape.lineTo(-1.4, 0.7);
    ribShape.lineTo(-1.25, 0.15);
    ribShape.lineTo(-1.2, 0);
    
    ribShape.lineTo(-1.15, 0);
    ribShape.lineTo(-1.20, 0.15);
    ribShape.lineTo(-1.35, 0.7);
    ribShape.lineTo(-1.35, 1.5);
    ribShape.lineTo(-0.75, 2.35);
    ribShape.lineTo(0.75, 2.35);
    ribShape.lineTo(1.35, 1.5);
    ribShape.lineTo(1.35, 0.7);
    ribShape.lineTo(1.20, 0.15);
    ribShape.lineTo(1.15, 0);
    ribShape.closePath();

    const ribGeo = new THREE.ExtrudeGeometry(ribShape, { depth: 0.3, bevelEnabled: false });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.8 });
    
    [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].forEach(z => {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(0, 0, z - 0.15);
      rib.receiveShadow = true;
      rib.castShadow = true;
      this._root.add(rib);
    });
  }

  // ── Corridor lighting ───────────────────────────────────────────────────
  _buildLights() {
    // Ambient — warm cream
    const amb = new THREE.AmbientLight(0xfff4e0, 0.65);
    this._root.add(amb);

    // Overhead point lights spaced 4m apart
    for (let z = -8; z <= 8; z += 4) {
      const pt = new THREE.PointLight(0xffe8b0, 1.8, 9);
      pt.position.set(0, 2.2, z);
      this._root.add(pt);
    }

    // Subtle blue accent lights near doors
    [-6, 0, 6].forEach(z => {
      const bl = new THREE.PointLight(0x3388ff, 0.4, 3);
      bl.position.set(1.3, 1.4, z);
      this._root.add(bl);
      const br = new THREE.PointLight(0x3388ff, 0.4, 3);
      br.position.set(-1.3, 1.4, z);
      this._root.add(br);
    });
  }

  // ── Sliding doors ───────────────────────────────────────────────────────
  _buildDoors() {
    const doorMat = new THREE.MeshStandardMaterial({
      color:     0x5c7085,
      roughness: 0.35,
      metalness: 0.55,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.7 });
    const lcarsMatFn = () => new THREE.MeshBasicMaterial({ map: this._makeDoorLCARSTexture() });

    // Three door pairs at z = -6, 0, 6
    [-6, 0, 6].forEach(z => {
      [1, -1].forEach(side => {
        const group = new THREE.Group();

        // Door frame block (acts as an alcove cutting into the angled wall)
        const frameGeo = new THREE.BoxGeometry(0.6, 2.3, 1.8);
        const frame    = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(side * 1.4, 1.15, z);
        this._root.add(frame);

        // Left door half
        const lGeo  = new THREE.BoxGeometry(0.06, 2.1, 0.72);
        const lDoor = new THREE.Mesh(lGeo, doorMat);
        lDoor.position.set(side * 1.25, 1.05, z - 0.36);
        group.add(lDoor);

        // Right door half
        const rDoor = new THREE.Mesh(lGeo.clone(), doorMat);
        rDoor.position.set(side * 1.25, 1.05, z + 0.36);
        group.add(rDoor);

        this._root.add(group);

        // LCARS panel on wall beside door
        const panelW = 0.22, panelH = 0.42;
        const lcarsGeo = new THREE.PlaneGeometry(panelW, panelH);
        const lcarsMesh = new THREE.Mesh(lcarsGeo, lcarsMatFn());
        // Place on the black panel (y=1.15, x=1.41)
        lcarsMesh.position.set(side * 1.41, 1.15, z + 1.1 * side);
        lcarsMesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        this._root.add(lcarsMesh);

        if (side > 0) {
          this._doors.push({ left: lDoor, right: rDoor, open: false, t: 0, triggerZ: z });
        }
      });
    });
  }

  /** Minimal canvas LCARS texture for door panels */
  _makeDoorLCARSTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 256);

    // Orange top bumper
    ctx.fillStyle = '#FF9900';
    ctx.beginPath(); ctx.roundRect(0, 0, 128, 36, 8); ctx.fill();

    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px Arial Narrow, Arial';
    ctx.fillText('DOOR', 8, 24);

    // Blue bar
    ctx.fillStyle = '#3399FF';
    ctx.beginPath(); ctx.roundRect(8, 44, 112, 22, 6); ctx.fill();

    // Status indicator
    ctx.fillStyle = '#00FF88';
    ctx.beginPath(); ctx.arc(20, 88, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px Arial';
    ctx.fillText('LOCKED', 34, 93);

    // Purple bar
    ctx.fillStyle = '#9966CC';
    ctx.beginPath(); ctx.roundRect(8, 104, 112, 16, 6); ctx.fill();

    // Bottom bar
    ctx.fillStyle = '#FF9900';
    ctx.beginPath(); ctx.roundRect(0, 220, 128, 36, 8); ctx.fill();

    return new THREE.CanvasTexture(cv);
  }

  // ── Containment field ───────────────────────────────────────────────────
  _buildContainmentField() {
    // Horizontal blue plane spanning corridor at z = -3
    // The cross section is roughly 2.8m wide and 2.4m high.
    const fGeo = new THREE.PlaneGeometry(2.8, 2.4);
    this._fieldMat = new THREE.MeshBasicMaterial({
      color:       0x0055ff,
      transparent: true,
      opacity:     0.22,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._fieldMesh = new THREE.Mesh(fGeo, this._fieldMat);
    this._fieldMesh.position.set(0, 1.2, -3); 
    this._fieldMesh.rotation.y = Math.PI / 2;
    this._root.add(this._fieldMesh);

    // Emissive frame around the field
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
    const makeEdge = (w, h, px, py) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), edgeMat);
      e.position.set(px, py, -3);
      e.rotation.y = Math.PI / 2;
      this._root.add(e);
    };
    makeEdge(0.06, 2.4,  1.38, 1.2);   // right edge
    makeEdge(0.06, 2.4, -1.38, 1.2);   // left edge
    makeEdge(2.8, 0.06,  0,    0.03);  // bottom edge
    makeEdge(2.8, 0.06,  0,    2.37);  // top edge

    // LCARS "FORCE FIELD ACTIVE" panel on starboard wall
    const panelTex = this._makeFieldLCARSTexture();
    const panelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.26),
      new THREE.MeshBasicMaterial({ map: panelTex })
    );
    panelMesh.position.set(1.41, 1.1, -3.55);
    panelMesh.rotation.y = -Math.PI / 2;
    this._root.add(panelMesh);
  }

  _makeFieldLCARSTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 160;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 160);

    ctx.fillStyle = '#FF9900';
    ctx.beginPath(); ctx.roundRect(0, 0, 256, 32, 8); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 13px Arial Narrow, Arial';
    ctx.fillText('CONTAINMENT', 10, 22);

    ctx.fillStyle = '#0044FF';
    ctx.beginPath(); ctx.roundRect(8, 40, 240, 28, 6); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Arial Narrow, Arial';
    ctx.fillText('FORCE FIELD ACTIVE', 16, 59);

    ctx.fillStyle = '#FF4444';
    ctx.beginPath(); ctx.arc(22, 104, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px Arial Narrow, Arial';
    ctx.fillText('SECURITY PROTOCOL 5', 38, 108);

    return new THREE.CanvasTexture(cv);
  }

  // ── Type-II Phaser prop ─────────────────────────────────────────────────
  _buildPhaser() {
    this._phaserGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color:     0x1a1a2e,
      roughness: 0.4,
      metalness: 0.7,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color:             0xFF6600,
      emissive:          new THREE.Color(0xFF6600),
      emissiveIntensity: 0.8,
      roughness:         0.3,
    });

    // Main body — tapered box (Type-II hand phaser shape)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.028, 0.19), bodyMat);
    this._phaserGroup.add(body);

    // Emitter head
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.04, 8), accentMat);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0, -0.115);
    this._phaserGroup.add(emitter);

    // Power cell accent
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.06), accentMat);
    cell.position.set(0, 0.018, 0.04);
    this._phaserGroup.add(cell);

    // Phaser on wall bracket — starboard side, near z=3
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.22), bracketMat);
    bracket.position.set(1.38, 1.05, 3.2);
    this._root.add(bracket);

    this._phaserGroup.position.set(1.36, 1.09, 3.2);
    this._phaserGroup.rotation.y = -Math.PI / 2;
    this._phaserGroup.userData.interactable = true;
    this._phaserGroup.userData.isPhaser     = true;
    this._root.add(this._phaserGroup);

    // Phaser beam (hidden until fired) — a long thin box along -Z from emitter
    const beamMat = new THREE.MeshBasicMaterial({
      color:       0xFF4400,
      transparent: true,
      opacity:     0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    this._phaserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 14, 6), beamMat);
    this._phaserBeam.rotation.x = Math.PI / 2;
    this._phaserBeam.position.set(0, 0, -7);   // relative to phaserGroup when held
    this._phaserBeam.visible = false;
    this._root.add(this._phaserBeam);  // added to root, repositioned on fire
  }

  // ── Corridor end-caps ───────────────────────────────────────────────────
  _buildEndCaps() {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 0.9 });

    // Corridor bends into darkness at each end — just a dark wall
    [-11, 11].forEach(z => {
      const rect = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 2.5), capMat
      );
      rect.position.set(0, 1.25, z);
      rect.rotation.y = z > 0 ? Math.PI : 0;
      this._root.add(rect);
    });

    // Fog to obscure corridor ends attractively
    this._scene.fog = new THREE.Fog(0x0a0905, 12, 22);
  }
}
