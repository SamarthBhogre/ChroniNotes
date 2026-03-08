import { create } from "zustand"

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  name: string
  artist: string
  album: string
  album_art_url: string | null
  duration_ms: number
  progress_ms: number
  is_playing: boolean
  track_uri: string
  shuffle_state?: boolean
  repeat_state?: string
}

export interface SpotifyDevice {
  id: string
  name: string
  device_type: string
  is_active: boolean
  volume_percent: number | null
}

export interface SpotifyPlaylist {
  id: string
  name: string
  uri: string
  image_url: string | null
  tracks_total: number
  owner_name: string | null
}

interface SpotifyState {
  loggedIn: boolean
  track: SpotifyTrack | null
  devices: SpotifyDevice[]
  playlists: SpotifyPlaylist[]
  playlistsLoading: boolean
  playlistsLoaded: boolean
  playlistsError: string | null
  loading: boolean
  error: string | null
  shuffleState: boolean
  repeatState: "off" | "context" | "track"

  // Actions
  checkAuthStatus: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
  fetchPlayback: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  setVolume: (volume: number) => Promise<void>
  setShuffle: (state: boolean) => Promise<void>
  setRepeat: (state: "off" | "context" | "track") => Promise<void>
  toggleShuffle: () => Promise<void>
  cycleRepeat: () => Promise<void>
  fetchDevices: () => Promise<void>
  fetchPlaylists: () => Promise<void>
  playPlaylist: (playlistUri: string, deviceId?: string | null) => Promise<void>
  setLoggedIn: (v: boolean) => void
  clearError: () => void
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  loggedIn: false,
  track: null,
  devices: [],
  playlists: [],
  playlistsLoading: false,
  playlistsLoaded: false,
  playlistsError: null,
  loading: false,
  error: null,
  shuffleState: false,
  repeatState: "off",

  checkAuthStatus: async () => {
    try {
      const result = await window.electron.invoke("spotify:authStatus") as { logged_in: boolean }
      set({ loggedIn: result.logged_in })
    } catch (e) {
      console.error("[Spotify] Failed to check auth status:", e)
    }
  },

  login: async () => {
    set({ loading: true, error: null })
    try {
      await window.electron.invoke("spotify:login")
      // The actual auth completion is signaled via the spotify:auth-complete event
      // (handled in the SpotifyPlayer component). We keep loading=true until then.
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  logout: async () => {
    try {
      await window.electron.invoke("spotify:logout")
      set({
        loggedIn: false,
        track: null,
        devices: [],
        playlists: [],
        playlistsLoading: false,
        playlistsLoaded: false,
        playlistsError: null,
        shuffleState: false,
        repeatState: "off",
      })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  fetchPlayback: async () => {
    if (!get().loggedIn) return
    try {
      const track = await window.electron.invoke("spotify:getPlayback") as SpotifyTrack | null
      if (track) {
        set({
          track,
          shuffleState: track.shuffle_state ?? get().shuffleState,
          repeatState: (track.repeat_state as "off" | "context" | "track") ?? get().repeatState,
          error: null,
        })
      } else {
        set({ track, error: null })
      }
    } catch (e) {
      // Don't spam errors for 429 rate limits etc.
      console.warn("[Spotify] Playback fetch error:", e)
    }
  },

  play: async () => {
    try {
      await window.electron.invoke("spotify:play")
      // Optimistic update
      const t = get().track
      if (t) set({ track: { ...t, is_playing: true } })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  pause: async () => {
    try {
      await window.electron.invoke("spotify:pause")
      const t = get().track
      if (t) set({ track: { ...t, is_playing: false } })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  next: async () => {
    try {
      await window.electron.invoke("spotify:next")
      // Fetch new track after a brief delay
      setTimeout(() => get().fetchPlayback(), 500)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  previous: async () => {
    try {
      await window.electron.invoke("spotify:previous")
      setTimeout(() => get().fetchPlayback(), 500)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  setVolume: async (volume: number) => {
    try {
      await window.electron.invoke("spotify:setVolume", volume)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  setShuffle: async (state: boolean) => {
    try {
      await window.electron.invoke("spotify:setShuffle", { state })
      set({ shuffleState: state })
      // Refresh from actual state after a brief delay
      setTimeout(() => get().fetchPlayback(), 500)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  setRepeat: async (state: "off" | "context" | "track") => {
    try {
      await window.electron.invoke("spotify:setRepeat", { state })
      set({ repeatState: state })
      setTimeout(() => get().fetchPlayback(), 500)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  toggleShuffle: async () => {
    const newState = !get().shuffleState
    await get().setShuffle(newState)
  },

  cycleRepeat: async () => {
    const current = get().repeatState
    const next = current === "off" ? "context" : current === "context" ? "track" : "off"
    await get().setRepeat(next)
  },

  fetchDevices: async () => {
    if (!get().loggedIn) return
    try {
      const devices = await window.electron.invoke("spotify:getDevices") as SpotifyDevice[]
      set({ devices })
    } catch (e) {
      console.warn("[Spotify] Device fetch error:", e)
    }
  },

  fetchPlaylists: async () => {
    if (!get().loggedIn) return
    set({ playlistsLoading: true, playlistsError: null })
    try {
      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Playlist request timed out")), ms)
          promise
            .then((value) => {
              clearTimeout(timer)
              resolve(value)
            })
            .catch((err) => {
              clearTimeout(timer)
              reject(err)
            })
        })

      const playlists = await withTimeout(
        window.electron.invoke("spotify:getPlaylists") as Promise<SpotifyPlaylist[]>,
        12000,
      )
      set({
        playlists,
        playlistsLoaded: true,
        playlistsLoading: false,
        playlistsError: null,
      })
    } catch (e) {
      const raw = String(e)
      const missingScope =
        raw.includes("insufficient_scope") ||
        raw.includes("Insufficient client scope") ||
        raw.includes("playlist-read-private") ||
        raw.includes("permissions")
      const message = missingScope
        ? "Reconnect Spotify to grant playlist permissions."
        : "Failed to load playlists. Try refresh."

      console.warn("[Spotify] Playlists fetch error:", e)
      set({
        playlists: [],
        playlistsLoaded: true,
        playlistsLoading: false,
        playlistsError: message,
      })
    }
  },

  playPlaylist: async (playlistUri: string, deviceId?: string | null) => {
    try {
      // Prefer an explicit device id (Web Playback SDK in-app device),
      // then fallback to currently active Spotify Connect device.
      const { devices } = get()
      const activeDevice = devices.find(d => d.is_active)
      await window.electron.invoke("spotify:playPlaylist", {
        playlistUri,
        deviceId: deviceId ?? activeDevice?.id ?? null,
      })
      // Fetch updated playback after a brief delay
      setTimeout(() => get().fetchPlayback(), 800)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  setLoggedIn: (v) => set({ loggedIn: v, loading: false }),
  clearError: () => set({ error: null }),
}))
