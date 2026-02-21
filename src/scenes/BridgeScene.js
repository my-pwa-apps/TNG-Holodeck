import * as THREE from 'three';

const CANVAS_UPDATE_INTERVAL   = 0.05;  // throttle canvas texture uploads to ~20fps
const RED_ALERT_PULSE_FREQUENCY = 4.0;  // Hz — red alert light pulse rate

/**
 * BridgeScene — TNG Starship Bridge with LCARS consoles,
 * animated viewscreen starfield, and warp support.
 */
export class BridgeScene {
  constructor(scene, audio) {
    this._scene  = scene;
    this._audio  = audio;
    this._root   = new THREE.Group();
    this._lcarsScreens    = [];      // {canvas, ctx, tex, t, title}
    this._starfieldMat    = null;
    this._warpActive      = false;
    this._warpProgress    = 0;
    this._redAlertMode    = false;   // toggled by "computer, red alert"
    this._redAlertTime    = 0;
    this._starUpdateAccum = 0;       // throttle canvas redraws to ~20 fps
    this._accentLights    = [];      // tracked for red-alert colour pulse
    this._ceilLightMat    = null;    // emissive ceiling ring — flashes on alert
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

    // Accent lights at console positions — tracked for red-alert pulse
    [[-3, 1, -1], [3, 1, -1], [0, 1, 2]].forEach(pos => {
      const l = new THREE.PointLight(0xFF9900, 1.5, 6);
      l.position.set(...pos);
      this._root.add(l);
      this._accentLights.push(l);
    });

    // ── Floor — concentric-band vertex colours suggest TNG bridge carpet ──
    const floorGeo = new THREE.CircleGeometry(7, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorPos = floorGeo.attributes.position;
    const floorCols = new Float32Array(floorPos.count * 3);
    for (let i = 0; i < floorPos.count; i++) {
      const r = Math.sqrt(floorPos.getX(i) ** 2 + floorPos.getZ(i) ** 2) / 7;
      const b = r < 0.28 ? 0.14 : r < 0.62 ? 0.10 : 0.07;
      floorCols[i * 3] = b * 0.72; floorCols[i * 3 + 1] = b * 0.72; floorCols[i * 3 + 2] = b;
    }
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(floorCols, 3));
    const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.75, vertexColors: true });
    this._root.add(new THREE.Mesh(floorGeo, floorMat));

    // ── Consoles (arc layout) ─────────────────────────────────────────────
    this._root.add(this._buildConsoles());

    // ── Viewscreen ───────────────────────────────────────────────────────
    this._root.add(this._buildViewscreen());

    // ── Command chairs ────────────────────────────────────────────────────
    this._root.add(this._buildChairs());

    // ── Hull envelope: walls, ceiling, Conn station, Tactical station ─────
    this._root.add(this._buildWalls());
    this._root.add(this._buildCeiling());
    this._root.add(this._buildConnStation());
    this._root.add(this._buildTacticalStation());

    this._scene.add(this._root);
    return this._root;
  }

  _buildConsoles() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });

    // Front console arc
    const shape   = new THREE.Shape();
    shape.absarc(0, 0, 3.2, -Math.PI * 0.35, Math.PI * 0.35, false);
    shape.absarc(0, 0, 2.6, Math.PI * 0.35, -Math.PI * 0.35, true);
    const extSettings = { depth: 0.8, bevelEnabled: false };
    const consoleFront = new THREE.ExtrudeGeometry(shape, extSettings);
    const conMesh = new THREE.Mesh(consoleFront, panMat);
    conMesh.rotation.x = -Math.PI / 2;
    conMesh.position.y = 0.8;
    conMesh.position.z = -2.5;
    group.add(conMesh);

    // Side stations
    const sideTitles = ['SCIENCE', 'ENGINEERING'];
    [[-4.5, 0, 0], [4.5, 0, 0]].forEach((pos, idx) => {
      const side = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.0, 0.8),
        panMat
      );
      side.position.set(...pos);
      side.position.y = 0.5;
      group.add(side);

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
    const mat  = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

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

    // Screen frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.4 });
    const frame    = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.2, 0.15), frameMat);
    frame.position.set(0, 2.4, -6);
    group.add(frame);

    // Starfield via custom shader on canvas texture
    const canvas = document.createElement('canvas');
    canvas.width  = 1024;
    canvas.height = 512;
    this._starCanvas = canvas;
    this._starCtx    = canvas.getContext('2d');
    this._starTex    = new THREE.CanvasTexture(canvas);

    // Generate static stars
    this._stars = Array.from({ length: 500 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      brightness: Math.random(),
    }));

    const screenMat = new THREE.MeshBasicMaterial({ map: this._starTex });
    const screen    = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), screenMat);
    screen.position.set(0, 2.4, -5.92);
    group.add(screen);

    return group;
  }

  _buildChairs() {
    const group  = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.8 });

    // Captain's chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.6), seatMat);
    seat.position.set(0, 0.5, 1);
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), seatMat);
    back.position.set(0, 0.85, 0.75);
    group.add(back);

    // Armrests with LCARS panels
    [[-0.4, 0.6, 1], [0.4, 0.6, 1]].forEach(pos => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), seatMat);
      arm.position.set(...pos);
      group.add(arm);
      // Tiny LCARS panel
      const panel = this._buildLCARSScreen(0.1, 0.12);
      panel.position.set(pos[0], pos[1] + 0.05, pos[2]);
      panel.rotation.x = -Math.PI / 2;
      group.add(panel);
    });

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

  // ── Hull geometry ────────────────────────────────────────────────────────

  /** Cylindrical bridge hull wall with turbolift door detail at rear. */
  _buildWalls() {
    const group   = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1c1c2e, roughness: 0.6, metalness: 0.2 });

    // Full cylindrical hull rendered on the inside (BackSide)
    const wallGeo = new THREE.CylinderGeometry(7.8, 7.8, 3.4, 32, 1, true);
    const wall    = new THREE.Mesh(wallGeo, hullMat.clone());
    wall.material.side = THREE.BackSide;
    wall.position.y = 1.7;
    group.add(wall);

    // Rear turbolift door (centre back)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.4 });
    const door    = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), doorMat);
    door.position.set(0, 1.1, 7.7);
    group.add(door);

    // Amber door frame trim
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xFF9900, emissive: new THREE.Color(0xFF9900), emissiveIntensity: 0.4, roughness: 0.3,
    });
    [-0.65, 0.65].forEach(x => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.1), trimMat);
      trim.position.set(x, 1.1, 7.7);
      group.add(trim);
    });

    return group;
  }

  /** Ceiling disc with TNG ambient lighting ring (changes colour on red alert). */
  _buildCeiling() {
    const group   = new THREE.Group();
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.5 });

    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.2;
    group.add(ceiling);

    // Ambient ring — colour-shifts on red alert
    this._ceilLightMat = new THREE.MeshStandardMaterial({
      color: 0x3366AA, emissive: new THREE.Color(0x3366AA), emissiveIntensity: 0.8, roughness: 0.3,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.09, 8, 48), this._ceilLightMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3.05;
    group.add(ring);

    // Central recessed lighting panel
    const panMat = new THREE.MeshStandardMaterial({
      color: 0x334466, emissive: new THREE.Color(0x334466), emissiveIntensity: 0.5,
    });
    const centrePanel = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), panMat);
    centrePanel.rotation.x = Math.PI / 2;
    centrePanel.position.y = 3.15;
    group.add(centrePanel);

    return group;
  }

  /** Conn/Helm station — twin forward console in front of the captain's chair. */
  _buildConnStation() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });

    const conn = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 0.75), panMat);
    conn.position.set(0, 0.425, -0.5);
    group.add(conn);

    // Angled top surface
    const surfMat = new THREE.MeshStandardMaterial({ color: 0x0d0d1e, roughness: 0.4 });
    const surf    = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), surfMat);
    surf.rotation.x = -0.6;
    surf.position.set(0, 0.88, -0.52);
    group.add(surf);

    const screen = this._buildLCARSScreen(1.6, 0.65, 'CONN / HELM');
    screen.position.set(0, 1.05, -0.5);
    screen.rotation.x = -0.55;
    group.add(screen);
    this._lcarsScreens.push(screen._lcarsData);

    return group;
  }

  /** Tactical station — raised console at rear of bridge behind captain's chair. */
  _buildTacticalStation() {
    const group  = new THREE.Group();
    const panMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });

    // Raised platform
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 1.2), panMat);
    base.position.set(0, 0.075, 3.2);
    group.add(base);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 0.9), panMat);
    housing.position.set(0, 0.625, 3.2);
    group.add(housing);

    const screen = this._buildLCARSScreen(2.2, 0.75, 'TACTICAL SYS');
    screen.position.set(0, 1.28, 3.2);
    screen.rotation.x = -0.5;
    group.add(screen);
    this._lcarsScreens.push(screen._lcarsData);

    return group;
  }

  // ── Red alert ────────────────────────────────────────────────────────────

  /** Toggle red alert mode — pulses lights red, resets on second call. */
  activateRedAlert() {
    this._redAlertMode = !this._redAlertMode;
    if (!this._redAlertMode) {
      // Reset to normal
      this._redAlertTime = 0;
      this._accentLights.forEach(l => { l.color.set(0xFF9900); l.intensity = 1.5; });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.set(0x3366AA);
        this._ceilLightMat.emissiveIntensity = 0.8;
      }
    }
  }

  activateWarp() {
    this._warpActive   = true;
    this._warpProgress = 0;
    this._audio.play?.('computer_ack');
  }

  unload() {
    this._scene.fog = null;
    this._scene.remove(this._root);
    this._root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    });
    this._starTex?.dispose();
    // Dispose canvas textures created by _buildLCARSScreen
    this._lcarsScreens.forEach(d => d.tex?.dispose());
  }

  getObjects() { return [this._root]; }

  update(dt, elapsed) {
    // Throttle canvas redraws to ~20fps to reduce GPU texture upload cost
    this._starUpdateAccum += dt;
    const shouldRedraw = this._starUpdateAccum >= CANVAS_UPDATE_INTERVAL;
    if (shouldRedraw) this._starUpdateAccum = 0;

    // Animate LCARS screens
    this._lcarsScreens.forEach(d => {
      d.t += dt;
      if (shouldRedraw) {
        this._drawLCARS(d.ctx, d.canvas.width, d.canvas.height, d.t);
        d.tex.needsUpdate = true;
      }
    });

    // Animate viewscreen
    if (this._starTex && shouldRedraw) {
      this._drawStarfield(elapsed);
      this._starTex.needsUpdate = true;
    }

    // Warp effect ramp
    if (this._warpActive) {
      this._warpProgress = Math.min(1, this._warpProgress + dt * 0.5);
      if (this._warpProgress >= 1) {
        setTimeout(() => { this._warpActive = false; }, 2000);
      }
    }

    // Red alert: pulse accent lights and ceiling ring red
    if (this._redAlertMode) {
      this._redAlertTime += dt;
      const pulse = 0.5 + 0.5 * Math.sin(this._redAlertTime * RED_ALERT_PULSE_FREQUENCY);
      this._accentLights.forEach(l => {
        l.color.setHSL(0, 1, 0.3 + pulse * 0.35);
        l.intensity = 2.0 + pulse * 2.0;
      });
      if (this._ceilLightMat) {
        this._ceilLightMat.emissive.setHSL(0, 1, 0.15 + pulse * 0.2);
        this._ceilLightMat.emissiveIntensity = 0.5 + pulse;
      }
    }
  }
}
