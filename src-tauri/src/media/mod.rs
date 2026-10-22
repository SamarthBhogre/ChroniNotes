pub mod models;
pub mod provider;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
mod unsupported {
    use super::models::MediaInfo;
    use super::provider::MediaProvider;

    pub struct SystemMediaProvider;

    impl SystemMediaProvider {
        pub fn new() -> Self {
            Self
        }
    }

    impl MediaProvider for SystemMediaProvider {
        fn current_media(&self) -> Result<Option<MediaInfo>, String> {
            Ok(None)
        }

        fn all_media_sessions(&self) -> Result<Vec<MediaInfo>, String> {
            Ok(Vec::new())
        }

        fn play_pause(&self) -> Result<(), String> {
            Err("Media controls are not supported on this platform yet.".to_string())
        }

        fn next_track(&self) -> Result<(), String> {
            Err("Media controls are not supported on this platform yet.".to_string())
        }

        fn previous_track(&self) -> Result<(), String> {
            Err("Media controls are not supported on this platform yet.".to_string())
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub use unsupported::SystemMediaProvider;

#[cfg(target_os = "windows")]
pub use windows::SystemMediaProvider;
