use super::models::MediaInfo;

pub trait MediaProvider {
    fn current_media(&self) -> Result<Option<MediaInfo>, String>;
    fn all_media_sessions(&self) -> Result<Vec<MediaInfo>, String>;
    fn play_pause(&self) -> Result<(), String>;
    fn next_track(&self) -> Result<(), String>;
    fn previous_track(&self) -> Result<(), String>;
}
