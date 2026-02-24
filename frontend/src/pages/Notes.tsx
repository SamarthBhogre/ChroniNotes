import { useEffect, useState } from "react"
import RichEditor from "../components/editor/RichEditor"
import NotesSidebar from "../components/notes/NotesSidebar"
import { useNotesStore } from "../store/notes.store"

export default function Notes() {
  const {
    activeNoteId,
    notes,
    saving,
    fetchNoteContent,
    updateNote,
    createNote,
  } = useNotesStore()

  const activeNote = notes.find(n => n.id === activeNoteId)
  const [loadedContent, setLoadedContent] = useState<any>(null)
  const [contentReady, setContentReady] = useState(false)

  // Fetch content when active note changes
  useEffect(() => {
    setContentReady(false)
    setLoadedContent(null)

    if (!activeNoteId || activeNote?.isFolder) return

    fetchNoteContent(activeNoteId).then(entry => {
      if (entry) {
        setLoadedContent(entry.content ?? { type: "doc", content: [] })
        setContentReady(true)
      }
    })
  }, [activeNoteId])

  const handleSave = (json: any) => {
    if (activeNoteId) {
      updateNote(activeNoteId, { content: json })
    }
  }

  // Breadcrumb: walk up parentId chain
  const breadcrumb: { id: string; title: string; icon: string }[] = []
  if (activeNote) {
    let cur = activeNote
    breadcrumb.unshift({ id: cur.id, title: cur.title, icon: cur.icon })
    while (cur.parentId) {
      const parent = notes.find(n => n.id === cur.parentId)
      if (!parent) break
      breadcrumb.unshift({ id: parent.id, title: parent.title, icon: parent.icon })
      cur = parent
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", color: "var(--text-primary)" }}>

      {/* ── File Sidebar ── */}
      <div style={{ width: "240px", flexShrink: 0, height: "100%" }}>
        <NotesSidebar />
      </div>

      {/* ── Editor Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>

        {/* If a note file is selected */}
        {activeNoteId && activeNote && !activeNote.isFolder && contentReady ? (
          <>
            {/* ── Note Header ── */}
            <header style={{
              padding: "14px 36px 12px",
              borderBottom: "1px solid var(--glass-border)",
              background: "rgba(255,255,255,0.02)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "12px", flexShrink: 0,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                {/* Breadcrumb */}
                {breadcrumb.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--text-tertiary)" }}>
                    {breadcrumb.slice(0, -1).map((crumb, i) => (
                      <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        {i > 0 && <span style={{ opacity: 0.4, margin: "0 1px" }}>/</span>}
                        <span style={{ fontSize: "10px" }}>{crumb.icon}</span>
                        <span>{crumb.title}</span>
                      </span>
                    ))}
                    <span style={{ opacity: 0.4, margin: "0 1px" }}>/</span>
                  </div>
                )}

                {/* Title */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{activeNote.icon}</span>
                  <h1 style={{
                    fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.2px",
                    lineHeight: 1.2, margin: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: "var(--text-primary)",
                  }}>
                    {activeNote.title}
                  </h1>
                </div>
              </div>

              {/* Right side: save indicator + meta */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                {/* Save indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  fontSize: "10px", fontWeight: 500,
                  color: saving ? "var(--color-yellow)" : "var(--text-tertiary)",
                  padding: "3px 8px", borderRadius: "6px",
                  background: saving ? "rgba(251,191,36,0.08)" : "transparent",
                  transition: "all 0.2s",
                }}>
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: saving ? "var(--color-yellow)" : "var(--color-green)",
                    transition: "background 0.2s",
                  }} />
                  {saving ? "Saving…" : "Saved"}
                </div>
              </div>
            </header>

            {/* ── Editor ── */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{
                maxWidth: "820px", margin: "0 auto",
                padding: "20px 42px 40px", height: "100%",
              }}>
                <RichEditor
                  key={activeNoteId}
                  noteId={activeNoteId}
                  content={loadedContent}
                  onSave={handleSave}
                />
              </div>
            </div>
          </>
        ) : activeNote?.isFolder ? (
          /* ── Folder selected ── */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: "280px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "14px", margin: "0 auto 16px",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px",
              }}>◈</div>
              <h2 style={{
                fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)",
                marginBottom: "6px",
              }}>
                {activeNote.title}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "16px", lineHeight: 1.5 }}>
                {notes.filter(n => n.parentId === activeNote.id).length} items inside this folder
              </p>
              <button
                onClick={() => createNote(activeNote.id)}
                style={{
                  padding: "8px 18px", borderRadius: "10px",
                  fontSize: "12px", fontWeight: 600,
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-border)",
                  cursor: "pointer", transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: "5px",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 14px var(--accent-glow)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)" }}
              >
                <span style={{ fontSize: "13px" }}>+</span> New page here
              </button>
            </div>
          </div>
        ) : (
          /* ── No note selected — empty state ── */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: "300px" }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "16px", margin: "0 auto 20px",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "28px", opacity: 0.4,
              }}>◉</div>
              <h2 style={{
                fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)",
                marginBottom: "6px",
              }}>ChroniNotes</h2>
              <p style={{
                fontSize: "12px", color: "var(--text-tertiary)",
                lineHeight: 1.6, marginBottom: "20px",
              }}>
                Select a page from the sidebar or create a new one to start writing.
              </p>
              <button
                onClick={() => createNote(null)}
                style={{
                  padding: "9px 20px", borderRadius: "10px",
                  background: "var(--accent)", border: "none",
                  color: "white", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: "0 0 14px var(--accent-glow)",
                  display: "inline-flex", alignItems: "center", gap: "6px",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px) scale(1.02)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)" }}
              >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> Create your first page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
