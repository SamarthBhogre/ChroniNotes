import { Notification, BrowserWindow, app } from "electron"

/**
 * Notification Service for Windows Desktop Notifications
 * Uses Electron's native Notification API with custom branding
 * Displays notifications in Windows notification area (system tray)
 */

/* ────────────────────────────── TYPES ─────────────────────────────── */

export type NotificationType = "workStart" | "breakStart" | "pause" | "stop" | "breakEnd" | "stopwatchStart"

interface NotificationConfig {
  title: string
  message: string
  sound?: boolean
  timeout?: number
  urgency?: "normal" | "critical" | "low"
}

/* ─────────────────────── APP CONFIGURATION ──────────────────────── */

// Set the app name to show in notifications instead of "Electron"
const APP_NAME = "ChroniNotes"

// Configure app user model ID for Windows notifications (shows custom app name)
if (process.platform === "win32") {
  app.setAppUserModelId(APP_NAME)
}

/* ─────────────────────── NOTIFICATION PRESETS ──────────────────────── */

const notificationConfigs: Record<NotificationType, NotificationConfig> = {
  workStart: {
    title: "Work Session Started",
    message: "Focus session active. Minimize distractions and maintain your concentration for the next 25 minutes.",
    sound: true,
    timeout: 5,
    urgency: "normal",
  },
  breakStart: {
    title: "Break Time",
    message: "Excellent progress. Take a well-deserved break. Stand up, stretch, and refresh for 5 minutes.",
    sound: true,
    timeout: 5,
    urgency: "normal",
  },
  pause: {
    title: "Session Paused",
    message: "Your timer has been paused. Resume your session whenever you are ready to continue.",
    sound: false,
    timeout: 3,
    urgency: "low",
  },
  stop: {
    title: "Session Stopped",
    message: "Your timer has been stopped. Start a new session when you are ready to continue working.",
    sound: false,
    timeout: 3,
    urgency: "low",
  },
  breakEnd: {
    title: "Break Completed",
    message: "Your break time is complete. Ready to start another focus session and maintain your productivity streak?",
    sound: true,
    timeout: 5,
    urgency: "normal",
  },
  stopwatchStart: {
    title: "Stopwatch Started",
    message: "Time tracking is now active. Monitor your elapsed time and keep up the pace.",
    sound: true,
    timeout: 4,
    urgency: "normal",
  },
}

/* ──────────────────────────── MAIN FUNCTIONS ──────────────────────── */

/**
 * Send a notification to the user using Electron's native API
 * This displays in Windows notification area (system tray/toast notification)
 * 
 * @param type - The type of notification to send
 * @param window - Optional reference to the main window
 * @returns Promise that resolves when notification is processed
 */
export function sendNotification(type: NotificationType, window: BrowserWindow | null | undefined = undefined): Promise<void> {
  return new Promise((resolve) => {
    const config = notificationConfigs[type]

    if (!config) {
      console.error(`[Notification] Unknown notification type: ${type}`)
      resolve()
      return
    }

    try {
      // Use Electron's native Notification API
      // Check if Notification is supported on this system
      if (!Notification.isSupported()) {
        console.warn("[Notification] Native notifications are not supported on this system")
        resolve()
        return
      }

      // Create and show the notification with custom app branding
      const notification = new Notification({
        title: config.title,
        body: config.message,
        silent: !config.sound,  // silent: false = play sound, silent: true = no sound
        timeoutType: "default",
        urgency: config.urgency || "normal",
      })

      // Handle notification click — bring window to focus
      notification.on("click", () => {
        if (window) {
          if (window.isMinimized()) {
            window.restore()
          }
          window.focus()
        }
        notification.close()
      })

      // Handle notification close
      notification.on("close", () => {
        console.log(`[Notification] Closed: ${type}`)
      })

      // Show the notification in Windows notification area
      notification.show()

      console.log(`[Notification] Sent: ${type} | Title: "${config.title}"`)

      // Auto-dismiss after configured timeout
      if (config.timeout && config.timeout > 0) {
        setTimeout(() => {
          try {
            notification.close()
          } catch (e) {
            // Notification may already be closed
          }
        }, config.timeout * 1000)
      }

      resolve()
    } catch (error) {
      console.error(`[Notification] Failed to send (${type}):`, error)
      resolve()  // Always resolve, never reject
    }
  })
}

/**
 * Send work session started notification
 */
export async function notifyWorkSessionStart(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("workStart", window)
}

/**
 * Send break session started notification
 */
export async function notifyBreakSessionStart(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("breakStart", window)
}

/**
 * Send break ended notification
 */
export async function notifyBreakEnded(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("breakEnd", window)
}

/**
 * Send timer paused notification
 */
export async function notifyTimerPaused(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("pause", window)
}

/**
 * Send timer stopped notification
 */
export async function notifyTimerStopped(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("stop", window)
}

/**
 * Send stopwatch started notification
 */
export async function notifyStopwatchStart(window: BrowserWindow | null | undefined = undefined): Promise<void> {
  await sendNotification("stopwatchStart", window)
}
