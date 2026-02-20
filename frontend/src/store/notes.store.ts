import { create } from "zustand"

export interface NoteEntry {
  id: string            // relative path from notes root
  name: string
  title: string
  icon: string
  isFolder: boolean
  parentId: string | null
  content: any | null   // tiptap JSON, null until fetched
  createdAt: string
  updatedAt: string
}

interface NotesState {
  notes: NoteEntry[]
  activeNoteId: string | null
  expandedFolders: Set<string>
  loading: boolean
  saving: boolean

  // Actions
  loadNotes: () => Promise<void>
  fetchNoteContent: (id: string) => Promise<NoteEntry | null>
  createNote: (parentId?: string | null) => Promise<NoteEntry>
  createFolder: (parentId?: string | null) => Promise<NoteEntry>
  updateNote: (id: string, patch: { title?: string; content?: any; icon?: string }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  toggleFolder: (id: string) => void
  getActiveNote: () => NoteEntry | undefined
  openNotesFolder: () => Promise<void>
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
      const entries: NoteEntry[] = await window.electron.invoke("notes:list")
      set({ notes: entries, loading: false })
    } catch (err) {
      console.error("Failed to load notes:", err)
      set({ loading: false })
    }
  },

  fetchNoteContent: async (id: string) => {
    try {
      const entry: NoteEntry | null = await window.electron.invoke("notes:get", id)
      if (entry && entry.content !== null) {
        // Update local state with content
        set(s => ({
          notes: s.notes.map(n =>
            n.id === id ? { ...n, content: entry.content } : n
          ),
        }))
      }
      return entry
    } catch (err) {
      console.error("Failed to fetch note:", err)
      return null
    }
  },

  createNote: async (parentId = null) => {
    const entry: NoteEntry = await window.electron.invoke("notes:create", {
      parentId,
      title: "Untitled",
      icon: "◉",
    })

    set(s => {
      const next = new Set(s.expandedFolders)
      if (parentId) next.add(parentId)
      return {
        notes: [...s.notes, entry],
        activeNoteId: entry.id,
        expandedFolders: next,
      }
    })

    return entry
  },

  createFolder: async (parentId = null) => {
    const entry: NoteEntry = await window.electron.invoke("notes:createFolder", {
      parentId,
      title: "New Folder",
      icon: "◈",
    })

    set(s => {
      const next = new Set(s.expandedFolders)
      next.add(entry.id)
      if (parentId) next.add(parentId)
      return {
        notes: [...s.notes, entry],
        expandedFolders: next,
      }
    })

    return entry
  },

  updateNote: async (id, patch) => {
    set({ saving: true })
    try {
      const updated: NoteEntry | null = await window.electron.invoke("notes:update", {
        id,
        ...patch,
      })

      if (updated) {
        set(s => ({
          notes: s.notes.map(n =>
            n.id === id
              ? {
                  ...n,
                  ...(patch.title !== undefined && { title: patch.title, name: patch.title }),
                  ...(patch.content !== undefined && { content: patch.content }),
                  ...(patch.icon !== undefined && { icon: patch.icon }),
                  updatedAt: updated.updatedAt,
                }
              : n
          ),
          saving: false,
        }))
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

    // Remove from local state — also remove any children whose id starts with this folder path
    set(s => {
      const isChildOf = (noteId: string, parentPath: string) => {
        return noteId === parentPath || noteId.startsWith(parentPath + "/")
      }

      return {
        notes: s.notes.filter(n => !isChildOf(n.id, id)),
        activeNoteId:
          s.activeNoteId && (s.activeNoteId === id || s.activeNoteId.startsWith(id + "/"))
            ? null
            : s.activeNoteId,
      }
    })
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  toggleFolder: (id) =>
    set(s => {
      const next = new Set(s.expandedFolders)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedFolders: next }
    }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find(n => n.id === activeNoteId)
  },

  openNotesFolder: async () => {
    await window.electron.invoke("notes:openFolder")
  },
}))
