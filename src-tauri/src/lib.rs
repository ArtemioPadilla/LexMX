//! LexMX Escritorio: the same static site, packaged with Tauri 2 so the full
//! corpus and a local model can live on disk. No network access is needed;
//! the web app stays local-first and every server feature stays opt-in.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running LexMX Escritorio");
}
