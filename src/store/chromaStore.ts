// ─── ChromaPlay — Zustand State Store ─────────────────────────────────
// Central state for all color-grading parameters, playback state, LUT data,
// FX toggles, and presets. Slider values update WebGL uniforms in real-time.

import { create } from "zustand";
import type { LutData } from "../engine/lutService";

// ─── Preset Type ──────────────────────────────────────────────────────

export interface Preset {
  id: string;
  name: string;
  // Color grading
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
  // FX
  grainIntensity: number;
  grainSize: number;
  vignetteIntensity: number;
  vignetteFalloff: number;
  bloomIntensity: number;
  // LUT (name only; actual data is separate)
  lutName: string | null;
  lutIntensity: number;
}

// ─── Store Interface ──────────────────────────────────────────────────

export interface ChromaPlayState {
  // ── Playback ──
  videoSrc: string | null;
  videoName: string | null;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0.0 – 1.0
  currentTime: number;
  duration: number;
  playbackRate: number;
  isLooping: boolean;

  // ── Color Grading ──
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;

  // ── LUT ──
  lutData: LutData | null;
  lutIntensity: number;
  lutEnabled: boolean;

  // ── Post-FX ──
  grainIntensity: number;
  grainSize: number;
  vignetteIntensity: number;
  vignetteFalloff: number;
  bloomIntensity: number;

  // ── UI State ──
  isDockOpen: boolean;
  activeTab: "color" | "luts" | "effects" | "presets";
  fxEnabled: boolean; // Master FX bypass (Alt+E)

  // ── Presets ──
  presets: Preset[];
  activePresetId: string | null;

  // ── Actions ──
  setVideoSrc: (src: string | null, name?: string) => void;
  setPlayback: (partial: Partial<Pick<ChromaPlayState,
    "isPlaying" | "isMuted" | "volume" | "currentTime" | "duration" | "playbackRate" | "isLooping"
  >>) => void;
  setGrading: (partial: Partial<Pick<ChromaPlayState,
    "exposure" | "contrast" | "highlights" | "shadows" | "temperature" | "tint" | "saturation"
  >>) => void;
  setLut: (partial: Partial<Pick<ChromaPlayState,
    "lutData" | "lutIntensity" | "lutEnabled"
  >>) => void;
  setFx: (partial: Partial<Pick<ChromaPlayState,
    "grainIntensity" | "grainSize" | "vignetteIntensity" | "vignetteFalloff" | "bloomIntensity"
  >>) => void;
  setUI: (partial: Partial<Pick<ChromaPlayState,
    "isDockOpen" | "activeTab" | "fxEnabled"
  >>) => void;
  resetGrading: () => void;
  resetFx: () => void;
  resetAll: () => void;
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  initPresets: (loaded: Preset[]) => void;
}

// ─── Default Values ───────────────────────────────────────────────────

const DEFAULT_GRADING = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
};

const DEFAULT_FX = {
  grainIntensity: 0,
  grainSize: 1.0,
  vignetteIntensity: 0,
  vignetteFalloff: 0.5,
  bloomIntensity: 0,
};

// ─── Bundled Presets ──────────────────────────────────────────────────

const BUNDLED_PRESETS: Preset[] = [
  {
    id: "cinematic-teal-orange",
    name: "Cinematic Teal & Orange",
    exposure: 0.1,
    contrast: 0.2,
    highlights: -0.15,
    shadows: 0.1,
    temperature: 0.35,
    tint: -0.05,
    saturation: 0.2,
    grainIntensity: 0.15,
    grainSize: 1.2,
    vignetteIntensity: 0.3,
    vignetteFalloff: 0.6,
    bloomIntensity: 0.05,
    lutName: null,
    lutIntensity: 0,
  },
  {
    id: "moody-noir",
    name: "Moody Noir",
    exposure: -0.2,
    contrast: 0.45,
    highlights: -0.3,
    shadows: -0.2,
    temperature: -0.15,
    tint: 0,
    saturation: -0.6,
    grainIntensity: 0.35,
    grainSize: 1.5,
    vignetteIntensity: 0.55,
    vignetteFalloff: 0.45,
    bloomIntensity: 0,
    lutName: null,
    lutIntensity: 0,
  },
  {
    id: "vintage-warm",
    name: "Vintage Warm",
    exposure: 0.15,
    contrast: -0.1,
    highlights: 0.1,
    shadows: 0.2,
    temperature: 0.4,
    tint: 0.05,
    saturation: -0.15,
    grainIntensity: 0.4,
    grainSize: 1.8,
    vignetteIntensity: 0.25,
    vignetteFalloff: 0.7,
    bloomIntensity: 0.15,
    lutName: null,
    lutIntensity: 0,
  },
  {
    id: "cool-moonlight",
    name: "Cool Moonlight",
    exposure: -0.1,
    contrast: 0.15,
    highlights: 0.05,
    shadows: -0.1,
    temperature: -0.45,
    tint: 0.1,
    saturation: -0.2,
    grainIntensity: 0.1,
    grainSize: 1.0,
    vignetteIntensity: 0.4,
    vignetteFalloff: 0.5,
    bloomIntensity: 0.2,
    lutName: null,
    lutIntensity: 0,
  },
  {
    id: "faded-film",
    name: "Faded Film",
    exposure: 0.2,
    contrast: -0.2,
    highlights: -0.1,
    shadows: 0.35,
    temperature: 0.1,
    tint: 0.05,
    saturation: -0.35,
    grainIntensity: 0.5,
    grainSize: 2.0,
    vignetteIntensity: 0.15,
    vignetteFalloff: 0.8,
    bloomIntensity: 0.1,
    lutName: null,
    lutIntensity: 0,
  },
];

// ─── Store ────────────────────────────────────────────────────────────

export const useChromaStore = create<ChromaPlayState>((set, get) => ({
  // Playback
  videoSrc: null,
  videoName: null,
  isPlaying: false,
  isMuted: false,
  volume: 1.0,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  isLooping: false,

  // Grading
  ...DEFAULT_GRADING,

  // LUT
  lutData: null,
  lutIntensity: 0,
  lutEnabled: false,

  // FX
  ...DEFAULT_FX,

  // UI
  isDockOpen: false,
  activeTab: "color",
  fxEnabled: true,

  // Presets
  presets: [...BUNDLED_PRESETS],
  activePresetId: null,

  // ── Actions ──

  setVideoSrc: (src, name) =>
    set({ videoSrc: src, videoName: name ?? null, isPlaying: !!src, currentTime: 0, duration: 0 }),

  setPlayback: (partial) => set(partial),

  setGrading: (partial) => set({ ...partial, activePresetId: null }),

  setLut: (partial) => set(partial),

  setFx: (partial) => set({ ...partial, activePresetId: null }),

  setUI: (partial) => set(partial),

  resetGrading: () => set({ ...DEFAULT_GRADING, activePresetId: null }),

  resetFx: () => set({ ...DEFAULT_FX, activePresetId: null }),

  resetAll: () =>
    set({
      ...DEFAULT_GRADING,
      ...DEFAULT_FX,
      lutData: null,
      lutIntensity: 0,
      lutEnabled: false,
      activePresetId: null,
    }),

  savePreset: (name) => {
    const state = get();
    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name,
      exposure: state.exposure,
      contrast: state.contrast,
      highlights: state.highlights,
      shadows: state.shadows,
      temperature: state.temperature,
      tint: state.tint,
      saturation: state.saturation,
      grainIntensity: state.grainIntensity,
      grainSize: state.grainSize,
      vignetteIntensity: state.vignetteIntensity,
      vignetteFalloff: state.vignetteFalloff,
      bloomIntensity: state.bloomIntensity,
      lutName: state.lutData?.title ?? null,
      lutIntensity: state.lutIntensity,
    };
    const updated = [...state.presets, newPreset];
    set({ presets: updated, activePresetId: newPreset.id });
    import("../services/tauriService").then(({ savePresetsToDisk }) => {
      savePresetsToDisk(updated).catch(() => {});
    });
  },

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    set({
      exposure: preset.exposure,
      contrast: preset.contrast,
      highlights: preset.highlights,
      shadows: preset.shadows,
      temperature: preset.temperature,
      tint: preset.tint,
      saturation: preset.saturation,
      grainIntensity: preset.grainIntensity,
      grainSize: preset.grainSize,
      vignetteIntensity: preset.vignetteIntensity,
      vignetteFalloff: preset.vignetteFalloff,
      bloomIntensity: preset.bloomIntensity,
      lutIntensity: preset.lutIntensity,
      activePresetId: id,
    });
  },

  deletePreset: (id) => {
    const updated = get().presets.filter((p) => p.id !== id);
    set((s) => ({
      presets: updated,
      activePresetId: s.activePresetId === id ? null : s.activePresetId,
    }));
    import("../services/tauriService").then(({ savePresetsToDisk }) => {
      savePresetsToDisk(updated).catch(() => {});
    });
  },

  initPresets: (loaded) => {
    if (!loaded || loaded.length === 0) return;
    set((s) => {
      // Merge bundled presets with loaded custom presets
      const customOnly = loaded.filter((p) => p.id.startsWith("custom-"));
      const map = new Map<string, Preset>();
      s.presets.forEach((p) => map.set(p.id, p));
      customOnly.forEach((p) => map.set(p.id, p));
      return { presets: Array.from(map.values()) };
    });
  },
}));
