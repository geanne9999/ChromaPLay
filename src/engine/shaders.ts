// ─── ChromaPlay — GLSL Shader Sources ─────────────────────────────────
// Master vertex + fragment shaders for the WebGL2 color-grading pipeline.
// The fragment shader processes every video frame through:
//   1. Tonality (Exposure, Contrast, Highlights, Shadows)
//   2. Color Balance (Temperature, Tint)
//   3. Saturation
//   4. 3D LUT Sampling (optional, when a .cube file is loaded)
//   5. Post-processing FX (Film Grain, Vignette, Bloom)

// ─── Vertex Shader ────────────────────────────────────────────────────
export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// ─── Fragment Shader ──────────────────────────────────────────────────
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_texCoord;
out vec4 fragColor;

// Video frame texture
uniform sampler2D u_videoTexture;

// ── Tonality uniforms ──
uniform float u_exposure;    // range: -2.0 to +2.0, default: 0.0
uniform float u_contrast;    // range: -0.5 to +1.0, default: 0.0
uniform float u_highlights;  // range: -1.0 to +1.0, default: 0.0
uniform float u_shadows;     // range: -1.0 to +1.0, default: 0.0

// ── Color balance uniforms ──
uniform float u_temperature; // range: -1.0 to +1.0 (cool ↔ warm), default: 0.0
uniform float u_tint;        // range: -1.0 to +1.0 (green ↔ magenta), default: 0.0

// ── Saturation ──
uniform float u_saturation;  // range: -1.0 to +1.0, default: 0.0

// ── 3D LUT ──
uniform sampler3D u_lutTexture;
uniform float u_lutIntensity; // range: 0.0 to 1.0, default: 0.0
uniform bool  u_lutEnabled;
uniform float u_lutSize;      // LUT grid dimension (e.g., 17.0, 33.0, 64.0)

// ── Post-processing FX ──
uniform float u_grainIntensity;  // range: 0.0 to 1.0, default: 0.0
uniform float u_grainSize;       // range: 0.5 to 3.0, default: 1.0
uniform float u_vignetteIntensity; // range: 0.0 to 1.0, default: 0.0
uniform float u_vignetteFalloff;   // range: 0.1 to 2.0, default: 0.5
uniform float u_bloomIntensity;    // range: 0.0 to 1.0, default: 0.0
uniform float u_time;              // elapsed seconds (for grain animation)

// ─── Helpers ──────────────────────────────────────────────────────────

// Pseudo-random hash for film grain (higher quality, less pattern)
float hash(vec2 p) {
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p.yx + 19.19);
  return fract(p.x * p.y);
}

float filmNoise(vec2 fragCoord, float t, float size) {
  vec2 cell = floor(fragCoord / max(size, 1.0));
  float n1 = hash(cell + floor(t * 7.13) * 1.71);
  float n2 = hash(cell.yx + floor(t * 11.37) * 3.23);
  return (n1 + n2) * 0.5 - 0.5;  // centered around 0
}

// Luminance (Rec. 709)
float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// ─── Main ─────────────────────────────────────────────────────────────

void main() {
  // Sample the video frame
  vec3 color = texture(u_videoTexture, v_texCoord).rgb;

  // ── 1. Exposure ──
  color *= pow(2.0, u_exposure);

  // ── 2. Contrast ──
  // Pivot around mid-gray (0.5) with S-curve influence
  color = mix(vec3(0.5), color, 1.0 + u_contrast);

  // ── 3. Highlights & Shadows ──
  float lum = luminance(color);

  // Highlights: affect bright regions (lum > 0.5)
  float highlightMask = smoothstep(0.4, 0.9, lum);
  color += color * u_highlights * highlightMask * 0.5;

  // Shadows: affect dark regions (lum < 0.5)
  float shadowMask = 1.0 - smoothstep(0.1, 0.6, lum);
  color += color * u_shadows * shadowMask * 0.5;

  // ── 4. Temperature (warm/cool) ──
  // Warm shifts red up and blue down; cool does the inverse
  color.r += u_temperature * 0.08;
  color.b -= u_temperature * 0.08;

  // ── 5. Tint (green/magenta) ──
  color.g += u_tint * 0.06;

  // ── 6. Saturation ──
  float gray = luminance(color);
  color = mix(vec3(gray), color, 1.0 + u_saturation);

  // ── 7. 3D LUT Application ──
  if (u_lutEnabled && u_lutIntensity > 0.001) {
    // Clamp to valid range before LUT lookup
    vec3 lutCoord = clamp(color, 0.0, 1.0);

    // Scale and offset for proper 3D texture sampling
    // This avoids sampling at the exact edges of the texture
    float scale = (u_lutSize - 1.0) / u_lutSize;
    float offset = 0.5 / u_lutSize;
    lutCoord = lutCoord * scale + offset;

    vec3 lutColor = texture(u_lutTexture, lutCoord).rgb;
    color = mix(color, lutColor, u_lutIntensity);
  }

  // Clamp before post-processing
  color = clamp(color, 0.0, 1.0);

  // ── 8. Film Grain ──
  if (u_grainIntensity > 0.001) {
    float grain = filmNoise(gl_FragCoord.xy, u_time, u_grainSize);
    color += grain * u_grainIntensity * 0.3;
  }

  // ── 9. Vignette ──
  if (u_vignetteIntensity > 0.001) {
    vec2 uv = v_texCoord - 0.5;
    float dist = length(uv);
    float vig = 1.0 - smoothstep(0.3 * u_vignetteFalloff, 0.8 * u_vignetteFalloff, dist);
    color *= mix(1.0, vig, u_vignetteIntensity);
  }

  // ── 10. Simple Bloom (additive bright-pass glow approximation) ──
  if (u_bloomIntensity > 0.001) {
    float brightness = luminance(color);
    float bloomMask = smoothstep(0.6, 1.0, brightness);
    color += color * bloomMask * u_bloomIntensity * 0.4;
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
