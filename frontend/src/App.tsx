import { useState } from "react"
import Sidebar from "./components/layout/Sidebar"
import Dashboard from "./pages/Dashboard"
import Tasks from "./pages/Tasks"
import Notes from "./pages/Notes"
import Timer from "./pages/Timer"

type Page = "dashboard" | "tasks" | "notes" | "timer"

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <Sidebar current={page} onChange={setPage} />

      <main className="flex-1 p-8 overflow-auto">
        {page === "dashboard" && <Dashboard />}
        {page === "tasks" && <Tasks />}
        {page === "notes" && <Notes />}
        {page === "timer" && <Timer />}
      </main>
    </div>
  )
}
