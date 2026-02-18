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

  return (
    <div
      className="flex h-full"
      style={{ color: "var(--text-primary)" }}
    >
      {/* ── File Sidebar ── */}
      <div
        className="flex-shrink-0 h-full"
        style={{ width: "240px" }}
      >
        <NotesSidebar />
      </div>

      {/* ── Editor Area ── */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* If a note file is selected */}
        {activeNoteId && activeNote && !activeNote.isFolder && contentReady ? (
          <>
            {/* ── Note Header ── */}
            <header
              className="flex-shrink-0"
              style={{
                padding: "20px 48px 16px",
                borderBottom: "1px solid var(--glass-border)",
                background: "rgba(255,255,255,0.02)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span style={{ fontSize: "22px", lineHeight: 1 }}>{activeNote.icon}</span>
                <h1
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    letterSpacing: "-0.3px",
                    lineHeight: 1.2,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {activeNote.title}
                </h1>
              </div>

              {/* Save indicator */}
              <div
                style={{
                  fontSize: "10.5px",
                  fontWeight: 500,
                  color: saving ? "var(--color-yellow)" : "var(--text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  flexShrink: 0,
                  transition: "color 0.2s",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: saving ? "var(--color-yellow)" : "var(--color-green)",
                    transition: "background 0.2s",
                  }}
                />
                {saving ? "Saving…" : "Saved"}
              </div>
            </header>

            {/* ── Editor ── */}
            <div className="flex-1 overflow-hidden">
              <div
                style={{
                  maxWidth: "860px",
                  margin: "0 auto",
                  padding: "24px 48px 40px",
                  height: "100%",
                }}
              >
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
          <div className="flex-1 flex items-center justify-center">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>
                {activeNote.icon}
              </div>
              <h2
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                {activeNote.title}
              </h2>
              <p
                style={{
                  fontSize: "12.5px",
                  color: "var(--text-tertiary)",
                  marginBottom: "16px",
                }}
              >
                {notes.filter(n => n.parentId === activeNote.id).length} items inside
              </p>
              <button
                onClick={() => createNote(activeNote.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-border)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 0 16px var(--accent-glow)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                ＋ New page here
              </button>
            </div>
          </div>
        ) : (
          /* ── No note selected — empty state ── */
          <div className="flex-1 flex items-center justify-center">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "52px", marginBottom: "16px", opacity: 0.2 }}>◉</div>
              <h2
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                }}
              >
                ChroniNotes
              </h2>
              <p
                style={{
                  fontSize: "12.5px",
                  color: "var(--text-tertiary)",
                  maxWidth: "260px",
                  lineHeight: 1.6,
                }}
              >
                Select a page from the sidebar or create a new one to start writing.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
