/**
 * AudioSystem — 100% procedural Web Audio API synthesis.
 * Zero external audio files — everything is synthesised on the fly.
 * Sidesteps all copyright / licensing concerns.
 */
export class AudioSystem {
  constructor() {
    this._ctx        = null;   // AudioContext (lazy — created on first interaction)
    this._masterGain = null;
    this._ambientNodes = [];   // currently playing ambient oscillators
    this._volume     = 0.7;
  }

  // ── Lazy context init (browsers require user gesture) ────────────────────
  _ensureCtx() {
    if (this._ctx) return;
    this._ctx        = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);
  }

  setVolume(v) {
    this._volume = v;
    if (this._masterGain) this._masterGain.gain.setTargetAtTime(v, this._ctx.currentTime, 0.05);
  }

  // ── Named sound dispatcher ──────────────────────────────────────────────
  play(name) {
    this._ensureCtx();
    switch (name) {
      case 'materialize':      this._materialize(); break;
      case 'dematerialize':    this._dematerialize(); break;
      case 'holodeck_door':    this._holodeckDoor(); break;
      case 'computer_ack':     this._computerAck(); break;
      case 'lcars_button':     this._lcarsButton(); break;
      default: break;
    }
  }

  // Alias used for UI-only (non-spatial) sounds
  playUI(name) { this.play(name); }

  // ── Spatial playback ────────────────────────────────────────────────────
  playAt(name, vec3) {
    this._ensureCtx();
    const panner = this._ctx.createPanner();
    panner.panningModel  = 'HRTF';
    panner.positionX.value = vec3.x;
    panner.positionY.value = vec3.y;
    panner.positionZ.value = vec3.z;
    panner.connect(this._masterGain);
    this._playThrough(name, panner);
  }

  _playThrough(name, destination) {
    // Route a sound to an arbitrary destination node
    const save = this._masterGain;
    this._masterGain = destination;
    this.play(name);
    this._masterGain = save;
  }

  // ── Ambient scene loops ─────────────────────────────────────────────────
  playAmbient(scene) {
    this._ensureCtx();
    this.stopAmbient();
    switch (scene) {
      case 'grid':     this._ambientHolodeckHum(); break;
      case 'bridge':   this._ambientBridge(); break;
      default: break;
    }
  }

  stopAmbient() {
    this._ambientNodes.forEach(n => {
      try {
        n.gain?.setTargetAtTime(0, this._ctx.currentTime, 0.3);
        setTimeout(() => { try { n.stop?.(); } catch(e) {} }, 600);
      } catch(e) {}
    });
    this._ambientNodes = [];
  }

  // ── Synthesis helpers ────────────────────────────────────────────────────

  _makeEnv(dest, attack, decay, sustain, release, peak = 0.4) {
    const env = this._ctx.createGain();
    env.connect(dest);
    const t = this._ctx.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak,    t + attack);
    env.gain.linearRampToValueAtTime(sustain, t + attack + decay);
    return env;
  }

  _makeOsc(type, freq, dest, stop = 1.0) {
    const osc = this._ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(dest);
    osc.start();
    osc.stop(this._ctx.currentTime + stop);
    return osc;
  }

  _makeNoise(duration) {
    const len    = this._ctx.sampleRate * duration;
    const buffer = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this._ctx.createBufferSource();
    src.buffer = buffer;
    src.start();
    return src;  // caller is responsible for connecting to graph
  }

  // ── Sound definitions ────────────────────────────────────────────────────

  /** Holodeck materialisation shimmer */
  _materialize() {
    const dur  = 2.5;
    const env  = this._makeEnv(this._masterGain, 0.05, 0.3, 0.15, 0.5, 0.35);
    env.gain.setTargetAtTime(0, this._ctx.currentTime + dur - 0.5, 0.2);

    // Bandpass-filtered noise sweep low→high
    const noise  = this._makeNoise(dur);
    const bpf    = this._ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.Q.value = 4;
    bpf.frequency.setValueAtTime(150, this._ctx.currentTime);
    bpf.frequency.linearRampToValueAtTime(4000, this._ctx.currentTime + dur);
    noise.connect(bpf); bpf.connect(env);

    // Pitch-modulated sine layer
    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this._ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this._ctx.currentTime + dur * 0.6);
    const oscGain = this._ctx.createGain();
    oscGain.gain.value = 0.12;
    osc.connect(oscGain); oscGain.connect(this._masterGain);
    osc.start(); osc.stop(this._ctx.currentTime + dur);
  }

  /** Reverse of materialise */
  _dematerialize() {
    const dur  = 2.0;
    const env  = this._makeEnv(this._masterGain, 0.02, 0.1, 0.3, 0.4, 0.35);
    env.gain.setTargetAtTime(0, this._ctx.currentTime + dur - 0.4, 0.15);

    const noise  = this._makeNoise(dur);
    const bpf    = this._ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.Q.value = 4;
    bpf.frequency.setValueAtTime(4000, this._ctx.currentTime);
    bpf.frequency.linearRampToValueAtTime(120, this._ctx.currentTime + dur);
    noise.connect(bpf); bpf.connect(env);

    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this._ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180, this._ctx.currentTime + dur * 0.7);
    const g = this._ctx.createGain(); g.gain.value = 0.1;
    osc.connect(g); g.connect(this._masterGain);
    osc.start(); osc.stop(this._ctx.currentTime + dur);
  }

  /** Holodeck door hiss */
  _holodeckDoor() {
    const dur = 1.2;
    const lpf = this._ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 800; lpf.Q.value = 2;

    const env = this._makeEnv(this._masterGain, 0.05, 0.4, 0.1, 0.3, 0.25);
    env.gain.setTargetAtTime(0, this._ctx.currentTime + dur - 0.35, 0.15);
    lpf.connect(env);

    const noise = this._makeNoise(dur);
    noise.connect(lpf);
  }

  /** Two-tone TNG-style computer acknowledgment chime */
  _computerAck() {
    const t    = this._ctx.currentTime;
    const rev  = this._makeReverb(0.5);
    rev.connect(this._masterGain);

    [880, 1108].forEach((freq, i) => {
      const osc  = this._ctx.createOscillator();
      const env  = this._ctx.createGain();
      osc.type   = 'sine';
      osc.frequency.value = freq;
      osc.connect(env); env.connect(rev);

      const at = t + i * 0.13;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.22, at + 0.01);
      env.gain.setTargetAtTime(0, at + 0.09, 0.04);
      osc.start(at); osc.stop(at + 0.35);
    });
  }

  /** Short LCARS button chirp */
  _lcarsButton() {
    const env  = this._makeEnv(this._masterGain, 0.005, 0.025, 0.0, 0.01, 0.18);
    const osc  = this._ctx.createOscillator();
    osc.type   = 'square';
    osc.frequency.setValueAtTime(900,  this._ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1300, this._ctx.currentTime + 0.04);
    osc.connect(env);
    osc.start(); osc.stop(this._ctx.currentTime + 0.06);
  }

  /** Poor-man's convolution reverb via all-pass chain */
  _makeReverb(mix = 0.3) {
    const wet  = this._ctx.createGain();
    wet.gain.value = mix;
    // simple comb delay chain
    for (const [delay, gain] of [[0.03, 0.4],[0.05, 0.3],[0.08, 0.2]]) {
      const d = this._ctx.createDelay(0.1);
      const g = this._ctx.createGain();
      d.delayTime.value = delay;
      g.gain.value = gain;
      wet.connect(d); d.connect(g); g.connect(wet);
    }
    return wet;
  }

  // ── Ambient loops ────────────────────────────────────────────────────────

  _ambientHolodeckHum() {
    [40, 120, 240].forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      osc.type  = 'sine';
      osc.frequency.value = freq;
      const g   = this._ctx.createGain();
      g.gain.value = [0.07, 0.04, 0.015][i];
      osc.connect(g); g.connect(this._masterGain);
      osc.start();
      this._ambientNodes.push({ stop: () => osc.stop(), gain: g.gain });
    });
  }

  _ambientVictorian() {
    // Droning low notes + filtered wind noise
    [55, 110].forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      osc.type  = 'sawtooth';
      osc.frequency.value = freq;
      const bpf = this._ctx.createBiquadFilter();
      bpf.type  = 'lowpass'; bpf.frequency.value = 300;
      const g   = this._ctx.createGain(); g.gain.value = [0.04, 0.025][i];
      osc.connect(bpf); bpf.connect(g); g.connect(this._masterGain);
      osc.start();
      this._ambientNodes.push({ stop: () => osc.stop(), gain: g });
    });

    // Wind noise
    const windBuf = this._makeNoise(999);
    const hpf = this._ctx.createBiquadFilter();
    hpf.type  = 'highpass'; hpf.frequency.value = 2000;
    const wg  = this._ctx.createGain(); wg.gain.value = 0.05;
    windBuf.connect(hpf); hpf.connect(wg); wg.connect(this._masterGain);
    this._ambientNodes.push({ stop: () => windBuf.stop(), gain: wg });
  }

  _ambientBridge() {
    // Sub warp hum + white noise floor + LFO-modulated bandpass
    const osc = this._ctx.createOscillator();
    osc.type  = 'sine'; osc.frequency.value = 28;
    const g   = this._ctx.createGain(); g.gain.value = 0.08;
    osc.connect(g); g.connect(this._masterGain); osc.start();
    this._ambientNodes.push({ stop: () => osc.stop(), gain: g });

    const n   = this._makeNoise(999);
    const bpf = this._ctx.createBiquadFilter();
    bpf.type  = 'bandpass'; bpf.frequency.value = 800; bpf.Q.value = 0.5;
    const ng  = this._ctx.createGain(); ng.gain.value = 0.03;
    n.connect(bpf); bpf.connect(ng); ng.connect(this._masterGain);
    this._ambientNodes.push({ stop: () => n.stop(), gain: ng });

    // LFO on noise filter freq
    const lfo = this._ctx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfog = this._ctx.createGain(); lfog.gain.value = 400;
    lfo.connect(lfog); lfog.connect(bpf.frequency); lfo.start();
    this._ambientNodes.push({ stop: () => lfo.stop(), gain: lfog });
  }

  _ambientAlien() {
    // Detuned chords + slow filter sweep
    [60, 63, 67, 70].forEach((midi, i) => {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const osc  = this._ctx.createOscillator();
      osc.type   = 'triangle';
      osc.frequency.value = freq;
      const bpf  = this._ctx.createBiquadFilter();
      bpf.type   = 'bandpass'; bpf.Q.value = 3;
      bpf.frequency.value = freq * 2;
      const g    = this._ctx.createGain(); g.gain.value = 0.035;
      osc.connect(bpf); bpf.connect(g); g.connect(this._masterGain);
      osc.start();
      this._ambientNodes.push({ stop: () => osc.stop(), gain: g });
    });
  }

  destroy() {
    this.stopAmbient();
    if (this._ctx) this._ctx.close();
  }
}
