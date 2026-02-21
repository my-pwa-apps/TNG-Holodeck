import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VRButton }         from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { useSceneStore, SCENE_LABELS } from './store/SceneStore.js';
import { HolodeckRoom }          from './scenes/HolodeckRoom.js';
import { SherlockScene }         from './scenes/SherlockScene.js';
import { BridgeScene }           from './scenes/BridgeScene.js';
import { AlienScene }            from './scenes/AlienScene.js';
import { MaterializationSystem } from './systems/MaterializationSystem.js';
import { AudioSystem }           from './systems/AudioSystem.js';
import { VoiceSystem }           from './systems/VoiceSystem.js';
import { HolodeckArch }          from './components/HolodeckArch.js';

const SCENE_MAP = {
  sherlock: SherlockScene,
  bridge:   BridgeScene,
  alien:    AlienScene,
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
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.xr.enabled = true;

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
  }

  // ── Post-processing ────────────────────────────────────────────────────
  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
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

      // Teleport ray
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -6),
        ]),
        new THREE.LineBasicMaterial({ color: 0xFFB300, transparent: true, opacity: 0.6 })
      );
      ctrl.add(ray);

      ctrl.addEventListener('selectstart', () => this._onGrab(ctrl));
      ctrl.addEventListener('selectend',   () => this._onRelease());

      return { ctrl, grip };
    });
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
      low:    { bloomStrength: 0.6,  bloomRadius: 0.4, bloomThreshold: 0.25 },
      medium: { bloomStrength: 1.4,  bloomRadius: 0.6, bloomThreshold: 0.18 },
      high:   { bloomStrength: 2.2,  bloomRadius: 0.7, bloomThreshold: 0.15 },
    };
    const p = presets[q] || presets.medium;
    this.bloomPass.strength  = p.bloomStrength;
    this.bloomPass.radius    = p.bloomRadius;
    this.bloomPass.threshold = p.bloomThreshold;
  }

  // ── Quest 3S XR performance mode ──────────────────────────────────────
  _onXRSessionStart() {
    // In XR: disable EffectComposer (already bypassed in _animate),
    // reduce shadow maps, lower tone mapping exposure slightly.
    this.renderer.shadowMap.type    = THREE.BasicShadowMap; // fastest
    this.renderer.toneMappingExposure = 0.85; // compensate for HDR in headset

    // Tell MaterializationSystem to drop to XR particle budget
    if (this.matSys) this.matSys.setXRMode(true);

    useSceneStore.getState().setProgramRunning(
      (useSceneStore.getState().programRunning || '') + ' — XR'
    );
  }

  _onXRSessionEnd() {
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 1.0;
    if (this.matSys) this.matSys.setXRMode(false);
  }

  // ── Scene loading ──────────────────────────────────────────────────────
  _loadScene(name) {
    const SceneClass = SCENE_MAP[name] || null;
    const store      = useSceneStore.getState();

    const doLoad = () => {
      if (SceneClass) {
        this._currentSceneModule = new SceneClass(this.scene, this.audio);
        const root = this._currentSceneModule.load();
        this.matSys.materialize([root]);
        this.audio.play('materialize');
        this.audio.playAmbient(name);
      } else {
        // Grid room — just play ambient
        this.audio.playAmbient('grid');
        this.matSys.materialize([]);
      }
      store.setCurrentScene(name);
      store.setProgramRunning(SCENE_LABELS[name] || name.toUpperCase());
    };

    if (this._currentSceneModule) {
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
    const raycaster  = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

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
    const dt      = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    if (!this.frozen) {
      this._updateDesktopMovement(dt);
      this.holoRoom.update(elapsed);
      this.matSys.update(dt);
      this.arch.update(elapsed);
      if (this._currentSceneModule) this._currentSceneModule.update(dt, elapsed);
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
    const dir   = new THREE.Vector3();

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dir.z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dir.z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dir.x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dir.x += 1;

    dir.normalize().applyEuler(this.camera.rotation);
    dir.y = 0;
    this.cameraRig.position.addScaledVector(dir, speed);
  }

  // ── Window resize ──────────────────────────────────────────────────────
  _handleResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.bloomPass.setSize(w, h);
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
