use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub source_app: String,
    pub thumbnail: Option<String>,
    pub is_playing: bool,
}
