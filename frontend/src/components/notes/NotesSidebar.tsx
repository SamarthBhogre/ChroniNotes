import { useEffect, useRef, useState } from "react"
import { useNotesStore, type NoteEntry } from "../../store/notes.store"

/* ═══════════════════════════════════
   NOTION-STYLE FILE SIDEBAR
═══════════════════════════════════ */

export default function NotesSidebar() {
  const {
    notes,
    activeNoteId,
    expandedFolders,
    loading,
    loadNotes,
    createNote,
    createFolder,
    deleteNote,
    setActiveNote,
    toggleFolder,
    updateNote,
  } = useNotesStore()

  useEffect(() => {
    loadNotes()
  }, [])

  // Root items = parentId is null
  const rootNotes = notes.filter(n => n.parentId === null)

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid var(--glass-border)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: "16px 14px 12px",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "1.2px",
          }}
        >
          Pages
        </span>
        <div className="flex items-center gap-1">
          <ActionBtn
            title="New page"
            icon="＋"
            onClick={() => createNote(null)}
          />
          <ActionBtn
            title="New folder"
            icon="◈"
            onClick={() => createFolder(null)}
            fontSize="11px"
          />
        </div>
      </div>

      {/* ── Tree ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: "6px 0" }}>
        {loading && (
          <div
            style={{
              padding: "20px 14px",
              fontSize: "12px",
              color: "var(--text-tertiary)",
            }}
          >
            Loading…
          </div>
        )}

        {!loading && rootNotes.length === 0 && (
          <div style={{ padding: "24px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.4 }}>◉</div>
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-tertiary)",
                lineHeight: 1.5,
              }}
            >
              No pages yet.
              <br />
              <button
                onClick={() => createNote(null)}
                style={{
                  color: "var(--accent)",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginTop: "4px",
                }}
              >
                Create your first page →
              </button>
            </div>
          </div>
        )}

        {rootNotes.map(note => (
          <TreeNode
            key={note.id}
            note={note}
            allNotes={notes}
            depth={0}
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
  note: NoteEntry
  allNotes: NoteEntry[]
  depth: number
  activeNoteId: string | null
  expandedFolders: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onCreate: (parentId: string) => void
  onCreateFolder: (parentId: string) => void
  onRename: (id: string, title: string) => void
}

function TreeNode({
  note,
  allNotes,
  depth,
  activeNoteId,
  expandedFolders,
  onSelect,
  onToggle,
  onDelete,
  onCreate,
  onCreateFolder,
  onRename,
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

  // Sync title when note changes externally
  useEffect(() => {
    setEditTitle(note.title)
  }, [note.title])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
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
    if (trimmed && trimmed !== note.title) {
      onRename(note.id, trimmed)
    } else {
      setEditTitle(note.title)
    }
    setIsEditing(false)
  }

  return (
    <div>
      {/* Row */}
      <div
        className="group flex items-center relative"
        style={{
          paddingLeft: `${12 + depth * 16}px`,
          paddingRight: "8px",
          height: "30px",
          cursor: "pointer",
          fontSize: "12.5px",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--accent)" : "var(--text-secondary)",
          background: isActive ? "var(--accent-dim)" : "transparent",
          transition: "background 0.12s, color 0.12s",
        }}
        onClick={() => {
          if (note.isFolder) {
            onToggle(note.id)
          }
          onSelect(note.id)
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)"
            e.currentTarget.style.color = "var(--text-primary)"
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color = "var(--text-secondary)"
          }
        }}
        onDoubleClick={e => {
          e.stopPropagation()
          setIsEditing(true)
        }}
      >
        {/* Expand arrow */}
        {(note.isFolder || hasChildren) ? (
          <span
            onClick={e => {
              e.stopPropagation()
              onToggle(note.id)
            }}
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              color: "var(--text-tertiary)",
              flexShrink: 0,
              transition: "transform 0.15s ease",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
        ) : (
          <span style={{ width: "16px", flexShrink: 0 }} />
        )}

        {/* Icon */}
        <span
          style={{
            fontSize: "13px",
            flexShrink: 0,
            marginRight: "6px",
            lineHeight: 1,
          }}
        >
          {note.icon}
        </span>

        {/* Title or edit input */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === "Enter") handleRename()
              if (e.key === "Escape") {
                setEditTitle(note.title)
                setIsEditing(false)
              }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              height: "22px",
              padding: "0 4px",
              fontSize: "12px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--accent-border)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {note.title}
          </span>
        )}

        {/* Actions (visible on hover) */}
        <div
          className="opacity-0 group-hover:opacity-100"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            transition: "opacity 0.12s",
            flexShrink: 0,
          }}
        >
          {note.isFolder && (
            <MicroBtn
              title="New page inside"
              icon="＋"
              onClick={e => {
                e.stopPropagation()
                onCreate(note.id)
              }}
            />
          )}
          <MicroBtn
            title="More"
            icon="⋯"
            onClick={e => {
              e.stopPropagation()
              setShowMenu(s => !s)
            }}
          />
        </div>

        {/* Context menu */}
        {showMenu && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: "28px",
              right: "8px",
              zIndex: 100,
              background: "rgba(14, 16, 30, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border-strong)",
              borderRadius: "var(--radius-md)",
              padding: "4px",
              minWidth: "140px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              animation: "menuSlideIn 0.15s ease",
            }}
          >
            <CtxMenuItem
              label="Rename"
              onClick={() => {
                setShowMenu(false)
                setIsEditing(true)
              }}
            />
            <CtxMenuItem
              label="New page inside"
              onClick={() => {
                setShowMenu(false)
                onCreate(note.id)
              }}
            />
            <CtxMenuItem
              label="New folder inside"
              onClick={() => {
                setShowMenu(false)
                onCreateFolder(note.id)
              }}
            />
            <div
              style={{
                height: "1px",
                background: "var(--glass-border)",
                margin: "4px 0",
              }}
            />
            <CtxMenuItem
              label="Delete"
              danger
              onClick={() => {
                setShowMenu(false)
                onDelete(note.id)
              }}
            />
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode
              key={child.id}
              note={child}
              allNotes={allNotes}
              depth={depth + 1}
              activeNoteId={activeNoteId}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              onCreate={onCreate}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
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

function ActionBtn({
  title,
  icon,
  onClick,
  fontSize = "14px",
}: {
  title: string
  icon: string
  onClick: () => void
  fontSize?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: "22px",
        height: "22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        fontSize,
        color: "var(--text-tertiary)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--glass-bg-hover)"
        e.currentTarget.style.color = "var(--text-primary)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "var(--text-tertiary)"
      }}
    >
      {icon}
    </button>
  )
}

function MicroBtn({
  title,
  icon,
  onClick,
}: {
  title: string
  icon: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: "18px",
        height: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "3px",
        fontSize: "11px",
        color: "var(--text-tertiary)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--glass-bg-hover)"
        e.currentTarget.style.color = "var(--text-primary)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "var(--text-tertiary)"
      }}
    >
      {icon}
    </button>
  )
}

function CtxMenuItem({
  label,
  danger,
  onClick,
}: {
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "6px 10px",
        fontSize: "11.5px",
        fontWeight: 500,
        color: danger ? "var(--color-red)" : "var(--text-secondary)",
        background: "transparent",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger
          ? "rgba(248,113,113,0.12)"
          : "var(--glass-bg-hover)"
        e.currentTarget.style.color = danger
          ? "var(--color-red)"
          : "var(--text-primary)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = danger
          ? "var(--color-red)"
          : "var(--text-secondary)"
      }}
    >
      {label}
    </button>
  )
}
