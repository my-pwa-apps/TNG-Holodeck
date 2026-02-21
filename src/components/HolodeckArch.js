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
    const w   = this._lcarsCanvas.width;
    const h   = this._lcarsCanvas.height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Header
    ctx.fillStyle = '#FF9900';
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('HOLODECK CONTROL ARCH', 10, 26);

    // Sub header
    ctx.fillStyle = '#CC99FF';
    ctx.fillRect(0, 40, 120, 24);
    ctx.fillStyle = '#000';
    ctx.font = '13px Arial';
    ctx.fillText('PROGRAMS', 6, 58);

    // Programme list buttons
    const programs = [
      { label: 'GRID ROOM',     color: '#3399FF' },
      { label: 'BAKER STREET',  color: '#FF9900' },
      { label: 'BRIDGE SIM',    color: '#CC6600' },
      { label: 'ALIEN SURVEY',  color: '#CC99FF' },
    ];
    programs.forEach((p, i) => {
      const y = 80 + i * 52;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(8, y, w - 16, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 15px Arial';
      ctx.fillText(p.label, 20, y + 26);
    });

    // Status bar
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, h - 44, w, 44);
    ctx.fillStyle = '#00FF88';
    ctx.font = '11px monospace';
    ctx.fillText('SAFETY PROTOCOLS: ENABLED', 10, h - 28);
    ctx.fillStyle = '#3399FF';
    ctx.fillText(`STARDATE ${(2.37e5 + t * 12).toFixed(1)}`, 10, h - 10);

    // Animated scan line
    const scanY = ((t * 60) % (h - 80)) + 40;
    ctx.strokeStyle = 'rgba(255,200,0,0.15)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();

    this._lcarsTex.needsUpdate = true;
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
