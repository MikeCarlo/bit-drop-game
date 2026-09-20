import React from 'react';
import { canOpenCompeteLobby } from '../modes';

/**
 * Visible only when ENABLE_MULTIPLAYER=true.
 * Phase 1: advertise compete mode without starting a match.
 * Phase 2: replace the disabled button with `startCompete(seats)`.
 */
export function CompeteStub() {
  if (!canOpenCompeteLobby()) return null;

  return (
    <div
      className="bitdrop-compete-stub"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        border: '2px dashed #6e6e72',
        background: '#1a1a1c',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#9a9aa0' }}>MODE</span>
        <span style={{ fontSize: 9, color: '#2ea043' }}>SOLO</span>
      </div>
      <button
        type="button"
        disabled
        style={{
          fontFamily: 'inherit',
          fontSize: 10,
          background: '#2a2a2e',
          color: '#8e8e94',
          border: '3px solid #3a3a3e',
          padding: 12,
          cursor: 'not-allowed',
        }}
      >
        COMPETE · 2–4P
      </button>
      <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 600, fontSize: 12, color: '#8e8e94', lineHeight: 1.5 }}>
        Phase 2 hook — realtime match is not wired yet.
      </div>
    </div>
  );
}
