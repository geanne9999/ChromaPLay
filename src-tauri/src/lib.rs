// ChromaPlay — Tauri v2 Backend

use serde::Serialize;

#[derive(Serialize)]
pub struct HardwareDecodeInfo {
    pub supported_codecs: Vec<String>,
    pub hw_acceleration_enabled: bool,
    pub renderer: String,
    pub recommended_color_space: String,
}

#[tauri::command]
fn get_hardware_decode_hints() -> HardwareDecodeInfo {
    HardwareDecodeInfo {
        supported_codecs: vec![
            "H.264 / AVC (DirectShow / Media Foundation)".into(),
            "H.265 / HEVC (DXVA2 / D3D11VA)".into(),
            "VP9 (Hardware Accelerated)".into(),
            "AV1 (DirectX Video Acceleration)".into(),
        ],
        hw_acceleration_enabled: true,
        renderer: "Direct3D 11 / ANGLE (WebGL2 High-Performance)".into(),
        recommended_color_space: "Rec. 709 / sRGB Linearized".into(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_hardware_decode_hints])
        .run(tauri::generate_context!())
        .expect("error while running ChromaPlay");
}
