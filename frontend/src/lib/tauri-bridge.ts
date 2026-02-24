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

// Channel → Tauri command mapping + argument transform
const channelMap: Record<string, (payload?: any) => Promise<any>> = {
  // ── Tasks ──
  "tasks:create":            (title) => invoke("tasks_create", { title }),
  "tasks:list":              ()      => invoke("tasks_list"),
  "tasks:updateStatus":      (p)     => invoke("tasks_update_status", { id: p.id, status: p.status }),
  "tasks:updateDueDate":     (p)     => invoke("tasks_update_due_date", { id: p.id, dueDate: p.due_date }),
  "tasks:delete":            (id)    => invoke("tasks_delete", { id }),
  "tasks:completionHistory": ()      => invoke("tasks_completion_history"),
  "tasks:withDueDates":      ()      => invoke("tasks_with_due_dates"),

  // ── Pomodoro ──
  "pomodoro:start":          ()      => invoke("pomodoro_start"),
  "pomodoro:pause":          ()      => invoke("pomodoro_pause"),
  "pomodoro:stop":           ()      => invoke("pomodoro_stop"),
  "pomodoro:getSettings":    ()      => invoke("pomodoro_get_settings"),
  "pomodoro:updateSettings": (p)     => invoke("pomodoro_update_settings", { workMinutes: p.workMinutes, breakMinutes: p.breakMinutes }),

  // ── Stopwatch ──
  "stopwatch:start":         ()      => invoke("stopwatch_start"),
  "stopwatch:pause":         ()      => invoke("stopwatch_pause"),
  "stopwatch:stop":          ()      => invoke("stopwatch_stop"),

  // ── Focus history ──
  "focus:history":           ()      => invoke("focus_history"),
  "focus:todayMinutes":      ()      => invoke("focus_today_minutes"),
  "focus:yesterdayMinutes":  ()      => invoke("focus_yesterday_minutes"),

  // ── Notes ──
  "notes:list":              ()      => invoke("notes_list"),
  "notes:get":               (id)    => invoke("notes_get", { id }),
  "notes:create":            (p)     => invoke("notes_create", { payload: p }),
  "notes:createFolder":      (p)     => invoke("notes_create_folder", { payload: p }),
  "notes:update":            (p)     => invoke("notes_update", { payload: p }),
  "notes:delete":            (id)    => invoke("notes_delete", { id }),
  "notes:openFolder":        ()      => invoke("notes_open_folder").then((path: any) => { open(path as string); }),
  "notes:getRoot":           ()      => invoke("notes_get_root"),

  // ── Timer Presets ──
  "timer-presets:list":            ()  => invoke("timer_presets_list"),
  "timer-presets:create":          (p) => invoke("timer_presets_create", { name: p.name, durationMinutes: p.duration_minutes, isFavorite: p.is_favorite }),
  "timer-presets:update":          (p) => invoke("timer_presets_update", { id: p.id, name: p.name, durationMinutes: p.duration_minutes, isFavorite: p.is_favorite }),
  "timer-presets:delete":          (id) => invoke("timer_presets_delete", { id }),
  "timer-presets:toggle-favorite": (id) => invoke("timer_presets_toggle_favorite", { id }),

  // ── Calendar ──
  "calendar:create":      (p)     => invoke("calendar_create", { event: p }),
  "calendar:list":        (month) => invoke("calendar_list", { month: month ?? null }),
  "calendar:listByDate":  (date)  => invoke("calendar_list_by_date", { date }),
  "calendar:listByRange": (p)     => invoke("calendar_list_by_range", { from: p.from, to: p.to }),
  "calendar:update":      (p)     => { const { id, ...fields } = p; return invoke("calendar_update", { payload: { id, ...fields } }); },
  "calendar:delete":      (id)    => invoke("calendar_delete", { id }),
  "calendar:activeDates": (month) => invoke("calendar_active_dates", { month }),

  // ── Window controls ──
  "window-minimize": () => getCurrentWindow().minimize(),
  "window-maximize": () => getCurrentWindow().toggleMaximize(),
  "window-close":    () => getCurrentWindow().close(),
}

// Event listeners (for timer:update from backend)
const eventListeners: Record<string, (listener: (...args: any[]) => void) => void> = {
  "timer:update": (listener) => {
    listen<any>("timer:update", (event) => {
      listener(event.payload)
    })
  },
}

// Expose the bridge on window.electron for backward compatibility
;(window as any).electron = {
  invoke: async (channel: string, payload?: unknown): Promise<any> => {
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

  on: (channel: string, listener: (...args: any[]) => void) => {
    const setup = eventListeners[channel]
    if (setup) {
      setup(listener)
    } else {
      console.warn(`[Tauri Bridge] Unknown event channel: ${channel}`)
    }
  },
}

export {}
