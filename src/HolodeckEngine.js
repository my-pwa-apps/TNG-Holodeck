import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VRButton }         from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { useSceneStore, SCENE_LABELS } from './store/SceneStore.js';
import { HolodeckRoom }          from './scenes/HolodeckRoom.js';
import { BridgeScene }           from './scenes/BridgeScene.js';
import { CorridorScene }         from './scenes/CorridorScene.js';
import { MaterializationSystem } from './systems/MaterializationSystem.js';
import { AudioSystem }           from './systems/AudioSystem.js';
import { VoiceSystem }           from './systems/VoiceSystem.js';
import { HolodeckArch }          from './components/HolodeckArch.js';

const SCENE_MAP = {
  bridge:   BridgeScene,
  corridor: CorridorScene,
};

/**
 * HolodeckEngine — singleton Three.js engine.
 * Owns the renderer, scene graph, post-processing, and XR controller setup.
 * Communicates with React UI via the Zustand SceneStore.
 */
export class HolodeckEngine {
  constructor(canvas) {
    this.canvas  = canvas;
    this.clock   = new THREE.Clock();
    this.frozen  = false;

    this._currentSceneModule = null;
    this._grabTarget         = null;
    this._unsubscribers      = [];

    // Pre-allocated scratch objects to avoid per-frame GC pressure
    this._moveDir       = new THREE.Vector3();
    this._grabRaycaster  = new THREE.Raycaster();
    this._grabMatrix     = new THREE.Matrix4();
    this._headQuat       = new THREE.Quaternion();
    this._headFwd        = new THREE.Vector3();
    this._headRight      = new THREE.Vector3();
    this._desktopEuler   = new THREE.Euler(0, 0, 0, 'YXZ');

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initPostProcessing();
    this._initDesktopControls();
    this._initXR();
    this._initSystems();
    this._subscribeToStore();

    // Boot into grid room
    this._loadScene('grid');
    this._startLoop();
    this._handleResize();
  }

  // ── Renderer ───────────────────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    // ACESFilmic aggressively compresses dim mid-tones.
    // 1.6 exposure keeps MeshStandardMaterial surfaces (lit by ~0.4 ambient)
    // visible without overexposing emissive grid lines or UI elements.
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.xr.enabled = true;
    this.renderer.localClippingEnabled = true;

    // ── Quest 3S optimisations ───────────────────────────────────────────
    // Fixed foveated rendering: renders full quality in centre of view
    // (where eye gaze is focused) and reduced quality at periphery.
    // Level 1 = maximum foveation, ideal for Quest 3S standalone.
    this.renderer.xr.setFoveation(1);

    // Framebuffer scale: 0.9 reduces render resolution by ~10%.
    // Quest 3S native: 1832×1920 per eye. At 0.9 = 1649×1728 — still crisp
    // at headset PPD but saves ~19% fill-rate budget (significant for bloom-like scenes).
    this.renderer.xr.setFramebufferScaleFactor(0.9);

    // XR session start: switch to Quest 3S performance profile
    this.renderer.xr.addEventListener('sessionstart', () => {
      this._onXRSessionStart();
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this._onXRSessionEnd();
    });

    // Append VR button to body
    const vrBtn = VRButton.createButton(this.renderer);
    vrBtn.id    = 'vr-button';
    document.body.appendChild(vrBtn);
  }

  // ── Scene & camera ─────────────────────────────────────────────────────
  _initScene() {
    this.scene            = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    // Add a subtle global fog to blend the grid room into the distance
    this.scene.fog = new THREE.FogExp2(0x000000, 0.015);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05, 500
    );
    this.camera.position.set(0, 1.6, 3);

    // XR locomotion rig: camera is a child so we can translate the rig
    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    // Make camera accessible to scenes via scene.userData
    this.scene.userData.camera = this.camera;
  }

  // ── Post-processing ────────────────────────────────────────────────────
  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Render bloom at half resolution for significant performance gain
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      1.8,   // strength  — strong enough for warm grid-line glow
      0.45,  // radius    — tight radius keeps the glow close to the lines
      0.16   // threshold — grid lines at ~1.0 brightness: well above threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  // ── Desktop pointer-lock controls ──────────────────────────────────────
  _initDesktopControls() {
    this.plControls = new PointerLockControls(this.camera, this.canvas);

    this.keys = {};
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Escape') this.plControls.unlock();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.renderer.xr.isPresenting) this.plControls.lock();
    });
  }

  // ── WebXR controllers ──────────────────────────────────────────────────
  _initXR() {
    const factory = new XRControllerModelFactory();
    this._controllers = [0, 1].map(i => {
      const ctrl = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.cameraRig.add(ctrl, grip);

      // Teleport / aim ray
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -8),
        ]),
        new THREE.LineBasicMaterial({ color: 0xFF9900, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }) // TNG LCARS Orange
      );
      ctrl.userData.ray = ray;
      ctrl.add(ray);

      ctrl.addEventListener('selectstart', () => {
        if (i === 1) this._onPhaserFire(ctrl);
        else         this._onGrab(ctrl);
      });
      ctrl.addEventListener('selectend', () => this._onRelease());

      return { ctrl, grip };
    });

    // Snap-turn cooldown (right thumbstick, avoid continuous spinning)
    this._snapTurnCooldown = 0;

    // Per-button previous-frame pressed state for edge detection
    // key: `${handedness}_${buttonIndex}` → boolean
    this._btnPrev = {};
  }

  /**
   * Poll XR gamepad buttons once per frame.
   * Uses edge detection (prev=false → cur=true) so holding a button
   * fires the action exactly once until released and re-pressed.
   *
   * Quest 3 / 3S layout
   * ─────────────────────────────────────────────────
   *  Left   btn[0] = X       btn[1] = Y
   *         btn[3] = Menu    btn[5] = Grip/Squeeze
   *  Right  btn[0] = A       btn[1] = B
   *         btn[3] = Oculus  btn[5] = Grip/Squeeze
   * (btn[4] = Trigger — already handled via selectstart event)
   * ─────────────────────────────────────────────────
   * Mapping
   *   Left  X              → Load Corridor       (PROG·EPSILON·7)
   *   Left  Y              → Load Bridge         (PROG·DELTA·12)
   *   Left  Grip           → Toggle Arch
   *   Left  Menu           → Toggle Voice Control
   *   Left  Thumbstick btn → Freeze / Resume program
   *   Right A              → (unassigned)
   *   Right B              → (unassigned)
   *   Right Grip           → Mute / Unmute audio (cycle 0 ↔ 0.7)
   *   Right Menu           → Red Alert
   *   Right Thumbstick btn → Load Grid (end program)
   */
  _updateXRButtons() {
    if (!this.renderer.xr.isPresenting) return;
    const session = this.renderer.xr.getSession();
    if (!session) return;

    const store = useSceneStore.getState();

    for (const src of session.inputSources) {
      if (!src.gamepad) continue;
      const hand = src.handedness;  // 'left' | 'right'
      const btns = src.gamepad.buttons;

      btns.forEach((btn, idx) => {
        const key  = `${hand}_${idx}`;
        const prev = this._btnPrev[key] ?? false;
        const cur  = btn.pressed;
        this._btnPrev[key] = cur;

        if (!cur || prev) return;   // only act on rising edge

        // ── Left controller ──────────────────────────────────
        if (hand === 'left') {
          if (idx === 0) {           // X → Corridor
            this.audio.play('computer_ack');
            store.requestScene('corridor');
          } else if (idx === 1) {   // Y → Bridge
            this.audio.play('computer_ack');
            store.requestScene('bridge');
          } else if (idx === 3) {   // Menu → Voice toggle
            if (store.voiceActive) this.voice.stop();
            else                   this.voice.start();
            this.audio.play('computer_ack');
          } else if (idx === 4) {   // Thumbstick click → Freeze / Resume
            if (store.frozen) { store.setFrozen(false); }
            else              { store.setFrozen(true);  }
            this.audio.play('computer_ack');
          } else if (idx === 5) {   // Left Grip → Toggle Arch
            store.toggleArch();
            this.audio.play('computer_ack');
          }
        }

        // ── Right controller ─────────────────────────────────
        if (hand === 'right') {
          if (idx === 3) {   // Menu/Oculus → Red Alert
            this._currentSceneModule?.activateRedAlert?.();
            this.audio.play('computer_ack');
          } else if (idx === 4) {   // Thumbstick click → Grid (end program)
            this.audio.play('computer_ack');
            store.requestScene('grid');
          } else if (idx === 5) {   // Right Grip → Mute toggle
            const vol = store.audioVolume > 0.05 ? 0 : 0.7;
            store.setAudioVolume(vol);
            this.audio.setVolume(vol);
          }
        }
      });
    }
  }

  _updateXRLocomotion(dt) {
    if (!this.renderer.xr.isPresenting) return;
    const session = this.renderer.xr.getSession();
    if (!session) return;

    const MOVE_SPEED  = 3.0;   // m/s
    const TURN_SPEED  = 2.2;   // rad/s  (smooth turn on right stick)
    const DEAD_ZONE   = 0.18;

    // Use the actual XR camera world quaternion for head direction so that
    // "forward" always matches where the player is physically looking.
    // Re-use pre-allocated scratch objects to avoid per-frame GC at 90 fps.
    const xrCam = this.renderer.xr.getCamera();
    xrCam.getWorldQuaternion(this._headQuat);

    // Project head -Z onto the XZ (ground) plane
    this._headFwd.set(0, 0, -1).applyQuaternion(this._headQuat);
    this._headFwd.y = 0;
    this._headFwd.lengthSq() > 0.001
      ? this._headFwd.normalize()
      : this._headFwd.set(0, 0, -1);

    this._headRight
      .crossVectors(this._headFwd, THREE.Object3D.DEFAULT_UP)
      .normalize();

    for (const src of session.inputSources) {
      if (!src.gamepad) continue;
      const axes = src.gamepad.axes;

      // Quest 3 / Touch Pro: thumbstick is axes[2],[3].
      // Many other controllers (Index, Vive, WMR): thumbstick is axes[0],[1].
      // Detect by checking whether the gamepad has > 2 axes.
      const ofs = axes.length > 2 ? 2 : 0;
      const ax  = axes[ofs]     ?? 0;
      const ay  = axes[ofs + 1] ?? 0;

      if (src.handedness === 'left') {
        // Left stick → smooth translation in head-look direction
        //   stick-Y: forward (-1) / back (+1)  →  negate ay to get natural forward
        //   stick-X: strafe right (+1) / left (-1)
        const mx = Math.abs(ax) > DEAD_ZONE ? ax : 0;
        const my = Math.abs(ay) > DEAD_ZONE ? ay : 0;
        this.cameraRig.position.addScaledVector(this._headFwd,   -my * MOVE_SPEED * dt);
        this.cameraRig.position.addScaledVector(this._headRight,  mx * MOVE_SPEED * dt);
      }

      if (src.handedness === 'right') {
        // Right stick → smooth continuous yaw on the rig
        //   stick-X: turn right (+1) / left (-1)
        const rx = Math.abs(ax) > DEAD_ZONE ? ax : 0;
        if (rx !== 0) {
          this.cameraRig.rotateY(-rx * TURN_SPEED * dt);
        }
      }
    }

    // Clamp rig Y so the player can never fall below the floor
    if (this.cameraRig.position.y < 0) this.cameraRig.position.y = 0;
  }

  _onPhaserFire(controller) {
    // Right trigger → dematerialize everything and return to empty holodeck grid
    const store = useSceneStore.getState();
    if (store.currentScene !== 'grid') {
      this.audio.play('computer_ack');
      store.requestScene('grid');
      return;
    }
    // Already on grid — just play an acknowledgement
    if (this.audio && this.audio.play) {
      this.audio.play('computer_ack');
    }
  }

  // ── Scene systems ──────────────────────────────────────────────────────
  _initSystems() {
    this.audio    = new AudioSystem();
    this.voice    = new VoiceSystem(this);
    this.matSys   = new MaterializationSystem(this.scene);
    this.arch     = new HolodeckArch(this.scene);
    this.holoRoom = new HolodeckRoom(this.scene);
  }

  // ── Zustand subscriptions ──────────────────────────────────────────────
  _subscribeToStore() {
    const store = useSceneStore;

    this._unsubscribers.push(
      store.subscribe(
        s => s.pendingScene,
        name => {
          if (name) {
            this._loadScene(name);
            useSceneStore.getState().clearPendingScene();
          }
        }
      ),
      store.subscribe(s => s.archVisible, v => {
        if (v) this.arch.spawn(this.camera);
        else   this.arch.despawn();
      }),
      store.subscribe(s => s.frozen, v => { this.frozen = v; }),
      store.subscribe(s => s.audioVolume, v => this.audio.setVolume(v)),
      store.subscribe(s => s.quality,     q => this._applyQuality(q)),
    );
  }

  _applyQuality(q) {
    const presets = {
      //               strength  radius  threshold  exposure
      low:    { bs: 0.8,  br: 0.4, bt: 0.28, exp: 1.6 },
      medium: { bs: 1.6,  br: 0.5, bt: 0.20, exp: 1.6 },
      high:   { bs: 2.4,  br: 0.6, bt: 0.14, exp: 1.6 },
    };
    const p = presets[q] || presets.medium;
    if (this.bloomPass) {
      this.bloomPass.strength  = p.bs;
      this.bloomPass.radius    = p.br;
      this.bloomPass.threshold = p.bt;
    }
    if (!this.renderer.xr.isPresenting) {
      this.renderer.toneMappingExposure = p.exp;
    }
  }

  // ── Quest 3S XR performance mode ──────────────────────────────────────
  _onXRSessionStart() {
    // In XR: disable EffectComposer (already bypassed in _animate),
    // reduce shadow maps, lower tone mapping exposure slightly.
    this.renderer.shadowMap.type      = THREE.BasicShadowMap; // fastest
    // Headset colour pipeline already applies its own tone compression;
    // reduce exposure slightly to avoid washout inside the headset.
    this.renderer.toneMappingExposure = 1.2;

    // ── Reset camera local transform for clean VR tracking ──────────────
    // PointerLockControls bakes desktop mouse-look rotation into
    // this.camera.quaternion.  If we don't clear it, the XR world
    // quaternion = rig × camera(stale) × headset, and "forward" on the
    // thumbstick will be offset by however the user looked on desktop.
    // Save → reset → restore on session end.
    this._savedCameraPos = this.camera.position.clone();
    this._savedCameraQuat = this.camera.quaternion.clone();
    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.identity();

    // Tell MaterializationSystem to drop to XR particle budget
    if (this.matSys) this.matSys.setXRMode(true);

    // Derive label from current scene key so we never stack " — XR" twice
    const scene = useSceneStore.getState().currentScene;
    const baseLabel = SCENE_LABELS[scene] || 'HOLODECK PROGRAM';
    useSceneStore.getState().setProgramRunning(
      baseLabel.replace(' — XR ACTIVE', '') + ' — XR ACTIVE'
    );
  }

  _onXRSessionEnd() {
    // Restore desktop camera local transform
    if (this._savedCameraPos)  this.camera.position.copy(this._savedCameraPos);
    if (this._savedCameraQuat) this.camera.quaternion.copy(this._savedCameraQuat);

    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 1.6;
    if (this.matSys) this.matSys.setXRMode(false);
    
    const scene = useSceneStore.getState().currentScene;
    const baseLabel = SCENE_LABELS[scene] || 'HOLODECK PROGRAM';
    useSceneStore.getState().setProgramRunning(baseLabel.replace(' — XR ACTIVE', ''));
  }

  // ── Scene loading ──────────────────────────────────────────────────────
  _loadScene(name) {
    const SceneClass = SCENE_MAP[name] || null;
    const store      = useSceneStore.getState();

    const doLoad = () => {
      if (SceneClass) {
        this.holoRoom._group.visible = true;
        this._currentSceneModule = new SceneClass(this.scene, this.audio);
        const root = this._currentSceneModule.load();
        this.matSys.materialize([root], () => {
          this.holoRoom._group.visible = false;
        });
        this.audio.play('materialize');
        this.audio.playAmbient(name);
      } else {
        // Grid room — just play ambient and reset fog
        this.scene.fog = new THREE.FogExp2(0x000000, 0.015);
        this.audio.playAmbient('grid');
        this.holoRoom._group.visible = true;
        this.matSys.materialize([]);
      }
      store.setCurrentScene(name);
      
      let label = SCENE_LABELS[name] || name.toUpperCase();
      if (this.renderer.xr.isPresenting) {
        label += ' — XR ACTIVE';
      }
      store.setProgramRunning(label);
    };

    if (this._currentSceneModule) {
      this.holoRoom._group.visible = true;
      const objects = [this._currentSceneModule._root].filter(Boolean);
      this.matSys.dematerialize(objects, () => {
        this._currentSceneModule.unload();
        this._currentSceneModule = null;
        doLoad();
      });
      this.audio.play('dematerialize');
    } else {
      doLoad();
    }
  }

  // ── Grab & release ─────────────────────────────────────────────────────
  _onGrab(controller) {
    const raycaster  = this._grabRaycaster;
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    
    // Extract rotation properly
    const tempQuat = new THREE.Quaternion().setFromRotationMatrix(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyQuaternion(tempQuat);

    const interactables = [];
    this.scene.traverse(o => { if (o.userData.interactable) interactables.push(o); });

    const hits = raycaster.intersectObjects(interactables, true);
    if (hits.length) {
      this._grabTarget = hits[0].object;
      controller.attach(this._grabTarget);
    }
  }

  _onRelease() {
    if (this._grabTarget) {
      this.scene.attach(this._grabTarget);
      this._grabTarget = null;
    }
  }

  // ── Animation loop ─────────────────────────────────────────────────────
  _startLoop() {
    this.renderer.setAnimationLoop(() => this._animate());
  }

  _animate() {
    const dt      = Math.min(this.clock.getDelta(), 0.1); // Cap dt to prevent huge jumps on lag
    const elapsed = this.clock.getElapsedTime();

    if (!this.frozen) {
      this._updateDesktopMovement(dt);
      this._updateXRLocomotion(dt);
      this._updateXRButtons();
      this.holoRoom.update(elapsed);
      this.matSys.update(dt, elapsed);
      this.arch.update(elapsed);
      if (this._currentSceneModule && this._currentSceneModule.update) {
        this._currentSceneModule.update(dt, elapsed);
      }
    }

    // In VR, WebXR manages its own render target; skip EffectComposer
    if (this.renderer.xr.isPresenting) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  _updateDesktopMovement(dt) {
    if (this.renderer.xr.isPresenting) return;
    if (!this.plControls.isLocked) return;

    const speed = 4 * dt;
    const dir   = this._moveDir.set(0, 0, 0);

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dir.z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dir.z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dir.x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      // Apply only Y rotation for flat movement (reuse pre-allocated Euler)
      this._desktopEuler.set(0, this.camera.rotation.y, 0);
      dir.applyEuler(this._desktopEuler);
      this.cameraRig.position.addScaledVector(dir, speed);
    }
  }

  // ── Window resize ──────────────────────────────────────────────────────
  _handleResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.bloomPass.resolution.set(w / 2, h / 2);
    });
  }

  // ── Public API (callable from React UI) ───────────────────────────────
  loadScene(name)    { useSceneStore.getState().requestScene(name); }
  toggleArch()       { useSceneStore.getState().toggleArch(); }
  freezeProgram()    { useSceneStore.getState().setFrozen(true); }
  resumeProgram()    { useSceneStore.getState().setFrozen(false); }
  startVoice()       { this.voice.start(); }
  stopVoice()        { this.voice.stop(); }
  playUISound(name)  { this.audio.playUI(name); }

  destroy() {
    this._unsubscribers.forEach(u => u());
    this.renderer.setAnimationLoop(null);
    this.audio.destroy();
    this.voice.destroy();
    this.matSys.dispose();
    this.holoRoom.dispose();
    document.getElementById('vr-button')?.remove();
  }
}
