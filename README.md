# ChroniNotes

ChroniNotes is an offline-first desktop productivity app for students and focused creators.
It unifies tasks, notes, and timer workflows in one local-first workspace.

Your data stays on your machine.

## Why This Project

Most productivity tools split notes, tasks, and focus timers into separate apps.
ChroniNotes combines them so context stays together:

- Write notes while planning tasks.
- Run focus sessions without leaving your workspace.
- Keep all data local with no cloud lock-in.

## Core Features

- Task management with `todo`, `doing`, and `done` workflow.
- Rich notes editor with folders/pages and auto-save.
- Pomodoro + stopwatch + custom timer modes.
- Syntax-highlighted code blocks in notes with language selection.
- Local file + SQLite persistence.

## Tech Stack (What, How, Why)

| Layer | Used | How It Is Used | Why It Is Used |
|---|---|---|---|
| Desktop shell | Electron | Runs renderer + main process with IPC bridge | Native desktop UX and OS integrations |
| Frontend | React 19 + TypeScript | SPA renderer for Dashboard/Tasks/Notes/Timer | Fast UI development with type safety |
| Build tool | Vite | Dev server + frontend build pipeline | Fast HMR and modern bundling |
| State | Zustand | Lightweight stores for tasks/notes/timer | Simple, predictable state updates |
| Notes editor | TipTap | Rich text editor extensions and commands | Highly extensible editor model |
| Code highlighting | lowlight + TipTap code block extension | Syntax colors in note code blocks | Good language highlighting inside notes |
| Database | better-sqlite3 | Stores tasks and timer settings | Fast local persistence, no external service |
| Notes storage | JSON files in app data folder | Each note/folder stored as real files | Easy backup, portability, transparency |
| Styling | Tailwind CSS + custom CSS vars | Layout + theming + component styling | Rapid UI iteration with consistent theme |

## Architecture Overview

- `backend/` is the Electron main process.
- `frontend/` is the React renderer.
- Frontend talks to backend via `window.electron.invoke(...)` IPC calls.
- Tasks/timer settings go to SQLite.
- Notes content/tree live as files on disk.

## Installation

### Prerequisites

- Node.js (LTS recommended)
- npm
- Git

Windows note:
For native modules (`better-sqlite3`) you may need Visual Studio Build Tools with C++ workload.

### Setup

```bash
git clone https://github.com/SamarthBhogre/ChroniNotes.git
cd ChroniNotes
npm run setup
```

`npm run setup` does:

- Install root dependencies.
- Install backend/frontend dependencies.
- Rebuild native modules for Electron.

## Running the App

```bash
npm run dev
```

This starts:

- Vite frontend on `http://localhost:5173`
- Electron backend after frontend is ready

### Useful Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run full app (frontend + Electron) |
| `npm run setup` | Install everything + rebuild native deps |
| `npm run build` | Build backend + frontend |
| `npm run dev:frontend` | Run only Vite frontend |
| `npm run dev:backend` | Build backend and launch Electron |
| `npm run install:all` | Install root, backend, frontend deps |
| `npm run rebuild` | Rebuild native Electron modules |

## Data Storage

| Data Type | Storage |
|---|---|
| Tasks + timer settings | SQLite (`chroninotes.db`) in app data directory |
| Notes/folders | JSON files under app notes directory |

Typical app-data locations:

- Windows: `C:\Users\<you>\AppData\Roaming\<AppName>\`
- macOS: `~/Library/Application Support/<AppName>/`
- Linux: `~/.config/<AppName>/`

## Troubleshooting

### 1) App does not start after install

Try:

```bash
npm run install:all
npm run rebuild
npm run dev
```

Cause:
Native module rebuild may have failed.

### 2) `better-sqlite3` build errors on Windows

Fix:

- Install Visual Studio Build Tools.
- Enable Desktop development with C++ workload.
- Re-run `npm run rebuild`.

### 3) Port `5173` already in use

Fix:

- Stop other Vite processes.
- Or run frontend on another port manually:

```bash
cd frontend
npm run dev -- --port 5174
```

Then adjust backend `loadURL` if needed.

### 4) Toolbar/buttons in Notes feel inconsistent

Fix:

- Reload renderer window.
- Ensure toolbar focus/selection patches are on latest local changes.
- Restart with `npm run dev`.

### 5) Changes not showing in Electron

Fix:

- Hard reload the Electron renderer.
- Restart dev process fully (`Ctrl+C` then `npm run dev`).
- Clear cached compiled output if needed (`backend/dist`, `frontend/dist`) then rebuild.

## Future Scope

Planned and high-impact roadmap ideas:

- Core scheduling engine for study blocks and task calendar planning.
- Contribution streak system across timer sessions and todo completion.
- Advanced analytics:
  - Focus trends by day/week
  - Task completion velocity
  - Note activity heatmaps
  - Session consistency scoring
- Goal-based planning with milestones and review cycles.
- Cross-device sync as optional encrypted mode.
- Smart insights and reminders based on behavior patterns.

## Contributing

1. Fork the repository.
2. Create a feature branch:
`git checkout -b feat/my-feature`
3. Commit:
`git commit -m "feat: add my feature"`
4. Push:
`git push origin feat/my-feature`
5. Open a Pull Request.

## License

MIT License.
