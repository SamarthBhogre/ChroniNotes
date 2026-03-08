import { create } from "zustand"

export type ThemeId =
  | "default"
  | "steel-blue"
  | "warm-linen"
  | "ember"
  | "carbon"
  | "black-red"
  | "smooth-blues"
  | "warm-red-blue"

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
  {
    id: "black-red",
    name: "Black & Red",
    description: "High-contrast dark with vivid red accents",
    swatches: ["#111111", "#161616", "#1C1C1C", "#E31C25", "#BB000E"],
    isDark: true,
  },
  {
    id: "smooth-blues",
    name: "Smooth Blues",
    description: "Deep ocean blues with bright cyan highlights",
    swatches: ["#0945B4", "#0C59AF", "#0B6DC2", "#1187D7", "#0A1628"],
    isDark: true,
  },
  {
    id: "warm-red-blue",
    name: "Warm Red & Blue",
    description: "Bold dual-accent — red accents, blue-purple glass, twin duality",
    swatches: ["#E53030", "#D50000", "#8030C0", "#3168B9", "#100C16"],
    isDark: true,
  },
]

interface ThemeStore {
  theme: ThemeId
  setTheme: (id: ThemeId) => void
  memorySaver: boolean
  setMemorySaver: (on: boolean) => void
}

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id)
}

const savedTheme       = (localStorage.getItem("chorniNotes-theme") as ThemeId) || "default"
const savedMemorySaver = localStorage.getItem("chorniNotes-memorySaver") !== "false"  // default ON

// Apply immediately before React renders
applyTheme(savedTheme)

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: savedTheme,
  setTheme: (id) => {
    localStorage.setItem("chorniNotes-theme", id)
    applyTheme(id)
    set({ theme: id })
  },

  memorySaver: savedMemorySaver,
  setMemorySaver: (on) => {
    localStorage.setItem("chorniNotes-memorySaver", String(on))
    set({ memorySaver: on })
  },
}))