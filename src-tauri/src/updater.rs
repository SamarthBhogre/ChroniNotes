use serde::{Deserialize, Serialize};
use std::io::Write;
use tauri::{AppHandle, Emitter};

/// GitHub API response for a single release
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

/// What we return to the frontend
#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub release_notes: String,
    pub download_url: String,
    pub installer_name: String,
    pub installer_size: u64,
    pub release_url: String,
    pub update_available: bool,
}

/// Download progress events
#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

const GITHUB_REPO: &str = "SamarthBhogre/ChroniNotes";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Parse a version string like "2.0.0" or "v2.0.0" into (major, minor, patch)
fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let v = v.trim().strip_prefix('v').unwrap_or(v);
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

/// Returns true if `latest` is newer than `current`
fn is_newer(current: &str, latest: &str) -> bool {
    match (parse_version(current), parse_version(latest)) {
        (Some(c), Some(l)) => l > c,
        _ => false,
    }
}

/// Check GitHub for the latest release and compare versions
#[tauri::command]
pub async fn updater_check() -> Result<UpdateInfo, String> {
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let client = reqwest::Client::builder()
        .user_agent("ChroniNotes-Updater")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned status {}",
            response.status()
        ));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release JSON: {}", e))?;

    // Find the NSIS .exe installer asset
    let installer_asset = release
        .assets
        .iter()
        .find(|a| a.name.ends_with(".exe") && !a.name.contains("debug"))
        .or_else(|| {
            // Fallback: any .exe
            release.assets.iter().find(|a| a.name.ends_with(".exe"))
        });

    let (download_url, installer_name, installer_size) = match installer_asset {
        Some(asset) => (
            asset.browser_download_url.clone(),
            asset.name.clone(),
            asset.size,
        ),
        None => {
            // No installer found — still return info but no download
            ("".to_string(), "".to_string(), 0)
        }
    };

    let latest_version = release.tag_name.clone();
    let update_available = is_newer(CURRENT_VERSION, &latest_version);

    Ok(UpdateInfo {
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_version.clone(),
        release_name: release.name.unwrap_or_else(|| latest_version.clone()),
        release_notes: release.body.unwrap_or_default(),
        download_url,
        installer_name,
        installer_size,
        release_url: release.html_url,
        update_available,
    })
}

/// Download the installer and launch it, then close the app
#[tauri::command]
pub async fn updater_download_and_install(
    app: AppHandle,
    download_url: String,
    installer_name: String,
) -> Result<(), String> {
    if download_url.is_empty() || installer_name.is_empty() {
        return Err("No installer URL provided".to_string());
    }

    log::info!(
        "[Updater] Starting download: {} → {}",
        download_url,
        installer_name
    );

    let client = reqwest::Client::builder()
        .user_agent("ChroniNotes-Updater")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    // Save to temp directory
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join(&installer_name);

    log::info!("[Updater] Saving to: {:?}", installer_path);

    let mut file = std::fs::File::create(&installer_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    // Stream download with progress
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    let downloaded = bytes.len() as u64;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write installer: {}", e))?;

    drop(file);

    // Emit final progress
    let _ = app.emit(
        "updater:progress",
        DownloadProgress {
            downloaded,
            total: total_size,
            percent: 100.0,
        },
    );

    log::info!(
        "[Updater] Download complete ({} bytes). Launching installer...",
        downloaded
    );

    // Launch the installer with elevated privileges (UAC prompt)
    // Using ShellExecuteW with "runas" verb so the user gets a UAC prompt
    // instead of requiring the entire app to run as administrator.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::ffi::OsStr;

        let operation: Vec<u16> = OsStr::new("runas").encode_wide().chain(std::iter::once(0)).collect();
        let file: Vec<u16> = OsStr::new(&installer_path).encode_wide().chain(std::iter::once(0)).collect();
        let parameters: Vec<u16> = OsStr::new("").encode_wide().chain(std::iter::once(0)).collect();
        let directory: Vec<u16> = OsStr::new(&temp_dir).encode_wide().chain(std::iter::once(0)).collect();

        let result = unsafe {
            windows_sys::Win32::UI::Shell::ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                file.as_ptr(),
                parameters.as_ptr(),
                directory.as_ptr(),
                windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
            )
        };

        // ShellExecuteW returns a value > 32 on success
        if (result as isize) <= 32 {
            return Err(format!(
                "Failed to launch installer with elevation (ShellExecute returned {})",
                result as isize
            ));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    log::info!("[Updater] Installer launched. Closing app...");

    // Close the app so the installer can update it
    // Small delay to let the frontend show the message
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(1500));
        std::process::exit(0);
    });

    Ok(())
}
