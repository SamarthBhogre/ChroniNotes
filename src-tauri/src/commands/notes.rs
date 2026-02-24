use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use std::sync::Mutex;

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
}

#[derive(Debug, Deserialize)]
pub struct CreateNotePayload {
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotePayload {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<serde_json::Value>,
    pub icon: Option<String>,
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
                .unwrap_or_else(|| now_iso());
            let updated = meta
                .as_ref()
                .map(|m| m.updated_at.clone())
                .unwrap_or_else(|| now_iso());

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
            });

            // Recurse
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
    let abs_path = root.join(&id);

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
        let title = meta
            .as_ref()
            .map(|m| m.title.clone())
            .unwrap_or(dir_name);

        return Ok(Some(NoteEntry {
            id: id.clone(),
            name: title.clone(),
            title,
            icon: meta.as_ref().map(|m| m.icon.clone()).unwrap_or("◈".to_string()),
            is_folder: true,
            parent_id: parent_id(&id),
            content: None,
            created_at: meta.as_ref().map(|m| m.created_at.clone()).unwrap_or_else(now_iso),
            updated_at: meta.as_ref().map(|m| m.updated_at.clone()).unwrap_or_else(now_iso),
        }));
    }

    // File
    let data = read_note_file(&abs_path)?;
    Ok(Some(NoteEntry {
        id: id.clone(),
        name: data.title.clone(),
        title: data.title,
        icon: if data.icon.is_empty() { "◉".to_string() } else { data.icon },
        is_folder: false,
        parent_id: parent_id(&id),
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
    }))
}

#[tauri::command]
pub fn notes_create(payload: CreateNotePayload, notes_root: State<NotesRoot>) -> Result<NoteEntry, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let title = payload.title.unwrap_or_else(|| "Untitled".to_string());
    let parent_dir = match &payload.parent_id {
        Some(pid) => root.join(pid),
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
        updated_at: now,
    })
}

#[tauri::command]
pub fn notes_create_folder(payload: CreateNotePayload, notes_root: State<NotesRoot>) -> Result<NoteEntry, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let title = payload.title.unwrap_or_else(|| "New Folder".to_string());
    let parent_dir = match &payload.parent_id {
        Some(pid) => root.join(pid),
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
        updated_at: now,
    })
}

#[tauri::command]
pub fn notes_update(payload: UpdateNotePayload, notes_root: State<NotesRoot>) -> Result<Option<NoteEntry>, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let abs_path = root.join(&payload.id);

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
                .unwrap_or(NoteFile {
                    title: "".to_string(),
                    icon: "◈".to_string(),
                    content: None,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                })
        } else {
            NoteFile {
                title: "".to_string(),
                icon: "◈".to_string(),
                content: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            }
        };

        if let Some(t) = &payload.title {
            meta.title = t.clone();
        }
        if let Some(i) = &payload.icon {
            meta.icon = i.clone();
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
        }));
    }

    // File
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
    }))
}

#[tauri::command]
pub fn notes_delete(id: String, notes_root: State<NotesRoot>) -> Result<(), String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let abs_path = root.join(&id);

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

#[tauri::command]
pub fn notes_open_folder(notes_root: State<NotesRoot>) -> Result<String, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    let path_str = root.to_string_lossy().to_string();
    // Opening is done from frontend via shell plugin
    Ok(path_str)
}

#[tauri::command]
pub fn notes_get_root(notes_root: State<NotesRoot>) -> Result<String, String> {
    let root = notes_root.path.lock().map_err(|e| e.to_string())?;
    Ok(root.to_string_lossy().to_string())
}
