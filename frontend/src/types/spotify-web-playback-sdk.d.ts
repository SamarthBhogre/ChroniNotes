interface SpotifyAlbumImage {
  url: string
}

interface SpotifyArtist {
  name: string
}

interface SpotifyTrackWindowTrack {
  name: string
  uri: string
  duration_ms: number
  album: {
    name: string
    images: SpotifyAlbumImage[]
  }
  artists: SpotifyArtist[]
}

interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifyTrackWindowTrack
  }
}

interface SpotifyWebPlaybackError {
  message: string
}

interface SpotifyWebPlaybackReady {
  device_id: string
}

interface SpotifyPlayerInit {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

interface SpotifyWebPlaybackPlayer {
  addListener(
    event:
      | "ready"
      | "not_ready"
      | "initialization_error"
      | "authentication_error"
      | "account_error"
      | "playback_error"
      | "player_state_changed",
    callback: (
      data:
        | SpotifyWebPlaybackReady
        | SpotifyWebPlaybackError
        | SpotifyPlaybackState
        | null
    ) => void
  ): boolean
  connect(): Promise<boolean>
  disconnect(): void
  pause(): Promise<void>
  resume(): Promise<void>
  togglePlay(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  getCurrentState(): Promise<SpotifyPlaybackState | null>
  setVolume(volume: number): Promise<void>
}

interface SpotifyNamespace {
  Player: new (init: SpotifyPlayerInit) => SpotifyWebPlaybackPlayer
}

interface Window {
  Spotify?: SpotifyNamespace
  onSpotifyWebPlaybackSDKReady?: () => void
}
