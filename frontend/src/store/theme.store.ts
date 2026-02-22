import { create } from "zustand"

export type ThemeId =
  | "default"
  | "steel-blue"
  | "warm-linen"
  | "ember"
  | "carbon"

export interface ThemeMeta {
  id: ThemeId
  name: string
  description: string
  swatches: string[]
  isDark: boolean
}

export const THEMES: ThemeMeta[] = [
  {
    id: "default",
    name: "Midnight Indigo",
    description: "Dark glassmorphism with indigo & violet accents",
    swatches: ["#060811", "#0c0f1e", "#818cf8", "#8b5cf6", "#6366f1"],
    isDark: true,
  },
  {
    id: "steel-blue",
    name: "Steel Blue",
    description: "Dark industrial palette with steel blue and gold",
    swatches: ["#e8eaed", "#9bb5c8", "#3d6ea8", "#d4920a", "#1a1a1a"],
    isDark: true,
  },
  {
    id: "warm-linen",
    name: "Warm Linen",
    description: "Soft warm beige tones — light, elegant, minimal",
    swatches: ["#f0eeeb", "#d4cec8", "#9e8e84", "#3d3d3d", "#1a1714"],
    isDark: false,
  },
  {
    id: "ember",
    name: "Ember",
    description: "Light theme with warm greys and bold orange-red accent",
    swatches: ["#f5f5f5", "#d0d0d0", "#a0a0a8", "#e8380a", "#1a1a1a"],
    isDark: false,
  },
  {
    id: "carbon",
    name: "Carbon",
    description: "Dark navy with teal accent and blue-grey tones",
    swatches: ["#d8dbe2", "#a9bcd0", "#58a4b0", "#373f51", "#1b1b1e"],
    isDark: true,
  },
]

interface ThemeStore {
  theme: ThemeId
  setTheme: (id: ThemeId) => void
  perfMode: boolean
  setPerfMode: (on: boolean) => void
}

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id)
}

function applyPerfMode(on: boolean) {
  if (on) {
    document.documentElement.setAttribute("data-perf", "low")
  } else {
    document.documentElement.removeAttribute("data-perf")
  }
}

const savedTheme = (localStorage.getItem("chorniNotes-theme") as ThemeId) || "default"
const savedPerf  = localStorage.getItem("chorniNotes-perf") === "true"

// Apply both immediately on boot — before React renders
applyTheme(savedTheme)
applyPerfMode(savedPerf)

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: savedTheme,
  setTheme: (id) => {
    localStorage.setItem("chorniNotes-theme", id)
    applyTheme(id)
    set({ theme: id })
  },
  perfMode: savedPerf,
  setPerfMode: (on) => {
    localStorage.setItem("chorniNotes-perf", String(on))
    applyPerfMode(on)
    set({ perfMode: on })
  },
}))