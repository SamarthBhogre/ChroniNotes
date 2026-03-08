import { useEffect, useRef, useState } from "react"
import { useSpotifyStore } from "../store/spotify.store"

const SPOTIFY_SDK_SRC = "https://sdk.scdn.co/spotify-player.js"
let spotifySdkLoadPromise: Promise<void> | null = null

function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (spotifySdkLoadPromise) return spotifySdkLoadPromise

  spotifySdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SPOTIFY_SDK_SRC}"]`)
    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => resolve()
      return
    }

    const script = document.createElement("script")
    script.src = SPOTIFY_SDK_SRC
    script.async = true
    script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"))
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    document.body.appendChild(script)
  })

  return spotifySdkLoadPromise
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

const SpotifyLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
)

const PlayIcon = (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

const PrevIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
)

const NextIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z" />
  </svg>
)

const VolumeIcon = (
  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
  </svg>
)

const ShuffleIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
  </svg>
)

const RepeatIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
  </svg>
)

const RepeatOneIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
  </svg>
)

const LogoutIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const PlaylistIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

// ── Helper ───────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = (totalSec % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SpotifyPlayer() {
  const {
    loggedIn, track, loading, error,
    playlists, playlistsLoading, playlistsLoaded, playlistsError,
    shuffleState, repeatState,
    checkAuthStatus, login, logout,
    fetchPlayback, play: apiPlay, pause: apiPause, next: apiNext, previous: apiPrevious,
    setVolume, fetchPlaylists, playPlaylist,
    toggleShuffle, cycleRepeat,
    setLoggedIn, clearError,
  } = useSpotifyStore()

  const [volume, setVolumeLocal] = useState(50)
  const [collapsed, setCollapsed] = useState(false)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sdkPlayerRef = useRef<SpotifyWebPlaybackPlayer | null>(null)
  const sdkDeviceIdRef = useRef<string | null>(null)
  const sdkInitializingRef = useRef(false)
  const suppressTransientAuthErrorUntilRef = useRef<number>(0)

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  // Listen for auth events
  useEffect(() => {
    const cleanupComplete = window.electron.on("spotify:auth-complete", () => {
      setLoggedIn(true)
      fetchPlayback()
    })
    const cleanupError = window.electron.on("spotify:auth-error", (data) => {
      useSpotifyStore.setState({ loading: false, error: String(data) })
    })
    return () => {
      cleanupComplete()
      cleanupError()
    }
  }, [setLoggedIn, fetchPlayback])

  // Poll playback state only when SDK is not ready (Web API fallback path).
  useEffect(() => {
    if (!loggedIn) return
    if (sdkReady) return
    fetchPlayback()
    pollRef.current = setInterval(fetchPlayback, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loggedIn, fetchPlayback, sdkReady])

  // Auto-dismiss errors after 5s
  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 5000)
    return () => clearTimeout(t)
  }, [error, clearError])

  // Fetch playlists when panel is toggled open
  useEffect(() => {
    if (showPlaylists && loggedIn && !playlistsLoaded && !playlistsLoading) {
      fetchPlaylists()
    }
  }, [showPlaylists, loggedIn, playlistsLoaded, playlistsLoading, fetchPlaylists])

  // Standalone Spotify device via Web Playback SDK (in-app player)
  useEffect(() => {
    if (!loggedIn) {
      sdkPlayerRef.current?.disconnect()
      sdkPlayerRef.current = null
      sdkDeviceIdRef.current = null
      sdkInitializingRef.current = false
      setSdkReady(false)
      return
    }

    if (sdkPlayerRef.current || sdkInitializingRef.current) return
    sdkInitializingRef.current = true
    let disposed = false

    const initSdkPlayer = async () => {
      try {
        await loadSpotifySdk()
        if (disposed || !window.Spotify) return

        const getToken = async (attempt = 0): Promise<string> => {
          try {
            return await window.electron.invoke("spotify:getAccessToken") as string
          } catch (e) {
            if (attempt < 1) {
              await sleep(350)
              return getToken(attempt + 1)
            }
            throw e
          }
        }

        const player = new window.Spotify.Player({
          name: "ChroniNotes",
          volume: 0.5,
          getOAuthToken: (cb) => {
            // Suppress short-lived "invalid token" flashes while we retry.
            suppressTransientAuthErrorUntilRef.current = Date.now() + 2500
            getToken()
              .then((token) => cb(token))
              .catch((err) => {
                useSpotifyStore.setState({ error: String(err) })
              })
          },
        })

        player.addListener("ready", (payload) => {
          const { device_id } = payload as SpotifyWebPlaybackReady
          sdkDeviceIdRef.current = device_id
          setSdkReady(true)
          window.electron.invoke("spotify:setActiveDevice", { deviceId: device_id, play: false })
            .then(() => fetchPlayback())
            .catch((e) => {
              useSpotifyStore.setState({ error: String(e) })
            })
        })

        player.addListener("not_ready", (payload) => {
          const { device_id } = payload as SpotifyWebPlaybackReady
          if (sdkDeviceIdRef.current === device_id) {
            sdkDeviceIdRef.current = null
          }
          setSdkReady(false)
        })

        player.addListener("player_state_changed", (state) => {
          const playback = state as SpotifyPlaybackState | null
          if (!playback) return
          const current = playback.track_window.current_track
          useSpotifyStore.setState({
            track: {
              name: current.name,
              artist: current.artists.map((a) => a.name).join(", "),
              album: current.album.name,
              album_art_url: current.album.images[0]?.url ?? null,
              duration_ms: current.duration_ms,
              progress_ms: playback.position,
              is_playing: !playback.paused,
              track_uri: current.uri,
            },
          })
        })

        const onSdkError = (payload: SpotifyWebPlaybackError | SpotifyWebPlaybackReady | SpotifyPlaybackState | null) => {
          const err = payload as SpotifyWebPlaybackError
          const msg = String(err?.message ?? "")
          const looksTransientTokenError =
            msg.toLowerCase().includes("invalid token") ||
            msg.toLowerCase().includes("token expired")

          if (looksTransientTokenError && Date.now() < suppressTransientAuthErrorUntilRef.current) {
            return
          }
          useSpotifyStore.setState({ error: `Spotify SDK: ${err.message}` })
        }
        player.addListener("initialization_error", onSdkError)
        player.addListener("authentication_error", onSdkError)
        player.addListener("account_error", onSdkError)
        player.addListener("playback_error", onSdkError)

        const connected = await player.connect()
        if (!connected) {
          throw new Error("Spotify SDK could not connect")
        }

        if (disposed) {
          player.disconnect()
          return
        }
        sdkPlayerRef.current = player
      } catch (e) {
        useSpotifyStore.setState({ error: String(e) })
      } finally {
        sdkInitializingRef.current = false
      }
    }

    void initSdkPlayer()
    return () => {
      disposed = true
    }
  }, [loggedIn, fetchPlayback])

  const ensureSdkDeviceActive = async () => {
    const deviceId = sdkDeviceIdRef.current
    if (!deviceId) return
    await window.electron.invoke("spotify:setActiveDevice", { deviceId, play: false })
  }

  const syncTrackFromSdk = async () => {
    const player = sdkPlayerRef.current
    if (!player) return
    const state = await player.getCurrentState()
    if (!state) return
    const current = state.track_window.current_track
    useSpotifyStore.setState({
      track: {
        name: current.name,
        artist: current.artists.map((a) => a.name).join(", "),
        album: current.album.name,
        album_art_url: current.album.images[0]?.url ?? null,
        duration_ms: current.duration_ms,
        progress_ms: state.position,
        is_playing: !state.paused,
        track_uri: current.uri,
      },
    })
  }

  const handlePrevious = async () => {
    await ensureSdkDeviceActive()
    const player = sdkPlayerRef.current
    if (player) {
      await player.previousTrack()
      await sleep(250)
      await syncTrackFromSdk()
      return
    }
    await apiPrevious()
  }

  const handlePlayPause = async () => {
    await ensureSdkDeviceActive()
    const player = sdkPlayerRef.current
    if (player) {
      await player.togglePlay()
      await sleep(150)
      await syncTrackFromSdk()
      return
    }
    if (track?.is_playing) {
      await apiPause()
    } else {
      await apiPlay()
    }
  }

  const handleNext = async () => {
    await ensureSdkDeviceActive()
    const player = sdkPlayerRef.current
    if (player) {
      await player.nextTrack()
      await sleep(250)
      await syncTrackFromSdk()
      return
    }
    await apiNext()
  }

  const handlePlayPlaylist = async (playlistUri: string) => {
    await ensureSdkDeviceActive()
    await playPlaylist(playlistUri, sdkDeviceIdRef.current)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    setVolumeLocal(v)
    if (sdkPlayerRef.current) {
      void sdkPlayerRef.current.setVolume(v / 100).catch((err) => {
        useSpotifyStore.setState({ error: String(err) })
      })
      return
    }
    void setVolume(v)
  }

  // ── Not logged in: show connect button ──
  if (!loggedIn) {
    return (
      <div style={{
        padding: "12px 16px", borderTop: "1px solid var(--glass-border)",
      }}>
        <button
          onClick={login}
          disabled={loading}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", gap: "8px",
            padding: "10px 12px", borderRadius: "var(--radius-md)",
            background: loading ? "var(--glass-bg)" : "#1DB954",
            border: "1px solid",
            borderColor: loading ? "var(--glass-border)" : "#1DB954",
            color: loading ? "var(--text-tertiary)" : "white",
            fontSize: "12px", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.18s ease",
            opacity: loading ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            if (!loading) e.currentTarget.style.background = "#1ed760"
          }}
          onMouseLeave={e => {
            if (!loading) e.currentTarget.style.background = "#1DB954"
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: "14px", height: "14px", borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                animation: "spin 0.7s linear infinite",
              }} />
              Connecting…
            </>
          ) : (
            <>
              {SpotifyLogo}
              Connect Spotify
            </>
          )}
        </button>

        {error && (
          <div style={{
            marginTop: "6px", padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            fontSize: "10px", color: "var(--color-red)",
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Logged in: show player ──
  return (
    <div style={{
      borderTop: "1px solid var(--glass-border)",
      background: "rgba(0,0,0,0.15)",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px 4px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          color: "#1DB954", fontSize: "10px", fontWeight: 600,
        }}>
          {SpotifyLogo}
          <span style={{ letterSpacing: "0.3px" }}>
            Spotify{sdkReady ? " • In-App" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <MiniBtn
            onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) setCollapsed(false) }}
            title="Playlists"
            active={showPlaylists}
          >
            {PlaylistIcon}
          </MiniBtn>
          <MiniBtn onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand" : "Collapse"}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              {collapsed
                ? <polyline points="2,4 5,7 8,4" />
                : <polyline points="2,7 5,4 8,7" />
              }
            </svg>
          </MiniBtn>
          <MiniBtn onClick={logout} title="Disconnect Spotify">
            {LogoutIcon}
          </MiniBtn>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "4px 12px 10px" }}>
          {/* Track info */}
          {track ? (
            <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
              {/* Album art */}
              {track.album_art_url && (
                <img
                  src={track.album_art_url}
                  alt={track.album}
                  style={{
                    width: "44px", height: "44px", borderRadius: "6px",
                    objectFit: "cover", flexShrink: 0,
                    border: "1px solid var(--glass-border)",
                  }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: "12px", fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {track.name}
                </div>
                <div style={{
                  fontSize: "10px", color: "var(--text-tertiary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  marginTop: "2px",
                }}>
                  {track.artist}
                </div>
                <div style={{
                  fontSize: "9px", color: "var(--text-tertiary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  marginTop: "1px", opacity: 0.7,
                }}>
                  {track.album}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              fontSize: "11px", color: "var(--text-tertiary)",
              textAlign: "center", padding: "8px 0",
            }}>
              No track playing
            </div>
          )}

          {/* Progress bar */}
          {track && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{
                height: "3px", borderRadius: "2px",
                background: "var(--glass-border)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  background: "#1DB954",
                  width: `${track.duration_ms > 0 ? (track.progress_ms / track.duration_ms) * 100 : 0}%`,
                  transition: "width 1s linear",
                }} />
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "9px", color: "var(--text-tertiary)",
                marginTop: "3px", fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span>{formatMs(track.progress_ms)}</span>
                <span>{formatMs(track.duration_ms)}</span>
              </div>
            </div>
          )}

          {/* Playback controls */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "6px", marginBottom: "8px",
          }}>
            <ControlBtn
              onClick={async () => {
                try { await toggleShuffle() } catch (e) { useSpotifyStore.setState({ error: String(e) }) }
              }}
              title={shuffleState ? "Shuffle: On" : "Shuffle: Off"}
              active={shuffleState}
            >{ShuffleIcon}</ControlBtn>
            <ControlBtn onClick={async () => {
              try {
                await handlePrevious()
              } catch (e) {
                useSpotifyStore.setState({ error: String(e) })
              }
            }} title="Previous">{PrevIcon}</ControlBtn>
            <ControlBtn
              onClick={async () => {
                try {
                  await handlePlayPause()
                } catch (e) {
                  useSpotifyStore.setState({ error: String(e) })
                }
              }}
              title={track?.is_playing ? "Pause" : "Play"}
              primary
            >
              {track?.is_playing ? PauseIcon : PlayIcon}
            </ControlBtn>
            <ControlBtn onClick={async () => {
              try {
                await handleNext()
              } catch (e) {
                useSpotifyStore.setState({ error: String(e) })
              }
            }} title="Next">{NextIcon}</ControlBtn>
            <ControlBtn
              onClick={async () => {
                try { await cycleRepeat() } catch (e) { useSpotifyStore.setState({ error: String(e) }) }
              }}
              title={`Repeat: ${repeatState === "off" ? "Off" : repeatState === "context" ? "All" : "One"}`}
              active={repeatState !== "off"}
            >{repeatState === "track" ? RepeatOneIcon : RepeatIcon}</ControlBtn>
          </div>

          {/* Volume slider */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
              {VolumeIcon}
            </span>
            <input
              type="range"
              min={0} max={100}
              value={volume}
              onChange={handleVolumeChange}
              style={{
                flex: 1, height: "3px",
                appearance: "none", background: "var(--glass-border)",
                borderRadius: "2px", outline: "none",
                cursor: "pointer",
                accentColor: "#1DB954",
              }}
            />
            <span style={{
              fontSize: "9px", color: "var(--text-tertiary)",
              fontFamily: "'JetBrains Mono', monospace",
              width: "24px", textAlign: "right",
            }}>
              {volume}
            </span>
          </div>

          {/* ── Playlist Picker ── */}
          {showPlaylists && (
            <PlaylistPicker
              playlists={playlists}
              loading={playlistsLoading}
              error={playlistsError}
              onPlay={handlePlayPlaylist}
              onRefresh={fetchPlaylists}
            />
          )}
        </div>
      )}

      {error && (
        <div style={{
          margin: "0 12px 8px", padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          fontSize: "10px", color: "var(--color-red)",
          lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Playlist Picker ──────────────────────────────────────────────────────────

function PlaylistPicker({ playlists, loading, error, onPlay, onRefresh }: {
  playlists: { id: string; name: string; uri: string; image_url: string | null; tracks_total: number; owner_name: string | null }[]
  loading: boolean
  error: string | null
  onPlay: (uri: string) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [playingUri, setPlayingUri] = useState<string | null>(null)

  const handlePlay = async (uri: string) => {
    setPlayingUri(uri)
    try {
      await onPlay(uri)
    } finally {
      setTimeout(() => setPlayingUri(null), 1200)
    }
  }

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "6px",
      }}>
        <span style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase", color: "var(--text-tertiary)",
        }}>
          Playlists
        </span>
        <button
          onClick={onRefresh}
          title="Refresh playlists"
          disabled={loading}
          style={{
            padding: "2px 6px", borderRadius: "4px",
            background: "transparent", border: "none",
            color: "var(--text-tertiary)",
            cursor: loading ? "default" : "pointer",
            fontSize: "9px", fontWeight: 600,
            transition: "color 0.15s", opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.color = "#1DB954" }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.color = "var(--text-tertiary)" }}
        >
          ↻
        </button>
      </div>

      {loading ? (
        <div style={{
          fontSize: "10px", color: "var(--text-tertiary)",
          textAlign: "center", padding: "12px 0",
        }}>
          Loading playlists…
        </div>
      ) : error ? (
        <div style={{
          fontSize: "10px", color: "var(--color-red)",
          textAlign: "center", padding: "10px 6px",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.08)",
          borderRadius: "6px",
          lineHeight: 1.4,
        }}>
          {error}
        </div>
      ) : playlists.length === 0 ? (
        <div style={{
          fontSize: "10px", color: "var(--text-tertiary)",
          textAlign: "center", padding: "12px 0",
        }}>
          No playlists found.
        </div>
      ) : (
        <div style={{
          maxHeight: "160px", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: "3px",
        }}>
          {playlists.map(pl => {
            const isPlaying = playingUri === pl.uri
            return (
              <button
                key={pl.id}
                onClick={() => handlePlay(pl.uri)}
                disabled={isPlaying}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "5px 6px", borderRadius: "6px",
                  background: isPlaying ? "rgba(29,185,84,0.12)" : "transparent",
                  border: `1px solid ${isPlaying ? "rgba(29,185,84,0.25)" : "transparent"}`,
                  cursor: isPlaying ? "default" : "pointer",
                  transition: "all 0.12s ease",
                  textAlign: "left", width: "100%",
                }}
                onMouseEnter={e => {
                  if (!isPlaying) {
                    e.currentTarget.style.background = "var(--glass-bg-hover)"
                    e.currentTarget.style.borderColor = "var(--glass-border)"
                  }
                }}
                onMouseLeave={e => {
                  if (!isPlaying) {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.borderColor = "transparent"
                  }
                }}
              >
                {/* Playlist image */}
                {pl.image_url ? (
                  <img
                    src={pl.image_url}
                    alt=""
                    style={{
                      width: "28px", height: "28px", borderRadius: "4px",
                      objectFit: "cover", flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "4px",
                    background: "var(--glass-bg)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", color: "var(--text-tertiary)",
                  }}>
                    ♫
                  </div>
                )}

                {/* Playlist info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: "11px", fontWeight: 600,
                    color: isPlaying ? "#1DB954" : "var(--text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {pl.name}
                  </div>
                  <div style={{
                    fontSize: "9px", color: "var(--text-tertiary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {pl.tracks_total} tracks{pl.owner_name ? ` · ${pl.owner_name}` : ""}
                  </div>
                </div>

                {/* Play indicator */}
                {isPlaying ? (
                  <span style={{
                    fontSize: "9px", color: "#1DB954", fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    ▶
                  </span>
                ) : (
                  <span style={{
                    fontSize: "10px", color: "var(--text-tertiary)",
                    flexShrink: 0, opacity: 0.4,
                  }}>
                    ▶
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Small helper buttons ─────────────────────────────────────────────────────

function MiniBtn({ onClick, title, children, active }: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "20px", height: "20px", borderRadius: "4px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(29,185,84,0.15)" : "transparent",
        border: "none",
        color: active ? "#1DB954" : "var(--text-tertiary)",
        cursor: "pointer",
        transition: "all 0.15s ease", padding: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = "var(--glass-bg-hover)"
          e.currentTarget.style.color = "var(--text-secondary)"
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "var(--text-tertiary)"
        }
      }}
    >
      {children}
    </button>
  )
}

function ControlBtn({ onClick, title, children, primary, active }: {
  onClick: () => void; title: string; children: React.ReactNode; primary?: boolean; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: primary ? "34px" : "28px",
        height: primary ? "34px" : "28px",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: primary ? "#1DB954" : active ? "rgba(29,185,84,0.15)" : "var(--glass-bg)",
        border: `1px solid ${primary ? "#1DB954" : active ? "rgba(29,185,84,0.3)" : "var(--glass-border)"}`,
        color: primary ? "white" : active ? "#1DB954" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.15s ease", padding: 0,
        position: "relative",
      }}
      onMouseEnter={e => {
        if (primary) {
          e.currentTarget.style.background = "#1ed760"
          e.currentTarget.style.transform = "scale(1.05)"
        } else {
          e.currentTarget.style.background = active ? "rgba(29,185,84,0.25)" : "var(--glass-bg-hover)"
          e.currentTarget.style.color = active ? "#1ed760" : "var(--text-primary)"
        }
      }}
      onMouseLeave={e => {
        if (primary) {
          e.currentTarget.style.background = "#1DB954"
          e.currentTarget.style.transform = "scale(1)"
        } else {
          e.currentTarget.style.background = active ? "rgba(29,185,84,0.15)" : "var(--glass-bg)"
          e.currentTarget.style.color = active ? "#1DB954" : "var(--text-secondary)"
        }
      }}
    >
      {children}
      {/* Active dot indicator for shuffle/repeat */}
      {active && !primary && (
        <span style={{
          position: "absolute", bottom: "-2px", left: "50%", transform: "translateX(-50%)",
          width: "4px", height: "4px", borderRadius: "50%",
          background: "#1DB954",
        }} />
      )}
    </button>
  )
}
