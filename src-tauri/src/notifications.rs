use crate::db::Database;
use crate::commands::calendar;
use chrono::TimeZone;
use tauri_plugin_notification::NotificationExt;

/// Spawn a background thread that checks for pending calendar reminders
/// every 30 seconds and fires desktop notifications.
pub fn spawn_notification_scheduler(app: tauri::AppHandle, db: &'static Database) {
    std::thread::spawn(move || {
        log::info!("[Notifications] Scheduler started");
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            if let Err(e) = check_and_notify(&app, db) {
                log::error!("[Notifications] Error during check: {}", e);
            }
        }
    });
}

fn check_and_notify(app: &tauri::AppHandle, db: &Database) -> Result<(), String> {
    let now = chrono::Local::now();
    let today_str = now.format("%Y-%m-%d").to_string();

    // Pass LOCAL date string so the query uses the right date window
    let events = calendar::get_pending_notifications(db, &today_str)
        .map_err(|e| format!("DB query failed: {}", e))?;

    log::debug!(
        "[Notifications] Tick at {} — {} pending event(s) in window",
        now.format("%H:%M:%S"),
        events.len()
    );

    for event in events {
        let reminder_minutes = match event.reminder_minutes {
            Some(m) => m,
            None => continue,
        };

        let start_time = match &event.start_time {
            Some(t) => t.clone(),
            None => continue,
        };

        // Parse event datetime: date + start_time
        // start_time can be "HH:MM" or "HH:MM:SS"
        let datetime_str = if start_time.len() <= 5 {
            format!("{}T{}:00", event.date, start_time)
        } else {
            format!("{}T{}", event.date, start_time)
        };

        let event_time = match chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S") {
            Ok(dt) => dt,
            Err(e) => {
                log::warn!(
                    "[Notifications] Cannot parse datetime '{}' for event #{} '{}': {}",
                    datetime_str, event.id, event.title, e
                );
                continue;
            }
        };

        // Convert to local time for comparison
        let event_local = match chrono::Local.from_local_datetime(&event_time).single() {
            Some(dt) => dt,
            None => {
                log::warn!(
                    "[Notifications] Ambiguous local datetime for event #{} '{}'",
                    event.id, event.title
                );
                continue;
            }
        };

        // Calculate when notification should fire
        let notify_at = event_local - chrono::Duration::minutes(reminder_minutes);

        log::debug!(
            "[Notifications] Event #{} '{}' — event_at={}, notify_at={}, now={}",
            event.id, event.title,
            event_local.format("%Y-%m-%d %H:%M"),
            notify_at.format("%Y-%m-%d %H:%M"),
            now.format("%Y-%m-%d %H:%M"),
        );

        // Fire if we're within the notification window:
        //   past the notify time, but not more than 5 minutes past the event start
        //   (grace window so we don't miss "at time" notifications that land between checks)
        let grace = event_local + chrono::Duration::minutes(5);
        if now >= notify_at && now < grace {
            // Determine notification body
            let diff_minutes = (event_local - now).num_minutes().max(0);
            let body = if diff_minutes <= 0 {
                format!("{} is starting now!", event.title)
            } else if diff_minutes < 60 {
                format!(
                    "{} starts in {} minute{}",
                    event.title, diff_minutes,
                    if diff_minutes == 1 { "" } else { "s" }
                )
            } else {
                let hours = diff_minutes / 60;
                let mins = diff_minutes % 60;
                if mins == 0 {
                    format!(
                        "{} starts in {} hour{}",
                        event.title, hours,
                        if hours == 1 { "" } else { "s" }
                    )
                } else {
                    format!("{} starts in {}h {}m", event.title, hours, mins)
                }
            };

            let type_label = match event.event_type.as_str() {
                "reminder" => "⏰ Reminder",
                "focus" => "🎯 Focus Session",
                "task" => "📋 Task Due",
                _ => "📅 Event",
            };

            let title = format!("{} — {}", type_label, format_time_12h(&start_time));

            // Send notification via Tauri plugin
            match app.notification()
                .builder()
                .title(&title)
                .body(&body)
                .show()
            {
                Ok(_) => {
                    log::info!("[Notifications] ✅ Sent: {} — {}", title, body);
                }
                Err(e) => {
                    log::error!("[Notifications] ❌ Failed to send notification for event #{}: {}", event.id, e);
                    // Don't mark as notified so we retry next cycle
                    continue;
                }
            }

            // Mark as notified so we don't fire again
            calendar::mark_notified(db, event.id);
        }
    }

    Ok(())
}

fn format_time_12h(time: &str) -> String {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() < 2 {
        return time.to_string();
    }
    let h: i32 = parts[0].parse().unwrap_or(0);
    let m: i32 = parts[1].parse().unwrap_or(0);
    let ampm = if h >= 12 { "PM" } else { "AM" };
    let h12 = if h % 12 == 0 { 12 } else { h % 12 };
    format!("{}:{:02} {}", h12, m, ampm)
}
