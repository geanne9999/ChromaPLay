# ChromaPlay

ChromaPlay is a high-performance desktop media player featuring real-time color grading and post-processing capabilities. Built using Tauri v2, React 19, TypeScript, and a custom WebGL2 shader pipeline, ChromaPlay allows videographers, colorists, and enthusiasts to preview, grade, apply 3D LUTs, and export industry-standard lookup tables directly during playback.

---

## Key Capabilities

### Real-Time Color Grading Engine
- **Tonality Controls**: Fine-grained exposure (-2.0 EV to +2.0 EV), S-curve contrast, luminance-masked highlights, and shadow adjustments.
- **Color Balance**: White balance temperature (cool to warm) and tint adjustment (green to magenta).
- **Saturation**: Full saturation control ranging from complete desaturation (monochrome) to double saturation.
- **Hardware Acceleration**: Frame rendering is processed on the GPU via custom GLSL 300 es shaders at full display refresh rate with zero CPU bottleneck.

### 3D LUT Integration and Export
- **LUT Ingestion**: Direct loading and parsing of industry-standard `.cube` files (such as 17x17x17, 33x33x33, and 64x64x64 lattices).
- **Trilinear 3D Texture Filtering**: Real-time trilinear interpolation through 3D WebGL textures with seamless hardware fallback.
- **Grade Export**: Programmatically transforms current manual adjustments into standard `.cube` 3D LUT files compatible with DaVinci Resolve, Adobe Premiere Pro, and Final Cut Pro.

### Post-Processing Effects
- **Procedural Film Grain**: Multi-frequency hash algorithm mapped to fragment coordinates for natural, non-repetitive film emulsion simulation.
- **Vignette**: Optical light falloff with configurable intensity and radius controls.
- **Bloom / Soft Glow**: Luminance-targeted bright-pass glow approximation for subtle highlight diffusion.

### Preset Management
- **Bundled Grades**: Factory presets including Cinematic Teal & Orange, Moody Noir, Vintage Warm, Cool Moonlight, and Faded Film.
- **Disk Persistence**: User-created presets are saved automatically to the local application data directory and synchronized across sessions.

### Native Desktop Integration
- **Native File Dialogs**: Seamless interaction with operating system file selection and save dialogs via Tauri plugins.
- **Hardware Decode Hints**: IPC query system reporting available codecs and Direct3D / ANGLE acceleration status.

---

## Technology Stack

- **Desktop Framework**: Tauri v2 (Rust backend)
- **Frontend Core**: React 19, TypeScript
- **Styling**: Tailwind CSS, CSS Custom Properties, Glassmorphism UI
- **State Management**: Zustand
- **Rendering Pipeline**: WebGL2, GLSL (OpenGL ES 3.0), 3D Texture Sampling

---

## System Requirements

- **Operating System**: Windows 10/11 (64-bit), macOS 11+, or modern Linux distribution
- **Node.js**: v18.0.0 or higher
- **Package Manager**: npm v9+ or pnpm
- **Rust Toolchain**: Rust stable (2021 edition) via `rustup`
- **Build Tools**:
  - Windows: Visual Studio 2022 C++ Build Tools with Windows SDK
  - Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libayatana-appindicator3-dev`
  - macOS: Xcode Command Line Tools

---

## Installation and Development

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/chromaplay.git
cd chromaplay
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Launch the Development Environment
Run the frontend development server and compile the Tauri desktop shell simultaneously:
```bash
npm run tauri dev
```

### 4. Build for Production
To create an optimized, standalone executable installer:
```bash
npm run tauri build
```
Compiled artifacts are output to:
- Windows: `src-tauri/target/release/bundle/msi/` or `nsis/`
- macOS: `src-tauri/target/release/bundle/dmg/` or `macos/`
- Linux: `src-tauri/target/release/bundle/deb/` or `appimage/`

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause playback |
| `Left Arrow` | Seek backward by 5 seconds |
| `Right Arrow` | Seek forward by 5 seconds |
| `Up Arrow` | Increase volume by 5% |
| `Down Arrow` | Decrease volume by 5% |
| `M` | Toggle audio mute |
| `F` | Toggle fullscreen mode |
| `Tab` | Open or close the Control Dock |
| `Alt + E` | Master FX bypass toggle (A/B grade comparison) |

---

## Supported File Formats

### Video Containers
- MP4 (`.mp4`)
- WebM (`.webm`)
- QuickTime (`.mov`)
- Matroska (`.mkv`)

### Lookup Tables
- Adobe / DaVinci 3D LUT (`.cube`)

---

## Project Structure

```
ChromaPlay/
├── src/
│   ├── assets/              # Static assets and icons
│   ├── components/          # React interface components
│   │   ├── ControlDock.tsx  # Color grading tabs, sliders, presets, and export
│   │   ├── TransportBar.tsx # Timeline scrubber, playback controls, and volume
│   │   └── VideoCanvas.tsx  # Hidden media decoder and WebGL2 render surface
│   ├── engine/              # WebGL2 rendering and LUT math
│   │   ├── lutService.ts    # .cube parser, generator, and 3D texture uploader
│   │   ├── shaders.ts       # GLSL 300 es vertex and fragment shader sources
│   │   └── webglEngine.ts   # WebGL2 context, quad geometry, and uniform cache
│   ├── services/            # Native desktop bridge
│   │   └── tauriService.ts  # Native file dialogs, IPC, and disk persistence
│   ├── store/               # Application state
│   │   └── chromaStore.ts   # Zustand state for playback, grading, and presets
│   ├── App.tsx              # Application shell, hotkeys, and window overlays
│   ├── App.css              # Theme tokens and component styling
│   └── main.tsx             # React DOM entry point
├── src-tauri/
│   ├── capabilities/        # Tauri v2 security and permission specifications
│   ├── src/
│   │   ├── lib.rs           # Rust backend, plugin registration, and IPC handlers
│   │   └── main.rs          # Desktop executable entrypoint
│   ├── Cargo.toml           # Rust crate dependencies and build configuration
│   └── tauri.conf.json      # Window dimensions, bundle metadata, and plugins
├── package.json             # NPM dependencies and scripts
└── vite.config.ts           # Vite bundling configuration
```

---

## License

This project is licensed under the MIT License. Refer to the `LICENSE` file for full terms.
