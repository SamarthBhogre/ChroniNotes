use crate::media::models::MediaInfo;
use crate::media::provider::MediaProvider;
use crate::media::SystemMediaProvider;

#[tauri::command]
pub async fn get_current_media() -> Result<Option<MediaInfo>, String> {
    SystemMediaProvider::new().current_media()
}

#[tauri::command]
pub async fn get_all_media_sessions() -> Result<Vec<MediaInfo>, String> {
    SystemMediaProvider::new().all_media_sessions()
}

#[tauri::command]
pub async fn play_pause() -> Result<(), String> {
    SystemMediaProvider::new().play_pause()
}

#[tauri::command]
pub async fn next_track() -> Result<(), String> {
    SystemMediaProvider::new().next_track()
}

#[tauri::command]
pub async fn previous_track() -> Result<(), String> {
    SystemMediaProvider::new().previous_track()
}
