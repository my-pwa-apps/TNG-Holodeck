import * as THREE from 'three';
import { CatmullRomCurve3 } from 'three';

/**
 * HolodeckArch — the curved control arch that materialises from the
 * holodeck wall on voice command "Computer, arch."
 *
 * Architecture:
 *   - Semicircular tube frame with pulsing amber glow
 *   - Embedded LCARS panel (canvas texture)
 *   - Slides out of the wall over 0.6s
 */
export class HolodeckArch {
  constructor(scene) {
    this._scene   = scene;
    this._root    = new THREE.Group();
    this._visible = false;
    this._slideT  = 0;    // 0 = hidden, 1 = fully extended
    this._targetT = 0;

    this._lcarsTex = null;
    this._lcarsCtx = null;
    this._lcarsT   = 0;

    this._build();
    this._root.visible = false;
    scene.add(this._root);
  }

  _build() {
    // ── Arch frame (CatmullRom semicircle tube) ────────────────────────
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (Math.PI * i) / 20;           // 0 → π (semicircle)
      pts.push(new THREE.Vector3(
        -Math.cos(a) * 1.2,                   // width: 2.4m span
         Math.sin(a) * 2.2,                   // height: 2.2m
        0
      ));
    }
    const curve = new CatmullRomCurve3(pts);

    const tubeGeo = new THREE.TubeGeometry(curve, 30, 0.08, 8, false);
    this._archMat = new THREE.MeshStandardMaterial({
      color:             0xFFB300,
      emissive:          new THREE.Color(0xFFB300),
      emissiveIntensity: 0.9,
      roughness:         0.3,
      metalness:         0.6,
    });
    const tube = new THREE.Mesh(tubeGeo, this._archMat);
    this._root.add(tube);

    // Base pillars
    [-1.22, 1.22].forEach(x => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 2.2, 8),
        this._archMat
      );
      pillar.position.set(x, 1.1, 0);
      this._root.add(pillar);
    });

    // Arch glow (point light)
    this._archLight = new THREE.PointLight(0xFFB300, 1.5, 4);
    this._archLight.position.set(0, 1.5, 0.2);
    this._root.add(this._archLight);

    // ── LCARS panel embedded in arch ───────────────────────────────────
    this._root.add(this._buildLCARSPanel());

    // ── Keypad ─────────────────────────────────────────────────────────
    this._root.add(this._buildKeypad());
  }

  _buildLCARSPanel() {
    const canvas = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 384;
    this._lcarsCtx = canvas.getContext('2d');
    this._lcarsTex = new THREE.CanvasTexture(canvas);
    this._lcarsCanvas = canvas;
    this._drawPanel(0);

    const mat  = new THREE.MeshBasicMaterial({ map: this._lcarsTex, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.35), mat);
    mesh.position.set(0, 1.2, 0.05);
    return mesh;
  }

  _drawPanel(t) {
    const ctx = this._lcarsCtx;
    const w   = this._lcarsCanvas.width;   // 512
    const h   = this._lcarsCanvas.height;  // 384

    // TNG LCARS palette
    const C = {
      orange:  '#FF9900',
      dark:    '#CC6600',
      blue:    '#3399FF',
      purple:  '#CC99FF',
      red:     '#FF4444',
      green:   '#00FF88',
      bg:      '#000000',
      text:    '#FFFFFF',
    };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // ── TNG LCARS layout guide ─────────────────────────────
    // Left bumper column (24px wide)
    // Top elbow bar                                                 //
    // Main content area                                             //
    // Bottom status bar                                             //

    // Left bumper column
    this._roundRect(ctx, 0, 0, 24, h - 40, C.orange);

    // Top elbow bar — spans across, creates the TNG corner bracket look
    this._roundRect(ctx, 0, 0, w, 40, C.orange);
    // Recreate black cutout at corner (TNG elbow)
    ctx.fillStyle = C.bg;
    ctx.fillRect(28, 0, 24, 36);

    // Title text in top bar
    ctx.fillStyle = C.bg;
    ctx.font = 'bold 18px Arial Narrow, Arial';
    ctx.letterSpacing = '0.12em';
    ctx.fillText('HOLODECK ARCH', 60, 28);

    // Stardate (top right)
    ctx.fillStyle = C.bg;
    ctx.font = 'bold 13px Arial Narrow, Arial';
    ctx.fillText(`SD ${(47634 + t * 8.4).toFixed(1)}`, w - 110, 28);

    // ── Left vertical accent bars (below elbow) ──────────────
    const barColors = [C.blue, C.purple, C.orange, C.dark];
    barColors.forEach((c, i) => {
      const y0 = 48 + i * 48;
      this._roundRect(ctx, 28, y0, 18, 36, c);
    });

    // ── Program selector buttons (main content area) ─────────
    const programs = [
      { label: 'GRID ROOM',     key: 'grid',     color: C.blue   },
      { label: 'BAKER STREET',  key: 'sherlock', color: C.orange },
      { label: 'BRIDGE SIM',    key: 'bridge',   color: C.dark   },
      { label: 'ALIEN SURVEY',  key: 'alien',    color: C.purple },
    ];

    programs.forEach((p, i) => {
      const bx = 54, by = 52 + i * 56, bw = w - 62, bh = 42;
      this._roundRect(ctx, bx, by, bw, bh, p.color);
      ctx.fillStyle = C.bg;
      ctx.font = 'bold 15px Arial Narrow, Arial';
      ctx.fillText(p.label, bx + 14, by + 27);

      // Animated activity bar on right of each button
      const fill = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.6 + i * 1.3));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx + bw - 70, by + 8, 60, 8);
      ctx.fillStyle = C.green;
      ctx.fillRect(bx + bw - 70, by + 8, 60 * fill, 8);
    });

    // ── Status section ──────────────────────────────────
    const sy = h - 60;
    ctx.strokeStyle = C.orange;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(54, sy); ctx.lineTo(w - 8, sy); ctx.stroke();

    // Safety protocols status — always shown
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(66, sy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.font = 'bold 11px Arial Narrow, Arial';
    ctx.fillText('SAFETY PROTOCOLS ENABLED', 78, sy + 21);

    // Animated scan-line across panel
    const scanY = sy + 38 + 8 * Math.sin(t * 1.5);
    ctx.strokeStyle = `rgba(255,153,0,0.12)`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(54, scanY); ctx.lineTo(w - 8, scanY); ctx.stroke();

    this._lcarsTex.needsUpdate = true;
  }

  /** Filled rounded rectangle helper */
  _roundRect(ctx, x, y, w, h, color, r = 10) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  _buildKeypad() {
    const group  = new THREE.Group();
    const keyMat = new THREE.MeshStandardMaterial({
      color:   0x111111,
      emissive: new THREE.Color(0xFF9900),
      emissiveIntensity: 0.5,
      roughness: 0.5,
    });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), keyMat.clone());
        key.position.set(-0.23 + col * 0.16, 0.35 + row * 0.12, 0.08);
        key.userData.interactable = true;
        group.add(key);
      }
    }

    group.position.set(0.7, 0.8, 0);
    return group;
  }

  /**
   * Spawn the arch facing the camera, sliding out of the nearest wall.
   */
  spawn(camera) {
    if (this._visible) return;
    this._visible = true;
    this._targetT = 1;
    this._root.visible = true;

    // Position arch on the wall behind the camera
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.y = 0;
    dir.normalize();

    this._root.position.set(
      -dir.x * 4.5,
       0,
      -dir.z * 4.5
    );
    this._root.lookAt(new THREE.Vector3(0, 0, 0));

    // Start from inside wall (z offset)
    this._slideT = 0;
    this._root.position.z -= dir.z * 0.5;
  }

  despawn() {
    this._visible = false;
    this._targetT = 0;
  }

  update(elapsed) {
    if (!this._root.visible) return;

    // Slide animation
    this._slideT += (this._targetT - this._slideT) * 0.12;

    if (!this._visible && this._slideT < 0.01) {
      this._root.visible = false;
      return;
    }

    // Update scale for slide effect
    this._root.scale.z = this._slideT;

    // Pulsing glow
    if (this._archMat) {
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 2.2);
      this._archMat.emissiveIntensity = pulse;
      this._archLight.intensity   = 1.5 * pulse;
    }

    // Animate LCARS panel
    this._lcarsT += 0.016;
    this._drawPanel(this._lcarsT);
  }
}
