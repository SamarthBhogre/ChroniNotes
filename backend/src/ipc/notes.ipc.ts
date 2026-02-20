import { ipcMain, app, shell } from "electron"
import fs from "fs"
import path from "path"

/**
 * Notes are stored as real files on disk:
 *   <userData>/ChroniNotes/
 *     ├── note-abc.json
 *     ├── My Folder/
 *     │   ├── _folder.json        ← folder metadata (icon, etc.)
 *     │   └── note-xyz.json
 *     └── ...
 *
 * Each .json note file has:
 *   { title, icon, content (tiptap JSON), createdAt, updatedAt }
 *
 * Folders are real directories. A special `_folder.json` inside holds metadata.
 */

const NOTE_EXT = ".json"
const FOLDER_META = "_folder.json"

function getNotesRoot(): string {
  const dir = path.join(app.getPath("userData"), "ChroniNotes")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/* ── Types ── */

interface NoteFile {
  title: string
  icon: string
  content: any // tiptap JSON
  createdAt: string
  updatedAt: string
}

interface NoteEntry {
  id: string           // relative path from root (used as unique key)
  name: string         // display name (title from file, or folder name)
  title: string
  icon: string
  isFolder: boolean
  parentId: string | null
  content: any | null  // null for list calls, populated for single get
  createdAt: string
  updatedAt: string
  children?: NoteEntry[]
}

/* ── Helpers ── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "untitled"
}

function makeUniqueFilePath(dir: string, baseName: string, ext: string): string {
  let name = baseName
  let filePath = path.join(dir, name + ext)
  let counter = 1
  while (fs.existsSync(filePath)) {
    name = `${baseName}-${counter}`
    filePath = path.join(dir, name + ext)
    counter++
  }
  return filePath
}

function makeUniqueDirPath(parentDir: string, baseName: string): string {
  let name = baseName
  let dirPath = path.join(parentDir, name)
  let counter = 1
  while (fs.existsSync(dirPath)) {
    name = `${baseName}-${counter}`
    dirPath = path.join(parentDir, name)
    counter++
  }
  return dirPath
}

function relId(absPath: string, root: string): string {
  return path.relative(root, absPath).replace(/\\/g, "/")
}

function parentId(id: string): string | null {
  const parts = id.split("/")
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join("/")
}

function readNoteFile(filePath: string): NoteFile {
  const raw = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(raw) as NoteFile
}

function writeNoteFile(filePath: string, data: NoteFile) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
}

/** Recursively scan directory and return flat list of entries */
function scanDir(dir: string, root: string): NoteEntry[] {
  const entries: NoteEntry[] = []
  if (!fs.existsSync(dir)) return entries

  const items = fs.readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dir, item.name)

    if (item.isDirectory()) {
      // It's a folder
      const id = relId(fullPath, root)
      const metaPath = path.join(fullPath, FOLDER_META)
      let meta: Partial<NoteFile> = {}
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) } catch {}
      }

      entries.push({
        id,
        name: meta.title || item.name,
        title: meta.title || item.name,
        icon: meta.icon || "◈",
        isFolder: true,
        parentId: parentId(id),
        content: null,
        createdAt: meta.createdAt || fs.statSync(fullPath).birthtime.toISOString(),
        updatedAt: meta.updatedAt || fs.statSync(fullPath).mtime.toISOString(),
      })

      // Recurse
      entries.push(...scanDir(fullPath, root))
    } else if (item.isFile() && item.name.endsWith(NOTE_EXT) && item.name !== FOLDER_META) {
      try {
        const data = readNoteFile(fullPath)
        const id = relId(fullPath, root)
        entries.push({
          id,
          name: data.title || item.name.replace(NOTE_EXT, ""),
          title: data.title || item.name.replace(NOTE_EXT, ""),
          icon: data.icon || "◉",
          isFolder: false,
          parentId: parentId(id),
          content: null, // don't send content in list
          createdAt: data.createdAt || fs.statSync(fullPath).birthtime.toISOString(),
          updatedAt: data.updatedAt || fs.statSync(fullPath).mtime.toISOString(),
        })
      } catch {
        // skip malformed files
      }
    }
  }

  return entries
}

/* ═══════════════════════════════════
   IPC HANDLERS
═══════════════════════════════════ */

export function registerNotesHandlers() {
  const root = getNotesRoot()

  // ── List all notes (flat tree) ──
  ipcMain.handle("notes:list", () => {
    return scanDir(root, root)
  })

  // ── Get single note (with content) ──
  ipcMain.handle("notes:get", (_, id: string) => {
    const absPath = path.join(root, id)
    if (!fs.existsSync(absPath)) return null

    const stat = fs.statSync(absPath)
    if (stat.isDirectory()) {
      // folder
      const metaPath = path.join(absPath, FOLDER_META)
      let meta: Partial<NoteFile> = {}
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) } catch {}
      }
      return {
        id,
        name: meta.title || path.basename(absPath),
        title: meta.title || path.basename(absPath),
        icon: meta.icon || "◈",
        isFolder: true,
        parentId: parentId(id),
        content: null,
        createdAt: meta.createdAt || stat.birthtime.toISOString(),
        updatedAt: meta.updatedAt || stat.mtime.toISOString(),
      } as NoteEntry
    }

    // file
    const data = readNoteFile(absPath)
    return {
      id,
      name: data.title,
      title: data.title,
      icon: data.icon || "◉",
      isFolder: false,
      parentId: parentId(id),
      content: data.content,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as NoteEntry
  })

  // ── Create note ──
  ipcMain.handle(
    "notes:create",
    (_, payload: { parentId?: string | null; title?: string; icon?: string }) => {
      const title = payload.title || "Untitled"
      const parentDir = payload.parentId
        ? path.join(root, payload.parentId)
        : root

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      const slug = slugify(title)
      const filePath = makeUniqueFilePath(parentDir, slug, NOTE_EXT)
      const now = new Date().toISOString()

      const noteData: NoteFile = {
        title,
        icon: payload.icon || "◉",
        content: { type: "doc", content: [] },
        createdAt: now,
        updatedAt: now,
      }

      writeNoteFile(filePath, noteData)

      const id = relId(filePath, root)
      return {
        id,
        name: title,
        title,
        icon: noteData.icon,
        isFolder: false,
        parentId: parentId(id),
        content: noteData.content,
        createdAt: now,
        updatedAt: now,
      } as NoteEntry
    }
  )

  // ── Create folder ──
  ipcMain.handle(
    "notes:createFolder",
    (_, payload: { parentId?: string | null; title?: string; icon?: string }) => {
      const title = payload.title || "New Folder"
      const parentDir = payload.parentId
        ? path.join(root, payload.parentId)
        : root

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      const slug = slugify(title)
      const dirPath = makeUniqueDirPath(parentDir, slug)
      fs.mkdirSync(dirPath, { recursive: true })

      const now = new Date().toISOString()
      const meta: NoteFile = {
        title,
        icon: payload.icon || "◈",
        content: null,
        createdAt: now,
        updatedAt: now,
      }
      writeNoteFile(path.join(dirPath, FOLDER_META), meta)

      const id = relId(dirPath, root)
      return {
        id,
        name: title,
        title,
        icon: meta.icon,
        isFolder: true,
        parentId: parentId(id),
        content: null,
        createdAt: now,
        updatedAt: now,
      } as NoteEntry
    }
  )

  // ── Update note content / title / icon ──
  ipcMain.handle(
    "notes:update",
    (_, payload: { id: string; title?: string; content?: any; icon?: string }) => {
      const absPath = path.join(root, payload.id)
      if (!fs.existsSync(absPath)) return null

      const stat = fs.statSync(absPath)
      const now = new Date().toISOString()

      if (stat.isDirectory()) {
        // update folder meta
        const metaPath = path.join(absPath, FOLDER_META)
        let meta: Partial<NoteFile> = {}
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) } catch {}
        }
        if (payload.title !== undefined) meta.title = payload.title
        if (payload.icon !== undefined) meta.icon = payload.icon
        meta.updatedAt = now
        writeNoteFile(metaPath, meta as NoteFile)

        return {
          id: payload.id,
          name: meta.title,
          title: meta.title,
          icon: meta.icon || "◈",
          isFolder: true,
          parentId: parentId(payload.id),
          content: null,
          createdAt: meta.createdAt || now,
          updatedAt: now,
        } as NoteEntry
      }

      // update note file
      const data = readNoteFile(absPath)
      if (payload.title !== undefined) data.title = payload.title
      if (payload.content !== undefined) data.content = payload.content
      if (payload.icon !== undefined) data.icon = payload.icon
      data.updatedAt = now
      writeNoteFile(absPath, data)

      return {
        id: payload.id,
        name: data.title,
        title: data.title,
        icon: data.icon,
        isFolder: false,
        parentId: parentId(payload.id),
        content: data.content,
        createdAt: data.createdAt,
        updatedAt: now,
      } as NoteEntry
    }
  )

  // ── Delete note or folder ──
  ipcMain.handle("notes:delete", (_, id: string) => {
    const absPath = path.join(root, id)
    if (!fs.existsSync(absPath)) return

    const stat = fs.statSync(absPath)
    if (stat.isDirectory()) {
      fs.rmSync(absPath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(absPath)
    }
  })

  // ── Open notes folder in OS file explorer ──
  ipcMain.handle("notes:openFolder", () => {
    shell.openPath(root)
  })

  // ── Get notes folder path ──
  ipcMain.handle("notes:getRoot", () => {
    return root
  })
}
