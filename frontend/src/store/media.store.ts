import { create } from "zustand"

export interface MediaInfo {
  title: string
  artist: string
  source_app: string
  thumbnail: string | null
  is_playing: boolean
}

interface MediaState {
  current: MediaInfo | null
  sessions: MediaInfo[]
  loading: boolean
  error: string | null
  fetchCurrent: () => Promise<void>
  fetchSessions: () => Promise<void>
  playPause: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  clearError: () => void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  current: null,
  sessions: [],
  loading: false,
  error: null,

  fetchCurrent: async () => {
    set({ loading: true })
    try {
      const current = await window.electron.invoke("media:getCurrent") as MediaInfo | null
      set({ current, loading: false, error: null })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  fetchSessions: async () => {
    try {
      const sessions = await window.electron.invoke("media:getAllSessions") as MediaInfo[]
      set({ sessions, error: null })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  playPause: async () => {
    const current = get().current
    try {
      await window.electron.invoke("media:playPause")
      if (current) {
        set({ current: { ...current, is_playing: !current.is_playing }, error: null })
      }
      setTimeout(() => void get().fetchCurrent(), 350)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  next: async () => {
    try {
      await window.electron.invoke("media:next")
      setTimeout(() => void get().fetchCurrent(), 450)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  previous: async () => {
    try {
      await window.electron.invoke("media:previous")
      setTimeout(() => void get().fetchCurrent(), 450)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  clearError: () => set({ error: null }),
}))
