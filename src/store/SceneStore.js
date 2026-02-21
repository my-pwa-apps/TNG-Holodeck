import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Global Zustand store — single source of truth for scene state.
 * The HolodeckEngine subscribes to changes via subscribeWithSelector.
 */
export const useSceneStore = create(
  subscribeWithSelector((set) => ({
    // ── State ───────────────────────────────────────────────
    currentScene:   'grid',     // active scene key
    pendingScene:   null,       // queued scene change (engine picks it up)
    programRunning: null,       // human-readable label shown in LCARS
    archVisible:    false,
    frozen:         false,
    voiceActive:    false,
    locomotionMode: 'smooth',   // 'smooth' | 'teleport'
    quality:        'medium',   // 'low' | 'medium' | 'high'
    audioVolume:    0.7,
    safetyProtocols: true,      // always true — shown in UI

    // ── Actions ─────────────────────────────────────────────
    requestScene:      (name) => set({ pendingScene: name }),
    clearPendingScene: ()     => set({ pendingScene: null }),
    setCurrentScene:   (name) => set({ currentScene: name }),
    setProgramRunning: (label)=> set({ programRunning: label }),
    setArchVisible:    (v)    => set({ archVisible: v }),
    toggleArch:  ()  => set((s) => ({ archVisible: !s.archVisible })),
    setFrozen:   (v) => set({ frozen: v }),
    toggleFrozen:()  => set((s) => ({ frozen: !s.frozen })),
    setVoiceActive:    (v)    => set({ voiceActive: v }),
    setLocomotionMode: (m)    => set({ locomotionMode: m }),
    setQuality:   (q) => set({ quality: q }),
    setAudioVolume:(v)=> set({ audioVolume: v }),
  }))
);

// Human-readable labels for program display
export const SCENE_LABELS = {
  grid:     'GRID ROOM — STANDBY',
  sherlock: 'HOLODECK PROGRAM 47-ALPHA — BAKER STREET',
  bridge:   'HOLODECK PROGRAM 12-DELTA — TACTICAL BRIDGE SIMULATION',
  alien:    'HOLODECK PROGRAM 88-GAMMA — ALIEN LANDSCAPE SURVEY',
};
