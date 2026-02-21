import * as THREE from 'three';

/**
 * BridgeScene — TNG Enterprise-D Main Bridge
 *
 * Geometry:
 *   - Curved hull walls + carpet floor w/ vertex colours
 *   - Ceiling disc with rib rings and emissive light ring
 *   - Helm/Conn forward stations + Tactical station arc
 *   - 2 side science/engineering stations
 *   - Animated LCARS canvas screens on every console
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
  }

  load() {
    this._scene.fog = null;

    // ── Lighting ─────────────────────────────────────────────────────────
    // Raised ambient so ACES doesn't crush the dark hull/console surfaces.
    this._root.add(new THREE.AmbientLight(0x334466, 0.8));

    const keyLight = new THREE.SpotLight(0x6699CC, 5.0, 20, Math.PI / 4, 0.5);
    keyLight.position.set(0, 5, 0);
    keyLight.castShadow = true;
    this._root.add(keyLight);

    // Accent lights at console positions
    [[-3, 1, -1], [3, 1, -1], [0, 1, 2]].forEach(pos => {
      const l = new THREE.PointLight(0xFF9900, 1.5, 6);
      l.position.set(...pos);
      this._root.add(l);
    });

    // ── Floor ────────────────────────────────────────────────────────────
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.6 });
    const floorGeo = new THREE.CircleGeometry(7, 32);
    floorGeo.rotateX(-Math.PI / 2);
    this._root.add(new THREE.Mesh(floorGeo, floorMat));

    // ── Consoles (arc layout) ─────────────────────────────────────────────
    this._root.add(this._buildConsoles());

    // ── Viewscreen ───────────────────────────────────────────────────────
    this._root.add(this._buildViewscreen());

    // ── Command chairs ────────────────────────────────────────────────────
    this._root.add(this._buildChairs());

    this._scene.add(this._root);
    return this._root;
  }

  _buildConsoles() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });

    // Front arc
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 3.2, -Math.PI * 0.35, Math.PI * 0.35, false);
    shape.absarc(0, 0, 2.6, Math.PI * 0.35, -Math.PI * 0.35, true);
    const conMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false }),
      panMat
    );
    conMesh.rotation.x = -Math.PI / 2;
    conMesh.position.set(0, 0.8, -2.5);
    group.add(conMesh);

    // Side science / engineering stations
    const sideTitles = ['SCIENCE', 'ENGINEERING'];
    [[-4.5, 0, 0], [4.5, 0, 0]].forEach((pos, idx) => {
      group.add(Object.assign(
        new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.8), panMat),
        { position: new THREE.Vector3(...pos).setY(0.5) }
      ));
      const screen = this._buildLCARSScreen(0.9, 0.6, sideTitles[idx]);
      screen.position.set(pos[0], 1.1, pos[2]);
      screen.rotation.x = -0.4;
      group.add(screen);
      this._lcarsScreens.push(screen._lcarsData);
    });

    return group;
  }

  _buildLCARSScreen(w, h, title = 'TACTICAL SYS') {
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

  _drawLCARS(ctx, w, h, t, title = 'TACTICAL SYS') {
    // TNG LCARS palette
    const C = {
      orange: '#FF9900', dark: '#CC6600',
      blue:   '#3399FF', purple: '#CC99FF',
      red:    '#FF4444', green: '#00FF88',
      bg:     '#000000',
    };

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // ── Left bumper bars (TNG fingerprint) ────────────────────────────
    const bumpers = [C.orange, C.blue, C.purple, C.dark];
    bumpers.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(0, 4 + i * 44, 22, 36, 10);
      ctx.fill();
    });

    // ── Top header bar ────────────────────────────────────────────────
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

    // ── System status bars ────────────────────────────────────────────
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

      // Label pill
      ctx.fillStyle = sys.color;
      ctx.beginPath();
      ctx.roundRect(26, y, 90, 28, 4);
      ctx.fill();
      ctx.fillStyle = C.bg;
      ctx.font = 'bold 11px Arial Narrow, Arial';
      ctx.fillText(sys.label, 32, y + 19);

      // Fill bar
      ctx.fillStyle = '#111';
      ctx.fillRect(122, y + 6, w - 130, 16);
      ctx.fillStyle = sys.color;
      ctx.fillRect(122, y + 6, (w - 130) * fill, 16);

      // Percentage
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(fill * 100)}%`, w - 6, y + 19);
      ctx.textAlign = 'left';
    });

    // ── Animated scan line ────────────────────────────────────────────
    const scanY = 40 + ((t * 55) % (h - 50));
    ctx.strokeStyle = 'rgba(255,153,0,0.10)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(26, scanY); ctx.lineTo(w, scanY);
    ctx.stroke();
  }

  _buildViewscreen() {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.4 });
    const frame    = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.2, 0.15), frameMat);
    frame.position.set(0, 2.4, -6);
    group.add(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    this._starCanvas = canvas;
    this._starCtx    = canvas.getContext('2d');
    this._starTex    = new THREE.CanvasTexture(canvas);
    this._stars      = Array.from({ length: 500 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      brightness: Math.random(),
    }));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 3),
      new THREE.MeshBasicMaterial({ map: this._starTex })
    );
    screen.position.set(0, 2.4, -5.92);
    group.add(screen);
    return group;
  }

  _buildChairs() {
    const group   = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.8 });

    // Captain's chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.6), seatMat);
    seat.position.set(0, 0.5, 1);
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), seatMat);
    back.position.set(0, 0.85, 0.75);
    group.add(back);

    // XO / Counsellor chairs
    [[-0.85, 1.0], [0.85, 1.0]].forEach(([x, z]) => {
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.5), seatMat);
      s2.position.set(x, 0.5, z);
      group.add(s2);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.1), seatMat);
      b2.position.set(x, 0.82, z - 0.2);
      group.add(b2);
    });
    return group;
  }

  // ── Hull walls ─────────────────────────────────────────────────
  _buildWalls() {
    const group = new THREE.Group();
    const hull  = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.2, 4.8, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.6, side: THREE.BackSide })
    );
    hull.position.y = 2.4;
    group.add(hull);

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xFF9900, emissive: new THREE.Color(0xFF9900), emissiveIntensity: 0.25, roughness: 0.4,
    });

    [-Math.PI * 0.55, Math.PI * 0.55].forEach(angle => {
      const x = Math.sin(angle) * 6.9;
      const z = Math.cos(angle) * 6.9;
      const screen = this._buildLCARSScreen(1.2, 2.4, 'WALL STATUS');
      screen.position.set(x * 0.95, 1.8, z * 0.95);
      screen.lookAt(0, 1.8, 0);
      this._lcarsScreens.push(screen._lcarsData);
      group.add(screen);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.1), accentMat);
      bar.position.set(x * 0.97, 3.35, z * 0.97);
      bar.lookAt(0, 3.35, 0);
      group.add(bar);
    });
    return group;
  }

  // ── Ceiling ───────────────────────────────────────────────────
  _buildCeiling() {
    const group  = new THREE.Group();
    const CEIL_Y = 4.8;
    const disc   = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.5 })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.y = CEIL_Y;
    group.add(disc);

    [2.4, 4.2, 6.2].forEach(r => {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.06, 6, 40),
        new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.7 })
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = CEIL_Y - 0.04;
      group.add(rib);
    });

    this._ceilLightMat = new THREE.MeshStandardMaterial({
      color: 0x3344aa, emissive: new THREE.Color(0x3344aa), emissiveIntensity: 2.0, roughness: 0.1,
    });
    const lightRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.09, 6, 40), this._ceilLightMat);
    lightRing.rotation.x = Math.PI / 2;
    lightRing.position.y = CEIL_Y - 0.06;
    group.add(lightRing);

    const overhead = new THREE.PointLight(0x8899CC, 2.0, 15);
    overhead.position.set(0, CEIL_Y - 0.3, 0);
    this._accentLights.push(overhead);
    group.add(overhead);
    return group;
  }

  // ── Helm / Conn ──────────────────────────────────────────────
  _buildConnStation() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x110808, roughness: 0.8 });
    [{ x: -0.58, title: 'HELM' }, { x: 0.58, title: 'CONN' }].forEach(({ x, title }) => {
      const con = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.7), panMat);
      con.position.set(x, 0.72, -1.1);
      group.add(con);
      const screen = this._buildLCARSScreen(0.5, 0.35, title);
      screen.position.set(x, 0.95, -1.28);
      screen.rotation.x = -0.65;
      this._lcarsScreens.push(screen._lcarsData);
      group.add(screen);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.45), seatMat);
      seat.position.set(x, 0.46, -0.55);
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.08), seatMat);
      back.position.set(x, 0.7, -0.32);
      group.add(back);
      const cl = new THREE.PointLight(0xFF9900, 0.8, 3);
      cl.position.set(x, 1.1, -1.4);
      this._accentLights.push(cl);
      group.add(cl);
    });
    return group;
  }

  // ── Tactical station ─────────────────────────────────────────
  _buildTacticalStation() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x110808, roughness: 0.8 });
    const shape  = new THREE.Shape();
    shape.absarc(0, 0, 2.0, -Math.PI * 0.28, Math.PI * 0.28, false);
    shape.absarc(0, 0, 1.55, Math.PI * 0.28, -Math.PI * 0.28, true);
    const tacMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false }), panMat
    );
    tacMesh.rotation.x = -Math.PI / 2;
    tacMesh.position.set(0, 0.72, 3.2);
    group.add(tacMesh);
    const screen = this._buildLCARSScreen(0.9, 0.5, 'TACTICAL');
    screen.position.set(0, 1.05, 3.35);
    screen.rotation.x = -0.55;
    this._lcarsScreens.push(screen._lcarsData);
    group.add(screen);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.45), seatMat);
    seat.position.set(0, 0.46, 2.55);
    group.add(seat);
    const tl = new THREE.PointLight(0xFF9900, 0.9, 4);
    tl.position.set(0, 1.3, 3.2);
    this._accentLights.push(tl);
    group.add(tl);
    return group;
  }

  _drawStarfield(t) {
    const ctx = this._starCtx;
    const w   = this._starCanvas.width;
    const h   = this._starCanvas.height;

    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    if (this._warpActive) {
      // Warp streaks
      const wp = this._warpProgress;
      this._stars.forEach(s => {
        const cx   = w / 2;
        const cy   = h / 2;
        const dx   = s.x - cx;
        const dy   = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return; // skip stars too close to screen centre
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
      // Normal star points
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
        if (l.isPointLight) { l.color.setHex(0xFF9900); l.intensity = 1.5; }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(0x3344aa);
        this._ceilLightMat.emissiveIntensity = 2.0;
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

    // Starfield throttled to ~20 fps
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

    // Red-alert pulse (1 Hz, ~40 % duty)
    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const alertOn = (this._redAlertTime % 1.0) < 0.4;
      this._accentLights.forEach(l => {
        if (!l.isPointLight) return;
        if (alertOn) { l.color.setHex(0xFF1100); l.intensity = 2.8; }
        else         { l.color.setHex(0x220000); l.intensity = 0.2; }
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHex(alertOn ? 0xFF1100 : 0x220000);
        this._ceilLightMat.emissiveIntensity = alertOn ? 3.5 : 0.2;
      }
    }
  }
}
