import * as THREE from 'three';

/**
 * BridgeScene — TNG Enterprise-D Main Bridge
 *
 * Geometry:
 *   - Canonical two-level floor (red lower pit, tan upper horseshoe)
 *   - Wooden horseshoe railing with central Tactical station
 *   - Forward Helm and Conn stations
 *   - Aft Science, Engineering, and Mission Ops stations
 *   - Command chairs (Captain, XO, Counselor)
 *   - Ceiling dome and concentric light rings
 *   - Viewscreen with warp-capable starfield
 *   - Red-alert mode: accent lights pulse red at 1 Hz
 */
export class BridgeScene {
  constructor(scene, audio) {
    this._scene  = scene;
    this._audio  = audio;
    this._root   = new THREE.Group();
    this._lcarsScreens    = [];
    this._starfieldMat    = null;
    this._warpActive      = false;
    this._warpProgress    = 0;
    this._redAlertMode    = false;
    this._redAlertTime    = 0;
    this._starUpdateAccum = 0;
    this._accentLights    = [];
    this._ceilLightMat    = null;
    this._redAlertMats    = [];
  }

  load() {
    this._scene.fog = null;

    // ── Lighting ─────────────────────────────────────────────────────────
    this._root.add(new THREE.AmbientLight(0x556677, 0.6));

    const domeLight = new THREE.PointLight(0xffeedd, 2.5, 20);
    domeLight.position.set(0, 4.5, 0);
    this._root.add(domeLight);

    // Accent lights for consoles
    [[-3, 2, -4], [3, 2, -4], [0, 2, 3], [-5, 2, 4], [5, 2, 4]].forEach(pos => {
      const l = new THREE.PointLight(0xFF9900, 1.0, 8);
      l.position.set(...pos);
      this._accentLights.push(l);
      this._root.add(l);
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

  _buildFloor() {
    const group = new THREE.Group();
    
    // Lower level (Red Carpet)
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x661111, roughness: 0.9 });
    const lowerGeo = new THREE.CylinderGeometry(3.8, 3.8, 0.1, 64);
    const lowerFloor = new THREE.Mesh(lowerGeo, lowerMat);
    lowerFloor.position.y = 0.05;
    group.add(lowerFloor);

    // Upper level (Tan Carpet)
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.9 });
    const upperGeo = new THREE.RingGeometry(3.8, 7.8, 64);
    upperGeo.rotateX(-Math.PI / 2);
    const upperFloor = new THREE.Mesh(upperGeo, upperMat);
    upperFloor.position.y = 0.4;
    group.add(upperFloor);

    // Ramps connecting lower and upper levels
    const rampGeo = new THREE.BoxGeometry(2.5, 0.45, 2.0);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x774433, roughness: 0.9 });
    
    const leftRamp = new THREE.Mesh(rampGeo, rampMat);
    leftRamp.position.set(-3.5, 0.2, 0);
    leftRamp.rotation.z = -0.15;
    group.add(leftRamp);

    const rightRamp = new THREE.Mesh(rampGeo, rampMat);
    rightRamp.position.set(3.5, 0.2, 0);
    rightRamp.rotation.z = 0.15;
    group.add(rightRamp);

    return group;
  }

  _buildWalls() {
    const group = new THREE.Group();
    
    // Main curved hull walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.7, side: THREE.BackSide });
    const wallGeo = new THREE.CylinderGeometry(7.8, 7.8, 4.6, 64, 1, true, -Math.PI * 0.65, Math.PI * 1.3);
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = 2.7;
    group.add(walls);

    // Front alcove walls (around viewscreen)
    const frontWallGeo = new THREE.CylinderGeometry(7.8, 7.8, 4.6, 32, 1, true, Math.PI * 0.75, Math.PI * 0.5);
    const frontWalls = new THREE.Mesh(frontWallGeo, wallMat);
    frontWalls.position.y = 2.7;
    group.add(frontWalls);

    // Structural ribs
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xaa9988, roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.6, 0.2), ribMat);
      rib.position.set(Math.sin(angle) * 7.7, 2.7, Math.cos(angle) * 7.7);
      rib.rotation.y = angle;
      group.add(rib);
    }

    return group;
  }

  _buildCeiling() {
    const group = new THREE.Group();
    const CEIL_Y = 5.0;

    // Main ceiling disc
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.8 });
    const ceilGeo = new THREE.RingGeometry(2.5, 7.8, 64);
    ceilGeo.rotateX(Math.PI / 2);
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.position.y = CEIL_Y;
    group.add(ceiling);

    // Central translucent dome
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x445566, transparent: true, opacity: 0.9 });
    const domeGeo = new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.2);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = CEIL_Y - 0.2;
    dome.rotation.x = Math.PI;
    group.add(dome);

    // Concentric light rings
    this._ceilLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeedd, emissiveIntensity: 1.5 });
    [3.0, 4.5, 6.0].forEach(r => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 16, 64), this._ceilLightMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = CEIL_Y - 0.05;
      group.add(ring);
    });

    return group;
  }

  _buildHorseshoe() {
    const group = new THREE.Group();
    
    // Wooden railing
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.4 });
    const railGeo = new THREE.TorusGeometry(3.8, 0.15, 16, 64, Math.PI * 1.1);
    const rail = new THREE.Mesh(railGeo, woodMat);
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = -Math.PI * 0.55;
    rail.position.y = 1.2;
    group.add(rail);

    // Railing supports
    const supportGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i <= 10; i++) {
      const angle = -Math.PI * 0.55 + (i / 10) * Math.PI * 1.1;
      const support = new THREE.Mesh(supportGeo, metalMat);
      support.position.set(Math.cos(angle) * 3.8, 0.8, -Math.sin(angle) * 3.8);
      group.add(support);
    }

    // Tactical Console (Center of horseshoe)
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
    const tacShape = new THREE.Shape();
    tacShape.absarc(0, 0, 4.2, -Math.PI * 0.15, Math.PI * 0.15, false);
    tacShape.absarc(0, 0, 3.5, Math.PI * 0.15, -Math.PI * 0.15, true);
    const tacMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(tacShape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }), panMat);
    tacMesh.rotation.x = -Math.PI / 2;
    tacMesh.position.set(0, 0.4, 0);
    group.add(tacMesh);

    // Tactical Screen
    const screen = this._buildLCARSScreen(1.8, 0.6, 'TACTICAL');
    screen.position.set(0, 1.25, 3.7);
    screen.rotation.x = -0.5;
    screen.rotation.y = Math.PI;
    this._lcarsScreens.push(screen._lcarsData);
    group.add(screen);

    return group;
  }

  _buildCommandChairs() {
    const group = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x881111, roughness: 0.7 }); // Red/maroon seats
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });

    const createChair = (isCaptain) => {
      const chair = new THREE.Group();
      const w = isCaptain ? 0.8 : 0.7;
      const h = isCaptain ? 0.9 : 0.8;
      
      // Base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.4, 16), frameMat);
      base.position.y = 0.2;
      chair.add(base);

      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, 0.6), seatMat);
      seat.position.set(0, 0.45, 0);
      chair.add(seat);

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), seatMat);
      back.position.set(0, 0.45 + h/2, 0.25);
      chair.add(back);

      // Armrests
      const armGeo = new THREE.BoxGeometry(0.15, 0.3, 0.5);
      const leftArm = new THREE.Mesh(armGeo, frameMat);
      leftArm.position.set(-w/2 - 0.05, 0.6, 0);
      chair.add(leftArm);
      
      const rightArm = new THREE.Mesh(armGeo, frameMat);
      rightArm.position.set(w/2 + 0.05, 0.6, 0);
      chair.add(rightArm);

      // Mini LCARS on armrests
      const lcarsGeo = new THREE.PlaneGeometry(0.1, 0.2);
      const lcarsMat = new THREE.MeshBasicMaterial({ color: 0xFF9900 });
      const leftLcars = new THREE.Mesh(lcarsGeo, lcarsMat);
      leftLcars.rotation.x = -Math.PI / 2;
      leftLcars.position.set(-w/2 - 0.05, 0.76, 0.1);
      chair.add(leftLcars);

      return chair;
    };

    // Captain's Chair
    const captChair = createChair(true);
    captChair.position.set(0, 0.1, 1.5);
    group.add(captChair);

    // XO Chair (Riker)
    const xoChair = createChair(false);
    xoChair.position.set(1.2, 0.1, 1.7);
    xoChair.rotation.y = -0.15;
    group.add(xoChair);

    // Counselor Chair (Troi)
    const counsChair = createChair(false);
    counsChair.position.set(-1.2, 0.1, 1.7);
    counsChair.rotation.y = 0.15;
    group.add(counsChair);

    return group;
  }

  _buildConnHelm() {
    const group = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.5 }); // Beige consoles
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });

    // Front console base
    const baseShape = new THREE.Shape();
    baseShape.absarc(0, 0, 2.8, -Math.PI * 0.2, Math.PI * 0.2, false);
    baseShape.absarc(0, 0, 2.0, Math.PI * 0.2, -Math.PI * 0.2, true);
    const baseMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(baseShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.05 }), panMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.set(0, 0.1, -1.5);
    group.add(baseMesh);

    // Helm and Conn Screens
    [{ x: -1.0, title: 'CONN', rot: 0.2 }, { x: 1.0, title: 'OPS', rot: -0.2 }].forEach(({ x, title, rot }) => {
      const screen = this._buildLCARSScreen(0.8, 0.5, title);
      screen.position.set(x, 0.9, -3.8);
      screen.rotation.x = -0.6;
      screen.rotation.y = rot;
      this._lcarsScreens.push(screen._lcarsData);
      group.add(screen);

      // Chairs
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x881111, roughness: 0.7 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), seatMat);
      seat.position.set(x * 0.8, 0.45, -2.5);
      seat.rotation.y = rot;
      group.add(seat);
      
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), seatMat);
      back.position.set(x * 0.8, 0.75, -2.25);
      back.rotation.y = rot;
      group.add(back);
    });

    return group;
  }

  _buildAftStations() {
    const group = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.4 });

    const stations = [
      { angle: Math.PI * 0.75, title: 'SCIENCE I' },
      { angle: Math.PI * 0.85, title: 'SCIENCE II' },
      { angle: Math.PI * 0.95, title: 'ENVIRONMENT' },
      { angle: -Math.PI * 0.95, title: 'ENGINEERING' },
      { angle: -Math.PI * 0.85, title: 'MISSION OPS' },
      { angle: -Math.PI * 0.75, title: 'TACTICAL II' }
    ];

    stations.forEach(({ angle, title }) => {
      const stGroup = new THREE.Group();
      
      // Console base
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.8), panMat);
      base.position.set(0, 0.9, 0);
      stGroup.add(base);

      // Wooden trim
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.9), woodMat);
      trim.position.set(0, 1.4, 0);
      stGroup.add(trim);

      // Screen
      const screen = this._buildLCARSScreen(1.2, 0.7, title);
      screen.position.set(0, 1.8, 0.2);
      screen.rotation.x = -0.3;
      this._lcarsScreens.push(screen._lcarsData);
      stGroup.add(screen);

      // Position along the upper wall
      stGroup.position.set(Math.sin(angle) * 7.2, 0, Math.cos(angle) * 7.2);
      stGroup.rotation.y = angle + Math.PI;
      group.add(stGroup);
    });

    return group;
  }

  _buildViewscreen() {
    const group = new THREE.Group();
    
    // Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const frameGeo = new THREE.BoxGeometry(8.4, 3.6, 0.2);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 2.5, -7.6);
    group.add(frame);

    // Screen Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    this._starCanvas = canvas;
    this._starCtx    = canvas.getContext('2d');
    this._starTex    = new THREE.CanvasTexture(canvas);
    this._stars      = Array.from({ length: 600 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      brightness: Math.random(),
    }));
    
    const screenMat = new THREE.MeshBasicMaterial({ map: this._starTex });
    const screenGeo = new THREE.PlaneGeometry(8.0, 3.2);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 2.5, -7.49);
    group.add(screen);

    return group;
  }

  _buildDoors() {
    const group = new THREE.Group();
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xcc5533, roughness: 0.6 }); // Orange/red doors
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });

    const createDoor = () => {
      const dGroup = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.2), frameMat);
      frame.position.y = 1.6;
      dGroup.add(frame);

      const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.0, 0.1), doorMat);
      door.position.set(0, 1.5, 0.05);
      dGroup.add(door);
      return dGroup;
    };

    // Turbolift 1 (Back Left)
    const tl1 = createDoor();
    tl1.position.set(-5.5, 0.4, 5.0);
    tl1.rotation.y = Math.PI * 0.25;
    group.add(tl1);

    // Turbolift 2 (Back Right)
    const tl2 = createDoor();
    tl2.position.set(5.5, 0.4, 5.0);
    tl2.rotation.y = -Math.PI * 0.25;
    group.add(tl2);

    // Ready Room (Front Left)
    const rr = createDoor();
    rr.position.set(-6.5, 0.4, -3.5);
    rr.rotation.y = Math.PI * 0.6;
    group.add(rr);

    // Observation Lounge (Front Right)
    const ol = createDoor();
    ol.position.set(6.5, 0.4, -3.5);
    ol.rotation.y = -Math.PI * 0.6;
    group.add(ol);

    return group;
  }

  _buildLCARSScreen(w, h, title = 'SYS') {
    const canvas = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    this._drawLCARS(ctx, canvas.width, canvas.height, 0, title);
    const tex  = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide })
    );
    const lcarsData = { canvas, ctx, tex, t: 0, title };
    mesh._lcarsData  = lcarsData;
    return mesh;
  }

  _drawLCARS(ctx, w, h, t, title) {
    const C = {
      orange: '#FF9900', dark: '#CC6600',
      blue:   '#3399FF', purple: '#CC99FF',
      red:    '#FF4444', green: '#00FF88',
      bg:     '#000000',
    };

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const bumpers = [C.orange, C.blue, C.purple, C.dark];
    bumpers.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(0, 4 + i * 44, 22, 36, 10);
      ctx.fill();
    });

    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.roundRect(26, 0, w - 26, 36, [0, 10, 0, 0]);
    ctx.fill();

    ctx.fillStyle = C.bg;
    ctx.font = 'bold 15px Arial Narrow, Arial';
    ctx.fillText(title, 38, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`SD ${(47634 + t * 8.4).toFixed(1)}`, w - 8, 24);
    ctx.textAlign = 'left';

    const systems = [
      { label: 'SHIELDS',   color: C.blue   },
      { label: 'WEAPONS',   color: C.orange },
      { label: 'PROPULSION',color: C.purple },
      { label: 'LIFE SUPP', color: C.dark   },
      { label: 'SENSORS',   color: C.blue   },
    ];

    systems.forEach((sys, i) => {
      const y    = 46 + i * 40;
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
      ctx.fillText(`${Math.round(fill * 100)}%`, w - 6, y + 19);
      ctx.textAlign = 'left';
    });

    const scanY = 40 + ((t * 55) % (h - 50));
    ctx.strokeStyle = 'rgba(255,153,0,0.10)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(26, scanY); ctx.lineTo(w, scanY);
    ctx.stroke();
  }

  _drawStarfield(t) {
    const ctx = this._starCtx;
    const w   = this._starCanvas.width;
    const h   = this._starCanvas.height;

    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    if (this._warpActive) {
      const wp = this._warpProgress;
      this._stars.forEach(s => {
        const cx   = w / 2;
        const cy   = h / 2;
        const dx   = s.x - cx;
        const dy   = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;
        const len  = dist * wp * 3;
        const nx   = dx / dist;
        const ny   = dy / dist;
        ctx.strokeStyle = `rgba(180,200,255,${0.4 + s.brightness * 0.6})`;
        ctx.lineWidth = s.r * 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + nx * len, s.y + ny * len);
        ctx.stroke();
      });
    } else {
      this._stars.forEach(s => {
        const twinkle = 0.6 + 0.4 * Math.sin(t * 2.0 + s.x);
        ctx.fillStyle = `rgba(200,210,255,${s.brightness * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  activateRedAlert() {
    this._redAlertMode = !this._redAlertMode;
    this._redAlertTime = 0;
    if (!this._redAlertMode) {
      this._accentLights.forEach(l => {
        if (l.isPointLight) { l.color.setHex(0xFF9900); l.intensity = 1.0; }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(0xffeedd);
        this._ceilLightMat.emissiveIntensity = 1.5;
      }
    }
    this._audio.play?.('computer_ack');
  }

  activateWarp() {
    this._warpActive   = true;
    this._warpProgress = 0;
    this._audio.play?.('computer_ack');
  }

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

  update(dt, elapsed) {
    this._lcarsScreens.forEach(d => {
      d.t += dt;
      this._drawLCARS(d.ctx, d.canvas.width, d.canvas.height, d.t, d.title);
      d.tex.needsUpdate = true;
    });

    this._starUpdateAccum += dt;
    if (this._starUpdateAccum >= 0.05 && this._starTex) {
      this._drawStarfield(elapsed);
      this._starTex.needsUpdate = true;
      this._starUpdateAccum = 0;
    }

    if (this._warpActive) {
      this._warpProgress = Math.min(1, this._warpProgress + dt * 0.5);
      if (this._warpProgress >= 1) setTimeout(() => { this._warpActive = false; }, 2000);
    }

    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const alertOn = (this._redAlertTime % 1.0) < 0.4;
      this._accentLights.forEach(l => {
        if (!l.isPointLight) return;
        if (alertOn) { l.color.setHex(0xFF1100); l.intensity = 2.5; }
        else         { l.color.setHex(0x220000); l.intensity = 0.2; }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(alertOn ? 0xFF1100 : 0x220000);
        this._ceilLightMat.emissiveIntensity = alertOn ? 3.0 : 0.2;
      }
    }
  }
}
