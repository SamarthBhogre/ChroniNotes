import { create } from "zustand"

export type Difficulty = "easy" | "medium" | "hard" | null

/** Mirror of backend NoteEntry — single source of truth. */
export interface NoteEntry {
  id: string
  name: string
  title: string
  icon: string
  isFolder: boolean
  parentId: string | null
  content: unknown | null
  createdAt: string
  updatedAt: string
  /** Persisted backend-side in the note/folder JSON file. */
  tags: string[]
  /** Persisted backend-side in the note/folder JSON file. */
  difficulty: Difficulty
  /** Persisted backend-side — controls stable sort order within a folder. */
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
  createNote: (parentId?: string | null, navigate?: boolean) => Promise<NoteEntry>
  createFolder: (parentId?: string | null) => Promise<NoteEntry>
  updateNote: (
    id: string,
    patch: {
      title?: string
      content?: unknown
      icon?: string
      tags?: string[]
      difficulty?: Difficulty
      sortOrder?: number
    }
  ) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  toggleFolder: (id: string) => void
  getActiveNote: () => NoteEntry | undefined
  openNotesFolder: () => Promise<void>
  /**
   * Reorder a note within its parent folder — persists the new sortOrder
   * for all affected siblings via individual `notes:update` calls.
   */
  reorderNote: (dragId: string, targetId: string, position: "before" | "after") => Promise<void>
  moveNote: (id: string, direction: "up" | "down") => Promise<void>
}

/** Coerce a raw backend response to a fully-typed NoteEntry. */
function coerce(entry: unknown, idx: number): NoteEntry {
  const e = entry as Record<string, unknown>
  return {
    id:         e.id         as string,
    name:       e.name       as string,
    title:      e.title      as string,
    icon:       e.icon       as string,
    isFolder:   e.isFolder   as boolean,
    parentId:   (e.parentId  as string | null) ?? null,
    content:    e.content    ?? null,
    createdAt:  e.createdAt  as string,
    updatedAt:  e.updatedAt  as string,
    tags:       Array.isArray(e.tags) ? (e.tags as string[]) : [],
    difficulty: (e.difficulty as Difficulty) ?? null,
    sortOrder:  typeof e.sortOrder === "number" ? e.sortOrder : idx,
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
      const raw = await window.electron.invoke("notes:list") as unknown[]
      const entries = raw.map(coerce)
      // Only replace `notes` — never touch activeNoteId or expandedFolders
      // so an in-flight createNote optimistic update is not wiped out.
      set({ notes: entries, loading: false })
    } catch (err) {
      console.error("Failed to load notes:", err)
      set({ loading: false })
    }
  },

  fetchNoteContent: async (id) => {
    try {
      const raw = await window.electron.invoke("notes:get", id)
      if (!raw) return null
      const entry = coerce(raw, 0)
      if (entry.content !== null && entry.content !== undefined) {
        set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, content: entry.content } : n) }))
      }
      return entry
    } catch (err) {
      console.error("Failed to fetch note:", err)
      return null
    }
  },

  createNote: async (parentId = null, navigate = true) => {
    try {
      const raw = await window.electron.invoke("notes:create", { parentId, title: "Untitled", icon: "◉" })
      const entry = coerce(raw, get().notes.length)

      // Optimistic add + expand parent
      set(s => {
        const next = new Set(s.expandedFolders)
        if (parentId) next.add(parentId)
        return {
          notes: [...s.notes, entry],
          // Only switch active note when the caller wants navigation
          // (e.g. top nav "New" or sidebar root button — NOT folder card "+ Page")
          ...(navigate ? { activeNoteId: entry.id } : {}),
          expandedFolders: next,
        }
      })

      // Sync from backend to pick up server-side normalisation
      get().loadNotes()

      return entry
    } catch (err) {
      console.error("Failed to create note:", err)
      throw err
    }
  },

  createFolder: async (parentId = null) => {
    try {
      const raw = await window.electron.invoke("notes:createFolder", { parentId, title: "New Folder", icon: "📁" })
      const entry = coerce(raw, get().notes.length)

      // Optimistic add + expand self and parent — never navigate away from current view
      set(s => {
        const next = new Set(s.expandedFolders)
        next.add(entry.id)
        if (parentId) next.add(parentId)
        return { notes: [...s.notes, entry], expandedFolders: next }
      })

      // Sync from backend
      get().loadNotes()

      return entry
    } catch (err) {
      console.error("Failed to create folder:", err)
      throw err
    }
  },

  updateNote: async (id, patch) => {
    set({ saving: true })

    // Snapshot for rollback on error
    const snapshot = get().notes

    // Optimistic local update
    set(s => ({
      notes: s.notes.map(n => n.id === id ? {
        ...n,
        ...(patch.title      !== undefined && { title: patch.title, name: patch.title }),
        ...(patch.icon       !== undefined && { icon: patch.icon }),
        ...(patch.tags       !== undefined && { tags: patch.tags }),
        // difficulty: explicit null = clear, undefined = skip, string = set
        ...("difficulty" in patch && { difficulty: patch.difficulty ?? null }),
        ...(patch.sortOrder  !== undefined && { sortOrder: patch.sortOrder }),
      } : n),
    }))

    try {
      // Build payload. For difficulty we MUST distinguish:
      //   - key absent      → backend keeps existing value
      //   - key = null      → backend clears the value
      //   - key = "easy"|…  → backend sets the value
      const payload: Record<string, unknown> = { id }
      if (patch.title      !== undefined) payload.title      = patch.title
      if (patch.content    !== undefined) payload.content    = patch.content
      if (patch.icon       !== undefined) payload.icon       = patch.icon
      if (patch.tags       !== undefined) payload.tags       = patch.tags
      if (patch.sortOrder  !== undefined) payload.sortOrder  = patch.sortOrder
      // Always include difficulty when the caller explicitly provided it
      // (even if null — that is the clear signal).
      if ("difficulty" in patch) payload.difficulty = patch.difficulty ?? null

      const updated = await window.electron.invoke("notes:update", payload)
      if (updated) {
        const u = coerce(updated, 0)
        set(s => ({
          notes: s.notes.map(n => n.id === id ? { ...n, updatedAt: u.updatedAt } : n),
          saving: false,
        }))
      } else {
        set({ saving: false })
      }
    } catch (err) {
      console.error("Failed to update note:", err)
      // Rollback optimistic state on error
      set({ notes: snapshot, saving: false })
    }
  },

  deleteNote: async (id) => {
    // Optimistic remove — instant feedback
    set(s => ({
      notes: s.notes.filter(n => !(n.id === id || n.id.startsWith(id + "/"))),
      activeNoteId:
        s.activeNoteId && (s.activeNoteId === id || s.activeNoteId.startsWith(id + "/"))
          ? null
          : s.activeNoteId,
    }))
    try {
      await window.electron.invoke("notes:delete", id)
    } catch (err) {
      console.error("Failed to delete note:", err)
      // Re-sync to restore any note that failed to delete
      get().loadNotes()
    }
  },

  /**
   * Reorder a dragged note relative to a target note.
   *
   * Same-parent: persists new `sortOrder` for affected siblings only.
   * Cross-parent: calls `notes:move` to physically relocate the file/folder
   *   so the backend and UI are always in sync. After a cross-parent move
   *   the full note list is reloaded to pick up the new id.
   */
  reorderNote: async (dragId: string, targetId: string, position: "before" | "after") => {
    const s = get()
    const dragged = s.notes.find(n => n.id === dragId)
    const target  = s.notes.find(n => n.id === targetId)
    if (!dragged || !target) return

    const newParentId = target.parentId   // destination parent

    // ── Cross-parent move ─────────────────────────────────────────────────
    if (dragged.parentId !== newParentId) {
      // Do NOT apply an optimistic parentId update — wait for the backend
      // to confirm so UI never diverges.
      try {
        const raw = await window.electron.invoke("notes:move", {
          id: dragId,
          newParentId: newParentId ?? null,
        })
        if (raw) {
          // Expand the target parent so the moved note is visible
          set(s2 => {
            const next = new Set(s2.expandedFolders)
            if (newParentId) next.add(newParentId)
            return { expandedFolders: next }
          })
        }
        // Reload to pick up the new id (path) and sibling sort orders
        await get().loadNotes()
      } catch (err) {
        console.error(`Failed to move note ${dragId} to parent ${newParentId}:`, err)
        // No optimistic state was applied, so no rollback needed.
      }
      return
    }

    // ── Same-parent reorder ───────────────────────────────────────────────
    const siblings = [...s.notes.filter(n => n.parentId === newParentId)]
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const withoutDrag = siblings.filter(n => n.id !== dragId)
    const tIdx = withoutDrag.findIndex(n => n.id === targetId)
    if (tIdx < 0) return

    const insertAt = position === "before" ? tIdx : tIdx + 1
    withoutDrag.splice(insertAt, 0, { ...dragged, parentId: newParentId })
    const reordered = withoutDrag.map((n, i) => ({ ...n, sortOrder: i }))

    // Optimistic update (same-parent, ids unchanged)
    const map = new Map(reordered.map(n => [n.id, n]))
    set(prev => ({ notes: prev.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))

    // Persist each changed sortOrder to the backend
    const persisted = await Promise.allSettled(
      reordered
        .filter(n => {
          const original = s.notes.find(o => o.id === n.id)
          return original && original.sortOrder !== n.sortOrder
        })
        .map(n =>
          window.electron.invoke("notes:update", { id: n.id, sortOrder: n.sortOrder })
        )
    )
    // If any persist failed, re-sync from backend to restore truth
    if (persisted.some(r => r.status === "rejected")) {
      console.error("Some sortOrder persists failed — reloading from backend")
      get().loadNotes()
    }
  },

  moveNote: async (id, direction) => {
    const s = get()
    const note = s.notes.find(n => n.id === id)
    if (!note) return

    const siblings = [...s.notes.filter(n => n.parentId === note.parentId)]
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = siblings.findIndex(n => n.id === id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return

    const a = siblings[idx]
    const b = siblings[swapIdx]
    const aNewOrder = b.sortOrder
    const bNewOrder = a.sortOrder

    // Snapshot for rollback
    const snapshot = get().notes

    // Optimistic update
    const map = new Map<string, NoteEntry>([
      [a.id, { ...a, sortOrder: aNewOrder }],
      [b.id, { ...b, sortOrder: bNewOrder }],
    ])
    set(prev => ({ notes: prev.notes.map(n => map.has(n.id) ? map.get(n.id)! : n) }))

    // Persist both swapped sortOrders
    const results = await Promise.allSettled([
      window.electron.invoke("notes:update", { id: a.id, sortOrder: aNewOrder }),
      window.electron.invoke("notes:update", { id: b.id, sortOrder: bNewOrder }),
    ])

    if (results.some(r => r.status === "rejected")) {
      console.error("moveNote: persist failed — rolling back")
      set({ notes: snapshot })
    }
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
