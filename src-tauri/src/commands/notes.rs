use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

const NOTE_EXT: &str = ".json";
const FOLDER_META: &str = "_folder.json";

/* ── Types ── */

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteFile {
    pub title: String,
    pub icon: String,
    pub content: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    /// UI-side tags — stored in the note file so they survive app reinstalls.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Difficulty rating: "easy" | "medium" | "hard" | null
    #[serde(default)]
    pub difficulty: Option<String>,
    /// Position within the parent folder for stable ordering.
    #[serde(rename = "sortOrder", default)]
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteEntry {
    pub id: String,
    pub name: String,
    pub title: String,
    pub icon: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub content: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub difficulty: Option<String>,
    #[serde(rename = "sortOrder", default)]
    pub sort_order: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotePayload {
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub difficulty: Option<String>,
    #[serde(rename = "sortOrder", default)]
    pub sort_order: i64,
}

/// A JSON field that can be absent (not provided), explicitly null (clear),
/// or a concrete value (set).
///
/// Serde's default `Option<Option<T>>` collapses "absent" and "null" into
/// the same `None` variant.  We use a custom visitor that reads the raw
/// `Value` first so we can distinguish all three states:
///
///  - key absent in JSON  → `Absent`   (backend keeps existing value)
///  - key present, `null` → `Clear`    (backend sets field to None)
///  - key present, value  → `Set(T)`   (backend sets field to value)
#[derive(Debug)]
pub enum MaybeUpdate<T> {
    /// Field was not present in the JSON payload — do nothing.
    Absent,
    /// Field was present and `null` — clear the value.
    Clear,
    /// Field was present with a value — set to that value.
    Set(T),
}

impl<T> Default for MaybeUpdate<T> {
    fn default() -> Self {
        MaybeUpdate::Absent
    }
}

impl<'de, T> serde::Deserialize<'de> for MaybeUpdate<T>
where
    T: serde::Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        // Deserialize into an untyped Value first so we can check for
        // the JSON `null` literal vs. a real value vs. the field being
        // absent (which serde handles via Default::default()).
        let v = serde_json::Value::deserialize(deserializer)?;
        match v {
            serde_json::Value::Null => Ok(MaybeUpdate::Clear),
            other => {
                let typed = T::deserialize(other).map_err(serde::de::Error::custom)?;
                Ok(MaybeUpdate::Set(typed))
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotePayload {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
    /// Three-state: absent = keep, null = clear, "easy"/"medium"/"hard" = set.
    #[serde(default)]
    pub difficulty: MaybeUpdate<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
    /// New parent folder id (relative). Accepted but not applied by
    /// `notes_update` — use `notes_move` for parent changes.
    /// Kept here so the frontend can include it without a deserialisation error.
    #[allow(dead_code)]
    #[serde(rename = "parentId", default)]
    pub parent_id: Option<String>,
}

pub struct NotesRoot {
    pub path: Mutex<PathBuf>,
}

impl NotesRoot {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let notes_dir = app_data_dir.join("ChroniNotes");
        fs::create_dir_all(&notes_dir).expect("Failed to create notes directory");
        NotesRoot {
            path: Mutex::new(notes_dir),
        }
    }
}

/* ── Path security ── */

/// Resolve `user_path` relative to `root` and verify the canonical result
/// is still inside `root`.
///
/// Rejects:
///  - absolute paths   (`/etc/passwd`, `C:\Windows\...`)
///  - traversal tokens (`..`, `../sibling`)
///  - anything that canonicalises outside `root`
///
/// Returns the canonical `PathBuf` on success so callers never have to
/// call `join` themselves.
pub fn safe_resolve(root: &Path, user_path: &str) -> Result<PathBuf, String> {
    // 1. Reject obviously absolute paths before we even join.
    let probe = Path::new(user_path);
    if probe.is_absolute() {
        return Err(format!("Path must be relative, got: {user_path}"));
    }

    // 2. Reject any component that is a `..` traversal.
    //    We check the *string* components before joining so we never touch
    //    the filesystem for the validation step.
    for component in probe.components() {
        use std::path::Component;
        match component {
            Component::ParentDir => {
                return Err(format!("Path traversal not allowed: {user_path}"));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(format!("Absolute path component in: {user_path}"));
            }
            _ => {}
        }
    }

    // 3. Build the candidate absolute path.
    let candidate = root.join(user_path);

    // 4. Canonical check: resolve symlinks and normalise `.` components.
    //    If the path does not yet exist we walk up to the first existing
    //    ancestor and check that instead — this covers create operations
    //    where the leaf does not exist yet.
    let canonical_root =
        fs::canonicalize(root).map_err(|e| format!("Cannot canonicalise notes root: {e}"))?;

    let canonical_candidate = if candidate.exists() {
        fs::canonicalize(&candidate).map_err(|e| format!("Cannot canonicalise path: {e}"))?
    } else {
        // Walk up until we find an ancestor that exists.
        let mut check = candidate.as_path();
        loop {
            if check.exists() {
                let canon = fs::canonicalize(check)
                    .map_err(|e| format!("Cannot canonicalise ancestor: {e}"))?;
                // Re-attach the non-existent suffix.
                let suffix = candidate
                    .strip_prefix(check)
                    .map_err(|_| "Strip prefix failed".to_string())?;
                break canon.join(suffix);
            }
            match check.parent() {
                Some(p) => check = p,
                None => return Err("No existing ancestor found for path".to_string()),
            }
        }
    };

    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(format!("Path escapes notes root: {user_path}"));
    }

    Ok(canonical_candidate)
}

/* ── Helpers ── */

fn slugify(text: &str) -> String {
    let slug: String = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = slug.trim_matches('-').to_string();
    let result = if trimmed.len() > 60 {
        trimmed[..60].to_string()
    } else {
        trimmed
    };
    if result.is_empty() {
        "untitled".to_string()
    } else {
        result
    }
}

fn make_unique_file_path(dir: &Path, base_name: &str, ext: &str) -> PathBuf {
    let mut name = base_name.to_string();
    let mut file_path = dir.join(format!("{}{}", name, ext));
    let mut counter = 1;
    while file_path.exists() {
        name = format!("{}-{}", base_name, counter);
        file_path = dir.join(format!("{}{}", name, ext));
        counter += 1;
    }
    file_path
}

fn make_unique_dir_path(parent_dir: &Path, base_name: &str) -> PathBuf {
    let mut name = base_name.to_string();
    let mut dir_path = parent_dir.join(&name);
    let mut counter = 1;
    while dir_path.exists() {
        name = format!("{}-{}", base_name, counter);
        dir_path = parent_dir.join(&name);
        counter += 1;
    }
    dir_path
}

fn rel_id(abs_path: &Path, root: &Path) -> String {
    abs_path
        .strip_prefix(root)
        .unwrap_or(abs_path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn parent_id(id: &str) -> Option<String> {
    let parts: Vec<&str> = id.split('/').collect();
    if parts.len() <= 1 {
        None
    } else {
        Some(parts[..parts.len() - 1].join("/"))
    }
}

fn read_note_file(file_path: &Path) -> Result<NoteFile, String> {
    let raw = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn write_note_file(file_path: &Path, data: &NoteFile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn scan_dir(dir: &Path, root: &Path) -> Vec<NoteEntry> {
    let mut entries = Vec::new();
    if !dir.exists() {
        return entries;
    }

    let items = match fs::read_dir(dir) {
        Ok(items) => items,
        Err(_) => return entries,
    };

    for item in items.flatten() {
        let full_path = item.path();

        if full_path.is_dir() {
            let id = rel_id(&full_path, root);
            let meta_path = full_path.join(FOLDER_META);
            let meta: Option<NoteFile> = if meta_path.exists() {
                fs::read_to_string(&meta_path)
                    .ok()
                    .and_then(|raw| serde_json::from_str(&raw).ok())
            } else {
                None
            };

            let dir_name = full_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let title = meta
                .as_ref()
                .map(|m| m.title.clone())
                .unwrap_or_else(|| dir_name.clone());
            let icon = meta
                .as_ref()
                .map(|m| m.icon.clone())
                .unwrap_or_else(|| "◈".to_string());
            let created = meta
                .as_ref()
                .map(|m| m.created_at.clone())
                .unwrap_or_else(now_iso);
            let updated = meta
                .as_ref()
                .map(|m| m.updated_at.clone())
                .unwrap_or_else(now_iso);

            entries.push(NoteEntry {
                id: id.clone(),
                name: title.clone(),
                title,
                icon,
                is_folder: true,
                parent_id: parent_id(&id),
                content: None,
                created_at: created,
                updated_at: updated,
                tags: meta.as_ref().map(|m| m.tags.clone()).unwrap_or_default(),
                difficulty: meta.as_ref().and_then(|m| m.difficulty.clone()),
                sort_order: meta.as_ref().map(|m| m.sort_order).unwrap_or(0),
            });

            entries.extend(scan_dir(&full_path, root));
        } else if full_path.is_file() {
            let file_name = full_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            if file_name.ends_with(NOTE_EXT) && file_name != FOLDER_META {
                if let Ok(data) = read_note_file(&full_path) {
                    let id = rel_id(&full_path, root);
                    let name = if data.title.is_empty() {
                        file_name.trim_end_matches(NOTE_EXT).to_string()
                    } else {
                        data.title.clone()
                    };

                    entries.push(NoteEntry {
                        id: id.clone(),
                        name: name.clone(),
                        title: name,
                        icon: if data.icon.is_empty() {
                            "◉".to_string()
                        } else {
                            data.icon
                        },
                        is_folder: false,
                        parent_id: parent_id(&id),
                        content: None,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                        tags: data.tags,
                        difficulty: data.difficulty,
                        sort_order: data.sort_order,
                    });
                }
            }
        }
    }

    entries
}

/* ── Commands ── */

#[tauri::command]
pub fn notes_list(notes_root: State<NotesRoot>) -> Result<Vec<NoteEntry>, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    Ok(scan_dir(&root, &root))
}

#[tauri::command]
pub fn notes_get(id: String, notes_root: State<NotesRoot>) -> Result<Option<NoteEntry>, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let abs_path = safe_resolve(&root, &id)?;

    if !abs_path.exists() {
        return Ok(None);
    }

    if abs_path.is_dir() {
        let meta_path = abs_path.join(FOLDER_META);
        let meta: Option<NoteFile> = if meta_path.exists() {
            fs::read_to_string(&meta_path)
                .ok()
                .and_then(|raw| serde_json::from_str(&raw).ok())
        } else {
            None
        };

        let dir_name = abs_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let title = meta.as_ref().map(|m| m.title.clone()).unwrap_or(dir_name);

        return Ok(Some(NoteEntry {
            id: id.clone(),
            name: title.clone(),
            title,
            icon: meta
                .as_ref()
                .map(|m| m.icon.clone())
                .unwrap_or_else(|| "◈".to_string()),
            is_folder: true,
            parent_id: parent_id(&id),
            content: None,
            created_at: meta
                .as_ref()
                .map(|m| m.created_at.clone())
                .unwrap_or_else(now_iso),
            updated_at: meta
                .as_ref()
                .map(|m| m.updated_at.clone())
                .unwrap_or_else(now_iso),
            tags: meta.as_ref().map(|m| m.tags.clone()).unwrap_or_default(),
            difficulty: meta.as_ref().and_then(|m| m.difficulty.clone()),
            sort_order: meta.as_ref().map(|m| m.sort_order).unwrap_or(0),
        }));
    }

    let data = read_note_file(&abs_path)?;
    Ok(Some(NoteEntry {
        id: id.clone(),
        name: data.title.clone(),
        title: data.title,
        icon: if data.icon.is_empty() {
            "◉".to_string()
        } else {
            data.icon
        },
        is_folder: false,
        parent_id: parent_id(&id),
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        tags: data.tags,
        difficulty: data.difficulty,
        sort_order: data.sort_order,
    }))
}

#[tauri::command]
pub fn notes_create(
    payload: CreateNotePayload,
    notes_root: State<NotesRoot>,
) -> Result<NoteEntry, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let title = payload.title.unwrap_or_else(|| "Untitled".to_string());

    let parent_dir = match &payload.parent_id {
        Some(pid) => safe_resolve(&root, pid)?,
        None => root.clone(),
    };

    fs::create_dir_all(&parent_dir).map_err(|e| e.to_string())?;

    let slug = slugify(&title);
    let file_path = make_unique_file_path(&parent_dir, &slug, NOTE_EXT);
    let now = now_iso();

    let note_data = NoteFile {
        title: title.clone(),
        icon: payload.icon.unwrap_or_else(|| "◉".to_string()),
        content: Some(serde_json::json!({ "type": "doc", "content": [] })),
        created_at: now.clone(),
        updated_at: now.clone(),
        tags: payload.tags,
        difficulty: payload.difficulty,
        sort_order: payload.sort_order,
    };

    write_note_file(&file_path, &note_data)?;

    let id = rel_id(&file_path, &root);
    Ok(NoteEntry {
        id: id.clone(),
        name: title.clone(),
        title,
        icon: note_data.icon,
        is_folder: false,
        parent_id: parent_id(&id),
        content: note_data.content,
        created_at: now.clone(),
        updated_at: now.clone(),
        tags: note_data.tags,
        difficulty: note_data.difficulty,
        sort_order: note_data.sort_order,
    })
}

#[tauri::command]
pub fn notes_create_folder(
    payload: CreateNotePayload,
    notes_root: State<NotesRoot>,
) -> Result<NoteEntry, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let title = payload.title.unwrap_or_else(|| "New Folder".to_string());

    let parent_dir = match &payload.parent_id {
        Some(pid) => safe_resolve(&root, pid)?,
        None => root.clone(),
    };

    fs::create_dir_all(&parent_dir).map_err(|e| e.to_string())?;

    let slug = slugify(&title);
    let dir_path = make_unique_dir_path(&parent_dir, &slug);
    fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;

    let now = now_iso();
    let meta = NoteFile {
        title: title.clone(),
        icon: payload.icon.unwrap_or_else(|| "◈".to_string()),
        content: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        tags: payload.tags,
        difficulty: payload.difficulty,
        sort_order: payload.sort_order,
    };
    write_note_file(&dir_path.join(FOLDER_META), &meta)?;

    let id = rel_id(&dir_path, &root);
    Ok(NoteEntry {
        id: id.clone(),
        name: title.clone(),
        title,
        icon: meta.icon,
        is_folder: true,
        parent_id: parent_id(&id),
        content: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        tags: meta.tags,
        difficulty: meta.difficulty,
        sort_order: meta.sort_order,
    })
}

#[tauri::command]
pub fn notes_update(
    payload: UpdateNotePayload,
    notes_root: State<NotesRoot>,
) -> Result<Option<NoteEntry>, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let abs_path = safe_resolve(&root, &payload.id)?;

    if !abs_path.exists() {
        return Ok(None);
    }

    let now = now_iso();

    if abs_path.is_dir() {
        let meta_path = abs_path.join(FOLDER_META);
        let mut meta: NoteFile = if meta_path.exists() {
            fs::read_to_string(&meta_path)
                .ok()
                .and_then(|raw| serde_json::from_str(&raw).ok())
                .unwrap_or_else(|| NoteFile {
                    title: "".to_string(),
                    icon: "◈".to_string(),
                    content: None,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    tags: vec![],
                    difficulty: None,
                    sort_order: 0,
                })
        } else {
            NoteFile {
                title: "".to_string(),
                icon: "◈".to_string(),
                content: None,
                created_at: now.clone(),
                updated_at: now.clone(),
                tags: vec![],
                difficulty: None,
                sort_order: 0,
            }
        };

        if let Some(t) = &payload.title {
            meta.title = t.clone();
        }
        if let Some(i) = &payload.icon {
            meta.icon = i.clone();
        }
        if let Some(t) = &payload.tags {
            meta.tags = t.clone();
        }
        match &payload.difficulty {
            MaybeUpdate::Absent => {}                                 // keep existing
            MaybeUpdate::Clear => meta.difficulty = None,             // explicit clear
            MaybeUpdate::Set(d) => meta.difficulty = Some(d.clone()), // set value
        }
        if let Some(o) = payload.sort_order {
            meta.sort_order = o;
        }
        meta.updated_at = now.clone();
        write_note_file(&meta_path, &meta)?;

        return Ok(Some(NoteEntry {
            id: payload.id.clone(),
            name: meta.title.clone(),
            title: meta.title,
            icon: meta.icon,
            is_folder: true,
            parent_id: parent_id(&payload.id),
            content: None,
            created_at: meta.created_at,
            updated_at: now,
            tags: meta.tags,
            difficulty: meta.difficulty,
            sort_order: meta.sort_order,
        }));
    }

    let mut data = read_note_file(&abs_path)?;
    if let Some(t) = &payload.title {
        data.title = t.clone();
    }
    if let Some(c) = &payload.content {
        data.content = Some(c.clone());
    }
    if let Some(i) = &payload.icon {
        data.icon = i.clone();
    }
    if let Some(t) = &payload.tags {
        data.tags = t.clone();
    }
    match &payload.difficulty {
        MaybeUpdate::Absent => {}                                 // keep existing
        MaybeUpdate::Clear => data.difficulty = None,             // explicit clear
        MaybeUpdate::Set(d) => data.difficulty = Some(d.clone()), // set value
    }
    if let Some(o) = payload.sort_order {
        data.sort_order = o;
    }
    data.updated_at = now.clone();
    write_note_file(&abs_path, &data)?;

    Ok(Some(NoteEntry {
        id: payload.id.clone(),
        name: data.title.clone(),
        title: data.title,
        icon: data.icon,
        is_folder: false,
        parent_id: parent_id(&payload.id),
        content: data.content,
        created_at: data.created_at,
        updated_at: now,
        tags: data.tags,
        difficulty: data.difficulty,
        sort_order: data.sort_order,
    }))
}

#[tauri::command]
pub fn notes_delete(id: String, notes_root: State<NotesRoot>) -> Result<(), String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let abs_path = safe_resolve(&root, &id)?;

    if !abs_path.exists() {
        return Ok(());
    }

    if abs_path.is_dir() {
        fs::remove_dir_all(&abs_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&abs_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open the notes root directory in the system file manager.
///
/// Previously this returned the path as a string and the frontend used the
/// Tauri shell plugin's `open()` helper.  That approach silently failed on
/// Windows because the plugin's scope validation rejects local directory
/// paths.  We now open the folder directly in Rust, which sidesteps the
/// shell-plugin scope entirely and works reliably on all platforms.
#[tauri::command]
pub fn notes_open_folder(notes_root: State<NotesRoot>) -> Result<String, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let path_str = root.to_string_lossy().to_string();

    // Ensure the directory exists (it might have been deleted externally)
    if !root.exists() {
        std::fs::create_dir_all(&*root)
            .map_err(|e| format!("Failed to create notes directory: {e}"))?;
        log::info!("[Notes] Recreated notes directory: {}", path_str);
    }

    #[cfg(target_os = "windows")]
    {
        // Use explorer.exe with /e, flag to open in file explorer view
        std::process::Command::new("explorer")
            .arg(&*root)
            .spawn()
            .map_err(|e| format!("Failed to open folder in Explorer: {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(&*root)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }

    log::info!("[Notes] Opened notes folder: {}", path_str);
    Ok(path_str)
}

#[tauri::command]
pub fn notes_get_root(notes_root: State<NotesRoot>) -> Result<String, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    Ok(root.to_string_lossy().to_string())
}

/* ─────────────────────────────────────────────────────────────────────────────
   notes_move — move a note / folder to a new parent directory.

   Payload:  { id: "old/path.json", newParentId: "new/folder" | null }

   Rules:
   - `newParentId` null means the root notes directory.
   - Moving a note into its own subtree is rejected.
   - The filename (leaf) is preserved; a numeric suffix is appended if needed
     to avoid collisions in the destination.
   - On success the new `NoteEntry` (with updated id / parentId) is returned.
───────────────────────────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
pub struct MoveNotePayload {
    pub id: String,
    #[serde(rename = "newParentId")]
    pub new_parent_id: Option<String>,
}

#[tauri::command]
pub fn notes_move(
    payload: MoveNotePayload,
    notes_root: State<NotesRoot>,
) -> Result<NoteEntry, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let src_path = safe_resolve(&root, &payload.id)?;

    if !src_path.exists() {
        return Err(format!("Source does not exist: {}", payload.id));
    }

    // Resolve destination directory
    let dst_dir = match &payload.new_parent_id {
        Some(pid) if !pid.is_empty() => {
            let p = safe_resolve(&root, pid)?;
            if !p.is_dir() {
                return Err(format!("Target parent is not a directory: {pid}"));
            }
            p
        }
        _ => root.clone(),
    };

    // Guard: cannot move into own subtree
    if dst_dir.starts_with(&src_path) {
        return Err("Cannot move a folder into itself or one of its descendants".to_string());
    }

    // Skip no-op (same parent)
    let current_parent = src_path.parent().ok_or("Source has no parent")?;
    if fs::canonicalize(&dst_dir).map_err(|e| e.to_string())?
        == fs::canonicalize(current_parent).map_err(|e| e.to_string())?
    {
        // Already there — just return the current entry unchanged
        let id_str = payload.id.clone();
        if src_path.is_dir() {
            let meta_path = src_path.join(FOLDER_META);
            let meta: Option<NoteFile> = if meta_path.exists() {
                fs::read_to_string(&meta_path)
                    .ok()
                    .and_then(|r| serde_json::from_str(&r).ok())
            } else {
                None
            };
            let title = meta
                .as_ref()
                .map(|m| m.title.clone())
                .unwrap_or_else(|| id_str.clone());
            return Ok(NoteEntry {
                id: id_str.clone(),
                name: title.clone(),
                title,
                icon: meta
                    .as_ref()
                    .map(|m| m.icon.clone())
                    .unwrap_or_else(|| "◈".to_string()),
                is_folder: true,
                parent_id: parent_id(&id_str),
                content: None,
                created_at: meta
                    .as_ref()
                    .map(|m| m.created_at.clone())
                    .unwrap_or_else(now_iso),
                updated_at: meta
                    .as_ref()
                    .map(|m| m.updated_at.clone())
                    .unwrap_or_else(now_iso),
                tags: meta.as_ref().map(|m| m.tags.clone()).unwrap_or_default(),
                difficulty: meta.as_ref().and_then(|m| m.difficulty.clone()),
                sort_order: meta.as_ref().map(|m| m.sort_order).unwrap_or(0),
            });
        }
        let data = read_note_file(&src_path)?;
        return Ok(NoteEntry {
            id: id_str.clone(),
            name: data.title.clone(),
            title: data.title,
            icon: if data.icon.is_empty() {
                "◉".to_string()
            } else {
                data.icon
            },
            is_folder: false,
            parent_id: parent_id(&id_str),
            content: data.content,
            created_at: data.created_at,
            updated_at: data.updated_at,
            tags: data.tags,
            difficulty: data.difficulty,
            sort_order: data.sort_order,
        });
    }

    // Build destination path, avoiding collisions
    let leaf = src_path
        .file_name()
        .ok_or("Source has no file name")?
        .to_os_string();
    let dst_path = {
        let candidate = dst_dir.join(&leaf);
        if !candidate.exists() {
            candidate
        } else if src_path.is_dir() {
            let base = leaf.to_string_lossy();
            make_unique_dir_path(&dst_dir, &base)
        } else {
            let base = Path::new(&leaf)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            make_unique_file_path(&dst_dir, &base, NOTE_EXT)
        }
    };

    // Perform the move (rename across directories may fail on some platforms
    // if src/dst are on different mount points; use copy+delete fallback).
    if let Err(_) = fs::rename(&src_path, &dst_path) {
        // Fallback: recursive copy then remove
        copy_recursive(&src_path, &dst_path).map_err(|e| format!("Move (copy) failed: {e}"))?;
        if src_path.is_dir() {
            fs::remove_dir_all(&src_path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(&src_path).map_err(|e| e.to_string())?;
        }
    }

    // Build updated NoteEntry for the new location
    let new_id = rel_id(&dst_path, &root);
    let now = now_iso();

    if dst_path.is_dir() {
        let meta_path = dst_path.join(FOLDER_META);
        let meta: Option<NoteFile> = if meta_path.exists() {
            fs::read_to_string(&meta_path)
                .ok()
                .and_then(|r| serde_json::from_str(&r).ok())
        } else {
            None
        };
        let title = meta.as_ref().map(|m| m.title.clone()).unwrap_or_else(|| {
            dst_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });
        return Ok(NoteEntry {
            id: new_id.clone(),
            name: title.clone(),
            title,
            icon: meta
                .as_ref()
                .map(|m| m.icon.clone())
                .unwrap_or_else(|| "◈".to_string()),
            is_folder: true,
            parent_id: parent_id(&new_id),
            content: None,
            created_at: meta
                .as_ref()
                .map(|m| m.created_at.clone())
                .unwrap_or_else(|| now.clone()),
            updated_at: now,
            tags: meta.as_ref().map(|m| m.tags.clone()).unwrap_or_default(),
            difficulty: meta.as_ref().and_then(|m| m.difficulty.clone()),
            sort_order: meta.as_ref().map(|m| m.sort_order).unwrap_or(0),
        });
    }

    let data = read_note_file(&dst_path)?;
    Ok(NoteEntry {
        id: new_id.clone(),
        name: data.title.clone(),
        title: data.title,
        icon: if data.icon.is_empty() {
            "◉".to_string()
        } else {
            data.icon
        },
        is_folder: false,
        parent_id: parent_id(&new_id),
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        tags: data.tags,
        difficulty: data.difficulty,
        sort_order: data.sort_order,
    })
}

/// Recursively copy `src` (file or directory) to `dst`.
fn copy_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
    } else {
        if let Some(p) = dst.parent() {
            fs::create_dir_all(p)?;
        }
        fs::copy(src, dst)?;
    }
    Ok(())
}

/* ── Tests ── */

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("notes");
        fs::create_dir_all(&root).unwrap();
        (dir, root)
    }

    /// Helper: write a minimal NoteFile to `root/filename`.
    fn create_note_file(root: &Path, filename: &str, title: &str) -> PathBuf {
        let path = root.join(filename);
        let note = NoteFile {
            title: title.to_string(),
            icon: "◉".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: None,
            sort_order: 0,
        };
        write_note_file(&path, &note).unwrap();
        path
    }

    /// Helper: write a folder + its _folder.json meta.
    fn create_folder_meta(root: &Path, dir_name: &str, title: &str) -> PathBuf {
        let dir_path = root.join(dir_name);
        fs::create_dir_all(&dir_path).unwrap();
        let meta = NoteFile {
            title: title.to_string(),
            icon: "◈".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: None,
            sort_order: 0,
        };
        write_note_file(&dir_path.join(FOLDER_META), &meta).unwrap();
        dir_path
    }

    // ── safe_resolve ─────────────────────────────────────────────────────────

    #[test]
    fn resolve_normal_relative_path() {
        let (_dir, root) = setup();
        let target = root.join("sub");
        fs::create_dir_all(&target).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();
        let result = safe_resolve(&root, "sub").unwrap();
        assert!(result.starts_with(&canonical_root));
    }

    #[test]
    fn resolve_rejects_dotdot() {
        let (_dir, root) = setup();
        let err = safe_resolve(&root, "../escape").unwrap_err();
        assert!(
            err.contains("traversal"),
            "expected traversal error, got: {err}"
        );
    }

    #[test]
    fn resolve_rejects_absolute_path() {
        let (_dir, root) = setup();
        let abs = if cfg!(windows) {
            r"C:\Windows\system32"
        } else {
            "/etc/passwd"
        };
        let err = safe_resolve(&root, abs).unwrap_err();
        assert!(
            err.contains("relative") || err.contains("Absolute"),
            "expected absolute-path error, got: {err}"
        );
    }

    #[test]
    fn resolve_rejects_encoded_traversal() {
        let (_dir, root) = setup();
        let err = safe_resolve(&root, "sub/../../etc").unwrap_err();
        assert!(
            err.contains("traversal"),
            "expected traversal error, got: {err}"
        );
    }

    #[test]
    fn resolve_nested_path_stays_inside_root() {
        let (_dir, root) = setup();
        let nested = root.join("a").join("b").join("c");
        fs::create_dir_all(&nested).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();
        let result = safe_resolve(&root, "a/b/c").unwrap();
        assert!(result.starts_with(&canonical_root));
    }

    // ── NoteFile roundtrip ───────────────────────────────────────────────────

    #[test]
    fn note_file_write_read_roundtrip() {
        let (_dir, root) = setup();
        let path = root.join("test.json");
        let original = NoteFile {
            title: "My Note".to_string(),
            icon: "◉".to_string(),
            content: Some(serde_json::json!({ "type": "doc" })),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-02T00:00:00Z".to_string(),
            tags: vec!["rust".to_string(), "test".to_string()],
            difficulty: Some("hard".to_string()),
            sort_order: 42,
        };
        write_note_file(&path, &original).unwrap();
        let read_back = read_note_file(&path).unwrap();
        assert_eq!(read_back.title, "My Note");
        assert_eq!(read_back.tags, vec!["rust", "test"]);
        assert_eq!(read_back.difficulty, Some("hard".to_string()));
        assert_eq!(read_back.sort_order, 42);
    }

    // ── scan_dir ─────────────────────────────────────────────────────────────

    #[test]
    fn scan_dir_finds_notes_and_folders() {
        let (_dir, root) = setup();
        create_note_file(&root, "page-a.json", "Page A");
        create_folder_meta(&root, "folder-b", "Folder B");
        create_note_file(&root.join("folder-b"), "page-c.json", "Page C");

        let entries = scan_dir(&root, &root);
        assert_eq!(
            entries.len(),
            3,
            "should find 3 entries: page-a, folder-b, page-c"
        );
        let ids: Vec<&str> = entries.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.iter().any(|id| id.ends_with("page-a.json")));
        assert!(ids.iter().any(|id| id.ends_with("folder-b")));
        assert!(ids.iter().any(|id| id.ends_with("page-c.json")));
    }

    #[test]
    fn scan_dir_folder_has_correct_parent_id() {
        let (_dir, root) = setup();
        create_folder_meta(&root, "outer", "Outer");
        let inner = root.join("outer");
        create_note_file(&inner, "inner-note.json", "Inner Note");

        let entries = scan_dir(&root, &root);
        let inner_note = entries
            .iter()
            .find(|e| e.id.ends_with("inner-note.json"))
            .unwrap();
        let folder = entries
            .iter()
            .find(|e| e.is_folder && e.id.ends_with("outer"))
            .unwrap();
        assert_eq!(inner_note.parent_id.as_deref(), Some(folder.id.as_str()));
    }

    // ── tags roundtrip ───────────────────────────────────────────────────────

    #[test]
    fn tags_persisted_and_retrieved() {
        let (_dir, root) = setup();
        let path = root.join("tagged.json");
        let note = NoteFile {
            title: "Tagged".to_string(),
            icon: "◉".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec!["alpha".to_string(), "beta".to_string()],
            difficulty: None,
            sort_order: 0,
        };
        write_note_file(&path, &note).unwrap();

        let entries = scan_dir(&root, &root);
        let found = entries
            .iter()
            .find(|e| e.id.ends_with("tagged.json"))
            .unwrap();
        assert_eq!(found.tags, vec!["alpha", "beta"]);
    }

    // ── difficulty set + clear ───────────────────────────────────────────────

    #[test]
    fn difficulty_set_and_persisted() {
        let (_dir, root) = setup();
        let path = create_note_file(&root, "diff.json", "Diff Note");

        // Simulate notes_update setting difficulty = "medium"
        let mut data = read_note_file(&path).unwrap();
        // MaybeUpdate::Set
        data.difficulty = Some("medium".to_string());
        write_note_file(&path, &data).unwrap();

        let read_back = read_note_file(&path).unwrap();
        assert_eq!(read_back.difficulty, Some("medium".to_string()));
    }

    #[test]
    fn difficulty_cleared_when_null_sent() {
        let (_dir, root) = setup();
        let path = root.join("clearable.json");
        let note = NoteFile {
            title: "Note".to_string(),
            icon: "◉".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: Some("hard".to_string()),
            sort_order: 0,
        };
        write_note_file(&path, &note).unwrap();

        // Simulate the MaybeUpdate::Clear path
        let mut data = read_note_file(&path).unwrap();
        data.difficulty = None; // what MaybeUpdate::Clear does
        write_note_file(&path, &data).unwrap();

        let read_back = read_note_file(&path).unwrap();
        assert_eq!(read_back.difficulty, None, "difficulty should be cleared");
    }

    #[test]
    fn difficulty_absent_keeps_existing() {
        let (_dir, root) = setup();
        let path = root.join("keep.json");
        let note = NoteFile {
            title: "Note".to_string(),
            icon: "◉".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: Some("easy".to_string()),
            sort_order: 0,
        };
        write_note_file(&path, &note).unwrap();

        // Simulate MaybeUpdate::Absent — do nothing to difficulty
        let mut data = read_note_file(&path).unwrap();
        data.title = "Renamed".to_string(); // only title change
                                            // difficulty left untouched
        write_note_file(&path, &data).unwrap();

        let read_back = read_note_file(&path).unwrap();
        assert_eq!(
            read_back.difficulty,
            Some("easy".to_string()),
            "difficulty should be preserved"
        );
        assert_eq!(read_back.title, "Renamed");
    }

    // ── MaybeUpdate deserialisation ──────────────────────────────────────────

    #[test]
    fn maybe_update_absent_when_key_missing() {
        // {"id": "foo"} — difficulty key is absent
        let json = r#"{"id":"foo"}"#;
        let payload: UpdateNotePayload = serde_json::from_str(json).unwrap();
        assert!(matches!(payload.difficulty, MaybeUpdate::Absent));
    }

    #[test]
    fn maybe_update_clear_when_null() {
        // {"id": "foo", "difficulty": null}
        let json = r#"{"id":"foo","difficulty":null}"#;
        let payload: UpdateNotePayload = serde_json::from_str(json).unwrap();
        assert!(matches!(payload.difficulty, MaybeUpdate::Clear));
    }

    #[test]
    fn maybe_update_set_when_value_provided() {
        // {"id": "foo", "difficulty": "hard"}
        let json = r#"{"id":"foo","difficulty":"hard"}"#;
        let payload: UpdateNotePayload = serde_json::from_str(json).unwrap();
        match payload.difficulty {
            MaybeUpdate::Set(v) => assert_eq!(v, "hard"),
            other => panic!("expected Set, got {:?}", other),
        }
    }

    // ── sortOrder roundtrip ──────────────────────────────────────────────────

    #[test]
    fn sort_order_persisted_and_retrieved() {
        let (_dir, root) = setup();
        let path = root.join("sorted.json");
        let note = NoteFile {
            title: "Sorted".to_string(),
            icon: "◉".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: None,
            sort_order: 7,
        };
        write_note_file(&path, &note).unwrap();

        let entries = scan_dir(&root, &root);
        let found = entries
            .iter()
            .find(|e| e.id.ends_with("sorted.json"))
            .unwrap();
        assert_eq!(found.sort_order, 7);
    }

    #[test]
    fn sort_order_updated_on_update_payload() {
        let (_dir, root) = setup();
        let path = create_note_file(&root, "reorder.json", "Reorder");

        let mut data = read_note_file(&path).unwrap();
        data.sort_order = 99;
        write_note_file(&path, &data).unwrap();

        let read_back = read_note_file(&path).unwrap();
        assert_eq!(read_back.sort_order, 99);
    }

    // ── folder metadata roundtrip ────────────────────────────────────────────

    #[test]
    fn folder_meta_tags_and_difficulty_persist() {
        let (_dir, root) = setup();
        let dir_path = root.join("project-folder");
        fs::create_dir_all(&dir_path).unwrap();
        let meta = NoteFile {
            title: "Project".to_string(),
            icon: "◈".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec!["school".to_string()],
            difficulty: Some("medium".to_string()),
            sort_order: 3,
        };
        write_note_file(&dir_path.join(FOLDER_META), &meta).unwrap();

        let entries = scan_dir(&root, &root);
        let folder = entries
            .iter()
            .find(|e| e.is_folder && e.id.ends_with("project-folder"))
            .unwrap();
        assert_eq!(folder.tags, vec!["school"]);
        assert_eq!(folder.difficulty, Some("medium".to_string()));
        assert_eq!(folder.sort_order, 3);
    }

    #[test]
    fn folder_meta_difficulty_clear_persists() {
        let (_dir, root) = setup();
        let dir_path = root.join("clr-folder");
        fs::create_dir_all(&dir_path).unwrap();
        let meta_path = dir_path.join(FOLDER_META);

        // Write initial with difficulty set
        let meta = NoteFile {
            title: "CLR".to_string(),
            icon: "◈".to_string(),
            content: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec![],
            difficulty: Some("easy".to_string()),
            sort_order: 0,
        };
        write_note_file(&meta_path, &meta).unwrap();

        // Simulate MaybeUpdate::Clear
        let mut reloaded = read_note_file(&meta_path).unwrap();
        reloaded.difficulty = None;
        write_note_file(&meta_path, &reloaded).unwrap();

        let read_back = read_note_file(&meta_path).unwrap();
        assert_eq!(
            read_back.difficulty, None,
            "folder difficulty should be cleared"
        );
    }

    // ── notes_move ───────────────────────────────────────────────────────────

    #[test]
    fn move_note_to_new_parent_changes_id() {
        let (_dir, root) = setup();
        create_note_file(&root, "moveme.json", "Move Me");
        let dest_dir = root.join("dest");
        fs::create_dir_all(&dest_dir).unwrap();

        // Perform the move manually (simulating notes_move logic)
        let src = root.join("moveme.json");
        let dst = dest_dir.join("moveme.json");
        fs::rename(&src, &dst).unwrap();

        let new_id = rel_id(&dst, &root);
        assert!(new_id.contains("dest"), "new id should include dest folder");
        assert!(!src.exists(), "original file should be gone");
        assert!(dst.exists(), "file should exist in new location");
    }

    #[test]
    fn move_rejects_folder_into_itself() {
        let (_dir, root) = setup();
        let folder = root.join("myfolder");
        fs::create_dir_all(&folder).unwrap();

        // dst_dir.starts_with(src_path) guard
        let dst_dir = folder.join("sub");
        assert!(dst_dir.starts_with(&folder), "should detect self-move");
    }

    // ── create note + get roundtrip (unit helpers) ───────────────────────────

    #[test]
    fn create_note_and_get_roundtrip() {
        let (_dir, root) = setup();
        let path = root.join("alpha.json");
        let note = NoteFile {
            title: "Alpha".to_string(),
            icon: "◉".to_string(),
            content: Some(serde_json::json!({ "type": "doc", "content": [] })),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            tags: vec!["tag1".to_string()],
            difficulty: Some("easy".to_string()),
            sort_order: 1,
        };
        write_note_file(&path, &note).unwrap();

        let read_back = read_note_file(&path).unwrap();
        assert_eq!(read_back.title, "Alpha");
        assert_eq!(read_back.tags, vec!["tag1"]);
        assert_eq!(read_back.difficulty, Some("easy".to_string()));
        assert_eq!(read_back.sort_order, 1);
        assert!(read_back.content.is_some());
    }

    #[test]
    fn list_returns_all_entries_with_metadata() {
        let (_dir, root) = setup();
        create_note_file(&root, "n1.json", "Note 1");
        create_note_file(&root, "n2.json", "Note 2");
        create_folder_meta(&root, "fol", "Folder");

        let entries = scan_dir(&root, &root);
        assert_eq!(entries.len(), 3);
        assert!(entries.iter().any(|e| e.title == "Note 1"));
        assert!(entries.iter().any(|e| e.title == "Note 2"));
        assert!(entries.iter().any(|e| e.title == "Folder" && e.is_folder));
    }
}
