// ─── ChromaPlay — VideoCanvas Component ───────────────────────────────
// The core rendering surface. Manages:
//   1. Hidden <video> element for media decoding
//   2. WebGL2 <canvas> for shader-processed output
//   3. requestAnimationFrame render loop
//   4. Drag-and-drop and file picker integration
//   5. Real-time uniform updates from Zustand store

import { useEffect, useRef, useCallback } from "react";
import {
  initWebGLEngine,
  renderFrame,
  updateUniforms,
  uploadLutTexture,
  type WebGLEngine,
} from "../engine";
import { useChromaStore } from "../store";

export function VideoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<WebGLEngine | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lutTextureRef = useRef<WebGLTexture | null>(null);

  const store = useChromaStore();

  // ── Initialize WebGL engine ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      engineRef.current = initWebGLEngine(canvas);
      startTimeRef.current = performance.now();
    } catch (err) {
      console.error("Failed to initialize WebGL engine:", err);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // ── Upload LUT texture when LUT data changes ──
  useEffect(() => {
    const engine = engineRef.current;
    const lutData = store.lutData;
    if (!engine) return;

    // Clean up previous LUT texture
    if (lutTextureRef.current) {
      engine.gl.deleteTexture(lutTextureRef.current);
      lutTextureRef.current = null;
    }

    if (lutData) {
      try {
        const tex = uploadLutTexture(engine.gl, lutData);
        lutTextureRef.current = tex;
        engine.currentLutTexture = tex;
      } catch (err) {
        console.error("Failed to upload LUT texture:", err);
        engine.currentLutTexture = engine.defaultLutTexture;
      }
    } else {
      engine.currentLutTexture = engine.defaultLutTexture;
    }
  }, [store.lutData]);

  // ── Render loop ──
  useEffect(() => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!video || !engine) return;

    const loop = () => {
      // Get latest state directly (avoids stale closures)
      const s = useChromaStore.getState();
      const elapsed = (performance.now() - startTimeRef.current) / 1000;

      const isFxOn = s.fxEnabled;

      updateUniforms(engine, {
        exposure: isFxOn ? s.exposure : 0,
        contrast: isFxOn ? s.contrast : 0,
        highlights: isFxOn ? s.highlights : 0,
        shadows: isFxOn ? s.shadows : 0,
        temperature: isFxOn ? s.temperature : 0,
        tint: isFxOn ? s.tint : 0,
        saturation: isFxOn ? s.saturation : 0,
        lutIntensity: isFxOn ? s.lutIntensity : 0,
        lutEnabled: isFxOn && s.lutEnabled && !!s.lutData,
        lutSize: s.lutData?.size ?? 1,
        grainIntensity: isFxOn ? s.grainIntensity : 0,
        grainSize: s.grainSize,
        vignetteIntensity: isFxOn ? s.vignetteIntensity : 0,
        vignetteFalloff: s.vignetteFalloff,
        bloomIntensity: isFxOn ? s.bloomIntensity : 0,
        time: elapsed,
      });

      if (s.videoSrc && video.readyState >= video.HAVE_CURRENT_DATA) {
        renderFrame(engine, video);
      } else if (!s.videoSrc) {
        engine.gl.viewport(0, 0, engine.gl.canvas.width, engine.gl.canvas.height);
        engine.gl.clearColor(0, 0, 0, 1);
        engine.gl.clear(engine.gl.COLOR_BUFFER_BIT);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Sync video element with playback state ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!store.videoSrc) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (engineRef.current) {
        const gl = engineRef.current.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      return;
    }

    if (video.src !== store.videoSrc) {
      video.src = store.videoSrc;
      video.load();
    }
  }, [store.videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (store.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!store.isPlaying && !video.paused) {
      video.pause();
    }
  }, [store.isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.volume = store.volume;
  }, [store.volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = store.isMuted;
  }, [store.isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = store.playbackRate;
  }, [store.playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.loop = store.isLooping;
  }, [store.isLooping]);

  // ── Video event listeners ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      useChromaStore.getState().setPlayback({ currentTime: video.currentTime });
    };
    const onDurationChange = () => {
      useChromaStore.getState().setPlayback({ duration: video.duration || 0 });
    };
    const onEnded = () => {
      if (!video.loop) {
        useChromaStore.getState().setPlayback({ isPlaying: false });
      }
    };

    const onLoadedMetadata = () => {
      useChromaStore.getState().setPlayback({
        duration: video.duration || 0,
        isPlaying: true,
      });
      video.play().catch(() => {});
    };
    const onError = () => {
      console.warn("Video element load error:", video.error);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, []);

  // ── Drag & Drop ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file && /\.(mp4|mkv|mov|webm)$/i.test(file.name)) {
      const url = URL.createObjectURL(file);
      useChromaStore.getState().setVideoSrc(url, file.name);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Seek ──
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
    }
  }, []);

  // Expose seek function globally for the transport bar
  useEffect(() => {
    (window as any).__chromaplay_seekTo = seekTo;
    return () => {
      delete (window as any).__chromaplay_seekTo;
    };
  }, [seekTo]);

  return (
    <div
      className="video-canvas-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Hidden video element — decoded by browser, piped to WebGL */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        playsInline
        preload="auto"
      />

      {/* WebGL2 rendering canvas */}
      <canvas
        ref={canvasRef}
        className="render-canvas"
        style={{ display: store.videoSrc ? "block" : "none" }}
      />

      {/* Empty state — show when no video is loaded */}
      {!store.videoSrc && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <h2 className="empty-state-title">ChromaPlay</h2>
          <p className="empty-state-text">
            Drop a video file here or click to open
          </p>
          <p className="empty-state-formats">
            .mp4 · .mkv · .mov · .webm
          </p>
        </div>
      )}
    </div>
  );
}
