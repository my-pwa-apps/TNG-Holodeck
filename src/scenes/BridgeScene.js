import * as THREE from 'three';

/**
 * BridgeScene — TNG Enterprise-D Main Bridge (canonical layout)
 *
 * Fully enclosed room with:
 *   - Two-level floor: red-carpeted lower command area + tan upper ring
 *   - Curved beige/tan walls fully enclosing the space
 *   - Forward viewscreen with animated starfield
 *   - Turbolift doors (port + starboard aft)
 *   - Ready Room door (port forward) + Observation Lounge door (starboard forward)
 *   - Wooden horseshoe railing with Tactical station
 *   - Command chairs (Captain, XO, Counselor)
 *   - Conn/Ops forward stations
 *   - Aft Science, Engineering, Mission Ops stations
 *   - Ceiling dome with concentric light rings
 *   - Red Alert mode
 *   - Proper warm lighting throughout — no dark surfaces
 */
export class BridgeScene {
  constructor(scene, audio) {
    this._scene = scene;
    this._audio = audio;
    this._root = new THREE.Group();
    this._lcarsScreens = [];
    this._starfieldMat = null;
    this._warpActive = false;
    this._warpProgress = 0;
    this._redAlertMode = false;
    this._redAlertTime = 0;
    this._starUpdateAccum = 0;
    this._accentLights = [];
    this._ceilLightMat = null;
  }

  load() {
    this._scene.fog = null;

    // ── Lighting — warm, bright, even illumination ─────────────────────
    // Strong ambient so no surface is ever dark
    this._root.add(new THREE.AmbientLight(0xfff4e0, 1.2));

    // Central dome light
    const domeLight = new THREE.PointLight(0xffeedd, 3.0, 25);
    domeLight.position.set(0, 4.8, 0);
    domeLight.castShadow = true;
    this._root.add(domeLight);

    // Hemisphere light for natural fill
    const hemi = new THREE.HemisphereLight(0xfff8ee, 0x443322, 0.8);
    this._root.add(hemi);

    // Ring of accent lights around the perimeter
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const l = new THREE.PointLight(0xFFCC66, 1.2, 10);
      l.position.set(Math.sin(angle) * 6.5, 3.5, Math.cos(angle) * 6.5);
      this._accentLights.push(l);
      this._root.add(l);
    }

    // Forward viewscreen illumination
    const vsLight = new THREE.SpotLight(0x8899cc, 1.5, 12, Math.PI / 4);
    vsLight.position.set(0, 4, -5);
    vsLight.target.position.set(0, 2, -7.5);
    this._root.add(vsLight);
    this._root.add(vsLight.target);

    // Console accent lights
    const consoleLightPositions = [
      [-3, 2.5, -5], [3, 2.5, -5],   // forward consoles
      [0, 2.5, 4],                     // tactical
      [-6, 2.5, 2], [6, 2.5, 2],      // aft sides
    ];
    consoleLightPositions.forEach(pos => {
      const cl = new THREE.PointLight(0xFF9900, 0.6, 6);
      cl.position.set(...pos);
      this._accentLights.push(cl);
      this._root.add(cl);
    });

    // ── Architecture ─────────────────────────────────────────────────────
    this._root.add(this._buildFloor());
    this._root.add(this._buildWalls());
    this._root.add(this._buildCeiling());
    this._root.add(this._buildHorseshoe());
    this._root.add(this._buildCommandChairs());
    this._root.add(this._buildConnHelm());
    this._root.add(this._buildAftStations());
    this._root.add(this._buildViewscreen());
    this._root.add(this._buildDoors());

    this._scene.add(this._root);
    return this._root;
  }

  // ── Floor ──────────────────────────────────────────────────────────────
  _buildFloor() {
    const group = new THREE.Group();

    // Lower command area — red/maroon carpet
    const lowerMat = new THREE.MeshStandardMaterial({
      color: 0x993333, roughness: 0.85, metalness: 0.0,
    });
    const lowerGeo = new THREE.CylinderGeometry(4.0, 4.0, 0.12, 64);
    const lowerFloor = new THREE.Mesh(lowerGeo, lowerMat);
    lowerFloor.position.y = 0.06;
    lowerFloor.receiveShadow = true;
    group.add(lowerFloor);

    // Upper ring — tan carpet
    const upperMat = new THREE.MeshStandardMaterial({
      color: 0xBBA882, roughness: 0.85, metalness: 0.0,
    });
    const upperGeo = new THREE.RingGeometry(4.0, 8.0, 64);
    upperGeo.rotateX(-Math.PI / 2);
    const upperFloor = new THREE.Mesh(upperGeo, upperMat);
    upperFloor.position.y = 0.45;
    upperFloor.receiveShadow = true;
    group.add(upperFloor);

    // Step risers connecting levels
    const riserMat = new THREE.MeshStandardMaterial({
      color: 0x998866, roughness: 0.7,
    });
    const riserShape = new THREE.Shape();
    riserShape.moveTo(-1.8, 0);
    riserShape.lineTo(1.8, 0);
    riserShape.lineTo(1.8, 0.45);
    riserShape.lineTo(-1.8, 0.45);
    riserShape.closePath();

    const extrudeSettings = { depth: 0.15, bevelEnabled: false };
    const riserGeo = new THREE.ExtrudeGeometry(riserShape, extrudeSettings);

    // Port riser
    const riserL = new THREE.Mesh(riserGeo, riserMat);
    riserL.position.set(-3.5, 0, 0.6);
    riserL.rotation.y = Math.PI / 2;
    group.add(riserL);

    // Starboard riser
    const riserR = new THREE.Mesh(riserGeo, riserMat);
    riserR.position.set(3.5, 0, 0.6);
    riserR.rotation.y = -Math.PI / 2;
    group.add(riserR);

    return group;
  }

  // ── Walls — fully enclosed curved hull ─────────────────────────────────
  _buildWalls() {
    const group = new THREE.Group();

    // Main wall material — warm beige/tan (TNG bridge colour)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xCDBFA0, roughness: 0.6, metalness: 0.05,
      side: THREE.BackSide,
    });

    // Full enclosing cylinder wall
    const wallGeo = new THREE.CylinderGeometry(8.0, 8.0, 5.0, 64, 1, true);
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = 2.95;
    group.add(walls);

    // Interior wall panels — darker accent strips between stations
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xA89878, roughness: 0.5, metalness: 0.1,
    });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 4.5, 1.2),
        panelMat
      );
      panel.position.set(Math.sin(angle) * 7.85, 2.9, Math.cos(angle) * 7.85);
      panel.rotation.y = angle;
      group.add(panel);
    }

    // Horizontal accent band at waist height
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x776644, roughness: 0.4, metalness: 0.2,
    });
    const bandGeo = new THREE.TorusGeometry(7.9, 0.06, 8, 64);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.3;
    group.add(band);

    // Upper accent band
    const band2 = new THREE.Mesh(bandGeo.clone(), bandMat);
    band2.rotation.x = Math.PI / 2;
    band2.position.y = 3.8;
    group.add(band2);

    return group;
  }

  // ── Ceiling ────────────────────────────────────────────────────────────
  _buildCeiling() {
    const group = new THREE.Group();
    const CEIL_Y = 5.4;

    // Ceiling disc
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xCDBFA0, roughness: 0.7, metalness: 0.0,
    });
    const ceilGeo = new THREE.CircleGeometry(8.0, 64);
    ceilGeo.rotateX(Math.PI / 2);
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.position.y = CEIL_Y;
    group.add(ceiling);

    // Central translucent dome — diffuse glow
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      emissive: 0xFFF4DD,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
    });
    const domeGeo = new THREE.SphereGeometry(2.8, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.22);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = CEIL_Y - 0.15;
    dome.rotation.x = Math.PI;
    group.add(dome);

    // Concentric light rings
    this._ceilLightMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      emissive: 0xFFEECC,
      emissiveIntensity: 2.0,
    });
    [2.0, 3.5, 5.0, 6.5].forEach(r => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.06, 12, 64),
        this._ceilLightMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = CEIL_Y - 0.03;
      group.add(ring);
    });

    return group;
  }

  // ── Horseshoe railing + Tactical ───────────────────────────────────────
  _buildHorseshoe() {
    const group = new THREE.Group();

    // Wooden railing — warm oak
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6B4226, roughness: 0.35, metalness: 0.05,
    });

    // Horseshoe rail arc (opens toward viewscreen)
    const railGeo = new THREE.TorusGeometry(4.0, 0.12, 16, 64, Math.PI * 1.15);
    const rail = new THREE.Mesh(railGeo, woodMat);
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = -Math.PI * 0.575;
    rail.position.y = 1.15;
    group.add(rail);

    // Railing vertical supports
    const supportGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xBBBBBB, metalness: 0.7, roughness: 0.25,
    });
    for (let i = 0; i <= 12; i++) {
      const angle = -Math.PI * 0.575 + (i / 12) * Math.PI * 1.15;
      const support = new THREE.Mesh(supportGeo, metalMat);
      support.position.set(
        Math.cos(angle) * 4.0,
        0.8,
        -Math.sin(angle) * 4.0
      );
      group.add(support);
    }

    // Tactical Console (rear centre of horseshoe)
    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x2A2A3E, roughness: 0.4, metalness: 0.3,
    });
    const tacShape = new THREE.Shape();
    tacShape.absarc(0, 0, 4.4, -Math.PI * 0.15, Math.PI * 0.15, false);
    tacShape.absarc(0, 0, 3.6, Math.PI * 0.15, -Math.PI * 0.15, true);
    const tacGeo = new THREE.ExtrudeGeometry(tacShape, {
      depth: 0.85, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04,
    });
    const tacMesh = new THREE.Mesh(tacGeo, consoleMat);
    tacMesh.rotation.x = -Math.PI / 2;
    tacMesh.position.set(0, 0.45, 0);
    group.add(tacMesh);

    // Tactical LCARS screen
    const tacScreen = this._buildLCARSScreen(2.0, 0.6, 'TACTICAL SYSTEMS');
    tacScreen.position.set(0, 1.35, 3.85);
    tacScreen.rotation.x = -0.45;
    tacScreen.rotation.y = Math.PI;
    this._lcarsScreens.push(tacScreen._lcarsData);
    group.add(tacScreen);

    return group;
  }

  // ── Command Chairs ─────────────────────────────────────────────────────
  _buildCommandChairs() {
    const group = new THREE.Group();

    const seatMat = new THREE.MeshStandardMaterial({
      color: 0xAA2222, roughness: 0.6, metalness: 0.05,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x333333, roughness: 0.4, metalness: 0.5,
    });
    const armrestPanelMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.3, metalness: 0.6,
    });

    const createChair = (isCaptain) => {
      const chair = new THREE.Group();
      const w = isCaptain ? 0.85 : 0.72;
      const backH = isCaptain ? 0.95 : 0.82;

      // Pedestal base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.35, 0.38, 16),
        frameMat
      );
      base.position.y = 0.19;
      chair.add(base);

      // Seat cushion
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.12, 0.55),
        seatMat
      );
      seat.position.set(0, 0.44, 0);
      chair.add(seat);

      // Backrest
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(w, backH, 0.12),
        seatMat
      );
      back.position.set(0, 0.44 + backH / 2, 0.28);
      chair.add(back);

      // Armrests
      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.28, 0.48),
          frameMat
        );
        arm.position.set(side * (w / 2 + 0.04), 0.58, 0.02);
        chair.add(arm);

        // LCARS mini panel on armrest top
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, 0.18),
          new THREE.MeshBasicMaterial({ color: 0xFF9900 })
        );
        panel.rotation.x = -Math.PI / 2;
        panel.position.set(side * (w / 2 + 0.04), 0.73, 0.08);
        chair.add(panel);
      });

      return chair;
    };

    // Captain's chair — centre
    const captChair = createChair(true);
    captChair.position.set(0, 0.06, 1.5);
    group.add(captChair);

    // First Officer (Riker) — starboard
    const xoChair = createChair(false);
    xoChair.position.set(1.3, 0.06, 1.7);
    xoChair.rotation.y = -0.12;
    group.add(xoChair);

    // Counselor (Troi) — port
    const counsChair = createChair(false);
    counsChair.position.set(-1.3, 0.06, 1.7);
    counsChair.rotation.y = 0.12;
    group.add(counsChair);

    return group;
  }

  // ── Conn / Ops forward stations ────────────────────────────────────────
  _buildConnHelm() {
    const group = new THREE.Group();

    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0xCDBFA0, roughness: 0.5, metalness: 0.1,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x2A2A3E, roughness: 0.4, metalness: 0.3,
    });

    // Curved console base
    const baseShape = new THREE.Shape();
    baseShape.absarc(0, 0, 3.0, -Math.PI * 0.2, Math.PI * 0.2, false);
    baseShape.absarc(0, 0, 2.0, Math.PI * 0.2, -Math.PI * 0.2, true);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 0.7, bevelEnabled: true, bevelSize: 0.04,
    });
    const baseMesh = new THREE.Mesh(baseGeo, consoleMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.set(0, 0.08, -1.8);
    group.add(baseMesh);

    // Dark console surface
    const surfShape = new THREE.Shape();
    surfShape.absarc(0, 0, 2.95, -Math.PI * 0.19, Math.PI * 0.19, false);
    surfShape.absarc(0, 0, 2.05, Math.PI * 0.19, -Math.PI * 0.19, true);
    const surfGeo = new THREE.ExtrudeGeometry(surfShape, {
      depth: 0.04, bevelEnabled: false,
    });
    const surfMesh = new THREE.Mesh(surfGeo, topMat);
    surfMesh.rotation.x = -Math.PI / 2;
    surfMesh.position.set(0, 0.78, -1.8);
    group.add(surfMesh);

    // Conn and Ops LCARS screens
    const stationData = [
      { x: -0.9, title: 'CONN', rot: 0.18 },
      { x: 0.9, title: 'OPS', rot: -0.18 },
    ];
    stationData.forEach(({ x, title, rot }) => {
      const screen = this._buildLCARSScreen(0.85, 0.5, title);
      screen.position.set(x, 0.95, -4.0);
      screen.rotation.x = -0.55;
      screen.rotation.y = rot;
      this._lcarsScreens.push(screen._lcarsData);
      group.add(screen);

      // Operator seat
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.1, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.6 })
      );
      seat.position.set(x * 0.8, 0.42, -2.6);
      seat.rotation.y = rot;
      group.add(seat);

      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.55, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.6 })
      );
      back.position.set(x * 0.8, 0.72, -2.35);
      back.rotation.y = rot;
      group.add(back);
    });

    return group;
  }

  // ── Aft stations ───────────────────────────────────────────────────────
  _buildAftStations() {
    const group = new THREE.Group();

    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x2A2A3E, roughness: 0.4, metalness: 0.3,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x998866, roughness: 0.4, metalness: 0.1,
    });

    const stations = [
      { angle: Math.PI * 0.72, title: 'SCIENCE I' },
      { angle: Math.PI * 0.84, title: 'SCIENCE II' },
      { angle: Math.PI * 0.96, title: 'ENVIRONMENT' },
      { angle: -Math.PI * 0.96, title: 'ENGINEERING' },
      { angle: -Math.PI * 0.84, title: 'MISSION OPS' },
      { angle: -Math.PI * 0.72, title: 'TACTICAL II' },
    ];

    stations.forEach(({ angle, title }) => {
      const stGroup = new THREE.Group();

      // Console body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.0, 0.7),
        consoleMat
      );
      body.position.set(0, 0.95, 0);
      stGroup.add(body);

      // Wooden trim ledge
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.06, 0.75),
        frameMat
      );
      trim.position.set(0, 1.48, 0);
      stGroup.add(trim);

      // LCARS display
      const screen = this._buildLCARSScreen(1.2, 0.7, title);
      screen.position.set(0, 2.0, 0.15);
      screen.rotation.x = -0.25;
      this._lcarsScreens.push(screen._lcarsData);
      stGroup.add(screen);

      // Light above each station
      const stLight = new THREE.PointLight(0xFFCC66, 0.4, 4);
      stLight.position.set(0, 3.0, 0);
      stGroup.add(stLight);

      // Position along the wall
      stGroup.position.set(
        Math.sin(angle) * 7.3,
        0.45,
        Math.cos(angle) * 7.3
      );
      stGroup.rotation.y = angle + Math.PI;
      group.add(stGroup);
    });

    return group;
  }

  // ── Viewscreen ─────────────────────────────────────────────────────────
  _buildViewscreen() {
    const group = new THREE.Group();

    // Recessed frame — dark border around screen
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A1A, roughness: 0.2, metalness: 0.6,
    });
    const frameGeo = new THREE.BoxGeometry(9.0, 4.2, 0.3);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 2.8, -7.75);
    group.add(frame);

    // Beige surround matching the walls
    const surroundMat = new THREE.MeshStandardMaterial({
      color: 0xCDBFA0, roughness: 0.6,
    });
    const surroundGeo = new THREE.BoxGeometry(9.6, 4.8, 0.15);
    const surround = new THREE.Mesh(surroundGeo, surroundMat);
    surround.position.set(0, 2.8, -7.85);
    group.add(surround);

    // Screen canvas — animated starfield
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    this._starCanvas = canvas;
    this._starCtx = canvas.getContext('2d');
    this._starTex = new THREE.CanvasTexture(canvas);

    this._stars = Array.from({ length: 800 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      brightness: Math.random(),
    }));

    const screenMat = new THREE.MeshBasicMaterial({ map: this._starTex });
    const screenGeo = new THREE.PlaneGeometry(8.6, 3.8);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 2.8, -7.58);
    group.add(screen);

    return group;
  }

  // ── Doors — Turbolifts, Ready Room, Observation Lounge ─────────────────
  _buildDoors() {
    const group = new THREE.Group();

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xC8A882, roughness: 0.5, metalness: 0.1,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x444444, roughness: 0.4, metalness: 0.5,
    });
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xBBBBBB, roughness: 0.3, metalness: 0.6,
    });

    const createDoorAssembly = (label) => {
      const dGroup = new THREE.Group();

      // Door frame — recessed into wall
      const frameGeo = new THREE.BoxGeometry(2.0, 3.0, 0.4);
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(0, 1.95, 0);
      dGroup.add(frameMesh);

      // Left door panel
      const doorGeo = new THREE.BoxGeometry(0.88, 2.7, 0.08);
      const leftDoor = new THREE.Mesh(doorGeo, doorMat);
      leftDoor.position.set(-0.46, 1.85, 0.18);
      dGroup.add(leftDoor);

      // Right door panel
      const rightDoor = new THREE.Mesh(doorGeo.clone(), doorMat);
      rightDoor.position.set(0.46, 1.85, 0.18);
      dGroup.add(rightDoor);

      // Label above door
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 48;
      const lctx = labelCanvas.getContext('2d');
      lctx.fillStyle = '#1a1a1a';
      lctx.fillRect(0, 0, 256, 48);
      lctx.fillStyle = '#FF9900';
      lctx.font = 'bold 22px Arial Narrow, Arial';
      lctx.textAlign = 'center';
      lctx.fillText(label, 128, 34);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.25),
        new THREE.MeshBasicMaterial({ map: labelTex })
      );
      labelPlane.position.set(0, 3.55, 0.22);
      dGroup.add(labelPlane);

      // Small LCARS panel beside door
      const lcarsPanel = this._buildSmallLCARS();
      lcarsPanel.position.set(1.3, 1.5, 0.22);
      dGroup.add(lcarsPanel);

      return dGroup;
    };

    // Turbolift 1 — Port Aft
    const tl1 = createDoorAssembly('TURBOLIFT 1');
    tl1.position.set(-5.8, 0.45, 5.5);
    tl1.rotation.y = Math.PI * 0.28;
    group.add(tl1);

    // Turbolift 2 — Starboard Aft
    const tl2 = createDoorAssembly('TURBOLIFT 2');
    tl2.position.set(5.8, 0.45, 5.5);
    tl2.rotation.y = -Math.PI * 0.28;
    group.add(tl2);

    // Ready Room — Port Forward
    const rr = createDoorAssembly('READY ROOM');
    rr.position.set(-6.8, 0.45, -4.0);
    rr.rotation.y = Math.PI * 0.6;
    group.add(rr);

    // Observation Lounge — Starboard Forward
    const ol = createDoorAssembly('OBSERVATION');
    ol.position.set(6.8, 0.45, -4.0);
    ol.rotation.y = -Math.PI * 0.6;
    group.add(ol);

    return group;
  }

  _buildSmallLCARS() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 128);

    // Coloured bumpers
    const colors = ['#FF9900', '#3399FF', '#CC99FF', '#CC6600'];
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(4, 4 + i * 30, 56, 24, 6);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.35),
      new THREE.MeshBasicMaterial({ map: tex })
    );
  }

  // ── LCARS screen builder ───────────────────────────────────────────────
  _buildLCARSScreen(w, h, title = 'SYS') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    this._drawLCARS(ctx, canvas.width, canvas.height, 0, title);
    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide })
    );
    const lcarsData = { canvas, ctx, tex, t: 0, title };
    mesh._lcarsData = lcarsData;
    return mesh;
  }

  _drawLCARS(ctx, w, h, t, title) {
    const C = {
      orange: '#FF9900', dark: '#CC6600',
      blue: '#3399FF', purple: '#CC99FF',
      red: '#FF4444', green: '#00FF88',
      bg: '#000000',
    };

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Left bumpers
    const bumpers = [C.orange, C.blue, C.purple, C.dark];
    bumpers.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(0, 4 + i * 44, 22, 36, 10);
      ctx.fill();
    });

    // Top bar
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.roundRect(26, 0, w - 26, 36, [0, 10, 0, 0]);
    ctx.fill();

    // Title
    ctx.fillStyle = C.bg;
    ctx.font = 'bold 15px Arial Narrow, Arial';
    ctx.fillText(title, 38, 24);

    // Stardate
    ctx.textAlign = 'right';
    const sd = (47634 + t * 8.4).toFixed(1);
    ctx.fillText('SD ' + sd, w - 8, 24);
    ctx.textAlign = 'left';

    // System readouts
    const systems = [
      { label: 'SHIELDS', color: C.blue },
      { label: 'WEAPONS', color: C.orange },
      { label: 'PROPULSION', color: C.purple },
      { label: 'LIFE SUPP', color: C.dark },
      { label: 'SENSORS', color: C.blue },
    ];

    systems.forEach((sys, i) => {
      const y = 46 + i * 40;
      const fill = 0.6 + 0.35 * Math.abs(Math.sin(t * 0.7 + i * 1.4));

      ctx.fillStyle = sys.color;
      ctx.beginPath();
      ctx.roundRect(26, y, 90, 28, 4);
      ctx.fill();

      ctx.fillStyle = C.bg;
      ctx.font = 'bold 11px Arial Narrow, Arial';
      ctx.fillText(sys.label, 32, y + 19);

      ctx.fillStyle = '#111';
      ctx.fillRect(122, y + 6, w - 130, 16);
      ctx.fillStyle = sys.color;
      ctx.fillRect(122, y + 6, (w - 130) * fill, 16);

      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      const pct = Math.round(fill * 100);
      ctx.fillText(pct + '%', w - 6, y + 19);
      ctx.textAlign = 'left';
    });

    // Horizontal scanline
    const scanY = 40 + ((t * 55) % (h - 50));
    ctx.strokeStyle = 'rgba(255,153,0,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(26, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();
  }

  // ── Starfield animation ────────────────────────────────────────────────
  _drawStarfield(t) {
    const ctx = this._starCtx;
    const w = this._starCanvas.width;
    const h = this._starCanvas.height;

    // Deep space background
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    // Subtle nebula wash
    const grd = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.5);
    grd.addColorStop(0, 'rgba(20,15,40,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    if (this._warpActive) {
      const wp = this._warpProgress;
      this._stars.forEach(s => {
        const cx = w / 2;
        const cy = h / 2;
        const dx = s.x - cx;
        const dy = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;
        const len = dist * wp * 3.5;
        const nx = dx / dist;
        const ny = dy / dist;
        ctx.strokeStyle = 'rgba(180,210,255,' + (0.4 + s.brightness * 0.6) + ')';
        ctx.lineWidth = s.r * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + nx * len, s.y + ny * len);
        ctx.stroke();
      });
    } else {
      this._stars.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 2.0 + s.x * 0.5);
        const alpha = s.brightness * twinkle;
        ctx.fillStyle = 'rgba(200,215,255,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // ── Red Alert ──────────────────────────────────────────────────────────
  activateRedAlert() {
    this._redAlertMode = !this._redAlertMode;
    this._redAlertTime = 0;
    if (!this._redAlertMode) {
      // Reset lights to normal
      this._accentLights.forEach(l => {
        if (l.isPointLight) {
          l.color.setHex(0xFFCC66);
          l.intensity = 1.2;
        }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(0xFFEECC);
        this._ceilLightMat.emissiveIntensity = 2.0;
      }
    }
    this._audio.play?.('computer_ack');
  }

  activateWarp() {
    this._warpActive = true;
    this._warpProgress = 0;
    this._audio.play?.('computer_ack');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  unload() {
    this._scene.fog = null;
    this._ceilLightMat?.dispose();
    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._starTex?.dispose();
  }

  // ── Per-frame update ───────────────────────────────────────────────────
  update(dt, elapsed) {
    // Animate LCARS screens
    this._lcarsScreens.forEach(d => {
      d.t += dt;
      this._drawLCARS(d.ctx, d.canvas.width, d.canvas.height, d.t, d.title);
      d.tex.needsUpdate = true;
    });

    // Animate starfield (throttled to ~20fps for performance)
    this._starUpdateAccum += dt;
    if (this._starUpdateAccum >= 0.05 && this._starTex) {
      this._drawStarfield(elapsed);
      this._starTex.needsUpdate = true;
      this._starUpdateAccum = 0;
    }

    // Warp effect
    if (this._warpActive) {
      this._warpProgress = Math.min(1, this._warpProgress + dt * 0.5);
      if (this._warpProgress >= 1) {
        setTimeout(() => { this._warpActive = false; }, 2000);
      }
    }

    // Red alert pulsing
    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const alertOn = (this._redAlertTime % 1.0) < 0.4;
      this._accentLights.forEach(l => {
        if (!l.isPointLight) return;
        if (alertOn) {
          l.color.setHex(0xFF1100);
          l.intensity = 3.0;
        } else {
          l.color.setHex(0x330000);
          l.intensity = 0.3;
        }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(alertOn ? 0xFF1100 : 0x330000);
        this._ceilLightMat.emissiveIntensity = alertOn ? 3.5 : 0.3;
      }
    }
  }
}
