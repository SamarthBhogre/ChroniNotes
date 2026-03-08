fn main() {
    // Load ../.env (project root) so Spotify config is available as
    // compile-time environment variables via env!() in Rust source.
    // The .env file sits at the repo root, one level above src-tauri/.
    let env_path = std::path::Path::new("../.env");
    if env_path.exists() {
        for item in dotenvy::from_path_iter(env_path).expect("Failed to read .env") {
            let (key, value) = item.expect("Invalid .env entry");
            // Forward each variable so `env!("SPOTIFY_CLIENT_ID")` etc. work
            // in the Rust source without any runtime file parsing.
            println!("cargo:rustc-env={key}={value}");
        }
    } else {
        // No .env file — fall back to OS environment variables (CI).
        // Forward each required variable if it exists in the env.
        for key in &["SPOTIFY_CLIENT_ID", "SPOTIFY_REDIRECT_URI"] {
            if let Ok(value) = std::env::var(key) {
                println!("cargo:rustc-env={key}={value}");
            }
            // If neither .env nor OS env has the var, env!() in spotify.rs
            // will produce a compile-time error with a clear message.
        }
    }

    // Re-run build.rs if .env appears / changes / is deleted
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
