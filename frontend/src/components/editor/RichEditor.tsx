import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import FontFamily from "@tiptap/extension-font-family"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
import { createLowlight } from "lowlight"

interface Props {
  content: any
  onChange: (json: any) => void
}

const lowlight = createLowlight()

export default function RichEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList:  { keepMarks: true },
        orderedList: { keepMarks: true },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      FontFamily,
      Placeholder.configure({
        placeholder: "Start writing…",
        emptyEditorClass: "is-editor-empty",
      }),
    ],

    content,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),

    editorProps: {
      attributes: {
        class: "focus:outline-none w-full min-h-[calc(100vh-300px)] max-w-none",
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex flex-col w-full">

      {/* ═══════════════ TOOLBAR ═══════════════ */}
      <div
        className="flex flex-wrap items-center gap-1 sticky top-0 z-10"
        style={{
          padding: "8px 12px",
          background: "rgba(6,8,17,0.75)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        }}
      >
        {/* ── Text style group ── */}
        <ToolGroup>
          <Btn label="B"  title="Bold"   active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            style={{ fontWeight: 700 }}
          />
          <Btn label="I"  title="Italic" active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            style={{ fontStyle: "italic" }}
          />
        </ToolGroup>

        <Divider />

        {/* ── Heading group ── */}
        <ToolGroup>
          <Btn label="H1" title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <Btn label="H2" title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <Btn label="H3" title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
        </ToolGroup>

        <Divider />

        {/* ── List group ── */}
        <ToolGroup>
          <Btn label="•"  title="Bullet List"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <Btn label="1." title="Numbered List"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </ToolGroup>

        <Divider />

        {/* ── Block group ── */}
        <ToolGroup>
          <Btn label="<>" title="Code Block"
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <Btn label="❝"  title="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </ToolGroup>

        {/* ── Font selector ── */}
        <select
          onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
          title="Font Family"
          style={{
            marginLeft: "auto",
            height: "28px",
            padding: "0 10px",
            borderRadius: "var(--radius-md)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)",
            fontSize: "11.5px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <option value="">Default</option>
          <option value="Inter">Inter</option>
          <option value="ui-monospace">Mono</option>
          <option value="serif">Serif</option>
        </select>
      </div>

      {/* ═══════════════ EDITOR AREA ═══════════════ */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--glass-border)",
          borderTop: "none",
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "32px 40px 60px",
          minHeight: "calc(100vh - 320px)",
        }}
      >
        <EditorContent editor={editor} className="tiptap w-full" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   TOOLBAR SUB-COMPONENTS
═══════════════════════════════════ */

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5">
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: "1px", height: "18px",
        background: "var(--glass-border-strong)",
        margin: "0 6px", flexShrink: 0,
      }}
    />
  )
}

function Btn({
  label,
  title,
  active,
  onClick,
  style,
}: {
  label: string
  title: string
  active: boolean
  onClick: () => void
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        height: "28px",
        padding: "0 9px",
        borderRadius: "var(--radius-sm)",
        fontSize: "12.5px",
        fontWeight: active ? 600 : 500,
        color: active ? "var(--accent)" : "var(--text-secondary)",
        background: active ? "var(--accent-dim)" : "transparent",
        border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
        boxShadow: active ? `0 0 10px var(--accent-glow)` : "none",
        transition: "all 0.15s ease",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget
          el.style.background = "var(--glass-bg-hover)"
          el.style.borderColor = "var(--glass-border)"
          el.style.color = "var(--text-primary)"
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const el = e.currentTarget
          el.style.background = "transparent"
          el.style.borderColor = "transparent"
          el.style.color = "var(--text-secondary)"
        }
      }}
    >
      {label}
    </button>
  )
}