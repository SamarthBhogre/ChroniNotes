import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { useNotesStore, type NoteEntry, type Difficulty } from "../../store/notes.store"

/* ─── Difficulty config ─── */
const DIFF_CFG: Record<NonNullable<Difficulty>, { label: string; color: string; bg: string }> = {
  easy:   { label: "Easy",   color: "#34d399", bg: "rgba(52,211,153,0.18)"  },
  medium: { label: "Med",    color: "#fbbf24", bg: "rgba(251,191,36,0.18)"  },
  hard:   { label: "Hard",   color: "#f87171", bg: "rgba(248,113,113,0.18)" },
}
const TAG_PALETTE = ["#818cf8","#60a5fa","#34d399","#fbbf24","#f472b6","#a78bfa","#38bdf8","#fb923c"]
function tagColor(t: string) {
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) & 0xffff
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

/* ═══════════════════════════════════════════════
   useSidebarDrag  — identical pattern to Tasks.tsx
   global window pointermove/pointerup, floating ghost
═══════════════════════════════════════════════ */
type DragState = {
  id: string; title: string; parentId: string | null
  startX: number; startY: number; curX: number; curY: number
  active: boolean
}

function useSidebarDrag(onDrop: (dragId: string, targetId: string, pos: "before" | "after") => void) {
  const [drag, setDrag]       = useState<DragState | null>(null)
  const [overId, setOverId]   = useState<string | null>(null)
  const [overPos, setOverPos] = useState<"before" | "after">("before")
  const rowRefs  = useRef<Record<string, HTMLDivElement>>({})
  const ghostRef = useRef<HTMLDivElement | null>(null)

  /* ghost */
  useEffect(() => {
    if (!drag?.active) { ghostRef.current?.remove(); ghostRef.current = null; return }
    if (!ghostRef.current) {
      const g = document.createElement("div")
      g.style.cssText = `position:fixed;z-index:9999;pointer-events:none;padding:5px 10px;border-radius:8px;background:var(--glass-bg-hover);border:1.5px solid var(--accent-border);box-shadow:0 8px 28px rgba(0,0,0,0.45);font-size:12px;font-weight:500;color:var(--text-primary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:rotate(1.5deg) scale(1.04);opacity:0.92;`
      g.textContent = drag.title
      document.body.appendChild(g)
      ghostRef.current = g
    }
    return () => { ghostRef.current?.remove(); ghostRef.current = null }
  }, [drag?.active])

  /* global pointermove + pointerup — same as Tasks.tsx */
  useEffect(() => {
    if (!drag) return
    const THRESHOLD = 6
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY
      const moved = Math.sqrt(dx*dx + dy*dy) > THRESHOLD
      setDrag(d => d ? { ...d, curX: e.clientX, curY: e.clientY, active: d.active || moved } : null)
      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX + 14}px`
        ghostRef.current.style.top  = `${e.clientY - 16}px`
      }
      if (moved || drag.active) {
        let fId: string | null = null, fPos: "before" | "after" = "before"
        for (const [id, el] of Object.entries(rowRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            fId = id; fPos = e.clientY < r.top + r.height / 2 ? "before" : "after"; break
          }
        }
        setOverId(fId); setOverPos(fPos)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (drag.active) {
        let tId: string | null = null, tPos: "before" | "after" = "before"
        for (const [id, el] of Object.entries(rowRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            tId = id; tPos = e.clientY < r.top + r.height / 2 ? "before" : "after"; break
          }
        }
        if (tId && tId !== drag.id) onDrop(drag.id, tId, tPos)
      }
      ghostRef.current?.remove(); ghostRef.current = null
      setDrag(null); setOverId(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup",   onUp)
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp) }
  }, [drag, onDrop])

  const startDrag = useCallback((note: NoteEntry, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return
    e.preventDefault()
    setDrag({ id: note.id, title: note.title, parentId: note.parentId, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, active: false })
  }, [])
  const registerRow   = useCallback((id: string, el: HTMLDivElement | null) => { if (el) rowRefs.current[id] = el; else delete rowRefs.current[id] }, [])
  const isDragging    = (id: string) => drag?.id === id && drag.active
  const isDraggingAny = drag?.active === true
  return { startDrag, registerRow, overId, overPos, isDragging, isDraggingAny }
}

/* ═══════════════════════════════════════════════
   NotesSidebar
═══════════════════════════════════════════════ */
export default function NotesSidebar() {
  const {
    notes, activeNoteId, expandedFolders, loading,
    loadNotes, createNote, createFolder, deleteNote,
    setActiveNote, toggleFolder, updateNote, reorderNote, moveNote,
  } = useNotesStore()

  const [search, setSearch]           = useState("")
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode]   = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadNotes() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === "Escape") { setSelectMode(false); setSelected(new Set()) }
      /* Ctrl+A — select all visible root notes while in select mode */
      if (selectMode && (e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        setSelected(new Set(notes.map(n => n.id)))
      }
      /* Delete key — delete selected */
      if (selectMode && (e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault()
        handleMassDelete()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [notes, selectMode, selected])

  const handleDrop = useCallback((dragId: string, targetId: string, pos: "before" | "after") => {
    reorderNote(dragId, targetId, pos)
  }, [reorderNote])

  const { startDrag, registerRow, overId, overPos, isDragging, isDraggingAny } = useSidebarDrag(handleDrop)

  /* ── Selection helpers ── */
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll  = () => setSelected(new Set(notes.map(n => n.id)))
  const clearSel   = () => { setSelected(new Set()); setSelectMode(false) }

  const handleMassDelete = () => {
    selected.forEach(id => deleteNote(id))
    clearSel()
  }

  const rootNotes    = [...notes.filter(n => n.parentId === null)].sort((a, b) => a.sortOrder - b.sortOrder)
  const searchActive = search.trim().length > 0
  const filteredNotes = searchActive
    ? notes.filter(n => !n.isFolder && n.title.toLowerCase().includes(search.toLowerCase()))
    : []
  const totalPages = notes.filter(n => !n.isFolder).length

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "var(--sidebar-bg)", borderRight: "1px solid var(--glass-border)", cursor: isDraggingAny ? "grabbing" : "default" }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid var(--glass-border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", paddingLeft: "2px" }}>Pages</span>
          <div style={{ display: "flex", gap: "1px" }}>
            <ActionBtn title="New page"          icon={<IconPage />}   onClick={() => createNote(null)} />
            <ActionBtn title="New folder"        icon={<IconFolder />} onClick={() => createFolder(null)} />
            <ActionBtn title="Select multiple (Ctrl+click rows)" icon={<IconCheck />}
              onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
              active={selectMode}
            />
          </div>
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search… (Ctrl+F)"
            style={{ width: "100%", padding: "5px 24px 5px 26px", fontSize: "11px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "7px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = "var(--accent-border)"}
            onBlur={e  => e.target.style.borderColor = "var(--glass-border)"}
          />
          {searchActive && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: "5px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "var(--text-tertiary)", cursor: "pointer", background: "var(--glass-bg-hover)", border: "none" }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Mass-select action bar ── */}
      {selectMode && (
        <div style={{ padding: "6px 10px", background: "var(--accent-dim)", borderBottom: "1px solid var(--accent-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", flex: 1 }}>
            {selected.size} selected
          </span>
          <MassBtn onClick={selectAll}        label="All"    />
          <MassBtn onClick={() => setSelected(new Set())} label="None"   />
          <div style={{ width: "1px", height: "14px", background: "var(--accent-border)" }} />
          <MassBtn onClick={handleMassDelete} label="Delete" danger disabled={selected.size === 0} />
          <button onClick={clearSel} style={{ width: "16px", height: "16px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", opacity: 0.7 }}>✕</button>
        </div>
      )}

      {/* ── Tree / Search results ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0 8px" }}>
        {loading && <div style={{ padding: "20px 12px", fontSize: "11px", color: "var(--text-tertiary)" }}>Loading…</div>}

        {/* Search results */}
        {!loading && searchActive && (
          <>
            <div style={{ padding: "5px 12px 3px", fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              {filteredNotes.length} result{filteredNotes.length !== 1 ? "s" : ""}
            </div>
            {filteredNotes.length === 0
              ? <div style={{ padding: "16px 12px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)" }}>No matching pages</div>
              : filteredNotes.map(note => (
                <div key={note.id} onClick={() => { setActiveNote(note.id); setSearch("") }}
                  style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)" }}
                >
                  <span>{note.icon}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</span>
                  {note.difficulty && <DiffPill d={note.difficulty} />}
                </div>
              ))
            }
          </>
        )}

        {/* Empty state */}
        {!loading && !searchActive && rootNotes.length === 0 && (
          <div style={{ padding: "32px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.15 }}>◉</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              No pages yet.<br />
              <button onClick={() => createNote(null)} style={{ color: "var(--accent)", fontSize: "11px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: "4px" }}>
                Create your first page →
              </button>
            </div>
          </div>
        )}

        {/* Tree */}
        {!loading && !searchActive && rootNotes.map(note => (
          <TreeNode key={note.id}
            note={note} allNotes={notes} depth={0}
            activeNoteId={activeNoteId} expandedFolders={expandedFolders}
            overId={overId} overPos={overPos}
            isDragging={isDragging} isDraggingAny={isDraggingAny}
            onStartDrag={startDrag} registerRow={registerRow}
            selectMode={selectMode} selected={selected} onToggleSelect={toggleSelect}
            onSelect={setActiveNote} onToggle={toggleFolder}
            onDelete={deleteNote} onCreate={createNote} onCreateFolder={createFolder}
            onRename={(id, title) => updateNote(id, { title })}
            onUpdateMeta={(id, patch) => updateNote(id, patch)}
            onMoveUp={id => moveNote(id, "up")}
            onMoveDown={id => moveNote(id, "down")}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "7px 12px", borderTop: "1px solid var(--glass-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
        {selectMode && selected.size > 0 && (
          <span style={{ fontSize: "10px", color: "var(--accent)", fontWeight: 600 }}>{selected.size} selected · Del to delete</span>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TreeNode
═══════════════════════════════════════════════ */
interface TreeNodeProps {
  note: NoteEntry; allNotes: NoteEntry[]; depth: number
  activeNoteId: string | null; expandedFolders: Set<string>
  overId: string | null; overPos: "before" | "after"
  isDragging: (id: string) => boolean; isDraggingAny: boolean
  onStartDrag: (note: NoteEntry, e: React.PointerEvent) => void
  registerRow:  (id: string, el: HTMLDivElement | null) => void
  selectMode: boolean; selected: Set<string>; onToggleSelect: (id: string) => void
  onSelect: (id: string) => void; onToggle: (id: string) => void
  onDelete: (id: string) => void; onCreate: (parentId: string) => void
  onCreateFolder: (parentId: string) => void
  onRename: (id: string, title: string) => void
  onUpdateMeta: (id: string, patch: any) => void
  onMoveUp: (id: string) => void; onMoveDown: (id: string) => void
}

function TreeNode({
  note, allNotes, depth, activeNoteId, expandedFolders,
  overId, overPos, isDragging, isDraggingAny,
  onStartDrag, registerRow,
  selectMode, selected, onToggleSelect,
  onSelect, onToggle, onDelete, onCreate, onCreateFolder,
  onRename, onUpdateMeta, onMoveUp, onMoveDown,
}: TreeNodeProps) {
  const children   = [...allNotes.filter(n => n.parentId === note.id)].sort((a, b) => a.sortOrder - b.sortOrder)
  const isExpanded = expandedFolders.has(note.id)
  const isActive   = activeNoteId === note.id
  const amDragging = isDragging(note.id)
  const isSelected = selected.has(note.id)

  const [isEditing,    setIsEditing]    = useState(false)
  const [editTitle,    setEditTitle]    = useState(note.title)
  const [showMenu,     setShowMenu]     = useState(false)
  const [showMetaMenu, setShowMetaMenu] = useState(false)
  const [hovered,      setHovered]      = useState(false)

  const menuRef  = useRef<HTMLDivElement>(null)
  const metaRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditTitle(note.title) }, [note.title])
  useEffect(() => {
    if (!showMenu && !showMetaMenu) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
      if (metaRef.current && !metaRef.current.contains(e.target as Node)) setShowMetaMenu(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showMenu, showMetaMenu])
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [isEditing])

  const handleRename = () => {
    const t = editTitle.trim()
    if (t && t !== note.title) onRename(note.id, t)
    else setEditTitle(note.title)
    setIsEditing(false)
  }

  const handleClick = () => {
    if (amDragging) return
    if (selectMode) { onToggleSelect(note.id); return }
    if (note.isFolder) onToggle(note.id)
    onSelect(note.id)
  }

  const isDropBefore = overId === note.id && overPos === "before" && !amDragging
  const isDropAfter  = overId === note.id && overPos === "after"  && !amDragging

  return (
    <div style={{ position: "relative" }}>
      {isDropBefore && <DropLine />}

      <div
        ref={el => registerRow(note.id, el)}
        onMouseEnter={() => !isDraggingAny && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={e => { if (selectMode) return; onStartDrag(note, e) }}
        onClick={handleClick}
        onDoubleClick={e => { if (selectMode) return; e.stopPropagation(); setIsEditing(true) }}
        style={{
          paddingLeft: `${10 + depth * 14}px`,
          paddingRight: "4px",
          height: note.isFolder ? "32px" : "28px",
          cursor: selectMode ? "pointer" : isDraggingAny ? "grabbing" : "grab",
          fontSize: "12px",
          fontWeight: isActive ? 600 : note.isFolder ? 600 : 400,
          color: isSelected
            ? "var(--accent)"
            : isActive ? "var(--accent)"
            : hovered ? "var(--text-primary)" : "var(--text-secondary)",
          background: isSelected
            ? "var(--accent-dim)"
            : isActive ? "var(--accent-dim)"
            : hovered ? "var(--glass-bg-hover)"
            : note.isFolder ? "rgba(255,255,255,0.02)" : "transparent",
          transition: "background 0.1s, color 0.1s",
          display: "flex", alignItems: "center",
          position: "relative",
          userSelect: "none", touchAction: "none",
          borderLeft: isSelected
            ? "2px solid var(--accent)"
            : isActive ? "2px solid var(--accent)" : "2px solid transparent",
          opacity: amDragging ? 0.35 : 1,
          outline: isSelected ? "none" : "none",
        }}
      >
        {/* Checkbox in select mode, expand arrow otherwise */}
        {selectMode ? (
          <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--text-tertiary)"}`, background: isSelected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}>
              {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
          </span>
        ) : (
          (note.isFolder || children.length > 0) ? (
            <span onClick={e => { e.stopPropagation(); onToggle(note.id) }}
              style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", color: "var(--text-tertiary)", flexShrink: 0, transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          ) : <span style={{ width: "16px", flexShrink: 0 }} />
        )}

        <span style={{ fontSize: note.isFolder ? "13px" : "12px", flexShrink: 0, marginRight: "5px", lineHeight: 1 }}>{note.icon}</span>

        {isEditing ? (
          <input ref={inputRef} value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditTitle(note.title); setIsEditing(false) } }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, height: "20px", padding: "0 4px", fontSize: "11px", background: "var(--glass-bg)", border: "1px solid var(--accent-border)", borderRadius: "4px", color: "var(--text-primary)", outline: "none" }}
          />
        ) : (
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</span>
        )}

        {/* Badges */}
        {!isEditing && !amDragging && !selectMode && (
          <>
            {note.difficulty && <DiffPill d={note.difficulty} />}
            {note.tags.length > 0 && (
              <div style={{ display: "flex", gap: "2px", flexShrink: 0, marginLeft: "3px" }}>
                {note.tags.slice(0, 3).map(t => (
                  <span key={t} style={{ width: "5px", height: "5px", borderRadius: "50%", background: tagColor(t), opacity: 0.8, flexShrink: 0 }} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Hover actions (hidden in select mode) */}
        {!selectMode && (hovered || showMenu || showMetaMenu) && !isEditing && !isDraggingAny && (
          <div style={{ display: "flex", alignItems: "center", gap: "1px", flexShrink: 0, marginLeft: "3px" }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            {note.isFolder && (
              <MicroBtn title="New page inside" onClick={() => onCreate(note.id)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </MicroBtn>
            )}
            <MicroBtn title="Tags & difficulty" onClick={() => setShowMetaMenu(s => !s)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            </MicroBtn>
            <MicroBtn title="More options" onClick={() => setShowMenu(s => !s)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
            </MicroBtn>
          </div>
        )}

        {/* Context menu */}
        {showMenu && (
          <div ref={menuRef} style={{ position: "absolute", top: "100%", right: "4px", zIndex: 500, background: "var(--modal-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "10px", padding: "4px", minWidth: "160px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", animation: "menuSlideIn 0.15s ease" }}>
            <CtxItem label="Rename"            onClick={() => { setShowMenu(false); setIsEditing(true) }} />
            <CtxItem label="New page inside"   onClick={() => { setShowMenu(false); onCreate(note.id) }} />
            <CtxItem label="New folder inside" onClick={() => { setShowMenu(false); onCreateFolder(note.id) }} />
            <div style={{ height: "1px", background: "var(--glass-border)", margin: "3px 4px" }} />
            <CtxItem label="Move up"   icon="↑" onClick={() => { setShowMenu(false); onMoveUp(note.id) }} />
            <CtxItem label="Move down" icon="↓" onClick={() => { setShowMenu(false); onMoveDown(note.id) }} />
            <div style={{ height: "1px", background: "var(--glass-border)", margin: "3px 4px" }} />
            <CtxItem label="Delete" danger onClick={() => { setShowMenu(false); onDelete(note.id) }} />
          </div>
        )}
        {showMetaMenu && (
          <MetaPanel ref={metaRef} note={note}
            onClose={() => setShowMetaMenu(false)}
            onUpdate={patch => { onUpdateMeta(note.id, patch); setShowMetaMenu(false) }}
          />
        )}
      </div>

      {isDropAfter && <DropLine />}

      {isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode key={child.id}
              note={child} allNotes={allNotes} depth={depth + 1}
              activeNoteId={activeNoteId} expandedFolders={expandedFolders}
              overId={overId} overPos={overPos}
              isDragging={isDragging} isDraggingAny={isDraggingAny}
              onStartDrag={onStartDrag} registerRow={registerRow}
              selectMode={selectMode} selected={selected} onToggleSelect={onToggleSelect}
              onSelect={onSelect} onToggle={onToggle}
              onDelete={onDelete} onCreate={onCreate} onCreateFolder={onCreateFolder}
              onRename={onRename} onUpdateMeta={onUpdateMeta}
              onMoveUp={onMoveUp} onMoveDown={onMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MetaPanel
═══════════════════════════════════════════════ */
const MetaPanel = forwardRef<HTMLDivElement, {
  note: NoteEntry; onClose: () => void
  onUpdate: (patch: { tags?: string[]; difficulty?: Difficulty }) => void
}>(({ note, onUpdate }, ref) => {
  const [tags, setTags]     = useState<string[]>(note.tags)
  const [newTag, setNewTag] = useState("")
  const [diff, setDiff]     = useState<Difficulty>(note.difficulty)
  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, "-")
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setNewTag("")
  }
  return (
    <div ref={ref} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
      style={{ position: "absolute", top: "100%", right: "4px", zIndex: 500, background: "var(--modal-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "12px", padding: "12px", minWidth: "210px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)", animation: "menuSlideIn 0.15s ease" }}>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Difficulty</div>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["easy", "medium", "hard"] as const).map(d => {
            const c = DIFF_CFG[d]; const active = diff === d
            return <button key={d} onClick={() => setDiff(active ? null : d)} style={{ flex: 1, padding: "5px 0", borderRadius: "7px", fontSize: "10px", fontWeight: 700, background: active ? c.bg : "var(--glass-bg)", border: `1px solid ${active ? c.color + "60" : "var(--glass-border)"}`, color: active ? c.color : "var(--text-tertiary)", cursor: "pointer", transition: "all 0.12s" }}>{c.label}</button>
          })}
        </div>
      </div>
      <div>
        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "7px", minHeight: "20px" }}>
          {tags.length === 0
            ? <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontStyle: "italic" }}>No tags</span>
            : tags.map(t => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 7px 2px 8px", borderRadius: "20px", background: tagColor(t) + "22", border: `1px solid ${tagColor(t)}55`, color: tagColor(t), fontSize: "10px", fontWeight: 600 }}>
                #{t}<button onClick={() => setTags(p => p.filter(x => x !== t))} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, fontSize: "9px", lineHeight: 1 }}>✕</button>
              </span>
            ))}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <input value={newTag} onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTag() }}
            onPointerDown={e => e.stopPropagation()}
            placeholder="add-tag"
            style={{ flex: 1, padding: "4px 8px", fontSize: "10px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "6px", color: "var(--text-primary)", outline: "none" }}
            onFocus={e => e.currentTarget.style.borderColor = "var(--accent-border)"}
            onBlur={e  => e.currentTarget.style.borderColor = "var(--glass-border)"}
          />
          <button onClick={addTag} style={{ padding: "4px 9px", borderRadius: "6px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>+</button>
        </div>
      </div>
      <button onClick={() => onUpdate({ tags, difficulty: diff })} style={{ marginTop: "10px", width: "100%", padding: "7px", background: "var(--accent)", border: "none", borderRadius: "8px", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Apply</button>
    </div>
  )
})

/* ═══════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════ */
function DropLine() {
  return <div style={{ height: "2px", margin: "0 10px", background: "var(--accent)", borderRadius: "2px", opacity: 0.85, pointerEvents: "none" }} />
}
function DiffPill({ d }: { d: NonNullable<Difficulty> }) {
  const c = DIFF_CFG[d]
  return <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "5px", background: c.bg, color: c.color, lineHeight: "14px", flexShrink: 0, marginLeft: "3px" }}>{c.label}</span>
}
function ActionBtn({ title, icon, onClick, active }: { title: string; icon: React.ReactNode; onClick: () => void; active?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", color: active ? "var(--accent)" : hov ? "var(--text-primary)" : "var(--text-tertiary)", background: active ? "var(--accent-dim)" : hov ? "var(--glass-bg-hover)" : "transparent", border: active ? "1px solid var(--accent-border)" : "none", cursor: "pointer", transition: "all 0.1s" }}>
      {icon}
    </button>
  )
}
function MicroBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", color: hov ? "var(--text-primary)" : "var(--text-tertiary)", background: hov ? "var(--glass-bg-hover)" : "transparent", border: "none", cursor: "pointer", transition: "all 0.1s" }}>
      {children}
    </button>
  )
}
function MassBtn({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "none", background: danger ? (disabled ? "rgba(248,113,113,0.08)" : "rgba(248,113,113,0.18)") : "rgba(255,255,255,0.06)", color: danger ? (disabled ? "rgba(248,113,113,0.4)" : "var(--color-red)") : "var(--accent)", opacity: disabled ? 0.5 : 1, transition: "all 0.1s" }}>
      {label}
    </button>
  )
}
function CtxItem({ label, icon, danger, onClick }: { label: string; icon?: string; danger?: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: "11px", fontWeight: 500, color: danger ? "var(--color-red)" : hov ? "var(--text-primary)" : "var(--text-secondary)", background: hov ? (danger ? "rgba(248,113,113,0.08)" : "var(--glass-bg-hover)") : "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.1s" }}>
      {icon && <span style={{ fontSize: "11px", opacity: 0.7 }}>{icon}</span>}
      {label}
    </button>
  )
}
function IconPage() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
}
function IconFolder() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
}
function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
