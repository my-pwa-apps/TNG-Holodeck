import { useSceneStore } from '../store/SceneStore.js';

/**
 * VoiceSystem — Web Speech API voice command recognition.
 * Listens continuously and dispatches commands to the engine.
 */
export class VoiceSystem {
  constructor(engine) {
    this.engine   = engine;
    this._active  = false;
    this._recognition = null;
    this._init();
  }

  _init() {
    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('[VoiceSystem] Web Speech API not available in this browser.');
      return;
    }

    this._recognition = new SpeechRec();
    this._recognition.continuous     = true;
    this._recognition.interimResults = false;
    this._recognition.lang           = 'en-US';

    this._recognition.onresult = (e) => {
      const last       = e.results[e.results.length - 1];
      const transcript = last[0].transcript.trim().toLowerCase();
      console.log(`[VoiceSystem] Heard: "${transcript}"`);
      this._dispatch(transcript);
    };

    this._recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('[VoiceSystem] Error:', e.error);
      }
    };

    // Auto-restart when recognition ends (browser stops after ~60s silence)
    this._recognition.onend = () => {
      if (this._active) this._recognition.start();
    };
  }

  start() {
    if (!this._recognition || this._active) return;
    this._active = true;
    this._recognition.start();
    useSceneStore.getState().setVoiceActive(true);
    console.log('[VoiceSystem] Listening…');
  }

  stop() {
    if (!this._recognition) return;
    this._active = false;
    this._recognition.stop();
    useSceneStore.getState().setVoiceActive(false);
  }

  toggle() {
    this._active ? this.stop() : this.start();
  }

  _dispatch(text) {
    const store = useSceneStore.getState();

    // "Computer, arch" — spawn / hide arch
    if (/computer,?\s*arch\b/.test(text)) {
      store.toggleArch();
      this.engine.audio.play('computer_ack');
      return;
    }

    // "Computer, end program"
    if (/computer,?\s*end\s+program/.test(text)) {
      this.engine.audio.play('holodeck_door');
      store.requestScene('grid');
      return;
    }

    // "Computer, load program <name>"
    const loadMatch = text.match(/computer,?\s*load\s+program\s+(.+)/);
    if (loadMatch) {
      const raw  = loadMatch[1].trim();
      const name = this._resolveScene(raw);
      if (name) {
        this.engine.audio.play('computer_ack');
        store.requestScene(name);
      }
      return;
    }

    // "Computer, freeze program"
    if (/computer,?\s*freeze\s+program/.test(text)) {
      store.setFrozen(true);
      this.engine.audio.play('computer_ack');
      return;
    }

    // "Computer, resume program"
    if (/computer,?\s*resume\s+program/.test(text)) {
      store.setFrozen(false);
      this.engine.audio.play('computer_ack');
      return;
    }

    // "Computer, save program"
    if (/computer,?\s*save\s+program/.test(text)) {
      this.engine.audio.play('computer_ack');
      this.engine.exportGLTF?.();
      return;
    }
  }

  _resolveScene(raw) {
    if (/sherlock|baker|holmes|victorian/i.test(raw))  return 'sherlock';
    if (/bridge|tactical|starship|enterprise/i.test(raw)) return 'bridge';
    if (/alien|planet|landscape|survey/i.test(raw))    return 'alien';
    if (/grid|end|standby/i.test(raw))                 return 'grid';
    console.warn(`[VoiceSystem] Unknown scene: "${raw}"`);
    return null;
  }

  destroy() {
    this.stop();
  }
}
