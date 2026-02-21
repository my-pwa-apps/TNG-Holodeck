import * as THREE from 'three';

/**
 * CorridorScene — Enterprise-D Deck 7 Ring Corridor
 *
 * Full circular corridor (~50m circumference) with:
 *   - D-shaped cross-section: flat floor + angled walls + curved ceiling
 *   - TNG warm beige/tan palette with dark accent strips and carpet
 *   - Structural ribs at regular intervals
 *   - 10 sliding door pairs (5 port inboard, 5 starboard outboard)
 *   - Doors embedded flush in the walls, slide open on proximity
 *   - Rooms visible behind each door (quarters, labs, cargo, etc.)
 *   - Overhead lighting strips and blue accent lights
 *   - LCARS panels beside each door
 *   - Containment field + wall-mounted phaser (interactable)
 */
export class CorridorScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root = new THREE.Group();

    // Ring parameters
    this._ringRadius = 14;       // centre-line radius of the corridor ring
    this._corridorW = 1.45;      // half-width of the corridor
    this._corridorH = 2.45;      // ceiling height
    this._numSegments = 128;     // smoothness of the ring geometry

    // Doors — { leftPanel, rightPanel, open, t, angle }
    this._doors = [];

    // Containment field
    this._fieldMat = null;

    // Phaser
    this._phaserGroup = null;
    this._phaserBeam = null;
    this._beamTimer = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  load() {
    this._camera = this._scene.userData.camera ?? null;

    this._buildCorridorRing();
    this._buildLighting();
    this._buildDoors();
    this._buildRooms();
    this._buildContainmentField();
    this._buildPhaser();

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
    this._fieldMat = null;
    this._phaserBeam = null;
    this._doors = [];
  }

  update(dt, elapsed) {
    // Containment field shimmer
    if (this._fieldMat) {
      this._fieldMat.opacity = 0.15 + 0.10 * Math.abs(Math.sin(elapsed * 3.1));
      this._fieldMat.color.setHSL(0.6, 0.9, 0.5 + 0.12 * Math.sin(elapsed * 5.7));
    }

    // Door proximity animation
    const cam = this._scene.userData.camera;
    if (cam) {
      const cp = cam.getWorldPosition(new THREE.Vector3());
      for (const door of this._doors) {
        // Calculate door world position from angle
        const dx = Math.sin(door.angle) * this._ringRadius;
        const dz = Math.cos(door.angle) * this._ringRadius;
        const dist = Math.sqrt((cp.x - dx) ** 2 + (cp.z - dz) ** 2);
        door.open = dist < 2.5;

        // Smooth slide animation
        const target = door.open ? 1 : 0;
        door.t += (target - door.t) * 6 * dt;
        door.t = Math.max(0, Math.min(1, door.t));

        // Slide door panels apart (along tangent direction)
        const slideAmount = 0.65 * door.t;
        door.leftPanel.position.x = -slideAmount;
        door.rightPanel.position.x = slideAmount;
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

  onPhaserFire(controller) {
    if (!this._phaserBeam) return;
    this._phaserBeam.visible = true;
    this._beamTimer = 0.4;
    this._audio.play?.('computer_ack');
  }

  // ── Corridor Ring Geometry ──────────────────────────────────────────────
  _buildCorridorRing() {
    const R = this._ringRadius;
    const hw = this._corridorW;
    const H = this._corridorH;
    const N = this._numSegments;

    // Materials
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x4A5A75, roughness: 0.88,
    });
    const floorBorderMat = new THREE.MeshStandardMaterial({
      color: 0xC8B8B0, roughness: 0.75,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xA0A5A9, roughness: 0.45,
    });
    const upperWallMat = new THREE.MeshStandardMaterial({
      color: 0xB5AA98, roughness: 0.5,
    });
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x4A2A18, roughness: 0.35,
    });
    const blackPanelMat = new THREE.MeshStandardMaterial({
      color: 0x080808, roughness: 0.1,
    });
    const lightStripMat = new THREE.MeshStandardMaterial({
      color: 0xDDDDFF, emissive: 0xDDDDFF, emissiveIntensity: 1.2,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xCCC8B8, roughness: 0.7,
    });
    const ceilLightMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFEE, emissive: 0xFFFFEE, emissiveIntensity: 1.0,
    });

    // Cross-section profile (right half, will be mirrored)
    //   x = distance from corridor centre-line
    //   y = height from floor
    const profile = [
      { x: 0,    y: 0 },      // centre carpet
      { x: 0.75, y: 0 },      // carpet edge
      { x: 1.15, y: 0 },      // floor border
      { x: 1.20, y: 0.12 },   // light strip bottom
      { x: 1.35, y: 0.65 },   // lower wall
      { x: 1.40, y: 0.65 },   // bumper outer
      { x: 1.40, y: 0.80 },   // bumper top
      { x: 1.35, y: 0.80 },   // bumper inner
      { x: 1.35, y: 1.45 },   // black panel top
      { x: 1.30, y: 1.90 },   // upper wall (angled in)
      { x: 0.85, y: 2.35 },   // ceiling curve start
      { x: 0,    y: 2.45 },   // ceiling centre
    ];

    // Material assignment for each band (between consecutive profile points)
    const bandMats = [
      carpetMat,       // 0-1: centre carpet
      floorBorderMat,  // 1-2: floor border
      lightStripMat,   // 2-3: light strip
      wallMat,         // 3-4: lower wall
      bumperMat,       // 4-5: bumper outer
      bumperMat,       // 5-6: bumper top
      bumperMat,       // 6-7: bumper inner
      blackPanelMat,   // 7-8: black panel
      upperWallMat,    // 8-9: upper wall
      ceilingMat,      // 9-10: ceiling transition
      ceilLightMat,    // 10-11: ceiling light strip
    ];

    // Build each band as a ring-shaped surface
    for (let b = 0; b < profile.length - 1; b++) {
      const p1 = profile[b];
      const p2 = profile[b + 1];
      const mat = bandMats[b];

      // Right side
      this._buildBandRing(R, p1, p2, mat, N, 1);
      // Left side (mirrored)
      this._buildBandRing(R, p1, p2, mat, N, -1);
    }

    // Structural ribs every ~3m along the corridor
    const ribCount = 20;
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xC8B89A, roughness: 0.7,
    });

    for (let i = 0; i < ribCount; i++) {
      const angle = (i / ribCount) * Math.PI * 2;
      this._buildRib(R, H, hw, angle, ribMat);
    }
  }

  /**
   * Build a single band of the corridor cross-section as a ring surface.
   * side: 1 = right (positive x), -1 = left (mirrored)
   */
  _buildBandRing(R, p1, p2, mat, N, side) {
    const vertices = [];
    const normals = [];
    const indices = [];

    for (let i = 0; i <= N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      // Tangent direction (perpendicular to radius in XZ plane)
      const tx = cosA;
      const tz = -sinA;

      // Inner point
      const r1 = R + side * p1.x;
      vertices.push(sinA * r1, p1.y, cosA * r1);

      // Outer point
      const r2 = R + side * p2.x;
      vertices.push(sinA * r2, p2.y, cosA * r2);

      // Simple normal (cross product approximation — good enough for smooth shading)
      const dx = side * (p2.x - p1.x);
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      // Transform normal into world space
      normals.push(nx * sinA, ny, nx * cosA);
      normals.push(nx * sinA, ny, nx * cosA);

      if (i < N) {
        const base = i * 2;
        // Two triangles per quad
        if (side > 0) {
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        } else {
          // Flip winding for mirrored side
          indices.push(base, base + 2, base + 1);
          indices.push(base + 1, base + 2, base + 3);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this._root.add(mesh);
  }

  /** Build a structural rib (arch) at a given angle around the ring. */
  _buildRib(R, H, hw, angle, mat) {
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    // Rib is a thin box that follows the cross-section shape
    const ribThickness = 0.06;
    const ribDepth = 0.22;

    // Use a simple box spanning the corridor width at this angle
    const ribGeo = new THREE.BoxGeometry(hw * 2.6, H, ribThickness);
    const rib = new THREE.Mesh(ribGeo, mat);

    rib.position.set(sinA * R, H / 2, cosA * R);
    rib.rotation.y = angle;
    rib.receiveShadow = true;
    rib.castShadow = true;
    this._root.add(rib);
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  _buildLighting() {
    // Strong ambient — nothing should be dark
    const amb = new THREE.AmbientLight(0xFFF4E0, 1.0);
    this._root.add(amb);

    // Hemisphere light for natural fill
    const hemi = new THREE.HemisphereLight(0xFFF8EE, 0x443322, 0.6);
    this._root.add(hemi);

    // Overhead point lights around the ring
    const lightCount = 16;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2;
      const px = Math.sin(angle) * this._ringRadius;
      const pz = Math.cos(angle) * this._ringRadius;
      const pt = new THREE.PointLight(0xFFE8B0, 1.5, 12);
      pt.position.set(px, 2.2, pz);
      this._root.add(pt);
    }

    // Blue accent lights near doors
    const doorCount = 10;
    for (let i = 0; i < doorCount; i++) {
      const angle = (i / doorCount) * Math.PI * 2;
      const px = Math.sin(angle) * this._ringRadius;
      const pz = Math.cos(angle) * this._ringRadius;
      const bl = new THREE.PointLight(0x3388FF, 0.35, 4);
      bl.position.set(px, 1.4, pz);
      this._root.add(bl);
    }
  }

  // ── Doors (embedded flush in walls) ─────────────────────────────────────
  _buildDoors() {
    const R = this._ringRadius;
    const hw = this._corridorW;

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5C7085, roughness: 0.3, metalness: 0.5,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x333840, roughness: 0.6,
    });

    // Room labels for the doors
    const roomLabels = [
      // Outboard (starboard) rooms
      'CREW QUARTERS', 'SCIENCE LAB', 'SICKBAY', 'CARGO BAY 2', 'CONFERENCE',
      // Inboard (port) rooms
      'CREW QUARTERS', 'ENGINEERING LAB', 'TRANSPORTER 3', "TEN FORWARD", 'HOLODECK 2',
    ];

    // 10 doors: 5 outboard + 5 inboard, evenly spaced around the ring
    const doorsPerSide = 5;

    for (let i = 0; i < doorsPerSide * 2; i++) {
      const isOutboard = i < doorsPerSide;
      const idx = i % doorsPerSide;
      const angle = (idx / doorsPerSide) * Math.PI * 2
        + (isOutboard ? 0 : Math.PI * 2 / (doorsPerSide * 2));
      const side = isOutboard ? 1 : -1; // outboard = positive offset, inboard = negative

      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      // Door group positioned at the wall
      const doorGroup = new THREE.Group();
      const wallOffset = hw + 0.02;

      doorGroup.position.set(
        sinA * (R + side * wallOffset),
        0,
        cosA * (R + side * wallOffset)
      );
      doorGroup.rotation.y = angle + (side > 0 ? 0 : Math.PI);

      // Door frame (flush with wall)
      const frameGeo = new THREE.BoxGeometry(1.6, 2.3, 0.18);
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(0, 1.15, 0);
      doorGroup.add(frame);

      // Left door panel
      const doorGeo = new THREE.BoxGeometry(0.68, 2.1, 0.06);
      const leftPanel = new THREE.Mesh(doorGeo, doorMat);
      leftPanel.position.set(0, 1.05, 0.08);
      doorGroup.add(leftPanel);

      // Right door panel
      const rightPanel = new THREE.Mesh(doorGeo.clone(), doorMat);
      rightPanel.position.set(0, 1.05, 0.08);
      doorGroup.add(rightPanel);

      // Door label
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 48;
      const lctx = labelCanvas.getContext('2d');
      lctx.fillStyle = '#1a1a1a';
      lctx.fillRect(0, 0, 256, 48);
      lctx.fillStyle = '#FF9900';
      lctx.font = 'bold 18px Arial Narrow, Arial';
      lctx.textAlign = 'center';
      lctx.fillText(roomLabels[i], 128, 34);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.18),
        new THREE.MeshBasicMaterial({ map: labelTex })
      );
      labelMesh.position.set(0, 2.35, 0.1);
      doorGroup.add(labelMesh);

      // LCARS panel beside door
      const lcarsPanel = this._makeDoorLCARS();
      lcarsPanel.position.set(0.95, 1.15, 0.1);
      doorGroup.add(lcarsPanel);

      this._root.add(doorGroup);

      // Track doors for animation
      this._doors.push({
        leftPanel,
        rightPanel,
        open: false,
        t: 0,
        angle,
      });
    }
  }

  /** Build rooms visible behind doors */
  _buildRooms() {
    const R = this._ringRadius;
    const hw = this._corridorW;
    const doorsPerSide = 5;

    // Room materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x6B7B8B, roughness: 0.85,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xBBB099, roughness: 0.55,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xCCC8B8, roughness: 0.7,
    });

    // Room type configurations
    const roomConfigs = [
      // Outboard rooms
      { type: 'quarters',  color: 0xBB9977 },
      { type: 'lab',       color: 0x88AACC },
      { type: 'medical',   color: 0xCCDDEE },
      { type: 'cargo',     color: 0x888888 },
      { type: 'conference',color: 0xAA9977 },
      // Inboard rooms
      { type: 'quarters',  color: 0xBB9977 },
      { type: 'lab',       color: 0x88AACC },
      { type: 'transport', color: 0x99AABB },
      { type: 'lounge',    color: 0xAA7755 },
      { type: 'holodeck',  color: 0x222222 },
    ];

    for (let i = 0; i < doorsPerSide * 2; i++) {
      const isOutboard = i < doorsPerSide;
      const idx = i % doorsPerSide;
      const angle = (idx / doorsPerSide) * Math.PI * 2
        + (isOutboard ? 0 : Math.PI * 2 / (doorsPerSide * 2));
      const side = isOutboard ? 1 : -1;

      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      const config = roomConfigs[i];
      const roomGroup = new THREE.Group();

      // Room dimensions
      const roomDepth = 3.5;
      const roomWidth = 3.0;
      const roomHeight = 2.4;

      // Room offset from corridor wall
      const roomCentre = R + side * (hw + roomDepth / 2 + 0.2);

      roomGroup.position.set(
        sinA * roomCentre,
        0,
        cosA * roomCentre
      );
      roomGroup.rotation.y = angle;

      // Floor
      const rFloor = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, 0.05, roomDepth),
        floorMat
      );
      rFloor.position.y = 0.025;
      roomGroup.add(rFloor);

      // Ceiling
      const rCeil = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, 0.05, roomDepth),
        ceilMat
      );
      rCeil.position.y = roomHeight;
      roomGroup.add(rCeil);

      // Back wall
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, roomHeight, 0.1),
        new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.6 })
      );
      backWall.position.set(0, roomHeight / 2, side * roomDepth / 2);
      roomGroup.add(backWall);

      // Side walls
      [-1, 1].forEach(s => {
        const sideWall = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, roomHeight, roomDepth),
          wallMat
        );
        sideWall.position.set(s * roomWidth / 2, roomHeight / 2, 0);
        roomGroup.add(sideWall);
      });

      // Room-specific furniture
      this._addRoomFurniture(roomGroup, config.type, roomWidth, roomHeight, roomDepth, side);

      // Room light
      const roomLight = new THREE.PointLight(0xFFE8CC, 0.8, 6);
      roomLight.position.set(0, roomHeight - 0.2, 0);
      roomGroup.add(roomLight);

      this._root.add(roomGroup);
    }
  }

  /** Add simple furniture based on room type */
  _addRoomFurniture(group, type, w, h, d, side) {
    const furnMat = new THREE.MeshStandardMaterial({
      color: 0x665544, roughness: 0.6,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x888899, roughness: 0.3, metalness: 0.6,
    });
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x445577, roughness: 0.7,
    });

    switch (type) {
      case 'quarters': {
        // Bed
        const bed = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.35, 2.0),
          bedMat
        );
        bed.position.set(-0.6, 0.175, side * 0.5);
        group.add(bed);

        // Desk
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.75, 0.6),
          furnMat
        );
        desk.position.set(0.7, 0.375, -side * 0.8);
        group.add(desk);

        // LCARS terminal on desk
        const terminal = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.35, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xFF9900 })
        );
        terminal.position.set(0.7, 0.8, -side * 0.8);
        terminal.rotation.x = -0.2;
        group.add(terminal);
        break;
      }
      case 'lab': {
        // Lab bench
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.8, 0.85, 0.7),
          metalMat
        );
        bench.position.set(0, 0.425, side * 0.8);
        group.add(bench);

        // Equipment on bench
        for (let j = 0; j < 3; j++) {
          const equip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8),
            metalMat
          );
          equip.position.set(-0.5 + j * 0.5, 1.0, side * 0.8);
          group.add(equip);
        }
        break;
      }
      case 'medical': {
        // Biobed
        const biobed = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.5, 2.0),
          new THREE.MeshStandardMaterial({ color: 0xCCDDEE, roughness: 0.4 })
        );
        biobed.position.set(0, 0.25, 0);
        group.add(biobed);

        // Scanner arch
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.04, 8, 16, Math.PI),
          metalMat
        );
        arch.rotation.z = Math.PI / 2;
        arch.position.set(0, 0.8, -side * 0.3);
        group.add(arch);
        break;
      }
      case 'cargo': {
        // Cargo containers
        for (let cx = -0.8; cx <= 0.8; cx += 0.8) {
          for (let cz = -0.6; cz <= 0.6; cz += 0.6) {
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(0.6, 0.6, 0.5),
              new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 })
            );
            box.position.set(cx, 0.3, cz);
            group.add(box);
          }
        }
        break;
      }
      case 'conference': {
        // Conference table
        const table = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 0.08, 16),
          furnMat
        );
        table.position.set(0, 0.72, 0);
        group.add(table);

        // Table pedestal
        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.25, 0.68, 8),
          metalMat
        );
        pedestal.position.set(0, 0.34, 0);
        group.add(pedestal);

        // Chairs around table
        for (let ci = 0; ci < 6; ci++) {
          const ca = (ci / 6) * Math.PI * 2;
          const chairSeat = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.05, 0.35),
            new THREE.MeshStandardMaterial({ color: 0xAA3333, roughness: 0.6 })
          );
          chairSeat.position.set(Math.sin(ca) * 1.2, 0.45, Math.cos(ca) * 1.2);
          group.add(chairSeat);
        }
        break;
      }
      case 'transport': {
        // Transporter pad (raised platform)
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.0, 0.15, 6),
          new THREE.MeshStandardMaterial({ color: 0x99AABB, roughness: 0.3, metalness: 0.4 })
        );
        pad.position.set(0, 0.075, side * 0.3);
        group.add(pad);

        // Individual pads
        for (let pi = 0; pi < 6; pi++) {
          const pa = (pi / 6) * Math.PI * 2;
          const iPad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16),
            new THREE.MeshStandardMaterial({
              color: 0x6688AA, emissive: 0x334466, emissiveIntensity: 0.5,
            })
          );
          iPad.position.set(Math.sin(pa) * 0.6, 0.16, Math.cos(pa) * 0.6 + side * 0.3);
          group.add(iPad);
        }
        break;
      }
      case 'lounge': {
        // Bar counter
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1.0, 0.4),
          furnMat
        );
        bar.position.set(0, 0.5, side * 1.0);
        group.add(bar);

        // Stools
        for (let si = -1; si <= 1; si++) {
          const stool = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.18, 0.65, 8),
            metalMat
          );
          stool.position.set(si * 0.5, 0.325, side * 0.5);
          group.add(stool);
        }

        // Window (starfield-like panel)
        const windowMat = new THREE.MeshBasicMaterial({ color: 0x0A0A1A });
        const windowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.6, 1.2),
          windowMat
        );
        windowMesh.position.set(0, 1.5, side * d / 2 - side * 0.06);
        windowMesh.rotation.y = side > 0 ? 0 : Math.PI;
        group.add(windowMesh);
        break;
      }
      case 'holodeck': {
        // Yellow grid lines on the walls — simplified
        const gridMat = new THREE.MeshBasicMaterial({
          color: 0xFFB300, wireframe: true,
        });
        const gridBox = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.9, 2.2, d * 0.9),
          gridMat
        );
        gridBox.position.set(0, 1.1, 0);
        group.add(gridBox);
        break;
      }
    }
  }

  // ── Containment field ───────────────────────────────────────────────────
  _buildContainmentField() {
    // Place at one specific corridor section
    const fieldAngle = Math.PI * 0.4;
    const sinA = Math.sin(fieldAngle);
    const cosA = Math.cos(fieldAngle);

    this._fieldMat = new THREE.MeshStandardMaterial({
      color: 0x4488FF,
      transparent: true,
      opacity: 0.2,
      emissive: 0x2244AA,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
    });

    const fieldGeo = new THREE.PlaneGeometry(this._corridorW * 2.6, this._corridorH);
    const field = new THREE.Mesh(fieldGeo, this._fieldMat);
    field.position.set(sinA * this._ringRadius, this._corridorH / 2, cosA * this._ringRadius);
    field.rotation.y = fieldAngle;
    this._root.add(field);
  }

  // ── Phaser ──────────────────────────────────────────────────────────────
  _buildPhaser() {
    const phaserAngle = Math.PI * 0.9;
    const sinA = Math.sin(phaserAngle);
    const cosA = Math.cos(phaserAngle);
    const R = this._ringRadius;
    const hw = this._corridorW;

    this._phaserGroup = new THREE.Group();

    // Phaser body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.3, metalness: 0.7,
    });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 0.22),
      bodyMat
    );
    this._phaserGroup.add(body);

    // Emitter tip
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xFF4400, emissive: 0xFF2200, emissiveIntensity: 0.8, roughness: 0.2,
    });
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, 0.04, 8),
      tipMat
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.12;
    this._phaserGroup.add(tip);

    // Wall bracket
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x666666, roughness: 0.5, metalness: 0.5,
    });
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.15, 0.06),
      bracketMat
    );
    bracket.position.set(0, 0.08, 0.08);
    this._phaserGroup.add(bracket);

    // Phaser beam (hidden initially)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xFF6600, transparent: true, opacity: 0,
    });
    const beamGeo = new THREE.CylinderGeometry(0.008, 0.004, 8, 8);
    beamGeo.rotateX(Math.PI / 2);
    this._phaserBeam = new THREE.Mesh(beamGeo, beamMat);
    this._phaserBeam.position.z = -4.1;
    this._phaserBeam.visible = false;
    this._phaserGroup.add(this._phaserBeam);

    this._phaserGroup.userData.interactable = true;

    // Position on the corridor wall
    this._phaserGroup.position.set(
      sinA * (R + hw - 0.05),
      1.3,
      cosA * (R + hw - 0.05)
    );
    this._phaserGroup.rotation.y = phaserAngle + Math.PI;

    this._root.add(this._phaserGroup);
  }

  // ── LCARS door panel texture ────────────────────────────────────────────
  _makeDoorLCARS() {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 256);

    // Coloured bumpers
    ctx.fillStyle = '#FF9900';
    ctx.beginPath();
    ctx.roundRect(8, 8, 112, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#3399FF';
    ctx.beginPath();
    ctx.roundRect(8, 48, 112, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#CC99FF';
    ctx.beginPath();
    ctx.roundRect(8, 80, 112, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#CC6600';
    ctx.beginPath();
    ctx.roundRect(8, 112, 112, 24, 6);
    ctx.fill();

    // Room status indicator
    ctx.fillStyle = '#00FF88';
    ctx.beginPath();
    ctx.arc(64, 170, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FF9900';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DECK 7', 64, 210);

    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial Narrow, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DOOR', 64, 30);

    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.4),
      new THREE.MeshBasicMaterial({ map: tex })
    );
  }
}
