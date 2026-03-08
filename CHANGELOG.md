# Changelog

All notable changes to ChroniNotes are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] - 2026-03-08

### Added

- **Spotify shuffle toggle:** Shuffle on/off button in playback controls with visual active state. Uses `PUT /me/player/shuffle` via new `spotify:setShuffle` bridge channel and `spotify_set_shuffle` backend command.
- **Spotify repeat/loop control:** Repeat button cycles through off → context (all) → track (single-song loop) → off. Uses `PUT /me/player/repeat` via `spotify:setRepeat` bridge channel. Active mode shown with green highlight and dot indicator; track-repeat shows a "1" badge icon.
- **Spotify playback state includes shuffle/repeat:** `spotify_get_playback` now returns `shuffle_state` (bool) and `repeat_state` ("off"/"context"/"track") from the Spotify Web API response. UI state auto-refreshes after toggling.
- **Habits module production-ready (Phase 2):**
  - **Section-based grouping:** Habits can be organized into collapsible sections (e.g. "Health", "Learning"). Uncategorized habits are grouped together.
  - **Goal types:** "Build" habits (`at_least` — reach target) and "Break" habits (`at_most` — stay under limit). Break habits show green for zero-count days and red for exceeding threshold.
  - **Advanced fields:** `section`, `start_date`, `reminder_time`, `goal_type`, `sort_order`, `notes` columns added via safe ALTER TABLE migrations.
  - **Backend streak computation:** New `habits_streak` command calculates current streak, best streak, total completions, and completion rate from full log history using date-walking algorithm. Supports both `at_least` and `at_most` goal types.
  - **Archive management:** View archived habits in a slide-out panel, restore to active tracking, or permanently delete (cascades logs).
  - **Monthly calendar heatmap view:** Toggle between week grid and month heatmap per habit. Shows intensity-based coloring with day numbers.
  - **Edit modal:** Full editing of all habit fields — name, icon, color, target, frequency, goal type, section, reminder time, notes.
  - **Stats/detail modal:** Click any habit to see current streak, best streak, total completions, completion rate, creation date, and notes.
  - **Week navigation:** Navigate to past weeks with arrow controls; "Today" button snaps back.
  - **Dynamic update system:** Uses single `UPDATE SET` query with dynamic clause building instead of multiple individual UPDATE calls.
  - **New commands:** `habits_list_archived`, `habits_restore`, `habits_streak`; expanded `habits_create` and `habits_update` with all new fields.
  - **New bridge channels:** `habits:listArchived`, `habits:restore`, `habits:streak`
  - **Input validation:** Date format (YYYY-MM-DD), time format (HH:MM), goal_type enum, frequency enum — validated in Rust before DB write.
- **Task archive system (Phase 3):**
  - **Archive column + migration:** New `archived INTEGER NOT NULL DEFAULT 0` column on tasks table with CHECK constraint. Active task list (`tasks_list`) now excludes archived rows. Safe ALTER TABLE migration with rebuild-guard integration.
  - **Individual task archiving:** Done tasks show an archive button (📦) on hover next to the delete button. Archiving hides the task from the board while preserving it in the DB.
  - **Bulk "Archive All Done":** Button appears in the Done column header when completed tasks exist. One click archives all done tasks via `tasks_archive_done` (returns count of archived rows).
  - **Archive panel:** Accessible from page header. Slide-down panel lists all archived tasks with completed date, "Restore" (resets to todo status + clears completed_at), and "Delete" (permanent) actions.
  - **Restore flow:** Restored tasks return to "todo" status with `completed_at` cleared — ready for re-work.
  - **New commands:** `tasks_archive`, `tasks_archive_done`, `tasks_restore`, `tasks_list_archived`
  - **New bridge channels:** `tasks:archive`, `tasks:archiveDone`, `tasks:restore`, `tasks:listArchived`
  - **4 new tests:** `archive_hides_from_active_list`, `archive_missing_task_returns_err`, `restore_resets_to_todo`, `archive_done_bulk`
- **Unified calendar integration (Phase 4):**
  - **Habit completion on calendar:** Monthly calendar cells show daily habit completion indicators (e.g. "⟡ 3/5") with green highlight when all habits completed. Day view shows full habit breakdown with per-habit colored pills.
  - **Countdown events on calendar:** Countdown target dates appear as colored markers on month grid cells, full cards in day/agenda views, and sidebar detail sections.
  - **Calendar sidebar integration:** Selected-day sidebar now shows habits summary (completion count + per-habit status) and countdown events alongside calendar events.
  - **Agenda view enrichment:** Agenda now includes habit summaries and countdown events alongside calendar events and tasks. Date list includes all dates with any data source.
  - **Data source badges:** Calendar header shows live badge counts for events, reminders, active habits, and countdown events.
  - **No new backend commands needed:** Leverages existing `habits:allLogs` and localStorage countdown data.
- **Sidebar layout redesign (Phase 5):**
  - **Collapsible sidebar:** Toggle between full (200px) and mini (60px, icon-only) modes. Click the logo icon or use Ctrl+B. State persisted in localStorage.
  - **Grouped navigation sections:** Nav items organized into "Workspace" (Dashboard, Tasks, Notes) and "Tracking" (Timer, Calendar, Habits, Countdown) with section headers in expanded mode and divider lines in collapsed mode.
  - **Quick stat badges:** Tasks and Habits nav items show live count badges (active task count, active habit count) in expanded mode. Collapsed mode shows accent-colored dot indicators.
  - **Collapse toggle button:** Explicit "Collapse" button with chevron icon at bottom of nav area (expanded mode), expand chevron in collapsed mode.
  - **Spotify hidden when collapsed:** Spotify player section hidden in collapsed mode to prevent layout overflow.
  - **Responsive UserProfileCard:** Avatar-only view in collapsed mode; full card with name/status/chevron in expanded mode.
- **Spotify integration (PKCE + Web Playback SDK):** Full Spotify OAuth flow using PKCE with local loopback server on `127.0.0.1:43821`. In-app playback via Web Playback SDK. Play/pause/next/prev controls, volume slider, and album art display in the sidebar player widget.
- **Spotify playlist picker:** Browse and play from Spotify playlists directly in the sidebar. Shows playlist thumbnails, track counts, and one-click playback.
- **Environment-based Spotify config:** Client ID and redirect URI loaded from `.env` at compile time via `dotenvy` + `build.rs`. CI uses GitHub Secrets.
- **Three new custom themes:**
  - **Black & Red:** High-contrast dark with vivid red (#E31C25) accents
  - **Smooth Blues:** Deep ocean base with bright blue (#1187D7) highlights
  - **Warm Red & Blue:** Bold dual-accent with red (#D50000) and blue (#3168B9)
- **Task subtasks:** Tasks can have parent-child relationships via `parent_id` column
- **Task priority (Eisenhower matrix):** Tasks support `urgent-important`, `important`, `urgent`, `neither` priority levels
- **Task description:** Tasks now have an optional description field for notes/details
- **Task custom ordering:** `sort_order` column enables drag-to-reorder with batch updates
- **Task reorder API:** New `tasks:reorder` bridge channel for batch sort order updates

### Fixed

- **Sidebar Spotify/profile overlap:** Playlist panel no longer pushes the user profile card off-screen. Spotify section is now in a scroll-contained flex wrapper with `overflow-y: auto` and `flex-shrink: 1`, while the profile card has `flex-shrink: 0` to remain always visible at the bottom. Works correctly on small-height windows.
- **P0 Bug: "Open Notes Folder" not working:** Added directory existence check before opening with Explorer. If the notes directory was externally deleted, it is now recreated automatically.
- **P0 Bug: Updater install/replace flow:** Updater now detects the current installation directory via `std::env::current_exe()` and passes `/D=<dir>` to the NSIS silent installer, ensuring the new version replaces the old one in the same location.
- **Windows URL parsing in Spotify auth:** Replaced `cmd /C start` (which splits URLs on `&`) with the `webbrowser` crate for reliable URL opening on all platforms.

### Removed

- **macOS support:** Removed macOS build jobs from CI, macOS bundle config from `tauri.conf.json`, macOS-specific code paths from `updater.rs` and `notes.rs`. ChroniNotes is now Windows-only.
- **DMG installer handling:** Removed `.dmg` file validation and macOS DMG launch code from the updater.

### Changed

- Bundle targets restricted from `"all"` to `["nsis", "msi"]` (Windows only)
- Task list now sorted by `sort_order ASC, created_at DESC` (was `created_at DESC` only)
- Total test count increased from 103 to 114 (2 Spotify tests, 5 habits tests, 4 task archive tests)

---

## [2.5.0] - 2026-03-04

### Added

- **macOS build pipeline:** GitHub Actions CI now builds native `.dmg` installers for both Intel (`x86_64`) and Apple Silicon (`aarch64`) Macs alongside the existing Windows `.exe` / `.msi` builds; all three platform jobs run in parallel
- **macOS bundle configuration:** `tauri.conf.json` includes `macOS` section with `minimumSystemVersion: "10.15"` (Catalina+) and a DMG layout with drag-to-install positioning (app icon left, Applications shortcut right)
- **Cross-platform self-updater:** `updater_check` now detects the running OS and CPU architecture at compile time and picks the correct release asset (`.exe` on Windows, `_aarch64.dmg` or `_x64.dmg` on macOS)
- **macOS DMG installer launch:** `updater_download_and_install` uses `open` to mount the downloaded `.dmg` on macOS instead of the Windows-only `ShellExecuteW` UAC elevation path

### Fixed

- **`productName` typo:** Corrected `"ChorniNotes"` → `"ChroniNotes"` in `tauri.conf.json`; the macOS bundler lowercases `productName` to locate the compiled binary (`chorninotes` ≠ `chroninotes`), causing a "No such file or directory" bundling failure — Windows was unaffected because the NSIS bundler resolves the binary path differently
- **CI target passthrough:** Replaced `npm run build -- -- --target` with direct `npx tauri build --target` calls; the double `--` npm passthrough was silently dropping the `--target` flag so cross-compile builds fell back to native

### Changed

- **Installer name validation:** `validate_installer_name` now accepts both `.exe` and `.dmg` extensions (was `.exe`-only)
- **Release workflow:** The `release` job now depends on `build-windows`, `build-macos-intel`, and `build-macos-arm`; all artifacts (NSIS `.exe`, `.msi`, Intel `.dmg`, ARM `.dmg`) are published in a single GitHub Release
- **DMG naming convention:** Intel builds are suffixed `_x64.dmg`, Apple Silicon builds `_aarch64.dmg` for unambiguous identification
- **macOS CI runner:** Uses `macos-latest` (Apple Silicon) for both Intel and ARM builds; Intel target cross-compiles via `--target x86_64-apple-darwin` (`macos-13` was retired by GitHub)

---

## [2.4.0] - 2026-03-03

### Fixed

- **Notes — difficulty cannot be cleared:** Added `MaybeUpdate<T>` enum in backend to distinguish absent / null / value; frontend now sends `difficulty: null` to clear
- **Notes — drag-and-drop cross-parent desync:** New `notes_move` backend command physically relocates files; frontend waits for backend confirmation before refreshing the tree (IDs are file paths, so they change on move)
- **Notes — same-parent reorder not persisted:** `reorderNote` now writes updated `sortOrder` to disk for all affected siblings
- **Tasks — optimistic update has no rollback:** `updateStatus`, `handleDrop`, and `onStatusChange` now capture a snapshot before mutation and restore it on IPC failure
- **About modal — hardcoded version string:** Version is now injected at build time from root `package.json` via Vite `define`; no more manual edits
- **Loading screen logo off-centre:** Removed fixed `width: 88px; height: 88px` from `.ws-logo` wrapper that was clipping the larger logo; now uses flexbox centering

### Added

- **BrandLogo component:** Reusable `<BrandLogo>` using Sora font weight-800 with `background-clip: text` gradient fill; two variants (`plain` / `gradient`); fully theme-aware via `--logo-grad-start` / `--logo-grad-end` CSS tokens (tuned for all 5 themes)
- **Sora font:** Added Google Fonts `Sora:wght@800` import for logo typography
- **23 backend tests for notes commands:** `MaybeUpdate` deserialization, difficulty set/clear/absent, tags roundtrip, `sortOrder` persistence, `notes_move` success and rejection cases, `scan_dir` correctness, path traversal rejection (total: 91 tests)
- **`VITE_APP_VERSION` build-time constant:** `vite.config.ts` reads root `package.json` version and injects it as `import.meta.env.VITE_APP_VERSION`
- **TypeScript env type:** `frontend/src/types/env.d.ts` declares `VITE_APP_VERSION` on `ImportMetaEnv`

### Changed

- **Topbar:** Replaced hardcoded gradient `<div>C</div>` with `<BrandLogo size={22} />`
- **WelcomeScreen:** Replaced ring + circle + "C" letter with `<BrandLogo size={108} animate />`; logo size bumped from 84 → 108 px
- **About modal:** Replaced `✦` sparkle div with `<BrandLogo size={52} />`; logo size bumped from 42 → 52 px
- **PageSkeleton:** Added `<BrandLogo variant="gradient" size={44} animate />` above the loading spinner

---

## [2.3.0] - 2026-03-03

### Added

**Tasks — Pointer-event drag and drop**
- Fixed drag and drop which was not working; now uses a custom pointer-event system (useDragDrop hook) that works reliably inside Tauri WebView2 on Windows
- Global window.addEventListener pointermove and pointerup listeners are registered on drag start and cleaned up on release, preventing the WebView2 compositor from swallowing pointer events when the cursor leaves the originating element
- Floating ghost card created imperatively on document.body follows the cursor with a slight rotation and scale, showing the task title
- Column drop targets are hit-tested each pointermove via getBoundingClientRect on column refs; the hovered column receives an animated glow ring highlight
- Optimistic status update applied immediately via useTasksStore.setState before the backend IPC call for instant visual feedback with no flicker

**Tasks — Status circle click to advance**
- Clicking the status dot on a task card now cycles the status forward: todo to doing to done and back to todo
- Removed the status dropdown menu that previously appeared on dot click; the single-click advance is faster and less error-prone

**Notes — Sidebar multi-select**
- New select-mode toggle button in the sidebar header activates checkbox selection for all tree nodes (notes and folders alike)
- Checkboxes appear on every row in select mode; clicking a row toggles its selection
- Action bar slides in below the header showing selection count, Select All, Select None, and Delete buttons
- Delete button is disabled until at least one item is selected
- Keyboard shortcuts active while in select mode: Escape exits, Ctrl+A selects all visible items, Delete or Backspace deletes the selection
- Footer hint displays selected count and keyboard shortcut while items are chosen

**Notes — Folder view multi-select**
- Select button added to the folder hero header; toggles card-level checkbox modecod
- Cards display a checkbox indicator in select mode; clicking toggles selection with accent highlight
- Action bar appears below the hero with Select All, Select None, and Delete Selected controls
- Delete Selected is greyed out until at least one card is selected
- Escape exits select mode; Delete or Backspace triggers bulk delete

**Notes — Folder view drag-and-drop rewrite**
- Replaced element-level pointer capture on cards with the same global window.addEventListener pointermove and pointerup pattern used by the Tasks page and sidebar
- Floating ghost element created imperatively on document.body with the card title, follows cursor with slight rotation
- Card DOM refs registered via forwardRef and a registerCard callback; hit-tested by getBoundingClientRect during pointermove
- Horizontal midpoint determines before or after drop position
- Cards dim to 35% opacity while being dragged; drop target receives accent border and glow ring

**Notes — Sidebar drag-and-drop (folders)**
- Drag-to-reorder now works for folder rows in the sidebar tree, not just note rows
- The existing useSidebarDrag hook already handled all NoteEntry types; behavior confirmed and preserved

### Changed

- FolderCard and NoteCard components converted to forwardRef so the drag hook can register their DOM elements
- Folder hero action area reorganised to include the new Select button alongside existing Page and Folder creation buttons
- FolderMassBtn helper component added in Notes.tsx for consistent mass-action button styling
- Notes.tsx imports updated to include forwardRef and useCallback

### Fixed

- Drag-and-drop in the folder view previously failed silently on Tauri WebView2 because element-level onPointerMove and onPointerUp events are captured by the WebView2 compositor when the pointer leaves the originating element; global window listeners bypass this limitation

---

## [2.2.1] - 2026-02-28

### Fixed
- Updater validate_download_url rejected valid CDN hostnames; allowed-host list corrected

---

## [2.2.0] - 2026-02-26

### Added
- Backend security and robustness hardening across all Tauri commands
- Input validation and error boundary improvements on IPC handlers

---

## [2.1.1] - 2026-02-20

### Fixed
- About page author description text corrected

---

## [2.1.0] - 2026-02-18

### Added
- Timer UI redesign with circular progress ring
- Auto-update system with UAC elevation on Windows
- Performance mode made permanent across sessions

### Fixed
- Notification delivery on Windows 11
- Calendar today indicator stuck on previous date after midnight

---

## [2.0.0] - 2026-02-10

### Added
- Modernized UI with glass-morphism design system
- About page
- Global keyboard shortcuts
- Notification reliability fixes
