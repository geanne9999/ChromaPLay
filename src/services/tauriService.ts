// ─── ChromaPlay — Tauri Services & Native Integrations ───────────────
// Provides native desktop integration with fallbacks:
//   1. Native File Dialogs for LUT import and export (.cube)
//   2. Native File Dialog for video files
//   3. Persistent presets storage on disk
//   4. Hardware-accelerated decode hints via Tauri IPC

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { Preset } from "../store";

export interface HardwareDecodeInfo {
  supported_codecs: string[];
  hw_acceleration_enabled: boolean;
  renderer: string;
  recommended_color_space: string;
}

/** Check if running inside the Tauri desktop shell */
export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * Open native file picker for selecting a video file.
 */
export async function openVideoNative(): Promise<{ url: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/mp4,video/webm,video/quicktime,.mkv,.mov";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve({ url: URL.createObjectURL(file), name: file.name });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Open native file picker for selecting a .cube LUT file.
 */
export async function openLutNative(): Promise<{ content: string; name: string } | null> {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "3D LUT",
            extensions: ["cube"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        const name = selected.split(/[\\/]/).pop() || "Imported LUT";
        return { content, name };
      }
    } catch (err) {
      console.warn("Tauri open LUT dialog error, falling back to web file input:", err);
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cube";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ content: reader.result as string, name: file.name });
        };
        reader.readAsText(file);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Save LUT string to disk with native save dialog.
 */
export async function exportLutNative(cubeContent: string, defaultName: string = "ChromaPlay_Grade.cube"): Promise<boolean> {
  if (isTauri()) {
    try {
      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: "3D LUT",
            extensions: ["cube"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, cubeContent);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Tauri native save dialog failed, using web download fallback:", err);
    }
  }

  // Web download fallback
  const blob = new Blob([cubeContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

const PRESETS_STORAGE_KEY = "chromaplay_custom_presets";
const PRESETS_FILE_NAME = "chromaplay_presets.json";

/**
 * Save custom presets to disk (via Tauri FS in AppData or localStorage).
 */
export async function savePresetsToDisk(presets: Preset[]): Promise<void> {
  const customPresets = presets.filter((p) => p.id.startsWith("custom-"));
  const json = JSON.stringify(customPresets, null, 2);

  // Always update localStorage as immediate cache
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, json);
  } catch (e) {
    // Ignore storage quota
  }

  // Save via Tauri fs if desktop
  if (isTauri()) {
    try {
      await writeTextFile(PRESETS_FILE_NAME, json, {
        baseDir: BaseDirectory.AppData,
      });
    } catch {
      try {
        // Create directory if needed
        await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
        await writeTextFile(PRESETS_FILE_NAME, json, {
          baseDir: BaseDirectory.AppData,
        });
      } catch (err) {
        console.warn("Could not write presets to AppData disk file:", err);
      }
    }
  }
}

/**
 * Load custom presets from disk.
 */
export async function loadPresetsFromDisk(): Promise<Preset[]> {
  // Try Tauri disk first
  if (isTauri()) {
    try {
      const hasFile = await exists(PRESETS_FILE_NAME, {
        baseDir: BaseDirectory.AppData,
      });
      if (hasFile) {
        const text = await readTextFile(PRESETS_FILE_NAME, {
          baseDir: BaseDirectory.AppData,
        });
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn("Could not read presets from AppData, checking localStorage fallback:", err);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Error reading presets from localStorage:", err);
  }

  return [];
}

/**
 * Query hardware-accelerated decode hints from Tauri backend.
 */
export async function fetchHardwareDecodeHints(): Promise<HardwareDecodeInfo | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<HardwareDecodeInfo>("get_hardware_decode_hints");
  } catch (err) {
    console.warn("Failed to fetch hardware decode hints via Tauri IPC:", err);
    return null;
  }
}
