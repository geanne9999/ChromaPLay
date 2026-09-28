// ─── ChromaPlay — Main Application Shell ──────────────────────────────

import { useEffect, useCallback, useState } from "react";
import { VideoCanvas } from "./components/VideoCanvas";
import { TransportBar } from "./components/TransportBar";
import { ControlDock } from "./components/ControlDock";
import { useChromaStore } from "./store";
import {
  openVideoNative,
  loadPresetsFromDisk,
  fetchHardwareDecodeHints,
  type HardwareDecodeInfo,
} from "./services/tauriService";
import "./App.css";

export default function App() {
  const store = useChromaStore();
  const [hwInfo, setHwInfo] = useState<HardwareDecodeInfo | null>(null);

  // ── Load custom presets from disk & query hardware decode hints ──
  useEffect(() => {
    loadPresetsFromDisk().then((saved) => {
      if (saved && saved.length > 0) {
        store.initPresets(saved);
      }
    });

    fetchHardwareDecodeHints().then((info) => {
      if (info) setHwInfo(info);
    });
  }, []);

  // ── Global Keyboard Shortcuts ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Alt+E — Toggle FX bypass
      if (e.altKey && e.key === "e") {
        e.preventDefault();
        useChromaStore.getState().setUI({
          fxEnabled: !useChromaStore.getState().fxEnabled,
        });
        return;
      }

      // Space — Play/Pause
      if (e.code === "Space" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        const s = useChromaStore.getState();
        s.setPlayback({ isPlaying: !s.isPlaying });
        return;
      }

      // F — Fullscreen
      if (e.key === "f" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        return;
      }

      // M — Mute toggle
      if (e.key === "m" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        const s = useChromaStore.getState();
        s.setPlayback({ isMuted: !s.isMuted });
        return;
      }

      // Tab — Toggle dock
      if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        const s = useChromaStore.getState();
        s.setUI({ isDockOpen: !s.isDockOpen });
        return;
      }

      // Arrow left/right — seek ±5s
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        const delta = e.key === "ArrowRight" ? 5 : -5;
        const s = useChromaStore.getState();
        const newTime = Math.max(0, Math.min(s.duration, s.currentTime + delta));
        (window as any).__chromaplay_seekTo?.(newTime);
        return;
      }

      // Arrow up/down — volume ±5%
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        const s = useChromaStore.getState();
        const delta = e.key === "ArrowUp" ? 0.05 : -0.05;
        const newVol = Math.max(0, Math.min(1, s.volume + delta));
        s.setPlayback({ volume: newVol, isMuted: false });
        return;
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Open video via native dialog or fallback ──
  const handleOpenFile = useCallback(async () => {
    const res = await openVideoNative();
    if (res) {
      store.setVideoSrc(res.url, res.name);
    }
  }, [store]);

  return (
    <div className="app-shell" onClick={!store.videoSrc ? handleOpenFile : undefined}>
      <VideoCanvas />
      <ControlDock />
      {store.videoSrc && <TransportBar />}

      {/* Top bar with back button, filename, and hardware decode badge */}
      {store.videoSrc && (
        <div className="video-top-bar">
          <button
            className="back-btn"
            onClick={(e) => {
              e.stopPropagation();
              store.setVideoSrc(null);
              store.resetAll();
              store.setUI({ isDockOpen: false });
            }}
            title="Close video"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="video-name-label">{store.videoName}</span>

          {/* Hardware acceleration hint badge */}
          {hwInfo && hwInfo.hw_acceleration_enabled && (
            <span
              className="hw-badge"
              title={`GPU Acceleration Active: ${hwInfo.renderer}\nSupported: ${hwInfo.supported_codecs.join(", ")}`}
            >
              ⚡ GPU
            </span>
          )}
        </div>
      )}
    </div>
  );
}
