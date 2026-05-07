import { create } from "zustand"

export type UserStatus = "learning" | "working" | "idle"

export const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; color: string; glow: string; wash: string; border: string }
> = {
  learning: {
    label: "Learning",
    color: "#38bdf8",
    glow: "0 0 6px #38bdf8",
    wash: "rgba(56, 189, 248, 0.12)",
    border: "rgba(56, 189, 248, 0.26)",
  },
  working: {
    label: "Working",
    color: "#34d399",
    glow: "0 0 6px #34d399",
    wash: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.26)",
  },
  idle: {
    label: "Idle",
    color: "#94a3b8",
    glow: "0 0 6px #94a3b8",
    wash: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.24)",
  },
}

type UserStore = {
  name: string
  avatar: string | null   // base64 data-url
  status: UserStatus
  setName: (name: string) => void
  setAvatar: (dataUrl: string | null) => void
  setStatus: (status: UserStatus) => void
  hydrate: () => void
}

const STORAGE_KEY = "chroni-user-profile"

function loadFromStorage(): Partial<Pick<UserStore, "name" | "avatar" | "status">> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveToStorage(data: { name: string; avatar: string | null; status: UserStatus }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* quota exceeded — ignore */ }
}

export const useUserStore = create<UserStore>((set, get) => ({
  name: "User",
  avatar: null,
  status: "idle",

  setName: (name) => {
    const trimmed = name.trim() || "User"
    set({ name: trimmed })
    saveToStorage({ ...get(), name: trimmed })
  },

  setAvatar: (dataUrl) => {
    set({ avatar: dataUrl })
    saveToStorage({ ...get(), avatar: dataUrl })
  },

  setStatus: (status) => {
    set({ status })
    saveToStorage({ ...get(), status })
  },

  hydrate: () => {
    const saved = loadFromStorage()
    if (saved.name || saved.avatar || saved.status) {
      set({
        name: saved.name ?? "User",
        avatar: saved.avatar ?? null,
        status: saved.status ?? "idle",
      })
    }
  },
}))
