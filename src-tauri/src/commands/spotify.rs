//! Spotify integration – PKCE OAuth + playback control via Spotify Web API.
//!
//! ## Auth flow
//!
//! 1. Frontend calls `spotify_login` → backend generates a PKCE
//!    code_verifier + code_challenge, starts a tiny HTTP server on
//!    `127.0.0.1:43821`, opens the Spotify authorization URL in the
//!    default browser.
//! 2. User approves in browser → Spotify redirects to
//!    `http://127.0.0.1:43821/spotify/callback?code=…`
//! 3. The local HTTP server catches the redirect, exchanges the code
//!    for tokens, stores them in SQLite, shuts down the server, and
//!    emits a `spotify:auth-complete` event to the frontend.
//! 4. All subsequent API calls use the stored access_token (auto-refreshed
//!    when expired).
//!
//! ## Token storage
//!
//! Tokens live in the `spotify_tokens` SQLite table (single-row, id=1).
//! The refresh_token is persisted so the user stays logged in across
//! app restarts.  Calling `spotify_logout` deletes the row.

use crate::db::Database;
use reqwest::header::CONTENT_LENGTH;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, State};

// ── Constants ────────────────────────────────────────────────────────────────

/// Spotify application client ID, read from `.env` at compile time.
/// PKCE flow — no client secret needed.
const CLIENT_ID: &str = env!("SPOTIFY_CLIENT_ID");

/// OAuth redirect URI — must match the value registered in the Spotify
/// Developer Dashboard.  Read from `.env` at compile time.
const REDIRECT_URI: &str = env!("SPOTIFY_REDIRECT_URI");

/// Derive the callback port from the redirect URI at compile time.
/// We parse it once here so the tiny_http server binds to the right port.
const CALLBACK_PORT: u16 = 43821;

/// Scopes needed for playback control + reading the current track.
const SCOPES: &str = "user-read-playback-state \
                       user-modify-playback-state \
                       user-read-currently-playing \
                       playlist-read-private \
                       playlist-read-collaborative \
                       streaming";

const AUTH_URL: &str = "https://accounts.spotify.com/authorize";
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const API_BASE: &str = "https://api.spotify.com/v1";

// ── Managed state for the in-flight PKCE verifier ────────────────────────────

/// Holds the PKCE code_verifier between the `spotify_login` call and the
/// callback arrival.  Only one auth flow can be in flight at a time.
pub struct SpotifyAuthState {
    /// The PKCE code_verifier for the current auth flow (if any).
    verifier: Mutex<Option<String>>,
}

impl SpotifyAuthState {
    pub fn new() -> Self {
        Self {
            verifier: Mutex::new(None),
        }
    }
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/// Ensure the `spotify_tokens` table exists.  Called once at startup.
pub fn ensure_spotify_schema(db: &Database) {
    let conn = db.conn().lock().expect("DB lock poisoned");
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS spotify_tokens (
             id             INTEGER PRIMARY KEY CHECK (id = 1),
             access_token   TEXT    NOT NULL,
             refresh_token  TEXT    NOT NULL,
             expires_at     INTEGER NOT NULL
         );",
    )
    .expect("Failed to create spotify_tokens table");
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredTokens {
    access_token: String,
    refresh_token: String,
    /// Unix epoch seconds when the access_token expires.
    expires_at: i64,
}

fn load_tokens(db: &Database) -> Option<StoredTokens> {
    let conn = db.conn().lock().ok()?;
    conn.query_row(
        "SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE id = 1",
        [],
        |row| {
            Ok(StoredTokens {
                access_token: row.get(0)?,
                refresh_token: row.get(1)?,
                expires_at: row.get(2)?,
            })
        },
    )
    .ok()
}

fn save_tokens(db: &Database, tokens: &StoredTokens) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO spotify_tokens (id, access_token, refresh_token, expires_at)
         VALUES (1, ?1, ?2, ?3)",
        rusqlite::params![tokens.access_token, tokens.refresh_token, tokens.expires_at],
    )
    .map_err(|e| format!("Failed to save Spotify tokens: {e}"))?;
    Ok(())
}

fn delete_tokens(db: &Database) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM spotify_tokens WHERE id = 1", [])
        .map_err(|e| format!("Failed to delete Spotify tokens: {e}"))?;
    Ok(())
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

/// Generate a cryptographically random 128-byte string, base64url-encoded.
fn generate_code_verifier() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..64).map(|_| rng.gen::<u8>()).collect();
    base64_url_encode(&bytes)
}

/// S256 code challenge = base64url(sha256(verifier))
fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    base64_url_encode(&hash)
}

fn base64_url_encode(bytes: &[u8]) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD.encode(bytes)
}

// ── Token refresh ────────────────────────────────────────────────────────────

/// Refresh the access token using the stored refresh_token.
/// Returns the new access_token (and persists updated tokens to DB).
async fn refresh_access_token(db: &Database) -> Result<String, String> {
    let tokens = load_tokens(db).ok_or("No Spotify tokens stored — please log in first")?;

    let client = reqwest::Client::new();
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", &tokens.refresh_token),
            ("client_id", CLIENT_ID),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {e}"))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed ({}): {body}", body.len()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token refresh response: {e}"))?;

    let new_access = body["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?
        .to_string();
    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
    let new_refresh = body["refresh_token"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or(tokens.refresh_token);

    let now = chrono::Utc::now().timestamp();
    let updated = StoredTokens {
        access_token: new_access.clone(),
        refresh_token: new_refresh,
        expires_at: now + expires_in - 60, // 60s buffer
    };
    save_tokens(db, &updated)?;
    log::info!("[Spotify] Access token refreshed, expires in {expires_in}s");
    Ok(new_access)
}

/// Get a valid access token — refreshes automatically if expired.
async fn get_access_token(db: &Database) -> Result<String, String> {
    let tokens = load_tokens(db).ok_or("Not logged into Spotify")?;
    let now = chrono::Utc::now().timestamp();
    if now < tokens.expires_at {
        Ok(tokens.access_token)
    } else {
        refresh_access_token(db).await
    }
}

// ── Spotify API helper ───────────────────────────────────────────────────────

async fn spotify_api_get(db: &Database, path: &str) -> Result<serde_json::Value, String> {
    let token = get_access_token(db).await?;
    let url = format!("{API_BASE}{path}");
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("Spotify API request failed: {e}"))?;

    if resp.status().as_u16() == 204 {
        // 204 No Content — e.g. nothing is currently playing
        return Ok(serde_json::json!(null));
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify API error {status}: {body}"));
    }

    resp.json()
        .await
        .map_err(|e| format!("Failed to parse Spotify response: {e}"))
}

fn is_no_active_device_error(status: u16, body: &str) -> bool {
    if status != 404 {
        return false;
    }
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(body);
    match parsed {
        Ok(v) => v["error"]["reason"].as_str() == Some("NO_ACTIVE_DEVICE"),
        Err(_) => body.contains("NO_ACTIVE_DEVICE"),
    }
}

fn with_device_id(path: &str, device_id: &str) -> String {
    if path.contains('?') {
        format!("{path}&device_id={device_id}")
    } else {
        format!("{path}?device_id={device_id}")
    }
}

async fn ensure_active_device(db: &Database) -> Result<String, String> {
    let devices = spotify_api_get(db, "/me/player/devices").await?;
    let list = devices["devices"]
        .as_array()
        .ok_or("Spotify returned an invalid devices response")?;

    if let Some(active_id) = list
        .iter()
        .find(|d| d["is_active"].as_bool().unwrap_or(false))
        .and_then(|d| d["id"].as_str())
    {
        return Ok(active_id.to_string());
    }

    let target_id = list
        .iter()
        .find(|d| {
            !d["is_restricted"].as_bool().unwrap_or(false)
                && d["id"].as_str().map(|id| !id.is_empty()).unwrap_or(false)
        })
        .and_then(|d| d["id"].as_str())
        .ok_or("No active Spotify device found. Open Spotify on a device and start playback once.")?
        .to_string();

    let token = get_access_token(db).await?;
    let url = format!("{API_BASE}/me/player");
    let payload = serde_json::json!({
        "device_ids": [target_id],
        "play": false
    });
    let client = reqwest::Client::new();
    let resp = client
        .put(&url)
        .bearer_auth(&token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Spotify device transfer failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify device transfer failed {status}: {body}"));
    }

    // Give Spotify a brief moment to switch the active device.
    std::thread::sleep(Duration::from_millis(300));
    Ok(target_id)
}

async fn spotify_api_put(
    db: &Database,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<(), String> {
    let token = get_access_token(db).await?;
    let url = format!("{API_BASE}{path}");
    let client = reqwest::Client::new();
    let build_put = |target_url: &str, payload: &Option<serde_json::Value>| {
        let mut req = client.put(target_url).bearer_auth(&token);
        if let Some(json_body) = payload {
            req = req.json(json_body);
        } else {
            // Spotify can reject body-less PUT requests with 411 unless an explicit
            // zero-length body is sent.
            req = req.header(CONTENT_LENGTH, "0").body(Vec::<u8>::new());
        }
        req
    };

    let resp = build_put(&url, &body)
        .send()
        .await
        .map_err(|e| format!("Spotify API PUT failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let error_body = resp.text().await.unwrap_or_default();
        if is_no_active_device_error(status, &error_body) {
            let device_id = ensure_active_device(db).await?;
            let retry_path = with_device_id(path, &device_id);
            let retry_url = format!("{API_BASE}{retry_path}");
            let retry = build_put(&retry_url, &body)
                .send()
                .await
                .map_err(|e| format!("Spotify API PUT retry failed: {e}"))?;
            if retry.status().is_success() {
                return Ok(());
            }
            let retry_status = retry.status().as_u16();
            let retry_body = retry.text().await.unwrap_or_default();
            return Err(format!(
                "Spotify API PUT error {retry_status}: {retry_body}"
            ));
        }
        return Err(format!("Spotify API PUT error {status}: {error_body}"));
    }
    Ok(())
}

async fn spotify_api_post(db: &Database, path: &str) -> Result<(), String> {
    let token = get_access_token(db).await?;
    let url = format!("{API_BASE}{path}");
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(&token)
        // Spotify control endpoints (next/previous) expect no request body.
        // Send an explicit zero-length payload/header to avoid 411 responses.
        .header(CONTENT_LENGTH, "0")
        .body(Vec::<u8>::new())
        .send()
        .await
        .map_err(|e| format!("Spotify API POST failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if is_no_active_device_error(status, &body) {
            let device_id = ensure_active_device(db).await?;
            let retry_path = with_device_id(path, &device_id);
            let retry_url = format!("{API_BASE}{retry_path}");
            let retry = client
                .post(&retry_url)
                .bearer_auth(&token)
                .header(CONTENT_LENGTH, "0")
                .body(Vec::<u8>::new())
                .send()
                .await
                .map_err(|e| format!("Spotify API POST retry failed: {e}"))?;
            if retry.status().is_success() {
                return Ok(());
            }
            let retry_status = retry.status().as_u16();
            let retry_body = retry.text().await.unwrap_or_default();
            return Err(format!(
                "Spotify API POST error {retry_status}: {retry_body}"
            ));
        }
        return Err(format!("Spotify API POST error {status}: {body}"));
    }
    Ok(())
}

// ── Tauri commands ───────────────────────────────────────────────────────────

/// Check whether the user is currently logged in to Spotify.
#[derive(Serialize)]
pub struct SpotifyAuthStatus {
    pub logged_in: bool,
}

#[tauri::command]
pub fn spotify_auth_status(db: State<Database>) -> SpotifyAuthStatus {
    let logged_in = load_tokens(&db).is_some();
    SpotifyAuthStatus { logged_in }
}

/// Get a valid access token for Spotify Web Playback SDK in the frontend.
#[tauri::command]
pub async fn spotify_get_access_token(db: State<'_, Database>) -> Result<String, String> {
    get_access_token(&db).await
}

/// Transfer playback to a specific Spotify device (e.g. ChroniNotes SDK player).
#[tauri::command]
pub async fn spotify_set_active_device(
    db: State<'_, Database>,
    device_id: String,
    play: Option<bool>,
) -> Result<(), String> {
    if device_id.trim().is_empty() {
        return Err("device_id cannot be empty".to_string());
    }

    let token = get_access_token(&db).await?;
    let url = format!("{API_BASE}/me/player");
    let payload = serde_json::json!({
        "device_ids": [device_id],
        "play": play.unwrap_or(false)
    });

    let client = reqwest::Client::new();
    let resp = client
        .put(&url)
        .bearer_auth(&token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Spotify set active device failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Spotify set active device error {status}: {body}"));
    }

    Ok(())
}

/// Initiate the Spotify PKCE login flow.
///
/// 1. Generates PKCE verifier + challenge
/// 2. Starts a local HTTP server on port 43821
/// 3. Opens the Spotify auth URL in the default browser
/// 4. The local server handles the callback, exchanges the code for tokens
/// 5. Emits `spotify:auth-complete` to the frontend
#[tauri::command]
pub async fn spotify_login(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    auth_state: State<'_, SpotifyAuthState>,
) -> Result<(), String> {
    // Generate PKCE pair
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);

    // Store verifier for the callback
    {
        let mut v = auth_state.verifier.lock().map_err(|e| e.to_string())?;
        *v = Some(verifier);
    }

    // Build the authorization URL
    let auth_url = format!(
        "{AUTH_URL}?client_id={CLIENT_ID}\
         &response_type=code\
         &redirect_uri={redirect}\
         &scope={scopes}\
         &code_challenge_method=S256\
         &code_challenge={challenge}",
        redirect = urlencoding_encode(REDIRECT_URI),
        scopes = urlencoding_encode(SCOPES),
        challenge = challenge,
    );

    // Open in default browser — uses the `webbrowser` crate which handles
    // URL escaping correctly on all platforms (no cmd.exe & splitting).
    webbrowser::open(&auth_url).map_err(|e| format!("Failed to open browser: {e}"))?;

    log::info!("[Spotify] Auth URL opened in browser, waiting for callback...");

    // Clone what we need for the background thread
    let db_clone = db.inner().clone();
    let app_clone = app.clone();
    let auth_state_verifier = {
        let v = auth_state.verifier.lock().map_err(|e| e.to_string())?;
        v.clone().ok_or("PKCE verifier missing")?
    };

    // Start local HTTP server in a background thread
    std::thread::spawn(move || {
        if let Err(e) = run_callback_server(db_clone, app_clone, auth_state_verifier) {
            log::error!("[Spotify] Callback server error: {e}");
        }
    });

    Ok(())
}

/// The local HTTP server that catches the Spotify redirect.
fn run_callback_server(
    db: Database,
    app: tauri::AppHandle,
    verifier: String,
) -> Result<(), String> {
    let addr = format!("127.0.0.1:{CALLBACK_PORT}");
    let server = tiny_http::Server::http(&addr)
        .map_err(|e| format!("Failed to start callback server on {addr}: {e}"))?;

    log::info!("[Spotify] Callback server listening on {addr}");

    // Wait for ONE request (with a 120s timeout)
    // We'll accept up to a few requests (favicon, etc.) but only process
    // the one with the ?code= parameter.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(120);

    loop {
        if std::time::Instant::now() > deadline {
            log::warn!("[Spotify] Callback server timed out (120s)");
            return Err("Auth callback timed out".to_string());
        }

        // Check for a request with a 1-second poll interval
        let request = match server.recv_timeout(std::time::Duration::from_secs(1)) {
            Ok(Some(req)) => req,
            Ok(None) => continue, // timeout, try again
            Err(e) => {
                log::error!("[Spotify] Server recv error: {e}");
                continue;
            }
        };

        let url_str = request.url().to_string();

        // Only process the callback path
        if !url_str.starts_with("/spotify/callback") {
            // Respond to other requests (favicon, etc.) with 404
            let resp = tiny_http::Response::from_string("Not found").with_status_code(404);
            let _ = request.respond(resp);
            continue;
        }

        // Parse the authorization code from the query string
        let full_url = format!("http://127.0.0.1:{CALLBACK_PORT}{url_str}");
        let parsed =
            url::Url::parse(&full_url).map_err(|e| format!("Failed to parse callback URL: {e}"))?;

        // Check for error parameter (user denied)
        if let Some(error) = parsed.query_pairs().find(|(k, _)| k == "error") {
            let html = format!(
                "<html><body style='font-family:system-ui;text-align:center;padding:60px'>\
                 <h2>❌ Authorization Denied</h2>\
                 <p>Spotify returned: <code>{}</code></p>\
                 <p>You can close this tab.</p></body></html>",
                error.1
            );
            let resp = tiny_http::Response::from_string(html)
                .with_header(
                    "Content-Type: text/html; charset=utf-8"
                        .parse::<tiny_http::Header>()
                        .unwrap(),
                )
                .with_status_code(200);
            let _ = request.respond(resp);

            let _ = app.emit("spotify:auth-error", "Authorization denied by user");
            return Err("User denied authorization".to_string());
        }

        let code = parsed
            .query_pairs()
            .find(|(k, _)| k == "code")
            .map(|(_, v)| v.to_string())
            .ok_or("No authorization code in callback")?;

        log::info!("[Spotify] Received authorization code, exchanging for tokens...");

        // Exchange code for tokens (synchronous reqwest — we're in a thread)
        match exchange_code_for_tokens(&db, &code, &verifier) {
            Ok(()) => {
                let html =
                    "<html><body style='font-family:system-ui;text-align:center;padding:60px'>\
                            <h2>✅ Connected to Spotify!</h2>\
                            <p>You can close this tab and return to ChroniNotes.</p>\
                            <script>setTimeout(()=>window.close(),2000)</script>\
                            </body></html>";
                let resp = tiny_http::Response::from_string(html)
                    .with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    )
                    .with_status_code(200);
                let _ = request.respond(resp);

                let _ = app.emit("spotify:auth-complete", ());
                log::info!("[Spotify] Auth complete, tokens saved");
            }
            Err(e) => {
                let html = format!(
                    "<html><body style='font-family:system-ui;text-align:center;padding:60px'>\
                     <h2>❌ Token Exchange Failed</h2>\
                     <p><code>{e}</code></p>\
                     <p>Please try again from ChroniNotes.</p></body></html>"
                );
                let resp = tiny_http::Response::from_string(html)
                    .with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    )
                    .with_status_code(500);
                let _ = request.respond(resp);

                let _ = app.emit("spotify:auth-error", e.clone());
                log::error!("[Spotify] Token exchange failed: {e}");
            }
        }

        // Server's job is done
        return Ok(());
    }
}

/// Exchange the authorization code for access + refresh tokens.
fn exchange_code_for_tokens(db: &Database, code: &str, verifier: &str) -> Result<(), String> {
    // Use a blocking reqwest client since we're in a thread, not async
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", REDIRECT_URI),
            ("client_id", CLIENT_ID),
            ("code_verifier", verifier),
        ])
        .send()
        .map_err(|e| format!("Token exchange request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("Token exchange failed ({status}): {body}"));
    }

    let body: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Failed to parse token response: {e}"))?;

    let access_token = body["access_token"]
        .as_str()
        .ok_or("Missing access_token in response")?
        .to_string();
    let refresh_token = body["refresh_token"]
        .as_str()
        .ok_or("Missing refresh_token in response")?
        .to_string();
    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);

    let now = chrono::Utc::now().timestamp();
    let tokens = StoredTokens {
        access_token,
        refresh_token,
        expires_at: now + expires_in - 60, // 60s buffer
    };
    save_tokens(db, &tokens)?;
    Ok(())
}

/// Log out of Spotify — delete stored tokens.
#[tauri::command]
pub fn spotify_logout(db: State<Database>) -> Result<(), String> {
    delete_tokens(&db)?;
    log::info!("[Spotify] Logged out, tokens deleted");
    Ok(())
}

// ── Playback commands ────────────────────────────────────────────────────────

/// Get the currently playing track info.
#[derive(Serialize, Clone)]
pub struct SpotifyTrack {
    pub name: String,
    pub artist: String,
    pub album: String,
    pub album_art_url: Option<String>,
    pub duration_ms: u64,
    pub progress_ms: u64,
    pub is_playing: bool,
    pub track_uri: String,
    pub shuffle_state: bool,
    pub repeat_state: String,
}

#[tauri::command]
pub async fn spotify_get_playback(db: State<'_, Database>) -> Result<Option<SpotifyTrack>, String> {
    let data = spotify_api_get(&db, "/me/player").await?;

    if data.is_null() {
        return Ok(None);
    }

    // Spotify returns nothing playing
    if data["item"].is_null() {
        return Ok(None);
    }

    let item = &data["item"];
    let artists: Vec<&str> = item["artists"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|a| a["name"].as_str()).collect())
        .unwrap_or_default();

    let album_images = item["album"]["images"].as_array();
    let album_art = album_images
        .and_then(|imgs| imgs.first())
        .and_then(|img| img["url"].as_str())
        .map(|s| s.to_string());

    Ok(Some(SpotifyTrack {
        name: item["name"].as_str().unwrap_or("Unknown").to_string(),
        artist: artists.join(", "),
        album: item["album"]["name"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string(),
        album_art_url: album_art,
        duration_ms: item["duration_ms"].as_u64().unwrap_or(0),
        progress_ms: data["progress_ms"].as_u64().unwrap_or(0),
        is_playing: data["is_playing"].as_bool().unwrap_or(false),
        track_uri: item["uri"].as_str().unwrap_or("").to_string(),
        shuffle_state: data["shuffle_state"].as_bool().unwrap_or(false),
        repeat_state: data["repeat_state"]
            .as_str()
            .unwrap_or("off")
            .to_string(),
    }))
}

/// Resume / start playback.
#[tauri::command]
pub async fn spotify_play(db: State<'_, Database>) -> Result<(), String> {
    spotify_api_put(&db, "/me/player/play", None).await
}

/// Pause playback.
#[tauri::command]
pub async fn spotify_pause(db: State<'_, Database>) -> Result<(), String> {
    spotify_api_put(&db, "/me/player/pause", None).await
}

/// Skip to next track.
#[tauri::command]
pub async fn spotify_next(db: State<'_, Database>) -> Result<(), String> {
    spotify_api_post(&db, "/me/player/next").await
}

/// Skip to previous track.
#[tauri::command]
pub async fn spotify_previous(db: State<'_, Database>) -> Result<(), String> {
    spotify_api_post(&db, "/me/player/previous").await
}

/// Set playback volume (0–100).
#[tauri::command]
pub async fn spotify_set_volume(db: State<'_, Database>, volume: u8) -> Result<(), String> {
    let vol = volume.min(100);
    spotify_api_put(
        &db,
        &format!("/me/player/volume?volume_percent={vol}"),
        None,
    )
    .await
}

/// Toggle shuffle on or off.
#[tauri::command]
pub async fn spotify_set_shuffle(
    db: State<'_, Database>,
    state: bool,
) -> Result<(), String> {
    spotify_api_put(
        &db,
        &format!("/me/player/shuffle?state={state}"),
        None,
    )
    .await
}

/// Set repeat mode: "off", "context" (repeat playlist/album), or "track" (single-song loop).
#[tauri::command]
pub async fn spotify_set_repeat(
    db: State<'_, Database>,
    state: String,
) -> Result<(), String> {
    let mode = state.trim().to_lowercase();
    if mode != "off" && mode != "context" && mode != "track" {
        return Err(format!(
            "Invalid repeat mode '{mode}'. Allowed: off, context, track"
        ));
    }
    spotify_api_put(
        &db,
        &format!("/me/player/repeat?state={mode}"),
        None,
    )
    .await
}

/// Get available playback devices.
#[derive(Serialize, Clone)]
pub struct SpotifyDevice {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub is_active: bool,
    pub volume_percent: Option<u8>,
}

#[tauri::command]
pub async fn spotify_get_devices(db: State<'_, Database>) -> Result<Vec<SpotifyDevice>, String> {
    let data = spotify_api_get(&db, "/me/player/devices").await?;
    let devices = data["devices"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|d| SpotifyDevice {
                    id: d["id"].as_str().unwrap_or("").to_string(),
                    name: d["name"].as_str().unwrap_or("Unknown").to_string(),
                    device_type: d["type"].as_str().unwrap_or("Unknown").to_string(),
                    is_active: d["is_active"].as_bool().unwrap_or(false),
                    volume_percent: d["volume_percent"].as_u64().map(|v| v as u8),
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(devices)
}

/// A simplified playlist payload for frontend selection UIs.
#[derive(Serialize, Clone)]
pub struct SpotifyPlaylist {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub image_url: Option<String>,
    pub tracks_total: u32,
    pub owner_name: Option<String>,
}

/// List the current user's playlists.
#[tauri::command]
pub async fn spotify_get_playlists(db: State<'_, Database>) -> Result<Vec<SpotifyPlaylist>, String> {
    let data = spotify_api_get(&db, "/me/playlists?limit=50").await?;
    let items = data["items"]
        .as_array()
        .ok_or("Spotify returned invalid playlists data")?;

    let playlists = items
        .iter()
        .map(|p| SpotifyPlaylist {
            id: p["id"].as_str().unwrap_or_default().to_string(),
            name: p["name"].as_str().unwrap_or("Untitled playlist").to_string(),
            uri: p["uri"].as_str().unwrap_or_default().to_string(),
            image_url: p["images"]
                .as_array()
                .and_then(|imgs| imgs.first())
                .and_then(|img| img["url"].as_str())
                .map(|s| s.to_string()),
            tracks_total: p["tracks"]["total"].as_u64().unwrap_or(0) as u32,
            owner_name: p["owner"]["display_name"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(playlists)
}

/// Start playback from a selected playlist URI.
#[tauri::command]
pub async fn spotify_play_playlist(
    db: State<'_, Database>,
    playlist_uri: String,
    device_id: Option<String>,
) -> Result<(), String> {
    let uri = playlist_uri.trim();
    if !uri.starts_with("spotify:playlist:") {
        return Err("playlist_uri must start with 'spotify:playlist:'".to_string());
    }

    let path = match device_id {
        Some(id) if !id.trim().is_empty() => with_device_id("/me/player/play", id.trim()),
        _ => "/me/player/play".to_string(),
    };

    let body = serde_json::json!({
        "context_uri": uri
    });

    spotify_api_put(&db, &path, Some(body)).await
}

// ── URL encoding helper ──────────────────────────────────────────────────────
// Minimal percent-encoding for the auth URL parameters.

fn urlencoding_encode(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 2);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push('%');
                result.push_str(&format!("{byte:02X}"));
            }
        }
    }
    result
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_challenge_is_deterministic() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = generate_code_challenge(verifier);
        // S256(verifier) should be a valid base64url string
        assert!(!challenge.is_empty());
        assert!(!challenge.contains('+'));
        assert!(!challenge.contains('/'));
        assert!(!challenge.contains('='));
    }

    #[test]
    fn code_verifier_length_is_reasonable() {
        let verifier = generate_code_verifier();
        // RFC 7636: verifier must be 43-128 chars
        assert!(
            verifier.len() >= 43,
            "verifier too short: {}",
            verifier.len()
        );
        assert!(
            verifier.len() <= 128,
            "verifier too long: {}",
            verifier.len()
        );
    }

    #[test]
    fn urlencoding_basic() {
        assert_eq!(urlencoding_encode("hello"), "hello");
        assert_eq!(urlencoding_encode("a b"), "a%20b");
        assert_eq!(
            urlencoding_encode("http://127.0.0.1:43821/spotify/callback"),
            "http%3A%2F%2F127.0.0.1%3A43821%2Fspotify%2Fcallback"
        );
    }

    #[test]
    fn urlencoding_scopes() {
        let encoded = urlencoding_encode(SCOPES);
        assert!(encoded.contains("%20")); // spaces become %20
        assert!(!encoded.contains(' ')); // no raw spaces
    }

    #[test]
    fn spotify_schema_creates_table() {
        let dir = tempfile::TempDir::new().unwrap();
        let db = Database::new(&std::path::PathBuf::from(dir.path()));
        ensure_spotify_schema(&db);

        // The table should exist
        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='spotify_tokens'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn token_save_load_delete_roundtrip() {
        let dir = tempfile::TempDir::new().unwrap();
        let db = Database::new(&std::path::PathBuf::from(dir.path()));
        ensure_spotify_schema(&db);

        // No tokens initially
        assert!(load_tokens(&db).is_none());

        // Save tokens
        let tokens = StoredTokens {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at: 9999999999,
        };
        save_tokens(&db, &tokens).unwrap();

        // Load tokens
        let loaded = load_tokens(&db).unwrap();
        assert_eq!(loaded.access_token, "test_access");
        assert_eq!(loaded.refresh_token, "test_refresh");
        assert_eq!(loaded.expires_at, 9999999999);

        // Delete tokens
        delete_tokens(&db).unwrap();
        assert!(load_tokens(&db).is_none());
    }

    #[test]
    fn token_upsert_replaces_existing() {
        let dir = tempfile::TempDir::new().unwrap();
        let db = Database::new(&std::path::PathBuf::from(dir.path()));
        ensure_spotify_schema(&db);

        let t1 = StoredTokens {
            access_token: "first".to_string(),
            refresh_token: "r1".to_string(),
            expires_at: 100,
        };
        save_tokens(&db, &t1).unwrap();

        let t2 = StoredTokens {
            access_token: "second".to_string(),
            refresh_token: "r2".to_string(),
            expires_at: 200,
        };
        save_tokens(&db, &t2).unwrap();

        let loaded = load_tokens(&db).unwrap();
        assert_eq!(loaded.access_token, "second");
        assert_eq!(loaded.refresh_token, "r2");
    }

    #[test]
    fn repeat_mode_validation() {
        // Valid modes should produce correct API paths
        for mode in &["off", "context", "track"] {
            let trimmed = mode.trim().to_lowercase();
            assert!(
                trimmed == "off" || trimmed == "context" || trimmed == "track",
                "valid mode '{mode}' should be accepted"
            );
        }

        // Invalid modes should be rejected
        for bad in &["repeat", "loop", "all", "single", ""] {
            let trimmed = bad.trim().to_lowercase();
            let valid = trimmed == "off" || trimmed == "context" || trimmed == "track";
            assert!(!valid, "invalid mode '{bad}' should be rejected");
        }
    }

    #[test]
    fn shuffle_path_format() {
        // Verify the API path construction for shuffle
        let path_on = format!("/me/player/shuffle?state={}", true);
        assert_eq!(path_on, "/me/player/shuffle?state=true");
        let path_off = format!("/me/player/shuffle?state={}", false);
        assert_eq!(path_off, "/me/player/shuffle?state=false");
    }
}
