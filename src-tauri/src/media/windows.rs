use super::models::MediaInfo;
use super::provider::MediaProvider;
use std::future::{Future, IntoFuture};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};

pub struct SystemMediaProvider;

impl SystemMediaProvider {
    pub fn new() -> Self {
        Self
    }
}

impl MediaProvider for SystemMediaProvider {
    fn current_media(&self) -> Result<Option<MediaInfo>, String> {
        let manager = session_manager()?;
        match manager.GetCurrentSession() {
            Ok(session) => media_info_from_session(&session).map(Some),
            Err(_) => Ok(None),
        }
    }

    fn all_media_sessions(&self) -> Result<Vec<MediaInfo>, String> {
        let manager = session_manager()?;
        let sessions = manager
            .GetSessions()
            .map_err(|e| format!("Failed to list media sessions: {e}"))?;

        let mut items = Vec::new();
        for index in 0..sessions
            .Size()
            .map_err(|e| format!("Failed to read media session count: {e}"))?
        {
            let session = sessions
                .GetAt(index)
                .map_err(|e| format!("Failed to read media session: {e}"))?;
            items.push(media_info_from_session(&session)?);
        }
        Ok(items)
    }

    fn play_pause(&self) -> Result<(), String> {
        let session = current_session()?;
        let is_playing = is_session_playing(&session)?;
        let operation = if is_playing {
            session.TryPauseAsync()
        } else {
            session.TryPlayAsync()
        }
        .map_err(|e| format!("Failed to request play/pause: {e}"))?;

        let ok = wait_for(operation.into_future(), "Failed to complete play/pause")?;
        if ok {
            Ok(())
        } else {
            Err("The active media session rejected play/pause.".to_string())
        }
    }

    fn next_track(&self) -> Result<(), String> {
        let operation = current_session()?
            .TrySkipNextAsync()
            .map_err(|e| format!("Failed to request next track: {e}"))?;
        let ok = wait_for(operation.into_future(), "Failed to complete next track")?;
        if ok {
            Ok(())
        } else {
            Err("The active media session rejected next track.".to_string())
        }
    }

    fn previous_track(&self) -> Result<(), String> {
        let operation = current_session()?
            .TrySkipPreviousAsync()
            .map_err(|e| format!("Failed to request previous track: {e}"))?;
        let ok = wait_for(operation.into_future(), "Failed to complete previous track")?;
        if ok {
            Ok(())
        } else {
            Err("The active media session rejected previous track.".to_string())
        }
    }
}

fn session_manager() -> Result<GlobalSystemMediaTransportControlsSessionManager, String> {
    wait_for(
        GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .map_err(|e| format!("Failed to request media session manager: {e}"))?
            .into_future(),
        "Failed to initialize media session manager",
    )
}

fn current_session() -> Result<GlobalSystemMediaTransportControlsSession, String> {
    session_manager()?
        .GetCurrentSession()
        .map_err(|_| "No active media session found.".to_string())
}

fn media_info_from_session(
    session: &GlobalSystemMediaTransportControlsSession,
) -> Result<MediaInfo, String> {
    let properties = wait_for(
        session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| format!("Failed to request media metadata: {e}"))?
            .into_future(),
        "Failed to read media metadata",
    )?;

    let title = properties
        .Title()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|_| "Unknown title".to_string());
    let artist = properties
        .Artist()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|_| "Unknown artist".to_string());
    let source_app = session
        .SourceAppUserModelId()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|_| "Unknown app".to_string());

    Ok(MediaInfo {
        title,
        artist,
        source_app,
        thumbnail: None,
        is_playing: is_session_playing(session)?,
    })
}

fn is_session_playing(session: &GlobalSystemMediaTransportControlsSession) -> Result<bool, String> {
    let status = session
        .GetPlaybackInfo()
        .map_err(|e| format!("Failed to get media playback info: {e}"))?
        .PlaybackStatus()
        .map_err(|e| format!("Failed to get media playback status: {e}"))?;

    Ok(status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
}

fn wait_for<T, F>(future: F, context: &str) -> Result<T, String>
where
    F: Future<Output = windows::core::Result<T>>,
{
    pollster::block_on(future).map_err(|e| format!("{context}: {e}"))
}
