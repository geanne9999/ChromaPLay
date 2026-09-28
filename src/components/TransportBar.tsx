// ─── ChromaPlay — Transport Bar ───────────────────────────────────────
// Minimalist bottom transport with timeline scrubber, play/pause, volume,
// speed, loop, fullscreen, and FX dock toggle.

import { useCallback, useRef, useState } from "react";
import { useChromaStore } from "../store";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function TransportBar() {
  const store = useChromaStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const progress = store.duration > 0 ? store.currentTime / store.duration : 0;

  // ── Timeline scrub ──
  const seekFromEvent = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline || store.duration === 0) return;
      const rect = timeline.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = ratio * store.duration;
      (window as any).__chromaplay_seekTo?.(time);
    },
    [store.duration],
  );

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      seekFromEvent(e.clientX);

      const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekFromEvent],
  );

  // ── Toggle helpers ──
  const togglePlay = () => store.setPlayback({ isPlaying: !store.isPlaying });
  const toggleMute = () => store.setPlayback({ isMuted: !store.isMuted });
  const toggleLoop = () => store.setPlayback({ isLooping: !store.isLooping });
  const toggleDock = () => store.setUI({ isDockOpen: !store.isDockOpen });
  const toggleFx = () => store.setUI({ fxEnabled: !store.fxEnabled });
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const cycleSpeed = () => setShowSpeedMenu((v) => !v);
  const setSpeed = (rate: number) => {
    store.setPlayback({ playbackRate: rate });
    setShowSpeedMenu(false);
  };

  return (
    <div className="transport-bar">
      {/* Timeline scrubber */}
      <div
        ref={timelineRef}
        className="timeline"
        onMouseDown={handleTimelineMouseDown}
      >
        <div className="timeline-track">
          <div
            className="timeline-progress"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="timeline-thumb"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div className="transport-controls">
        {/* Left group: play, time */}
        <div className="transport-group">
          <button className="transport-btn" onClick={togglePlay} title={store.isPlaying ? "Pause" : "Play"}>
            {store.isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21" />
              </svg>
            )}
          </button>

          <button className="transport-btn" onClick={toggleMute} title={store.isMuted ? "Unmute" : "Mute"}>
            {store.isMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={store.isMuted ? 0 : store.volume}
            onChange={(e) => store.setPlayback({ volume: parseFloat(e.target.value), isMuted: false })}
          />

          <span className="transport-time">
            {formatTime(store.currentTime)} / {formatTime(store.duration)}
          </span>
        </div>

        {/* Right group: speed, loop, FX, dock, fullscreen */}
        <div className="transport-group">
          {/* Speed */}
          <div className="speed-container">
            <button className="transport-btn transport-btn-text" onClick={cycleSpeed} title="Playback Speed">
              {store.playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="speed-menu glass">
                {PLAYBACK_SPEEDS.map((s) => (
                  <button
                    key={s}
                    className={`speed-option ${store.playbackRate === s ? "active" : ""}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loop */}
          <button
            className={`transport-btn ${store.isLooping ? "active" : ""}`}
            onClick={toggleLoop}
            title="Loop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>

          {/* FX Master Toggle */}
          <button
            className={`transport-btn ${store.fxEnabled ? "fx-on" : "fx-off"}`}
            onClick={toggleFx}
            title="Toggle FX (Alt+E)"
          >
            <span className="fx-badge">FX</span>
          </button>

          {/* Dock Toggle */}
          <button
            className={`transport-btn ${store.isDockOpen ? "active" : ""}`}
            onClick={toggleDock}
            title="Toggle Control Dock"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button className="transport-btn" onClick={toggleFullscreen} title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
