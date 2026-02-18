import { useState } from "react"
import Topbar from "./components/layout/Topbar"
import Sidebar from "./components/layout/Sidebar"
import Dashboard from "./pages/Dashboard"
import Tasks from "./pages/Tasks"
import Notes from "./pages/Notes"
import Timer from "./pages/Timer"
import WelcomeScreen from "./components/WelcomeScreen"

type Page = "dashboard" | "tasks" | "notes" | "timer"

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const [showWelcome, setShowWelcome] = useState(true)

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Windows 11 OOBE-style Welcome Screen ── */}
      {showWelcome && (
        <WelcomeScreen onFinished={() => setShowWelcome(false)} />
      )}
      {/* ── Custom Topbar with window controls ── */}
      <Topbar />

      {/* ── Animated background orbs ── */}
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      {/* ── Sidebar ── */}
      <Sidebar current={page} onChange={setPage} />

      {/* ── Main content ── */}
      <main
        className="relative z-10 flex-1 flex flex-col"
        style={{ minWidth: 0, marginTop: "40px", overflow: "hidden" }}
      >
        {/* Subtle top-edge glow line */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--accent-border), transparent)",
          }}
        />

        <div key={page} className="page-enter h-full" style={{ overflow: page === "notes" ? "hidden" : "auto" }}>
          {page === "dashboard" && <Dashboard onNavigate={setPage} />}
          {page === "tasks"     && <Tasks />}
          {page === "notes"     && <Notes />}
          {page === "timer"     && <Timer />}
        </div>
      </main>
    </div>
  )
}