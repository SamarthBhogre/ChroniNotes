# ChroniNotes ✦

ChroniNotes is an **offline-first desktop productivity assistant** built specifically for students.  
It combines **task management, Pomodoro focus sessions, and rich-text notes** into a single, distraction-free environment — with **zero cloud dependency**.

> Your data. Your machine. Full control.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **[Node.js](https://nodejs.org/)** v18 or later (LTS recommended)
- **[Git](https://git-scm.com/)**
- **npm** (comes with Node.js)

### Installation & Setup (one command)

```bash
# 1. Clone the repository
git clone https://github.com/SamarthBhogre/ChroniNotes.git
cd ChroniNotes

# 2. Install everything + rebuild native modules
npm run setup
```

This single command installs dependencies for root, backend, and frontend, then rebuilds `better-sqlite3` for Electron.

> **Windows users**: You may need the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload installed for the native rebuild step.

---

## ▶️ Running the App

```bash
npm run dev
```

That's it. This single command:
1. Starts the Vite frontend dev server
2. Waits for it to be ready at `http://localhost:5173`
3. Compiles the backend TypeScript
4. Launches the Electron window

Both processes run side-by-side and are killed together when you press `Ctrl+C`.

### Other scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the full app (frontend + Electron) |
| `npm run setup` | Install all deps + rebuild native modules |
| `npm run build` | Production build (backend + frontend) |
| `npm run dev:frontend` | Start only the Vite dev server |
| `npm run dev:backend` | Build + launch only Electron |
| `npm run install:all` | Install deps for root, backend, and frontend |
| `npm run rebuild` | Rebuild native modules for Electron |

---

## 📁 Where is my data stored?

| Data | Location |
|------|----------|
| **Notes** | Stored as real `.json` files in `<userData>/ChroniNotes/` — you can browse, back up, or edit them directly from your file explorer. |
| **Tasks & Timer settings** | Stored in a local SQLite database at `<userData>/chroninotes.db` |

The `<userData>` path depends on your OS:

| OS | Path |
|----|------|
| Windows | `C:\Users\<You>\AppData\Roaming\<AppName>\` |
| macOS | `~/Library/Application Support/<AppName>/` |
| Linux | `~/.config/<AppName>/` |

You can also open the notes folder directly from the app: **Hamburger menu (☰) → Open Notes Folder**.

---

## 🎯 Features

### ✅ Task Manager
- To Do / Doing / Done workflow
- SQLite-backed persistence
- Fast IPC-based updates

### 🍅 Pomodoro Timer
- Runs safely in Electron Main Process
- Adjustable work & break durations
- Settings persisted in SQLite
- Background-safe (continues when window loses focus)

### 📝 Rich Text Notes
- TipTap editor (Notion-style)
- Headings, lists, code blocks, blockquotes
- Font selection
- **Notion-style file tree sidebar** with folders, nested pages, inline rename
- **Auto-save** — content saves to disk 500ms after you stop typing
- **Real files on disk** — notes are plain JSON files you can browse in your OS

### 🖥️ Desktop-First Architecture
- Electron + React + TypeScript
- Offline-first, local-only storage
- No cloud, no telemetry

---

## 🧠 Philosophy

ChroniNotes is built around three principles:

- **Deep Focus** — Minimal UI, keyboard-friendly, no distractions
- **Context Awareness** — Tasks, notes, and time are connected
- **Offline Sovereignty** — All data stays on your device

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19 + TypeScript |
| Desktop | Electron |
| State | Zustand |
| Editor | TipTap |
| Database | SQLite (better-sqlite3) |
| Notes Storage | Filesystem (JSON files) |
| Styling | Tailwind CSS |
| Build | Vite |

---

## 📂 Project Structure

```text
ChroniNotes/
├── backend/                  # Electron Main Process
│   ├── src/
│   │   ├── db/               # SQLite setup
│   │   ├── ipc/              # IPC handlers (tasks, timer, notes)
│   │   ├── services/         # Business logic (timer)
│   │   ├── main.ts
│   │   └── preload.ts
│   └── package.json
│
├── frontend/                 # Renderer (React)
│   ├── src/
│   │   ├── store/            # Zustand stores (tasks, timer, notes)
│   │   ├── components/       # UI components
│   │   │   ├── editor/       # TipTap rich editor
│   │   │   ├── layout/       # Sidebar, Topbar
│   │   │   └── notes/        # Notes file tree sidebar
│   │   ├── pages/            # Dashboard, Tasks, Notes, Timer
│   │   └── App.tsx
│   └── package.json
│
└── README.md
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m "feat: add my feature"`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Built with ♥ for students who want to own their productivity.**
