// ─── ChromaPlay — 3D LUT Service ──────────────────────────────────────
// Handles parsing .cube files into WebGL 3D textures and exporting
// the current color-grading state back into a standard .cube file.

export interface LutData {
  title: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // flat RGB triplets, length = size^3 * 3
}

// ─── Parser (.cube → LutData) ─────────────────────────────────────────

/**
 * Parse a standard 3D LUT `.cube` file string into structured LUT data.
 *
 * Format reference:
 *   - Lines starting with `#` are comments
 *   - `TITLE "..."` — optional title
 *   - `LUT_3D_SIZE N` — required; grid dimension (commonly 17, 33, or 64)
 *   - `DOMAIN_MIN r g b` — optional; input range floor (default 0 0 0)
 *   - `DOMAIN_MAX r g b` — optional; input range ceiling (default 1 1 1)
 *   - Remaining lines: `R G B` float triplets in row-major order
 */
export function parseCubeFile(text: string): LutData {
  const lines = text.split(/\r?\n/);

  let title = "Imported LUT";
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const rgbValues: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (line === "" || line.startsWith("#")) continue;

    // Parse header keywords
    if (line.startsWith("TITLE")) {
      const match = line.match(/TITLE\s+"?(.+?)"?\s*$/);
      if (match) title = match[1];
      continue;
    }

    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    if (line.startsWith("DOMAIN_MIN")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMin = [parts[0], parts[1], parts[2]];
      continue;
    }

    if (line.startsWith("DOMAIN_MAX")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMax = [parts[0], parts[1], parts[2]];
      continue;
    }

    // Skip any other non-numeric header (e.g., LUT_1D_SIZE, etc.)
    if (/^[A-Z_]/.test(line)) continue;

    // Parse RGB data triplet
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      rgbValues.push(
        parseFloat(parts[0]),
        parseFloat(parts[1]),
        parseFloat(parts[2]),
      );
    }
  }

  if (size === 0) {
    throw new Error("Invalid .cube file: missing LUT_3D_SIZE declaration.");
  }

  const expectedCount = size * size * size * 3;
  if (rgbValues.length !== expectedCount) {
    throw new Error(
      `Invalid .cube file: expected ${expectedCount / 3} RGB entries for a ${size}³ LUT, ` +
        `but found ${rgbValues.length / 3}.`,
    );
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(rgbValues),
  };
}

// ─── WebGL 3D Texture Upload ──────────────────────────────────────────

/**
 * Upload parsed LUT data as a WebGL2 3D texture (TEXTURE_3D).
 * Uses RGB32F internal format for high-precision color mapping.
 * Returns the created WebGLTexture handle.
 */
export function uploadLutTexture(
  gl: WebGL2RenderingContext,
  lutData: LutData,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create WebGL 3D texture for LUT.");

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const totalPoints = lutData.size * lutData.size * lutData.size;
  const floatLinear = gl.getExtension("OES_texture_float_linear");

  if (floatLinear) {
    // 4-channel Float32Array: RGBA32F is standard filterable with OES_texture_float_linear
    const rgbaData = new Float32Array(totalPoints * 4);
    const src = lutData.data;
    for (let i = 0; i < totalPoints; i++) {
      rgbaData[i * 4 + 0] = src[i * 3 + 0];
      rgbaData[i * 4 + 1] = src[i * 3 + 1];
      rgbaData[i * 4 + 2] = src[i * 3 + 2];
      rgbaData[i * 4 + 3] = 1.0;
    }

    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA32F,
      lutData.size,
      lutData.size,
      lutData.size,
      0,
      gl.RGBA,
      gl.FLOAT,
      rgbaData,
    );
  } else {
    // Universal fallback: 4-channel RGBA8 (hardware filterable on 100% of WebGL2 implementations)
    const rgbaData = new Uint8Array(totalPoints * 4);
    const src = lutData.data;
    for (let i = 0; i < totalPoints; i++) {
      rgbaData[i * 4 + 0] = Math.round(Math.min(1, Math.max(0, src[i * 3 + 0])) * 255);
      rgbaData[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, src[i * 3 + 1])) * 255);
      rgbaData[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, src[i * 3 + 2])) * 255);
      rgbaData[i * 4 + 3] = 255;
    }

    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA8,
      lutData.size,
      lutData.size,
      lutData.size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgbaData,
    );
  }

  // Trilinear filtering for smooth LUT interpolation
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Clamp-to-edge to prevent wrapping artifacts at LUT boundaries
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  return texture;
}

// ─── Export (Current Grade → .cube file text) ─────────────────────────

export interface GradeParams {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
}

/**
 * Programmatically generates a `.cube` file string by sampling a 3D color
 * lattice and passing each grid point through the app's exact color-grading
 * math. This produces a standard .cube that can be loaded in DaVinci Resolve,
 * Premiere Pro, or Lightroom.
 *
 * @param params - The current slider values from Zustand state.
 * @param gridSize - Output LUT resolution (default 17 — industry standard minimal).
 * @returns Standard .cube file contents as a string.
 */
export function generateCubeFile(
  params: GradeParams,
  gridSize: number = 17,
): string {
  const lines: string[] = [];

  lines.push(`# Generated by ChromaPlay`);
  lines.push(`TITLE "ChromaPlay Custom Grade"`);
  lines.push(`LUT_3D_SIZE ${gridSize}`);
  lines.push(`DOMAIN_MIN 0.0 0.0 0.0`);
  lines.push(`DOMAIN_MAX 1.0 1.0 1.0`);
  lines.push(``);

  // Iterate through the 3D lattice: B changes slowest, R changes fastest
  // This matches the standard .cube file ordering
  for (let b = 0; b < gridSize; b++) {
    for (let g = 0; g < gridSize; g++) {
      for (let r = 0; r < gridSize; r++) {
        // Normalized input color
        let cr = r / (gridSize - 1);
        let cg = g / (gridSize - 1);
        let cb = b / (gridSize - 1);

        // ── Apply the same grading math as the GLSL shader ──

        // 1. Exposure
        const expMul = Math.pow(2.0, params.exposure);
        cr *= expMul;
        cg *= expMul;
        cb *= expMul;

        // 2. Contrast (pivot at 0.5)
        const contrastFactor = 1.0 + params.contrast;
        cr = 0.5 + (cr - 0.5) * contrastFactor;
        cg = 0.5 + (cg - 0.5) * contrastFactor;
        cb = 0.5 + (cb - 0.5) * contrastFactor;

        // 3. Highlights & Shadows
        const lum = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;

        const highlightMask = smoothstep(0.4, 0.9, lum);
        cr += cr * params.highlights * highlightMask * 0.5;
        cg += cg * params.highlights * highlightMask * 0.5;
        cb += cb * params.highlights * highlightMask * 0.5;

        const shadowMask = 1.0 - smoothstep(0.1, 0.6, lum);
        cr += cr * params.shadows * shadowMask * 0.5;
        cg += cg * params.shadows * shadowMask * 0.5;
        cb += cb * params.shadows * shadowMask * 0.5;

        // 4. Temperature
        cr += params.temperature * 0.08;
        cb -= params.temperature * 0.08;

        // 5. Tint
        cg += params.tint * 0.06;

        // 6. Saturation
        const gray = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
        const satFactor = 1.0 + params.saturation;
        cr = gray + (cr - gray) * satFactor;
        cg = gray + (cg - gray) * satFactor;
        cb = gray + (cb - gray) * satFactor;

        // Clamp to [0, 1]
        cr = Math.max(0, Math.min(1, cr));
        cg = Math.max(0, Math.min(1, cg));
        cb = Math.max(0, Math.min(1, cb));

        lines.push(`${cr.toFixed(6)} ${cg.toFixed(6)} ${cb.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

// ─── Math Helpers ─────────────────────────────────────────────────────

/** GLSL-compatible smoothstep */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
