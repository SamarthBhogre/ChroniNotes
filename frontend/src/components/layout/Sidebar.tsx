type Page = "dashboard" | "tasks" | "notes" | "timer"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

export default function Sidebar({ current, onChange }: Props) {
  const item = (id: Page, label: string) => (
    <button
      onClick={() => onChange(id)}
      className={`w-full text-left px-3 py-2 rounded-md transition ${
        current === id
          ? "bg-zinc-700 text-white"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {label}
    </button>
  )

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 p-4 space-y-2">
      <div className="text-lg font-semibold text-white mb-4">
        ChroniNotes
      </div>

      {item("dashboard", "📊 Dashboard")}
      {item("tasks", "✅ Tasks")}
      {item("notes", "📝 Notes")}
      {item("timer", "⏱ Timer")}
    </aside>
  )
}