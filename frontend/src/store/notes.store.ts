import { create } from "zustand"

export type Difficulty = "easy" | "medium" | "hard" | null

export interface NoteEntry {
  id: string
  name: string
  title: string
  icon: string
  isFolder: boolean
  parentId: string | null
  content: any | null
  createdAt: string
  updatedAt: string
  tags: string[]
  difficulty: Difficulty
  sortOrder: number
}

interface NotesState {
  notes: NoteEntry[]
  activeNoteId: string | null
  expandedFolders: Set<string>
  loading: boolean
  saving: boolean

  loadNotes: () => Promise<void>
  fetchNoteContent: (id: string) => Promise<NoteEntry | null>
  createNote: (parentId?: string | null) => Promise<NoteEntry>
  createFolder: (parentId?: string | null) => Promise<NoteEntry>
  updateNote: (id: string, patch: { title?: string; content?: any; icon?: string; tags?: string[]; difficulty?: Difficulty }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  toggleFolder: (id: string) => void
  getActiveNote: () => NoteEntry | undefined
  openNotesFolder: () => Promise<void>
  reorderNote: (dragId: string, targetId: string, position: "before" | "after") => void
  moveNote: (id: string, direction: "up" | "down") => void
}

function normalize(entry: any, idx: number): NoteEntry {
  return {
    ...entry,
    tags: entry.tags ?? [],
    difficulty: entry.difficulty ?? null,
    sortOrder: entry.sortOrder ?? idx,
  }
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  expandedFolders: new Set<string>(),
  loading: false,
  saving: false,

  loadNotes: async () => {
    set({ loading: true })
    try {
      const raw: any[] = await window.electron.invoke("notes:list")
      const entries = raw.map(normalize)
      set({ notes: entries, loading: false })
    } catch (err) {
      console.error("Failed to load notes:", err)
      set({ loading: false })
    }
  },

  fetchNoteContent: async (id) => {
    try {
      const entry: any | null = await window.electron.invoke("notes:get", id)
      if (entry?.content !== null && entry?.content !== undefined) {
        set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, content: entry.content } : n) }))
      }
      return entry ? normalize(entry, 0) : null
    } catch (err) {
      console.error("Failed to fetch note:", err)
      return null
    }
  },

  createNote: async (parentId = null) => {
    const raw: any = await window.electron.invoke("notes:create", { parentId, title: "Untitled", icon: "◉" })
    const entry = normalize(raw, get().notes.length)
    set(s => {
      const next = new Set(s.expandedFolders)
      if (parentId) next.add(parentId)
      return { notes: [...s.notes, entry], activeNoteId: entry.id, expandedFolders: next }
    })
    return entry
  },

  createFolder: async (parentId = null) => {
    const raw: any = await window.electron.invoke("notes:createFolder", { parentId, title: "New Folder", icon: "📁" })
    const entry = normalize(raw, get().notes.length)
    set(s => {
      const next = new Set(s.expandedFolders)
      next.add(entry.id)
      if (parentId) next.add(parentId)
      return { notes: [...s.notes, entry], expandedFolders: next }
    })
    return entry
  },

  updateNote: async (id, patch) => {
    set({ saving: true })
    // Optimistic
    set(s => ({
      notes: s.notes.map(n => n.id === id ? {
        ...n,
        ...(patch.title      !== undefined && { title: patch.title, name: patch.title }),
        ...(patch.icon       !== undefined && { icon: patch.icon }),
        ...(patch.tags       !== undefined && { tags: patch.tags }),
        ...(patch.difficulty !== undefined && { difficulty: patch.difficulty }),
      } : n),
    }))
    try {
      const backendPatch: any = {}
      if (patch.title   !== undefined) backendPatch.title   = patch.title
      if (patch.content !== undefined) backendPatch.content = patch.content
      if (patch.icon    !== undefined) backendPatch.icon    = patch.icon
      if (Object.keys(backendPatch).length > 0) {
        const updated: any = await window.electron.invoke("notes:update", { id, ...backendPatch })
        if (updated) set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, updatedAt: updated.updatedAt } : n), saving: false }))
        else set({ saving: false })
      } else {
        set({ saving: false })
      }
    } catch (err) {
      console.error("Failed to update note:", err)
      set({ saving: false })
    }
  },

  deleteNote: async (id) => {
    await window.electron.invoke("notes:delete", id)
    set(s => ({
      notes: s.notes.filter(n => !(n.id === id || n.id.startsWith(id + "/"))),
      activeNoteId: s.activeNoteId && (s.activeNoteId === id || s.activeNoteId.startsWith(id + "/")) ? null : s.activeNoteId,
    }))
  },

  reorderNote: (dragId, targetId, position) => {
    set(s => {
      const dragged = s.notes.find(n => n.id === dragId)
      const target  = s.notes.find(n => n.id === targetId)
      if (!dragged || !target) return s

      const parentId = target.parentId
      const siblings = [...s.notes.filter(n => n.parentId === parentId)].sort((a, b) => a.sortOrder - b.sortOrder)
      const withoutDrag = siblings.filter(n => n.id !== dragId)
      const tIdx = withoutDrag.findIndex(n => n.id === targetId)
      if (tIdx < 0) return s
      const insertAt = position === "before" ? tIdx : tIdx + 1
      withoutDrag.splice(insertAt, 0, { ...dragged, parentId })
      const updated = withoutDrag.map((n, i) => ({ ...n, sortOrder: i }))
      const map = new Map(updated.map(n => [n.id, n]))
      return { notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }
    })
  },

  moveNote: (id, direction) => {
    set(s => {
      const note = s.notes.find(n => n.id === id)
      if (!note) return s
      const siblings = [...s.notes.filter(n => n.parentId === note.parentId)].sort((a, b) => a.sortOrder - b.sortOrder)
      const idx = siblings.findIndex(n => n.id === id)
      const swapIdx = direction === "up" ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= siblings.length) return s
      // Swap sortOrder values
      const a = siblings[idx]
      const b = siblings[swapIdx]
      const aOrder = a.sortOrder
      const bOrder = b.sortOrder
      const map = new Map([[a.id, { ...a, sortOrder: bOrder }], [b.id, { ...b, sortOrder: aOrder }]])
      return { notes: s.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }
    })
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  toggleFolder: (id) => set(s => {
    const next = new Set(s.expandedFolders)
    next.has(id) ? next.delete(id) : next.add(id)
    return { expandedFolders: next }
  }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find(n => n.id === activeNoteId)
  },

  openNotesFolder: async () => {
    try { await window.electron.invoke("notes:openFolder") }
    catch (err) { console.error("openNotesFolder failed:", err) }
  },
}))
