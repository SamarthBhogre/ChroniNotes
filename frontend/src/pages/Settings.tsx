import { useThemeStore, THEMES } from "../store/theme.store"
import type { ThemeId } from "../store/theme.store"

interface SettingsProps {
    onClose: () => void
}

export default function Settings({ onClose }: SettingsProps) {
    const { theme, setTheme, perfMode, setPerfMode } = useThemeStore()

    return (
        /* ── Backdrop ── */
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pageEnter 0.2s ease",
            }}
        >
            {/* ── Modal panel ── */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "min(560px, calc(100vw - 48px))",
                    maxHeight: "calc(100vh - 80px)",
                    overflowY: "auto",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--modal-bg, rgba(12,15,30,0.97))",
                    border: "1px solid var(--glass-border-strong)",
                    backdropFilter: "blur(32px) saturate(180%)",
                    WebkitBackdropFilter: "blur(32px) saturate(180%)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
                    animation: "settingsEnter 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                }}
            >
                {/* ── Header ── */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "20px 24px 16px",
                    borderBottom: "1px solid var(--glass-border)",
                }}>
                    <div>
                        <div style={{
                            fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px",
                            textTransform: "uppercase", color: "var(--accent)", marginBottom: "4px",
                        }}>Settings</div>
                        <h2 style={{
                            fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.3px",
                            color: "var(--text-primary)", margin: 0,
                        }}>Appearance</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: "32px", height: "32px", borderRadius: "8px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--text-secondary)",
                            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                            transition: "all 0.15s ease", flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = "var(--glass-bg-hover)"
                            e.currentTarget.style.color = "var(--text-primary)"
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = "var(--glass-bg)"
                            e.currentTarget.style.color = "var(--text-secondary)"
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: "20px 24px 24px" }}>

                    {/* ══ THEME SECTION ══ */}
                    <p style={{
                        fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px",
                        textTransform: "uppercase", color: "var(--text-tertiary)",
                        marginBottom: "14px",
                    }}>Theme</p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {THEMES.map(t => {
                            const active = theme === t.id
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id as ThemeId)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "14px",
                                        padding: "12px 14px", borderRadius: "var(--radius-lg)",
                                        background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                                        border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
                                        boxShadow: active ? "0 0 0 1px var(--accent-border)" : "none",
                                        transition: "all 0.18s ease",
                                        textAlign: "left", width: "100%", cursor: "pointer",
                                    }}
                                    onMouseEnter={e => {
                                        if (!active) {
                                            e.currentTarget.style.background = "var(--glass-bg-hover)"
                                            e.currentTarget.style.borderColor = "var(--glass-border-strong)"
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!active) {
                                            e.currentTarget.style.background = "var(--glass-bg)"
                                            e.currentTarget.style.borderColor = "var(--glass-border)"
                                        }
                                    }}
                                >
                                    {/* Swatches */}
                                    <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                                        {t.swatches.map((color, i) => (
                                            <div key={i} style={{
                                                width: i === 0 ? "22px" : "14px", height: "28px",
                                                borderRadius: "5px", background: color,
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                flexShrink: 0,
                                            }} />
                                        ))}
                                    </div>

                                    {/* Label */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: "13px", fontWeight: 600,
                                            color: active ? "var(--accent)" : "var(--text-primary)",
                                            marginBottom: "2px", transition: "color 0.15s",
                                        }}>{t.name}</div>
                                        <div style={{
                                            fontSize: "11px", color: "var(--text-tertiary)",
                                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                        }}>{t.description}</div>
                                    </div>

                                    {/* Active checkmark */}
                                    <div style={{
                                        width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
                                        background: active ? "var(--accent)" : "transparent",
                                        border: `1.5px solid ${active ? "var(--accent)" : "var(--glass-border-strong)"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: "all 0.18s ease",
                                    }}>
                                        {active && (
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* ── Divider ── */}
                    <div style={{ height: "1px", background: "var(--glass-border)", margin: "20px 0" }} />

                    {/* ══ PERFORMANCE SECTION ══ */}
                    <p style={{
                        fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px",
                        textTransform: "uppercase", color: "var(--text-tertiary)",
                        marginBottom: "14px",
                    }}>Performance</p>

                    {/* Performance Mode toggle row */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: "16px",
                        padding: "14px 16px", borderRadius: "var(--radius-lg)",
                        background: perfMode ? "var(--accent-dim)" : "var(--glass-bg)",
                        border: `1px solid ${perfMode ? "var(--accent-border)" : "var(--glass-border)"}`,
                        transition: "all 0.2s ease",
                    }}>
                        {/* Left: icon + text */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                            {/* Icon */}
                            <div style={{
                                width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
                                background: perfMode ? "var(--accent-dim)" : "var(--glass-bg-hover)",
                                border: `1px solid ${perfMode ? "var(--accent-border)" : "var(--glass-border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s ease",
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke={perfMode ? "var(--accent)" : "var(--text-secondary)"}
                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>

                            {/* Text */}
                            <div>
                                <div style={{
                                    fontSize: "13px", fontWeight: 600,
                                    color: perfMode ? "var(--accent)" : "var(--text-primary)",
                                    marginBottom: "2px", transition: "color 0.2s",
                                }}>
                                    Performance Mode
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
                                    {perfMode
                                        ? "Animations & blur effects disabled"
                                        : "Reduces blur, animations & GPU effects"}
                                </div>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                            onClick={() => setPerfMode(!perfMode)}
                            style={{
                                width: "44px", height: "24px", borderRadius: "12px",
                                background: perfMode ? "var(--accent)" : "var(--glass-border-strong)",
                                border: "none", cursor: "pointer", flexShrink: 0,
                                position: "relative",
                                transition: "background 0.25s ease",
                                padding: 0,
                            }}
                            aria-label="Toggle performance mode"
                        >
                            <div style={{
                                position: "absolute",
                                top: "3px",
                                left: perfMode ? "23px" : "3px",
                                width: "18px", height: "18px", borderRadius: "50%",
                                background: "white",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                            }} />
                        </button>
                    </div>

                    {/* Perf mode detail — what gets disabled */}
                    {perfMode && (
                        <div style={{
                            marginTop: "8px", padding: "10px 14px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--glass-bg)",
                            border: "1px solid var(--glass-border)",
                            animation: "pageEnter 0.2s ease",
                        }}>
                            <p style={{
                                fontSize: "11px", color: "var(--text-tertiary)",
                                lineHeight: 1.6, margin: 0,
                            }}>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Disabled: </span>
                                backdrop blur, background orb animations, ambient glow effects, CSS filters.
                                Solid backgrounds are used instead — ideal for low-end or integrated GPU systems.
                            </p>
                        </div>
                    )}

                    {/* ── Divider ── */}
                    <div style={{ height: "1px", background: "var(--glass-border)", margin: "20px 0" }} />

                    {/* Current theme badge */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 14px", borderRadius: "var(--radius-md)",
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    }}>
                        <div style={{
                            width: "8px", height: "8px", borderRadius: "50%",
                            background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)",
                            animation: "pulse-glow 2s ease-in-out infinite", flexShrink: 0,
                        }} />
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            Active theme:{" "}
                            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                                {THEMES.find(t => t.id === theme)?.name}
                            </span>
                            {perfMode && (
                                <span style={{
                                    marginLeft: "8px", fontSize: "10px", fontWeight: 600,
                                    color: "var(--accent)", opacity: 0.7,
                                    padding: "1px 6px", borderRadius: "4px",
                                    background: "var(--accent-dim)",
                                    border: "1px solid var(--accent-border)",
                                }}>
                                    PERF
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes settingsEnter {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
        </div>
    )
}