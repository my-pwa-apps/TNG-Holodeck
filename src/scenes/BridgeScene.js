import * as THREE from 'three';

/**
 * BridgeScene — TNG Starship Bridge with LCARS consoles,
 * animated viewscreen starfield, and warp support.
 */
export class BridgeScene {
  constructor(scene, audio) {
    this._scene  = scene;
    this._audio  = audio;
    this._root   = new THREE.Group();
    this._lcarsScreens = [];  // {mesh, canvas, ctx}
    this._starfieldMat = null;
    this._warpActive   = false;
    this._warpProgress = 0;
  }

  load() {
    this._scene.fog = null;

    // ── Lighting ─────────────────────────────────────────────────────────
    this._root.add(new THREE.AmbientLight(0x112233, 0.3));

    const keyLight = new THREE.SpotLight(0x4488FF, 2.0, 20, Math.PI / 4, 0.5);
    keyLight.position.set(0, 5, 0);
    keyLight.castShadow = true;
    this._root.add(keyLight);

    // Accent lights at console positions
    [[-3, 1, -1], [3, 1, -1], [0, 1, 2]].forEach(pos => {
      const l = new THREE.PointLight(0xFF9900, 0.6, 5);
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
    [[-4.5, 0, 0], [4.5, 0, 0]].forEach(pos => {
      const side = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.0, 0.8),
        panMat
      );
      side.position.set(...pos);
      side.position.y = 0.5;
      group.add(side);

      // LCARS screen on each station
      const screen = this._buildLCARSScreen(0.9, 0.6);
      screen.position.set(pos[0], 1.1, pos[2]);
      screen.rotation.x = -0.4;
      group.add(screen);
      this._lcarsScreens.push(screen._lcarsData);
    });

    return group;
  }

  _buildLCARSScreen(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    this._drawLCARS(ctx, canvas.width, canvas.height, 0);

    const tex  = new THREE.CanvasTexture(canvas);
    const mat  = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

    const lcarsData = { canvas, ctx, tex, t: 0 };
    mesh._lcarsData  = lcarsData;
    return mesh;
  }

  _drawLCARS(ctx, w, h, t) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const colors = ['#FF9900', '#CC6600', '#3399FF', '#CC99FF', '#FF6633'];

    // Header bar
    ctx.fillStyle = '#FF9900';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('TACTICAL SYSTEMS ACTIVE', 12, 20);

    // Animated data bars
    for (let i = 0; i < 6; i++) {
      const y     = 40 + i * 32;
      const fill  = 0.3 + 0.6 * Math.abs(Math.sin(t * 0.8 + i * 1.1));
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(8, y, w * fill - 16, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.fillText(`SYS-${(i + 1).toString().padStart(2, '0')}: ${Math.round(fill * 100)}%`, 12, y + 13);
    }

    // Timestamp
    ctx.fillStyle = '#3399FF';
    ctx.font = '10px monospace';
    ctx.fillText(`SD ${Math.floor(t * 10) % 99999}`, w - 80, h - 8);
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
        const cx  = w / 2;
        const cy  = h / 2;
        const dx  = s.x - cx;
        const dy  = s.y - cy;
        const len = Math.sqrt(dx*dx + dy*dy) * wp * 3;
        const nx  = dx / (Math.sqrt(dx*dx + dy*dy));
        const ny  = dy / (Math.sqrt(dx*dx + dy*dy));
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
  }

  getObjects() { return [this._root]; }

  update(dt, elapsed) {
    // Animate LCARS screens
    this._lcarsScreens.forEach(d => {
      d.t += dt;
      this._drawLCARS(d.ctx, d.canvas.width, d.canvas.height, d.t);
      d.tex.needsUpdate = true;
    });

    // Animate viewscreen
    if (this._starTex) {
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
  }
}
