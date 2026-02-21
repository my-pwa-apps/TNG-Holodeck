import React, { useEffect, useRef, useState } from 'react';
import { useSceneStore } from './store/SceneStore.js';
import {
  LCARSButton,
  LCARSTitle,
  LCARSDisplay,
  SafetyProtocolsIndicator,
  ProgramStatusDisplay,
} from './lcars/LCARSComponents.jsx';
import './App.css';

// Engine is imported lazily to avoid SSR issues with Three.js
let engineInstance = null;

const SCENES = [
  { key: 'grid',     label: 'GRID ROOM',    color: '#3399FF' },
  { key: 'sherlock', label: 'BAKER STREET', color: '#FF9900' },
  { key: 'bridge',   label: 'BRIDGE SIM',   color: '#CC6600' },
  { key: 'alien',    label: 'ALIEN SURVEY', color: '#CC99FF' },
];

export default function App() {
  const canvasRef    = useRef(null);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logLines, setLogLines]       = useState(['SYSTEM ONLINE', 'AWAITING PROGRAM SELECTION…']);

  // Zustand state bindings
  const programRunning = useSceneStore(s => s.programRunning);
  const voiceActive    = useSceneStore(s => s.voiceActive);
  const frozen         = useSceneStore(s => s.frozen);
  const locomotionMode = useSceneStore(s => s.locomotionMode);
  const quality        = useSceneStore(s => s.quality);
  const audioVolume    = useSceneStore(s => s.audioVolume);
  const store          = useSceneStore.getState();

  const addLog = (msg) =>
    setLogLines(prev => [...prev.slice(-20), msg]);

  // ── Boot engine ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || engineInstance) return;

    import('./HolodeckEngine.js').then(({ HolodeckEngine }) => {
      engineInstance = new HolodeckEngine(canvasRef.current);
      addLog('HOLODECK ENGINE INITIALISED');
      addLog('GRID ROOM — STANDBY');
    });

    return () => {
      engineInstance?.destroy();
      engineInstance = null;
    };
  }, []);

  // ── Button handlers ──────────────────────────────────────────────────
  const loadScene = (key) => {
    engineInstance?.audio.playUI('lcars_button');
    useSceneStore.getState().requestScene(key);
    addLog(`LOADING: ${SCENES.find(s => s.key === key)?.label}`);
    setPanelOpen(false);
  };

  const toggleArch = () => {
    engineInstance?.audio.playUI('lcars_button');
    engineInstance?.toggleArch();
    addLog('ARCH: TOGGLED');
  };

  const toggleFreeze = () => {
    engineInstance?.audio.playUI('lcars_button');
    if (frozen) { store.setFrozen(false); addLog('PROGRAM RESUMED'); }
    else        { store.setFrozen(true);  addLog('PROGRAM FROZEN'); }
  };

  const toggleVoice = () => {
    engineInstance?.audio.playUI('lcars_button');
    if (voiceActive) { engineInstance?.stopVoice();  addLog('VOICE: OFFLINE'); }
    else             { engineInstance?.startVoice(); addLog('VOICE: ACTIVE — SAY "COMPUTER..."'); }
  };

  return (
    <>
      {/* Three.js canvas fills the viewport */}
      <canvas ref={canvasRef} id="holodeck-canvas" />

      {/* ── HUD overlay ─────────────────────────────────────────────── */}
      <div id="hud">
        {/* Top-left: status */}
        <div id="hud-status">
          <SafetyProtocolsIndicator />
          <ProgramStatusDisplay label={programRunning} />
          {frozen && <div className="frozen-badge">❚❚ FROZEN</div>}
        </div>

        {/* Top-right: quick actions */}
        <div id="hud-actions">
          <LCARSButton label="ARCH"   color="#FF9900" onClick={toggleArch}   small />
          <LCARSButton label={frozen ? 'RESUME' : 'FREEZE'} color="#CC6600" onClick={toggleFreeze} small />
          <LCARSButton
            label={voiceActive ? '🎙 VOICE ON' : '🎙 VOICE OFF'}
            color={voiceActive ? '#00FF88' : '#334455'}
            onClick={toggleVoice}
            small
          />
          <LCARSButton label="PROGRAMS" color="#3399FF" onClick={() => setPanelOpen(p => !p)} small />
          <LCARSButton label="⚙" color="#CC99FF" onClick={() => setSettingsOpen(p => !p)} small />
        </div>

        {/* Bottom-left: log */}
        <div id="hud-log">
          <LCARSDisplay lines={logLines} />
        </div>

        {/* Bottom-right: controls hint */}
        <div id="hud-hint">
          WASD / MOUSE — MOVE &nbsp;|&nbsp; CLICK CANVAS — LOCK POINTER
          &nbsp;|&nbsp; SAY "COMPUTER, ARCH"
        </div>
      </div>

      {/* ── Scene selector panel ─────────────────────────────────────── */}
      {panelOpen && (
        <div id="scene-panel" onClick={e => e.stopPropagation()}>
          <LCARSTitle color="#FF9900">SELECT HOLODECK PROGRAM</LCARSTitle>
          <div className="scene-panel__grid">
            {SCENES.map(s => (
              <SceneCard key={s.key} scene={s} onLoad={loadScene} />
            ))}
          </div>
          <LCARSButton label="CLOSE" color="#CC6600" onClick={() => setPanelOpen(false)} small />
        </div>
      )}

      {/* ── Settings panel ───────────────────────────────────────────── */}
      {settingsOpen && (
        <div id="settings-panel" onClick={e => e.stopPropagation()}>
          <LCARSTitle color="#CC99FF">HOLODECK PARAMETERS</LCARSTitle>

          <div className="settings-row">
            <span>LOCOMOTION</span>
            <div className="settings-row__btns">
              {['smooth','teleport'].map(m => (
                <LCARSButton
                  key={m}
                  label={m.toUpperCase()}
                  color={locomotionMode === m ? '#FF9900' : '#334455'}
                  small
                  onClick={() => { store.setLocomotionMode(m); engineInstance?.audio.playUI('lcars_button'); }}
                />
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span>QUALITY</span>
            <div className="settings-row__btns">
              {['low','medium','high'].map(q => (
                <LCARSButton
                  key={q}
                  label={q.toUpperCase()}
                  color={quality === q ? '#3399FF' : '#334455'}
                  small
                  onClick={() => { store.setQuality(q); engineInstance?.audio.playUI('lcars_button'); }}
                />
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span>AUDIO VOLUME</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={audioVolume}
              onChange={e => {
                const v = parseFloat(e.target.value);
                store.setAudioVolume(v);
                engineInstance?.audio.setVolume(v);
              }}
              className="settings-slider"
            />
          </div>

          <LCARSButton label="CLOSE" color="#CC6600" onClick={() => setSettingsOpen(false)} small />
        </div>
      )}
    </>
  );
}

/** Holographic preview card for scene selector */
function SceneCard({ scene, onLoad }) {
  return (
    <div
      className="scene-card"
      style={{ '--card-color': scene.color }}
      onClick={() => onLoad(scene.key)}
    >
      <div className="scene-card__label">{scene.label}</div>
    </div>
  );
}
