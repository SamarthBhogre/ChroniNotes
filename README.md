# ChroniNotes 🕒📒

ChroniNotes is an **offline-first desktop productivity assistant** built specifically for students.  
It combines **task management, Pomodoro focus sessions, and rich-text notes** into a single, distraction-free environment — with **zero cloud dependency**.

> Your data. Your machine. Full control.

---

## ✨ Features

### ✅ Implemented
- 📝 **Task Manager**
  - To Do / Doing / Done workflow
  - SQLite-backed persistence
  - Fast IPC-based updates

- ⏱️ **Pomodoro Timer**
  - Runs safely in Electron Main Process
  - Adjustable work & break durations
  - Settings persisted in SQLite
  - Background-safe (continues when window loses focus)

- ✍️ **Rich Text Notes**
  - TipTap editor (Notion-style)
  - Headings, lists, code blocks
  - Font selection
  - Responsive desktop layout

- 🖥️ **Desktop-First Architecture**
  - Electron + React + TypeScript
  - Offline-first, local-only storage
  - No cloud, no telemetry

---

## 🧠 Philosophy

ChroniNotes is built around three principles:

- **Deep Focus** – Minimal UI, keyboard-friendly, no distractions
- **Context Awareness** – Tasks, notes, and time are connected
- **Offline Sovereignty** – All data stays on your device

---

## 🏗️ Tech Stack

| Layer | Technology |
|-----|-----------|
| UI | React 18 + TypeScript |
| Desktop | Electron |
| State | Zustand |
| Editor | TipTap |
| Database | SQLite (better-sqlite3) |
| Styling | Tailwind CSS |
| Build | Vite |

---

## 📂 Project Structure

```text
PROJECT/
├── backend/               # Electron Main Process
│   ├── src/
│   │   ├── db/            # SQLite setup
│   │   ├── ipc/           # IPC handlers
│   │   ├── services/      # Business logic (timer, tasks)
│   │   ├── main.ts
│   │   └── preload.ts
│   └── dist/              # Compiled backend
│
├── frontend/              # Renderer (React)
│   ├── src/
│   │   ├── store/         # Zustand stores
│   │   ├── components/    # UI components
│   │   ├── pages/
│   │   └── App.tsx
│   └── index.html
│
└── shared/                # Shared types (optional)
