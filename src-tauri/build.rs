fn main() {
    // Load ../.env (project root) so Spotify config is available as compile-time
    // environment variables via env!() in Rust source.
    let env_path = std::path::Path::new("../.env");
    let mut env_file_values = std::collections::HashMap::<String, String>::new();

    if env_path.exists() {
        for item in dotenvy::from_path_iter(env_path).expect("Failed to read .env") {
            let (key, value) = item.expect("Invalid .env entry");
            env_file_values.insert(key, value);
        }
    }

    let required = ["SPOTIFY_CLIENT_ID", "SPOTIFY_REDIRECT_URI"];
    for key in required {
        let value = env_file_values
            .get(key)
            .cloned()
            .or_else(|| std::env::var(key).ok())
            .unwrap_or_default();

        let trimmed = value.trim();
        if trimmed.is_empty() {
            panic!(
                "{key} is missing/empty. Set it in ../.env or CI environment before building."
            );
        }

        if key == "SPOTIFY_CLIENT_ID" && trimmed.eq_ignore_ascii_case("your_spotify_client_id_here")
        {
            panic!("{key} still has placeholder value in .env. Set a real Spotify Client ID.");
        }

        println!("cargo:rustc-env={key}={trimmed}");
    }

    // Re-run build.rs if .env appears / changes / is deleted
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
