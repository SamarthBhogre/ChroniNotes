import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

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
  parent_id?: number | null
  sort_order: number
  priority?: string | null
  description?: string | null
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
  "tasks:create":            (p) => {
    if (typeof p === "string") return invoke<Task>("tasks_create", { title: p })
    const { title, parentId } = p as { title: string; parentId?: number | null }
    return invoke<Task>("tasks_create", { title, parentId: parentId ?? null })
  },
  "tasks:list":              ()      => invoke<Task[]>("tasks_list"),
  "tasks:updateStatus":      (p)     => { const { id, status } = p as { id: number; status: string }; return invoke<void>("tasks_update_status", { id, status }); },
  "tasks:updateDueDate":     (p)     => { const { id, due_date } = p as { id: number; due_date: string | null }; return invoke<void>("tasks_update_due_date", { id, dueDate: due_date }); },
  "tasks:updatePriority":    (p)     => { const { id, priority } = p as { id: number; priority: string | null }; return invoke<void>("tasks_update_priority", { id, priority }); },
  "tasks:updateDescription": (p)     => { const { id, description } = p as { id: number; description: string | null }; return invoke<void>("tasks_update_description", { id, description }); },
  "tasks:reorder":           (p)     => invoke<void>("tasks_reorder", { taskOrders: p as [number, number][] }),
  "tasks:delete":            (id)    => invoke<void>("tasks_delete", { id }),
  "tasks:archive":           (id)    => invoke<void>("tasks_archive", { id }),
  "tasks:archiveDone":       ()      => invoke<number>("tasks_archive_done"),
  "tasks:restore":           (id)    => invoke<void>("tasks_restore", { id }),
  "tasks:listArchived":      ()      => invoke<Task[]>("tasks_list_archived"),
  "tasks:completionHistory": ()      => invoke<DayActivity[]>("tasks_completion_history"),
  "tasks:withDueDates":      ()      => invoke<Task[]>("tasks_with_due_dates"),

  // ── Habits ──
  "habits:create":           (p)     => {
    const { name, icon, color, frequency, target_count, section, start_date, reminder_time, goal_type, notes } =
      p as Record<string, unknown>
    return invoke<any>("habits_create", {
      name,
      icon: icon ?? null,
      color: color ?? null,
      frequency: frequency ?? null,
      targetCount: target_count ?? null,
      section: section ?? null,
      startDate: start_date ?? null,
      reminderTime: reminder_time ?? null,
      goalType: goal_type ?? null,
      notes: notes ?? null,
    })
  },
  "habits:list":             ()      => invoke<any[]>("habits_list"),
  "habits:listArchived":     ()      => invoke<any[]>("habits_list_archived"),
  "habits:update":           (p)     => {
    const { id, name, icon, color, target_count, frequency, section, start_date, reminder_time, goal_type, sort_order, notes } =
      p as Record<string, unknown>
    return invoke<void>("habits_update", {
      id,
      name: name ?? null,
      icon: icon ?? null,
      color: color ?? null,
      frequency: frequency ?? null,
      targetCount: target_count ?? null,
      section: section ?? null,
      startDate: start_date ?? null,
      reminderTime: reminder_time ?? null,
      goalType: goal_type ?? null,
      sortOrder: sort_order ?? null,
      notes: notes ?? null,
    })
  },
  "habits:archive":          (id)    => invoke<void>("habits_archive", { id }),
  "habits:restore":          (id)    => invoke<void>("habits_restore", { id }),
  "habits:delete":           (id)    => invoke<void>("habits_delete", { id }),
  "habits:log":              (p)     => {
    const { habit_id, date } = p as { habit_id: number; date: string }
    return invoke<void>("habits_log", { habitId: habit_id, date })
  },
  "habits:unlog":            (p)     => {
    const { habit_id, date } = p as { habit_id: number; date: string }
    return invoke<void>("habits_unlog", { habitId: habit_id, date })
  },
  "habits:logsRange":        (p)     => {
    const { habit_id, start_date, end_date } = p as { habit_id: number; start_date: string; end_date: string }
    return invoke<any[]>("habits_logs_range", { habitId: habit_id, startDate: start_date, endDate: end_date })
  },
  "habits:allLogs":          (p)     => {
    const { start_date, end_date, startDate, endDate } = p as Record<string, string>
    return invoke<any[]>("habits_all_logs", { startDate: startDate ?? start_date, endDate: endDate ?? end_date })
  },
  "habits:streak":           (p)     => {
    const { habit_id } = p as { habit_id: number }
    return invoke<any>("habits_streak", { habitId: habit_id })
  },

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
  "notes:openFolder":        ()      => invoke<string>("notes_open_folder"),
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

  // ── Spotify ──
  "spotify:authStatus":   ()  => invoke<{ logged_in: boolean }>("spotify_auth_status"),
  "spotify:getAccessToken": () => invoke<string>("spotify_get_access_token"),
  "spotify:login":        ()  => invoke<void>("spotify_login"),
  "spotify:logout":       ()  => invoke<void>("spotify_logout"),
  "spotify:setActiveDevice": (p) => {
    const { deviceId, play } = p as { deviceId: string; play?: boolean }
    return invoke<void>("spotify_set_active_device", { deviceId, play: play ?? false })
  },
  "spotify:getPlayback":  ()  => invoke<unknown>("spotify_get_playback"),
  "spotify:play":         ()  => invoke<void>("spotify_play"),
  "spotify:pause":        ()  => invoke<void>("spotify_pause"),
  "spotify:next":         ()  => invoke<void>("spotify_next"),
  "spotify:previous":     ()  => invoke<void>("spotify_previous"),
  "spotify:setVolume":    (v) => invoke<void>("spotify_set_volume", { volume: v as number }),
  "spotify:setShuffle":   (p) => {
    const { state } = p as { state: boolean }
    return invoke<void>("spotify_set_shuffle", { state })
  },
  "spotify:setRepeat":    (p) => {
    const { state } = p as { state: string }
    return invoke<void>("spotify_set_repeat", { state })
  },
  "spotify:getDevices":   ()  => invoke<unknown[]>("spotify_get_devices"),
  "spotify:getPlaylists": ()  => invoke<unknown[]>("spotify_get_playlists"),
  "spotify:playPlaylist": (p) => {
    const { playlistUri, deviceId } = p as { playlistUri: string; deviceId?: string | null }
    return invoke<void>("spotify_play_playlist", { playlistUri, deviceId: deviceId ?? null })
  },
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

  "spotify:auth-complete": (listener) =>
    listen<void>("spotify:auth-complete", () => {
      listener(undefined)
    }),

  "spotify:auth-error": (listener) =>
    listen<string>("spotify:auth-error", (event) => {
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
