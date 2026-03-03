import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-shell"

/**
 * Bridge layer: maps Electron-style IPC channel names → Tauri commands.
 *
 * Electron used:   window.electron.invoke("channel:name", payload)
 * Tauri uses:      invoke("command_name", { ...args })
 *
 * This bridge keeps the same `window.electron.invoke(channel, payload)` API
 * so all existing stores/components work with minimal changes.
 */

// ── Typed request/response contracts ────────────────────────────────────────

export interface Task {
  id: number
  title: string
  /** Canonical values: "todo" | "in-progress" | "done" */
  status: "todo" | "in-progress" | "done"
  due_date?: string | null
  completed_at?: string | null
  created_at?: string
}

export interface DayActivity { date: string; count: number }

export interface PomodoroSettings { work_minutes: number; break_minutes: number }

export interface FocusSession {
  id: number
  type: "work" | "stopwatch"
  duration_seconds: number
  completed_at?: string
}

export interface TimerPreset {
  id: number
  name: string
  duration_minutes: number
  is_favorite: boolean
  created_at?: string
}

export interface CalendarEvent {
  id: number
  title: string
  type: string
  date: string
  start_time?: string | null
  end_time?: string | null
  duration_minutes?: number | null
  color?: string | null
  notes?: string | null
  task_id?: number | null
  reminder_minutes?: number | null
  notified?: number | null
  created_at?: string | null
}

export interface ActiveDate { date: string; type: string }

export interface UpdateInfo {
  current_version: string
  latest_version: string
  release_name: string
  release_notes: string
  download_url: string
  installer_name: string
  installer_size: number
  release_url: string
  update_available: boolean
}

export interface TimerUpdate {
  seconds: number
  isRunning: boolean
  isPaused: boolean
  mode: "work" | "break"
  tool: "pomodoro" | "timer" | "stopwatch"
}

export interface UpdaterProgress { percent: number }

// ── Channel → Tauri command mapping ─────────────────────────────────────────

const channelMap: Record<string, (payload?: unknown) => Promise<unknown>> = {
  // ── Tasks ──
  "tasks:create":            (title) => invoke<Task>("tasks_create", { title }),
  "tasks:list":              ()      => invoke<Task[]>("tasks_list"),
  "tasks:updateStatus":      (p)     => { const { id, status } = p as { id: number; status: string }; return invoke<void>("tasks_update_status", { id, status }); },
  "tasks:updateDueDate":     (p)     => { const { id, due_date } = p as { id: number; due_date: string | null }; return invoke<void>("tasks_update_due_date", { id, dueDate: due_date }); },
  "tasks:delete":            (id)    => invoke<void>("tasks_delete", { id }),
  "tasks:completionHistory": ()      => invoke<DayActivity[]>("tasks_completion_history"),
  "tasks:withDueDates":      ()      => invoke<Task[]>("tasks_with_due_dates"),

  // ── Pomodoro ──
  "pomodoro:start":          ()      => invoke<void>("pomodoro_start"),
  "pomodoro:pause":          ()      => invoke<void>("pomodoro_pause"),
  "pomodoro:stop":           ()      => invoke<void>("pomodoro_stop"),
  "pomodoro:getSettings":    ()      => invoke<PomodoroSettings>("pomodoro_get_settings"),
  "pomodoro:updateSettings": (p)     => { const { workMinutes, breakMinutes } = p as { workMinutes: number; breakMinutes: number }; return invoke<void>("pomodoro_update_settings", { workMinutes, breakMinutes }); },

  // ── Stopwatch ──
  "stopwatch:start":         ()      => invoke<void>("stopwatch_start"),
  "stopwatch:pause":         ()      => invoke<void>("stopwatch_pause"),
  "stopwatch:stop":          ()      => invoke<void>("stopwatch_stop"),

  // ── Timer notifications ──
  "timer:notify":            (p)     => { const { title, body } = p as { title: string; body: string }; return invoke<void>("timer_notify", { title, body }); },

  // ── Focus history ──
  "focus:history":           ()      => invoke<FocusSession[]>("focus_history"),
  "focus:todayMinutes":      ()      => invoke<number>("focus_today_minutes"),
  "focus:yesterdayMinutes":  ()      => invoke<number>("focus_yesterday_minutes"),

  // ── Notes ──
  "notes:list":              ()      => invoke<NoteEntry[]>("notes_list"),
  "notes:get":               (id)    => invoke<NoteEntry | null>("notes_get", { id }),
  "notes:create":            (p)     => invoke<NoteEntry>("notes_create", { payload: p }),
  "notes:createFolder":      (p)     => invoke<NoteEntry>("notes_create_folder", { payload: p }),
  "notes:update":            (p)     => invoke<NoteEntry | null>("notes_update", { payload: p }),
  "notes:delete":            (id)    => invoke<void>("notes_delete", { id }),
  "notes:openFolder":        ()      => invoke<string>("notes_open_folder").then((path) => { open(path); }),
  "notes:getRoot":           ()      => invoke<string>("notes_get_root"),

  // ── Timer Presets ──
  "timer-presets:list":            ()  => invoke<TimerPreset[]>("timer_presets_list"),
  "timer-presets:create":          (p) => { const { name, duration_minutes, is_favorite } = p as { name: string; duration_minutes: number; is_favorite: boolean }; return invoke<TimerPreset>("timer_presets_create", { name, durationMinutes: duration_minutes, isFavorite: is_favorite }); },
  "timer-presets:update":          (p) => { const { id, name, duration_minutes, is_favorite } = p as { id: number; name: string; duration_minutes: number; is_favorite: boolean }; return invoke<TimerPreset>("timer_presets_update", { id, name, durationMinutes: duration_minutes, isFavorite: is_favorite }); },
  "timer-presets:delete":          (id) => invoke<void>("timer_presets_delete", { id }),
  "timer-presets:toggle-favorite": (id) => invoke<void>("timer_presets_toggle_favorite", { id }),

  // ── Calendar ──
  "calendar:create":      (p)     => invoke<CalendarEvent>("calendar_create", { event: p }),
  "calendar:list":        (month) => invoke<CalendarEvent[]>("calendar_list", { month: month ?? null }),
  "calendar:listByDate":  (date)  => invoke<CalendarEvent[]>("calendar_list_by_date", { date }),
  "calendar:listByRange": (p)     => { const { from, to } = p as { from: string; to: string }; return invoke<CalendarEvent[]>("calendar_list_by_range", { from, to }); },
  "calendar:update":      (p)     => { const { id, ...fields } = p as { id: number; [k: string]: unknown }; return invoke<CalendarEvent>("calendar_update", { payload: { id, ...fields } }); },
  "calendar:delete":      (id)    => invoke<void>("calendar_delete", { id }),
  "calendar:activeDates": (month) => invoke<ActiveDate[]>("calendar_active_dates", { month }),

  // ── Window controls ──
  "window-minimize": () => getCurrentWindow().minimize(),
  "window-maximize": () => getCurrentWindow().toggleMaximize(),
  "window-close":    () => getCurrentWindow().close(),

  // ── Updater ──
  "updater:check":              ()  => invoke<UpdateInfo>("updater_check"),
  "updater:downloadAndInstall": (p) => { const { download_url, installer_name } = p as { download_url: string; installer_name: string }; return invoke<void>("updater_download_and_install", { downloadUrl: download_url, installerName: installer_name }); },
}

// ── NoteEntry (used inside channelMap above) ─────────────────────────────────
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
}

// ── Event listeners ──────────────────────────────────────────────────────────
//
// Each factory returns a Promise<() => void> — the inner function is the
// Tauri unlisten handle.  `window.electron.on` wraps this so callers get a
// synchronous cleanup function that resolves and calls unlisten for them.
//
const eventListenerFactories: Record<
  string,
  (listener: (data: unknown) => void) => Promise<() => void>
> = {
  "timer:update": (listener) =>
    listen<TimerUpdate>("timer:update", (event) => {
      listener(event.payload)
    }),

  "updater:progress": (listener) =>
    listen<UpdaterProgress>("updater:progress", (event) => {
      listener(event.payload)
    }),
}

// Expose the bridge on window.electron for backward compatibility
;(window as any).electron = {
  invoke: async (channel: string, payload?: unknown): Promise<unknown> => {
    const handler = channelMap[channel]
    if (!handler) {
      console.warn(`[Tauri Bridge] Unknown channel: ${channel}`)
      return undefined
    }
    try {
      return await handler(payload)
    } catch (err) {
      console.error(`[Tauri Bridge] Error on "${channel}":`, err)
      throw err
    }
  },

  /**
   * Subscribe to a backend event.
   *
   * Returns a cleanup function — callers MUST call it (e.g. from useEffect
   * return) to avoid duplicate listeners under React StrictMode.
   *
   * The cleanup is safe to call multiple times and before the async unlisten
   * resolves (it queues the unlisten correctly).
   */
  on: (channel: string, listener: (data: unknown) => void): (() => void) => {
    const factory = eventListenerFactories[channel]
    if (!factory) {
      console.warn(`[Tauri Bridge] Unknown event channel: ${channel}`)
      return () => {}
    }

    let active = true
    let unlistenFn: (() => void) | null = null

    factory(listener).then((unlisten) => {
      if (active) {
        unlistenFn = unlisten
      } else {
        // Component already unmounted before the promise resolved — clean up immediately.
        unlisten()
      }
    }).catch((err) => {
      console.error(`[Tauri Bridge] Failed to subscribe to "${channel}":`, err)
    })

    return () => {
      active = false
      if (unlistenFn) {
        unlistenFn()
        unlistenFn = null
      }
    }
  },
}

export {}
