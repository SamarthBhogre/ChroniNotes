# Pull Request — ChroniNotes v2.4.0

**Branch:** `feat/notes-sync-dnd-tests-brandlogo`  
**Base:** `main` (last commit `51f54a8`)  
**Status:** ✅ Ready to merge  
**Tests:** 91 / 91 passing (`cargo test`)  
**Build:** ✅ Clean (`tsc -b && vite build` — 0 errors, 0 warnings)

---

## Summary

Six targeted fixes spanning the Rust backend, frontend state management, and UI layer.
No speculative refactors. Every change is directly tied to a bug, a correctness gap, or an explicit design request.

---

## Changes by Fix

---

### Fix 1 — Notes metadata: difficulty cannot be cleared

**Problem**  
Sending `difficulty: null` from the frontend had no effect. Serde's standard `Option<Option<T>>`
collapses "field absent" and "field = null" into the same `None` variant, so the backend
could never distinguish "don't touch this field" from "set this field to null".

**Root cause**  
`notes_update` used `Option<String>` for every patch field. A missing key and an explicit
`null` both deserialised to `None`, so clearing was impossible.

**Fix — Backend (`src-tauri/src/commands/notes.rs`)**  
Introduced a `MaybeUpdate<T>` enum with three variants:

```rust
pub enum MaybeUpdate<T> {
    Absent,   // key not in JSON → keep existing value
    Clear,    // key present, value is null → set field to None
    Set(T),   // key present, value is T → set field to value
}
```

The custom `Deserialize` impl reads a raw `serde_json::Value` first (avoiding serde's
absent-vs-null collapse), then maps `Value::Null → Clear` and any concrete value → `Set(T)`.
`notes_update` was updated to branch on all three states.

**Fix — Frontend (`frontend/src/store/notes.store.ts`)**  
`updateNote` now always includes `difficulty` in the IPC payload, even when the value is
`null`, so the backend receives the `Clear` signal. Added a pre-call snapshot and rollback
on error.

---

### Fix 2 — Notes drag-and-drop: cross-parent move causes parent/sort desync

**Problem**  
Dragging a note into a different folder optimistically set `parentId` in the UI before the
backend moved the file. On the next `loadNotes()` the note's `id` (which is its file path)
had changed, leaving a stale entry that pointed nowhere. Same-parent reorders didn't persist
`sortOrder` to disk at all.

**Fix — Backend (`src-tauri/src/commands/notes.rs`)**  
New `notes_move` command: physically relocates the file or folder via `fs::rename`, falling
back to recursive copy-then-delete if source and destination are on different mount points.
Returns the new path as the new `id`.

```rust
#[tauri::command]
pub async fn notes_move(id: String, new_parent_id: Option<String>, ...) -> Result<NoteEntry>
```

Registered in `src-tauri/src/lib.rs` invoke handler.

**Fix — Frontend (`frontend/src/store/notes.store.ts`)**  
- Cross-parent drop: calls `notes:move` IPC and waits for confirmation before reloading
  the full notes list. No optimistic `parentId` mutation (IDs change on move).
- Same-parent reorder: persists the new `sortOrder` for every affected sibling via
  individual `notes:update` calls using `Promise.allSettled`. Reloads on any failure.
- `moveNote` (keyboard up/down): added snapshot + rollback on error.

---

### Fix 3 — Backend command-level tests for notes metadata sync

**Problem**  
Zero test coverage for the notes commands. The `MaybeUpdate` logic, `scan_dir`, tag/difficulty
persistence, and move behaviour were entirely untested.

**Added (`src-tauri/src/commands/notes.rs` — `#[cfg(test)]` module)**  
23 new tests covering:

| Test | What it verifies |
|---|---|
| `note_file_write_read_roundtrip` | NoteFile serialises and deserialises without data loss |
| `scan_dir_finds_notes_and_folders` | `scan_dir` returns the correct entry count and types |
| `scan_dir_folder_has_correct_parent_id` | Parent ID is set correctly for nested entries |
| `tags_persisted_and_retrieved` | Tags survive a write/read cycle |
| `difficulty_set_and_persisted` | Setting difficulty persists to disk |
| `difficulty_cleared_when_null_sent` | `MaybeUpdate::Clear` sets `difficulty = None` |
| `difficulty_absent_keeps_existing` | Absent key leaves existing difficulty untouched |
| `maybe_update_absent_when_key_missing` | Deserialises `Absent` correctly |
| `maybe_update_clear_when_null` | Deserialises `Clear` correctly |
| `maybe_update_set_when_value_provided` | Deserialises `Set(T)` correctly |
| `sort_order_persisted_and_retrieved` | sortOrder survives write/read |
| `sort_order_updated_on_update_payload` | `notes_update` changes sortOrder |
| `folder_meta_tags_and_difficulty_persist` | Folder metadata is not lost on update |
| `folder_meta_difficulty_clear_persists` | Difficulty clear works on folders too |
| `move_note_to_new_parent_changes_id` | `notes_move` returns the new path as id |
| `move_rejects_folder_into_itself` | Moving a folder into itself returns an error |
| `create_note_and_get_roundtrip` | create → list → content is consistent |
| `list_returns_all_entries_with_metadata` | `notes_list` includes tags/difficulty/sortOrder |
| `resolve_normal_relative_path` | Safe path resolution accepts valid relative paths |
| `resolve_rejects_dotdot` | Rejects `../` traversal |
| `resolve_rejects_absolute_path` | Rejects absolute paths |
| `resolve_rejects_encoded_traversal` | Rejects URL-encoded `%2F..` traversal |
| `resolve_nested_path_stays_inside_root` | Deep nested paths resolve correctly |

**Total test count: 91** (was 68 before this PR).

---

### Fix 4 — Task optimistic update: no rollback on failure

**Problem**  
`updateStatus` in `tasks.store.ts` had no error handling. A failed IPC call left the UI
showing the wrong status with no way to recover other than a full page reload.
`Tasks.tsx` `handleDrop` applied the optimistic state update without capturing a snapshot.

**Fix — `frontend/src/store/tasks.store.ts`**  
`updateStatus` wrapped in try/catch; captures a snapshot of `tasks` before the IPC call
and calls `setState({ tasks: snapshot })` in the catch block.

**Fix — `frontend/src/pages/Tasks.tsx`**  
`handleDrop`: captures `prevTasks = useTasksStore.getState().tasks` before the optimistic
`setState`, then calls `updateStatus(...).catch(() => setState({ tasks: prevTasks }))`.
`onStatusChange`: same snapshot-before / rollback-in-catch pattern.

---

### Fix 5 — About modal shows hardcoded version string

**Problem**  
`About.tsx` had `const APP_VERSION = "2.1.1"` hardcoded. Every release required a manual
edit to this file that was easy to forget, causing version drift between the UI and the
actual installed binary.

**Fix — `frontend/vite.config.ts`**  
Reads `version` from the root `package.json` at build time and injects it as a
compile-time constant:

```ts
define: {
  'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
}
```

**Fix — `frontend/src/types/env.d.ts`** *(new file)*  
Added `ImportMetaEnv` type declaration for `VITE_APP_VERSION: string` so TypeScript
resolves the constant without errors.

**Fix — `frontend/src/pages/About.tsx`**  
```ts
// Before
const APP_VERSION = "2.1.1"

// After
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "2.3.0"
```

The single source of truth is now `package.json`. `tauri.conf.json` and `Cargo.toml`
are already kept in sync by the existing release workflow.

---

### Fix 6 — BrandLogo: reusable theme-aware monogram component

**Problem**  
Three separate placements (topbar, loading screen, About modal) each had their own
hand-rolled "C" or "✦" badge with hardcoded hex colours, inconsistent sizes, and no
relationship to the active theme.

**New file — `frontend/src/components/BrandLogo.tsx`**  
A single reusable React component implementing the design from `BrandLogoGradient`:

- **Font:** Sora weight-800 (loaded via Google Fonts in `index.css`)
- **Fill:** `background-clip: text` gradient using `--logo-grad-start → --logo-grad-end`
- **Sizing:** `fontSize = max(18, round(size × 0.62))` — scales correctly at 22 px (topbar)
  through 108 px (loading screen)
- **Two variants:** `"plain"` (solid `--accent`) and `"gradient"` (default)
- **No container, no border, no tile** — just the lettermark

**New CSS tokens in `frontend/src/index.css`**  
Two tokens added to every theme block, tuned per-palette:

| Theme | `--logo-grad-start` | `--logo-grad-end` |
|---|---|---|
| Midnight Indigo | `#818cf8` | `#8b5cf6` |
| Steel Blue | `#5b8fc9` | `#3d6ea8` |
| Warm Linen | `#7a6a5e` | `#9e8e84` |
| Ember | `#e8380a` | `#f06020` |
| Carbon | `#58a4b0` | `#a9bcd0` |

**Integrated into:**

| File | Before | After |
|---|---|---|
| `Topbar.tsx` | `<div>C</div>` hardcoded gradient box, 18×18 px | `<BrandLogo size={22} />` |
| `WelcomeScreen.tsx` | `<div class="ws-logo-inner"><span>C</span></div>` with ring | `<BrandLogo size={108} animate />` |
| `About.tsx` | `<div>✦</div>` with `floatY` animation, hardcoded colours | `<BrandLogo size={52} />` |
| `App.tsx` PageSkeleton | Plain spinner only | `<BrandLogo variant="gradient" size={44} animate />` above spinner |

**WelcomeScreen CSS**  
`.ws-logo` wrapper: removed fixed `width: 88px; height: 88px` (caused off-centre clipping
when logo size was bumped to 108 px). Replaced with `display: flex; align-items: center;
justify-content: center` so the wrapper sizes to its content.

---

## Files Changed

### New files
| File | Purpose |
|---|---|
| `frontend/src/components/BrandLogo.tsx` | CN monogram component |
| `frontend/src/types/env.d.ts` | TypeScript type for `VITE_APP_VERSION` |

### Modified files

**Backend**
| File | Change |
|---|---|
| `src-tauri/src/commands/notes.rs` | `MaybeUpdate<T>`, `notes_move`, 23 tests, tags/difficulty/sortOrder fields |
| `src-tauri/src/lib.rs` | Registered `notes_move` in invoke handler |

**Frontend — stores**
| File | Change |
|---|---|
| `frontend/src/store/notes.store.ts` | `updateNote` difficulty-clear fix, `reorderNote` cross-parent via `notes:move`, rollbacks |
| `frontend/src/store/tasks.store.ts` | `updateStatus` snapshot + rollback |

**Frontend — pages**
| File | Change |
|---|---|
| `frontend/src/pages/Tasks.tsx` | `handleDrop` + `onStatusChange` snapshot/rollback |
| `frontend/src/pages/About.tsx` | `VITE_APP_VERSION`, `BrandLogo size={52}` |

**Frontend — components**
| File | Change |
|---|---|
| `frontend/src/components/WelcomeScreen.tsx` | `BrandLogo size={108} animate`, removed old ring/inner/letter markup, fixed `.ws-logo` CSS |
| `frontend/src/components/layout/Topbar.tsx` | `BrandLogo size={22}` replaces hardcoded C div |
| `frontend/src/App.tsx` | PageSkeleton uses `BrandLogo` |

**Config / styles**
| File | Change |
|---|---|
| `frontend/vite.config.ts` | `define: { VITE_APP_VERSION }` injected from root `package.json` |
| `frontend/src/index.css` | Sora font import; `--logo-grad-start`/`--logo-grad-end` tokens for all 5 themes |

---

## Test Results

```
running 91 tests
...
test result: ok. 91 passed; 0 failed; 0 ignored; 0 measured
```

| Suite | Count |
|---|---|
| `commands::notes` | 23 |
| `commands::calendar` | 25 |
| `commands::tasks` | 14 |
| `commands::timer` | 4 |
| `notifications` | 9 |
| `db` | 9 |
| `commands::calendar` (extra) | 7 |
| **Total** | **91** |

---

## Build Output

```
✓ tsc -b  (0 errors)
✓ vite build — 327 modules transformed in 3.0 s
```

---

## Pre-existing Lint Notes

`npm run lint` reports 57 errors across the codebase, all pre-existing before this PR
(concentrated in `NotesSidebar.tsx`, `Notes.tsx`, `Calendar.tsx`, `Dashboard.tsx`,
`Timer.tsx`, `timer.store.ts`, `tauri-bridge.ts`). **Zero new lint errors** were
introduced by this PR's changes.
