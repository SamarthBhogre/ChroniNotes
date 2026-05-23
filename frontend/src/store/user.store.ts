import { create } from "zustand"

export type UserStatus = "working" | "meeting" | "dnd" | "idle" | "custom"
type StatusActivityLog = Record<string, Partial<Record<UserStatus, number>>>

export const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; color: string; glow: string; wash: string; border: string }
> = {
  working: {
    label: "Working",
    color: "#34d399",
    glow: "0 0 6px #34d399",
    wash: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.26)",
  },
  meeting: {
    label: "In a meeting",
    color: "#f59e0b",
    glow: "0 0 6px #f59e0b",
    wash: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.26)",
  },
  dnd: {
    label: "Do not disturb",
    color: "#f43f5e",
    glow: "0 0 6px #f43f5e",
    wash: "rgba(244, 63, 94, 0.12)",
    border: "rgba(244, 63, 94, 0.26)",
  },
  idle: {
    label: "Idle",
    color: "#94a3b8",
    glow: "0 0 6px #94a3b8",
    wash: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.24)",
  },
  custom: {
    label: "Custom status",
    color: "#a78bfa",
    glow: "0 0 6px #a78bfa",
    wash: "rgba(167, 139, 250, 0.12)",
    border: "rgba(167, 139, 250, 0.26)",
  },
}

type PersistedUser = Pick<
  UserStore,
  "name" | "avatar" | "status" | "customStatus" | "statusStartedAt" | "activityLog"
>

type UserStore = {
  name: string
  avatar: string | null
  status: UserStatus
  customStatus: string
  statusStartedAt: number
  activityLog: StatusActivityLog
  setName: (name: string) => void
  setAvatar: (dataUrl: string | null) => void
  setStatus: (status: UserStatus) => void
  setCustomStatus: (label: string) => void
  getTodayActivity: () => Partial<Record<UserStatus, number>>
  hydrate: () => void
}

const STORAGE_KEY = "chroni-user-profile"
const VALID_STATUSES = new Set<UserStatus>(["working", "meeting", "dnd", "idle", "custom"])

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeStatus(value: unknown): UserStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as UserStatus)
    ? value as UserStatus
    : "idle"
}

function withElapsedActivity(state: UserStore, now = Date.now()): StatusActivityLog {
  const elapsed = Math.max(0, Math.floor((now - state.statusStartedAt) / 1000))
  if (elapsed <= 0) return state.activityLog

  const day = todayKey()
  return {
    ...state.activityLog,
    [day]: {
      ...state.activityLog[day],
      [state.status]: (state.activityLog[day]?.[state.status] ?? 0) + elapsed,
    },
  }
}

function loadFromStorage(): Partial<PersistedUser> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function persistable(state: UserStore): PersistedUser {
  return {
    name: state.name,
    avatar: state.avatar,
    status: state.status,
    customStatus: state.customStatus,
    statusStartedAt: state.statusStartedAt,
    activityLog: state.activityLog,
  }
}

function saveToStorage(data: PersistedUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded - keep runtime state
  }
}

export const useUserStore = create<UserStore>((set, get) => ({
  name: "User",
  avatar: null,
  status: "idle",
  customStatus: "Custom status",
  statusStartedAt: Date.now(),
  activityLog: {},

  setName: (name) => {
    const trimmed = name.trim() || "User"
    set({ name: trimmed })
    saveToStorage(persistable(get()))
  },

  setAvatar: (dataUrl) => {
    set({ avatar: dataUrl })
    saveToStorage(persistable(get()))
  },

  setStatus: (status) => {
    const state = get()
    if (state.status === status) return
    const now = Date.now()
    set({
      status,
      statusStartedAt: now,
      activityLog: withElapsedActivity(state, now),
    })
    saveToStorage(persistable(get()))
  },

  setCustomStatus: (label) => {
    const customStatus = label.trim().slice(0, 32) || "Custom status"
    set({ customStatus })
    saveToStorage(persistable(get()))
  },

  getTodayActivity: () => {
    const state = get()
    const day = todayKey()
    const base = state.activityLog[day] ?? {}
    const elapsed = Math.max(0, Math.floor((Date.now() - state.statusStartedAt) / 1000))
    return {
      ...base,
      [state.status]: (base[state.status] ?? 0) + elapsed,
    }
  },

  hydrate: () => {
    const saved = loadFromStorage()
    if (saved.name || saved.avatar || saved.status || saved.customStatus || saved.activityLog) {
      set({
        name: saved.name ?? "User",
        avatar: saved.avatar ?? null,
        status: normalizeStatus(saved.status),
        customStatus: saved.customStatus ?? "Custom status",
        statusStartedAt: saved.statusStartedAt ?? Date.now(),
        activityLog: saved.activityLog ?? {},
      })
    }
  },
}))
