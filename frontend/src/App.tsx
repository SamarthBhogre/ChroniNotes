import { lazy, Suspense, useState } from "react"
import Topbar from "./components/layout/Topbar"
import Sidebar from "./components/layout/Sidebar"
import WelcomeScreen from "./components/WelcomeScreen"
import Settings from "./pages/Settings"
import { useThemeStore } from "./store/theme.store"

// Initialize theme store on app boot (applies saved theme from localStorage)
import "./store/theme.store"

// ── Code splitting: each page is a separate JS chunk ──
// These modules are NOT parsed/executed until the page is first visited
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Tasks     = lazy(() => import("./pages/Tasks"))
const Notes     = lazy(() => import("./pages/Notes"))
const Timer     = lazy(() => import("./pages/Timer"))

type Page = "dashboard" | "tasks" | "notes" | "timer"

// ── Minimal spinner — shown while a page chunk loads for the first time ──
function PageSkeleton() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-tertiary)", fontSize: "13px", gap: "10px",
    }}>
      <div style={{
        width: "16px", height: "16px", borderRadius: "50%",
        border: "2px solid var(--glass-border-strong)",
        borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }} />
      Loading…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  const [page, setPage]                 = useState<Page>("dashboard")
  const [showWelcome, setShowWelcome]   = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  // Reactively reads memorySaver — updates instantly when toggled in Settings
  const { memorySaver } = useThemeStore()

  // ── Visited set: pages are only mounted after first navigation ──
  // Dashboard is pre-seeded since it's the initial page
  const [visited, setVisited] = useState<Set<Page>>(new Set<Page>(["dashboard"]))

  const navigate = (target: Page) => {
    setPage(target)
    setVisited(prev => {
      if (prev.has(target)) return prev
      const next = new Set(prev)
      next.add(target)
      return next
    })
  }

  const pages: Page[] = ["dashboard", "tasks", "notes", "timer"]

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {showWelcome && (
        <WelcomeScreen onFinished={() => setShowWelcome(false)} />
      )}

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      <Topbar onOpenSettings={() => setShowSettings(true)} />

      {!showWelcome && (
        <div className="bg-orbs">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
        </div>
      )}

      <Sidebar current={page} onChange={navigate} />

      <main
        className="relative z-10 flex-1 flex flex-col"
        style={{ minWidth: 0, marginTop: "40px", overflow: "hidden" }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, var(--accent-border), transparent)",
          }}
        />

        <div className="h-full" style={{ position: "relative" }}>
          {pages.map(p => {
            const isActive  = p === page
            const hasVisited = visited.has(p)

            // ── Never-visited pages: don't mount at all (lazy mount) ──
            if (!hasVisited) return null

            // ── Memory Saver ON: unmount inactive pages entirely ──
            // React destroys the component tree, event listeners, editor instances,
            // store subscriptions → OS reclaims that heap memory
            if (memorySaver && !isActive) return null

            return (
              <div
                key={p}
                style={{
                  position: "absolute", inset: 0,
                  // Hide inactive pages via opacity+pointerEvents (not display:none)
                  // so CSS transitions still work and layout isn't disrupted
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                  animation: isActive ? "pageEnter 0.25s ease" : "none",
                  overflow: p === "notes" ? "hidden" : "auto",
                  display: "flex", flexDirection: "column",
                }}
              >
                <Suspense fallback={<PageSkeleton />}>
                  {p === "dashboard" && <Dashboard onNavigate={navigate} />}
                  {p === "tasks"     && <Tasks />}
                  {p === "notes"     && <Notes />}
                  {p === "timer"     && <Timer />}
                </Suspense>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}