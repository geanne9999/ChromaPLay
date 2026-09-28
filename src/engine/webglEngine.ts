// ─── ChromaPlay — WebGL2 Rendering Engine ─────────────────────────────
// Initializes the WebGL2 context, compiles shaders, creates the fullscreen
// quad geometry, and provides methods for rendering video frames with the
// active shader pipeline and updating uniforms from Zustand state.

import { VERTEX_SHADER, FRAGMENT_SHADER } from "./shaders";

// ─── Types ────────────────────────────────────────────────────────────

export interface UniformLocations {
  // Video
  u_videoTexture: WebGLUniformLocation | null;
  // Tonality
  u_exposure: WebGLUniformLocation | null;
  u_contrast: WebGLUniformLocation | null;
  u_highlights: WebGLUniformLocation | null;
  u_shadows: WebGLUniformLocation | null;
  // Color balance
  u_temperature: WebGLUniformLocation | null;
  u_tint: WebGLUniformLocation | null;
  // Saturation
  u_saturation: WebGLUniformLocation | null;
  // LUT
  u_lutTexture: WebGLUniformLocation | null;
  u_lutIntensity: WebGLUniformLocation | null;
  u_lutEnabled: WebGLUniformLocation | null;
  u_lutSize: WebGLUniformLocation | null;
  // Post-FX
  u_grainIntensity: WebGLUniformLocation | null;
  u_grainSize: WebGLUniformLocation | null;
  u_vignetteIntensity: WebGLUniformLocation | null;
  u_vignetteFalloff: WebGLUniformLocation | null;
  u_bloomIntensity: WebGLUniformLocation | null;
  u_time: WebGLUniformLocation | null;
}

export interface WebGLEngine {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: UniformLocations;
  videoTexture: WebGLTexture;
  defaultLutTexture: WebGLTexture;
  currentLutTexture: WebGLTexture;
  vao: WebGLVertexArrayObject;
  destroy: () => void;
}

// ─── Shader Compilation ───────────────────────────────────────────────

function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error:\n${log}`);
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
  const frag = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create shader program.");

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error:\n${log}`);
  }

  // Shaders can be deleted after linking
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return program;
}

// ─── Geometry — Fullscreen Quad ───────────────────────────────────────

function createFullscreenQuad(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO.");
  gl.bindVertexArray(vao);

  // Fullscreen triangle strip — 2 triangles, clip space
  // prettier-ignore
  const vertices = new Float32Array([
    // position (x,y)  texCoord (u,v)
    -1, -1,            0, 1,
     1, -1,            1, 1,
    -1,  1,            0, 0,
     1,  1,            1, 0,
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "a_position");
  const aTexCoord = gl.getAttribLocation(program, "a_texCoord");

  // position: 2 floats, stride 16 bytes, offset 0
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

  // texCoord: 2 floats, stride 16 bytes, offset 8
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return vao;
}

// ─── Video Texture ────────────────────────────────────────────────────

function createVideoTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create video texture.");

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Initialize with a 1×1 transparent pixel so the texture is valid before first video frame
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

function createDefaultLutTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create default LUT texture.");

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, texture);

  // 1x1x1 identity pixel [128, 128, 128, 255]
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.RGBA8,
    1,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([128, 128, 128, 255]),
  );

  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  return texture;
}

// ─── Uniform Location Cache ──────────────────────────────────────────

function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): UniformLocations {
  const get = (name: string) => gl.getUniformLocation(program, name);
  return {
    u_videoTexture: get("u_videoTexture"),
    u_exposure: get("u_exposure"),
    u_contrast: get("u_contrast"),
    u_highlights: get("u_highlights"),
    u_shadows: get("u_shadows"),
    u_temperature: get("u_temperature"),
    u_tint: get("u_tint"),
    u_saturation: get("u_saturation"),
    u_lutTexture: get("u_lutTexture"),
    u_lutIntensity: get("u_lutIntensity"),
    u_lutEnabled: get("u_lutEnabled"),
    u_lutSize: get("u_lutSize"),
    u_grainIntensity: get("u_grainIntensity"),
    u_grainSize: get("u_grainSize"),
    u_vignetteIntensity: get("u_vignetteIntensity"),
    u_vignetteFalloff: get("u_vignetteFalloff"),
    u_bloomIntensity: get("u_bloomIntensity"),
    u_time: get("u_time"),
  };
}

// ─── Engine Initialization ────────────────────────────────────────────

/**
 * Initialize the WebGL2 rendering engine on a given canvas element.
 * Returns an engine object with the GL context, compiled program,
 * uniform locations, video texture, and a destroy method for cleanup.
 */
export function initWebGLEngine(canvas: HTMLCanvasElement): WebGLEngine {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    throw new Error(
      "WebGL2 is not supported in this browser. ChromaPlay requires WebGL2 for real-time color grading.",
    );
  }

  // Enable float texture linear filtering (critical for 3D LUT sampling with gl.LINEAR)
  gl.getExtension("OES_texture_float_linear");
  gl.getExtension("EXT_color_buffer_float");

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const uniforms = getUniformLocations(gl, program);
  const vao = createFullscreenQuad(gl, program);
  const videoTexture = createVideoTexture(gl);
  const defaultLutTexture = createDefaultLutTexture(gl);

  // Bind the program once — we only use one shader program in this app
  gl.useProgram(program);

  // Set texture unit bindings (these don't change)
  gl.uniform1i(uniforms.u_videoTexture, 0); // TEXTURE0
  gl.uniform1i(uniforms.u_lutTexture, 1);   // TEXTURE1

  return {
    gl,
    program,
    uniforms,
    videoTexture,
    defaultLutTexture,
    currentLutTexture: defaultLutTexture,
    vao,
    destroy: () => {
      gl.deleteProgram(program);
      gl.deleteTexture(videoTexture);
      gl.deleteTexture(defaultLutTexture);
      gl.deleteVertexArray(vao);
    },
  };
}

// ─── Frame Rendering ──────────────────────────────────────────────────

/**
 * Upload the current video frame and draw it through the shader pipeline.
 * Call this inside a requestAnimationFrame loop.
 */
export function renderFrame(
  engine: WebGLEngine,
  videoElement: HTMLVideoElement,
): void {
  const { gl, videoTexture, currentLutTexture, vao } = engine;

  // Update canvas size to match video intrinsic dimensions
  if (
    gl.canvas.width !== videoElement.videoWidth ||
    gl.canvas.height !== videoElement.videoHeight
  ) {
    gl.canvas.width = videoElement.videoWidth || 1;
    gl.canvas.height = videoElement.videoHeight || 1;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  // Upload current video frame as texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    videoElement,
  );

  // Bind active 3D LUT texture
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, currentLutTexture);

  // Draw the fullscreen quad
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

// ─── Uniform Update Helpers ───────────────────────────────────────────

/**
 * Push all color-grading uniform values to the GPU.
 * Call this whenever any slider value changes in the Zustand store.
 */
export function updateUniforms(
  engine: WebGLEngine,
  values: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    temperature: number;
    tint: number;
    saturation: number;
    lutIntensity: number;
    lutEnabled: boolean;
    lutSize: number;
    grainIntensity: number;
    grainSize: number;
    vignetteIntensity: number;
    vignetteFalloff: number;
    bloomIntensity: number;
    time: number;
  },
): void {
  const { gl, uniforms } = engine;

  gl.uniform1f(uniforms.u_exposure, values.exposure);
  gl.uniform1f(uniforms.u_contrast, values.contrast);
  gl.uniform1f(uniforms.u_highlights, values.highlights);
  gl.uniform1f(uniforms.u_shadows, values.shadows);
  gl.uniform1f(uniforms.u_temperature, values.temperature);
  gl.uniform1f(uniforms.u_tint, values.tint);
  gl.uniform1f(uniforms.u_saturation, values.saturation);
  gl.uniform1f(uniforms.u_lutIntensity, values.lutIntensity);
  gl.uniform1i(uniforms.u_lutEnabled, values.lutEnabled ? 1 : 0);
  gl.uniform1f(uniforms.u_lutSize, values.lutSize);
  gl.uniform1f(uniforms.u_grainIntensity, values.grainIntensity);
  gl.uniform1f(uniforms.u_grainSize, values.grainSize);
  gl.uniform1f(uniforms.u_vignetteIntensity, values.vignetteIntensity);
  gl.uniform1f(uniforms.u_vignetteFalloff, values.vignetteFalloff);
  gl.uniform1f(uniforms.u_bloomIntensity, values.bloomIntensity);
  gl.uniform1f(uniforms.u_time, values.time);
}
