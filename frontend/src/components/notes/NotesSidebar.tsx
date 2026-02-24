import { useEffect, useRef, useState } from "react"
import { useNotesStore, type NoteEntry } from "../../store/notes.store"

export default function NotesSidebar() {
  const {
    notes, activeNoteId, expandedFolders, loading,
    loadNotes, createNote, createFolder, deleteNote,
    setActiveNote, toggleFolder, updateNote,
  } = useNotesStore()

  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadNotes() }, [])

  // Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const rootNotes = notes.filter(n => n.parentId === null)

  // Filtered notes: if search is active, flatten and filter by title
  const searchActive = search.trim().length > 0
  const filteredNotes = searchActive
    ? notes.filter(n => !n.isFolder && n.title.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", width: "100%",
      background: "rgba(255,255,255,0.02)",
      borderRight: "1px solid var(--glass-border)",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "12px 12px 8px",
        borderBottom: "1px solid var(--glass-border)",
        display: "flex", flexDirection: "column", gap: "8px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>
            Pages
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <ActionBtn title="New page" icon="＋" onClick={() => createNote(null)} />
            <ActionBtn title="New folder" icon="◈" onClick={() => createFolder(null)} fontSize="11px" />
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              width: "100%", padding: "5px 8px 5px 26px",
              fontSize: "11px", background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "6px", color: "var(--text-primary)",
              outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--accent-border)" }}
            onBlur={e => { e.target.style.borderColor = "var(--glass-border)" }}
          />
          {searchActive && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)",
              width: "16px", height: "16px", borderRadius: "4px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "9px", color: "var(--text-tertiary)", cursor: "pointer",
              background: "var(--glass-bg-hover)", border: "none",
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Tree / Search results ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0" }}>
        {loading && (
          <div style={{ padding: "20px 14px", fontSize: "11px", color: "var(--text-tertiary)" }}>Loading…</div>
        )}

        {!loading && searchActive && (
          <>
            <div style={{ padding: "6px 14px 4px", fontSize: "9px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              {filteredNotes.length} result{filteredNotes.length !== 1 ? "s" : ""}
            </div>
            {filteredNotes.length === 0 ? (
              <div style={{ padding: "16px 14px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)" }}>
                No matching pages
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => { setActiveNote(note.id); setSearch("") }}
                  style={{
                    padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px",
                    fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "var(--text-primary)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)" }}
                >
                  <span style={{ fontSize: "12px", flexShrink: 0 }}>{note.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</span>
                </div>
              ))
            )}
          </>
        )}

        {!loading && !searchActive && rootNotes.length === 0 && (
          <div style={{ padding: "24px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◉</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
              No pages yet.
              <br />
              <button onClick={() => createNote(null)} style={{
                color: "var(--accent)", fontSize: "11px", fontWeight: 600,
                background: "none", border: "none", cursor: "pointer",
                padding: 0, marginTop: "4px",
              }}>
                Create your first page →
              </button>
            </div>
          </div>
        )}

        {!loading && !searchActive && rootNotes.map(note => (
          <TreeNode
            key={note.id}
            note={note} allNotes={notes} depth={0}
            activeNoteId={activeNoteId}
            expandedFolders={expandedFolders}
            onSelect={setActiveNote}
            onToggle={toggleFolder}
            onDelete={deleteNote}
            onCreate={createNote}
            onCreateFolder={createFolder}
            onRename={(id, title) => updateNote(id, { title })}
          />
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   TREE NODE (recursive)
═══════════════════════════════════ */
interface TreeNodeProps {
  note: NoteEntry; allNotes: NoteEntry[]; depth: number
  activeNoteId: string | null; expandedFolders: Set<string>
  onSelect: (id: string) => void; onToggle: (id: string) => void
  onDelete: (id: string) => void; onCreate: (parentId: string) => void
  onCreateFolder: (parentId: string) => void
  onRename: (id: string, title: string) => void
}

function TreeNode({
  note, allNotes, depth, activeNoteId, expandedFolders,
  onSelect, onToggle, onDelete, onCreate, onCreateFolder, onRename,
}: TreeNodeProps) {
  const children = allNotes.filter(n => n.parentId === note.id)
  const isExpanded = expandedFolders.has(note.id)
  const isActive = activeNoteId === note.id
  const hasChildren = children.length > 0
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditTitle(note.title) }, [note.title])

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showMenu])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleRename = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== note.title) onRename(note.id, trimmed)
    else setEditTitle(note.title)
    setIsEditing(false)
  }

  return (
    <div>
      <div
        className="group"
        style={{
          paddingLeft: `${10 + depth * 14}px`, paddingRight: "6px",
          height: "28px", cursor: "pointer",
          fontSize: "12px", fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--accent)" : "var(--text-secondary)",
          background: isActive ? "var(--accent-dim)" : "transparent",
          transition: "background 0.1s, color 0.1s",
          display: "flex", alignItems: "center", position: "relative",
        }}
        onClick={() => { if (note.isFolder) onToggle(note.id); onSelect(note.id) }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "var(--text-primary)" } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)" } }}
        onDoubleClick={e => { e.stopPropagation(); setIsEditing(true) }}
      >
        {/* Expand arrow */}
        {(note.isFolder || hasChildren) ? (
          <span onClick={e => { e.stopPropagation(); onToggle(note.id) }}
            style={{ width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "var(--text-tertiary)", flexShrink: 0, transition: "transform 0.12s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
            ▶
          </span>
        ) : (
          <span style={{ width: "14px", flexShrink: 0 }} />
        )}

        <span style={{ fontSize: "12px", flexShrink: 0, marginRight: "5px", lineHeight: 1 }}>{note.icon}</span>

        {isEditing ? (
          <input ref={inputRef} value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditTitle(note.title); setIsEditing(false) } }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, height: "20px", padding: "0 4px", fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid var(--accent-border)", borderRadius: "3px", color: "var(--text-primary)", outline: "none" }}
          />
        ) : (
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</span>
        )}

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100" style={{ display: "flex", alignItems: "center", gap: "1px", transition: "opacity 0.1s", flexShrink: 0 }}>
          {note.isFolder && <MicroBtn title="New page inside" icon="＋" onClick={e => { e.stopPropagation(); onCreate(note.id) }} />}
          <MicroBtn title="More" icon="⋯" onClick={e => { e.stopPropagation(); setShowMenu(s => !s) }} />
        </div>

        {showMenu && (
          <div ref={menuRef} style={{
            position: "absolute", top: "26px", right: "6px", zIndex: 100,
            background: "rgba(14, 16, 30, 0.95)", backdropFilter: "blur(20px)",
            border: "1px solid var(--glass-border-strong)", borderRadius: "8px",
            padding: "3px", minWidth: "130px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)", animation: "menuSlideIn 0.15s ease",
          }}>
            <CtxMenuItem label="Rename" onClick={() => { setShowMenu(false); setIsEditing(true) }} />
            <CtxMenuItem label="New page inside" onClick={() => { setShowMenu(false); onCreate(note.id) }} />
            <CtxMenuItem label="New folder inside" onClick={() => { setShowMenu(false); onCreateFolder(note.id) }} />
            <div style={{ height: "1px", background: "var(--glass-border)", margin: "3px 0" }} />
            <CtxMenuItem label="Delete" danger onClick={() => { setShowMenu(false); onDelete(note.id) }} />
          </div>
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode key={child.id} note={child} allNotes={allNotes} depth={depth + 1}
              activeNoteId={activeNoteId} expandedFolders={expandedFolders}
              onSelect={onSelect} onToggle={onToggle} onDelete={onDelete}
              onCreate={onCreate} onCreateFolder={onCreateFolder} onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════
   SMALL SUB-COMPONENTS
═══════════════════════════════════ */
function ActionBtn({ title, icon, onClick, fontSize = "14px" }: { title: string; icon: string; onClick: () => void; fontSize?: string }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: "4px", fontSize, color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", transition: "background 0.1s, color 0.1s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-tertiary)" }}
    >{icon}</button>
  )
}

function MicroBtn({ title, icon, onClick }: { title: string; icon: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: "3px", fontSize: "10px", color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", transition: "background 0.1s, color 0.1s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-tertiary)" }}
    >{icon}</button>
  )
}

function CtxMenuItem({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "5px 9px", fontSize: "11px", fontWeight: 500,
      color: danger ? "var(--color-red)" : "var(--text-secondary)",
      background: "transparent", border: "none", borderRadius: "4px",
      cursor: "pointer", transition: "background 0.1s, color 0.1s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "rgba(248,113,113,0.12)" : "var(--glass-bg-hover)"; e.currentTarget.style.color = danger ? "var(--color-red)" : "var(--text-primary)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? "var(--color-red)" : "var(--text-secondary)" }}
    >{label}</button>
  )
}
