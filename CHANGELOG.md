# Changelog

All notable changes to ChroniNotes are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.5.0] - 2026-03-04

### Added

- **macOS build pipeline:** GitHub Actions CI now builds native `.dmg` installers for both Intel (`x86_64`) and Apple Silicon (`aarch64`) Macs alongside the existing Windows `.exe` / `.msi` builds; all three platform jobs run in parallel
- **macOS bundle configuration:** `tauri.conf.json` includes `macOS` section with `minimumSystemVersion: "10.15"` (Catalina+) and a DMG layout with drag-to-install positioning (app icon left, Applications shortcut right)
- **Cross-platform self-updater:** `updater_check` now detects the running OS and CPU architecture at compile time and picks the correct release asset (`.exe` on Windows, `_aarch64.dmg` or `_x64.dmg` on macOS)
- **macOS DMG installer launch:** `updater_download_and_install` uses `open` to mount the downloaded `.dmg` on macOS instead of the Windows-only `ShellExecuteW` UAC elevation path

### Changed

- **Installer name validation:** `validate_installer_name` now accepts both `.exe` and `.dmg` extensions (was `.exe`-only)
- **Release workflow:** The `release` job now depends on `build-windows`, `build-macos-intel`, and `build-macos-arm`; all artifacts (NSIS `.exe`, `.msi`, Intel `.dmg`, ARM `.dmg`) are published in a single GitHub Release
- **DMG naming convention:** Intel builds are suffixed `_x64.dmg`, Apple Silicon builds `_aarch64.dmg` for unambiguous identification

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
