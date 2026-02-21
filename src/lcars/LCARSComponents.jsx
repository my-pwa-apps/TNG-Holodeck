import React, { useEffect, useRef } from 'react';
import './lcars.css';

/** Reusable LCARS-styled button */
export function LCARSButton({ label, color = '#FF9900', onClick, small = false, disabled = false }) {
  return (
    <button
      className={`lcars-btn ${small ? 'lcars-btn--small' : ''}`}
      style={{ '--btn-color': color }}
      onClick={onClick}
      disabled={disabled}
      aria-label={typeof label === 'string' ? label : undefined}
    >
      {label}
    </button>
  );
}

/** Header bar */
export function LCARSTitle({ children, color = '#FF9900' }) {
  return (
    <div className="lcars-title" style={{ background: color }}>
      {children}
    </div>
  );
}

/** Scrolling data readout — auto-scrolls to latest entry */
export function LCARSDisplay({ lines = [] }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="lcars-display">
      {lines.map((l, i) => (
        <div key={i} className="lcars-display__line">{l}</div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

/** Safety protocols badge — always visible */
export function SafetyProtocolsIndicator() {
  return (
    <div className="safety-badge">
      <span className="safety-badge__dot" />
      SAFETY PROTOCOLS: ENABLED
    </div>
  );
}

/** "Program X running" status display */
export function ProgramStatusDisplay({ label }) {
  if (!label) return null;
  return (
    <div className="program-status">
      {label}
    </div>
  );
}
