// ─── ChromaPlay — Control Dock ────────────────────────────────────────
// Collapsible glassmorphism right-side panel with tabs:
//   Color · LUTs · Effects · Presets

import { useCallback, useRef, useState } from "react";
import { useChromaStore } from "../store";
import { parseCubeFile, generateCubeFile, type GradeParams } from "../engine";
import { openLutNative, exportLutNative } from "../services/tauriService";

// ─── Reusable Slider ──────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : value.toFixed(2);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </div>
      <input
        type="range"
        className="grade-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────

type TabId = "color" | "luts" | "effects" | "presets";

const TABS: { id: TabId; label: string }[] = [
  { id: "color", label: "Color" },
  { id: "luts", label: "LUTs" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
];

// ─── Color Tab ────────────────────────────────────────────────────────

function ColorTab() {
  const store = useChromaStore();

  return (
    <div className="dock-tab-content">
      <div className="section-header">
        <h3>Tonality</h3>
        <button className="reset-btn" onClick={() => store.resetGrading()}>
          Reset
        </button>
      </div>
      <Slider label="Exposure" value={store.exposure} min={-2} max={2} onChange={(v) => store.setGrading({ exposure: v })} />
      <Slider label="Contrast" value={store.contrast} min={-0.5} max={1} onChange={(v) => store.setGrading({ contrast: v })} />
      <Slider label="Highlights" value={store.highlights} min={-1} max={1} onChange={(v) => store.setGrading({ highlights: v })} />
      <Slider label="Shadows" value={store.shadows} min={-1} max={1} onChange={(v) => store.setGrading({ shadows: v })} />

      <div className="section-divider" />

      <h3 className="section-title">Color Balance</h3>
      <Slider label="Temperature" value={store.temperature} min={-1} max={1} onChange={(v) => store.setGrading({ temperature: v })} formatValue={(v) => (v > 0 ? `+${v.toFixed(2)} Warm` : v < 0 ? `${v.toFixed(2)} Cool` : "Neutral")} />
      <Slider label="Tint" value={store.tint} min={-1} max={1} onChange={(v) => store.setGrading({ tint: v })} formatValue={(v) => (v > 0 ? `+${v.toFixed(2)} Magenta` : v < 0 ? `${v.toFixed(2)} Green` : "Neutral")} />

      <div className="section-divider" />

      <h3 className="section-title">Saturation</h3>
      <Slider label="Saturation" value={store.saturation} min={-1} max={1} onChange={(v) => store.setGrading({ saturation: v })} />
    </div>
  );
}

// ─── LUT Tab ──────────────────────────────────────────────────────────

function LutTab() {
  const store = useChromaStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleLutFile = useCallback(
    (file: File) => {
      setLoadError(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const lutData = parseCubeFile(text);
          store.setLut({ lutData, lutEnabled: true, lutIntensity: 1.0 });
        } catch (err: any) {
          setLoadError(err.message || "Failed to parse .cube file");
        }
      };
      reader.readAsText(file);
    },
    [store],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".cube")) {
        handleLutFile(file);
      }
    },
    [handleLutFile],
  );

  const handleExport = useCallback(async () => {
    const s = useChromaStore.getState();
    const params: GradeParams = {
      exposure: s.exposure,
      contrast: s.contrast,
      highlights: s.highlights,
      shadows: s.shadows,
      temperature: s.temperature,
      tint: s.tint,
      saturation: s.saturation,
    };
    const cubeText = generateCubeFile(params, 17);
    await exportLutNative(cubeText, "ChromaPlay_Grade.cube");
  }, []);

  const handleBrowseLut = useCallback(async () => {
    setLoadError(null);
    const result = await openLutNative();
    if (result) {
      try {
        const lutData = parseCubeFile(result.content);
        if (lutData.title === "Imported LUT") {
          lutData.title = result.name.replace(/\.cube$/i, "");
        }
        store.setLut({ lutData, lutEnabled: true, lutIntensity: 1.0 });
      } catch (err: any) {
        setLoadError(err.message || "Failed to parse .cube file");
      }
    }
  }, [store]);

  return (
    <div className="dock-tab-content">
      <h3 className="section-title">3D LUT (.cube)</h3>

      {/* Drop zone */}
      <div
        className="lut-dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={handleBrowseLut}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".cube"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLutFile(file);
          }}
        />
        {store.lutData ? (
          <div className="lut-loaded">
            <span className="lut-icon">🎨</span>
            <span className="lut-name">{store.lutData.title}</span>
            <span className="lut-size">{store.lutData.size}³</span>
          </div>
        ) : (
          <div className="lut-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop .cube file or click to browse</span>
          </div>
        )}
      </div>

      {loadError && <div className="lut-error">{loadError}</div>}

      {/* LUT controls */}
      {store.lutData && (
        <>
          <Slider
            label="LUT Intensity"
            value={store.lutIntensity}
            min={0}
            max={1}
            onChange={(v) => store.setLut({ lutIntensity: v })}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
          <button
            className="dock-btn dock-btn-secondary"
            onClick={() => store.setLut({ lutData: null, lutEnabled: false, lutIntensity: 0 })}
          >
            Remove LUT
          </button>
        </>
      )}

      <div className="section-divider" />

      {/* Export */}
      <h3 className="section-title">Export Grade</h3>
      <p className="section-desc">
        Export your current color grade as a standard .cube file for use in DaVinci Resolve, Premiere, or Lightroom.
      </p>
      <button className="dock-btn dock-btn-primary" onClick={handleExport}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export Current Grade as .cube
      </button>
    </div>
  );
}

// ─── Effects Tab ──────────────────────────────────────────────────────

function EffectsTab() {
  const store = useChromaStore();

  return (
    <div className="dock-tab-content">
      <div className="section-header">
        <h3>Post-Processing FX</h3>
        <button className="reset-btn" onClick={() => store.resetFx()}>
          Reset
        </button>
      </div>

      <h4 className="subsection-title">Film Grain</h4>
      <Slider label="Intensity" value={store.grainIntensity} min={0} max={1} onChange={(v) => store.setFx({ grainIntensity: v })} formatValue={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Size" value={store.grainSize} min={0.5} max={3} step={0.1} onChange={(v) => store.setFx({ grainSize: v })} />

      <div className="section-divider" />

      <h4 className="subsection-title">Vignette</h4>
      <Slider label="Intensity" value={store.vignetteIntensity} min={0} max={1} onChange={(v) => store.setFx({ vignetteIntensity: v })} formatValue={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Falloff" value={store.vignetteFalloff} min={0.1} max={2} step={0.05} onChange={(v) => store.setFx({ vignetteFalloff: v })} />

      <div className="section-divider" />

      <h4 className="subsection-title">Bloom / Soft Glow</h4>
      <Slider label="Intensity" value={store.bloomIntensity} min={0} max={1} onChange={(v) => store.setFx({ bloomIntensity: v })} formatValue={(v) => `${Math.round(v * 100)}%`} />
    </div>
  );
}

// ─── Presets Tab ──────────────────────────────────────────────────────

function PresetsTab() {
  const store = useChromaStore();
  const [newName, setNewName] = useState("");

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    store.savePreset(name);
    setNewName("");
  };

  return (
    <div className="dock-tab-content">
      <h3 className="section-title">Preset Library</h3>

      <div className="preset-list">
        {store.presets.map((preset) => (
          <div
            key={preset.id}
            className={`preset-card ${store.activePresetId === preset.id ? "active" : ""}`}
            onClick={() => store.loadPreset(preset.id)}
          >
            <span className="preset-name">{preset.name}</span>
            {preset.id.startsWith("custom-") && (
              <button
                className="preset-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  store.deletePreset(preset.id);
                }}
                title="Delete preset"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="section-divider" />

      <h3 className="section-title">Save Current Grade</h3>
      <div className="preset-save-row">
        <input
          type="text"
          className="preset-input"
          placeholder="Preset name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <button className="dock-btn dock-btn-primary" onClick={handleSave} disabled={!newName.trim()}>
          Save
        </button>
      </div>

      <div className="section-divider" />

      <button className="dock-btn dock-btn-danger" onClick={() => store.resetAll()}>
        Reset All to Default
      </button>
    </div>
  );
}

// ─── Main Dock Component ─────────────────────────────────────────────

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  color: ColorTab,
  luts: LutTab,
  effects: EffectsTab,
  presets: PresetsTab,
};

export function ControlDock() {
  const isDockOpen = useChromaStore((s) => s.isDockOpen);
  const activeTab = useChromaStore((s) => s.activeTab);
  const setUI = useChromaStore((s) => s.setUI);

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className={`control-dock glass ${isDockOpen ? "open" : "closed"}`}>
      {/* Tab bar */}
      <div className="dock-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`dock-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setUI({ activeTab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
        <button
          className="dock-close-btn"
          onClick={() => setUI({ isDockOpen: false })}
          title="Close Settings (Tab)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div className="dock-content">
        <ActiveTabComponent />
      </div>
    </div>
  );
}
