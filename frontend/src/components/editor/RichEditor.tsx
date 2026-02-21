import { useEffect, useRef, useState } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import FontFamily from "@tiptap/extension-font-family"
import Underline from "@tiptap/extension-underline"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
import { common, createLowlight } from "lowlight"

interface Props {
  noteId: string
  content: any
  onSave: (json: any) => void
}

const CODE_LANG_OPTIONS = [
  { label: "TypeScript", value: "typescript" },
  { label: "React (JSX)", value: "jsx" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
] as const

const DEFAULT_CODE_LANGUAGE = "typescript"
const DEFAULT_TOOLBAR_STATE = {
  bold: false,
  italic: false,
  underline: false,
  h1: false,
  h2: false,
  h3: false,
  bulletList: false,
  orderedList: false,
  codeBlock: false,
  blockquote: false,
  codeLanguage: undefined as string | undefined,
}

const lowlight = createLowlight(common)
lowlight.registerAlias({
  javascript: ["js", "jsx", "react"],
  typescript: ["ts", "tsx"],
  cpp: ["c++"],
})

export default function RichEditor({ noteId, content, onSave }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [preferredCodeLanguage, setPreferredCodeLanguage] = useState<string>(DEFAULT_CODE_LANGUAGE)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: DEFAULT_CODE_LANGUAGE,
      }),
      TextStyle,
      FontFamily,
      Underline,
      Placeholder.configure({
        placeholder: "Start writing…",
        emptyEditorClass: "is-editor-empty",
      }),
    ],

    content,
    onUpdate: ({ editor }) => {
      // Debounced auto-save (500ms)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSave(editor.getJSON())
      }, 500)
    },

    editorProps: {
      attributes: {
        class: "focus:outline-none w-full min-h-full max-w-none",
      },
    },
  })

  // When noteId changes, reload content into editor
  useEffect(() => {
    if (editor && content) {
      // Prevent re-setting if content is the same (avoids cursor jump)
      const current = JSON.stringify(editor.getJSON())
      const incoming = JSON.stringify(content)
      if (current !== incoming) {
        editor.commands.setContent(content)
      }
    }
  }, [noteId])

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) =>
      !editor
        ? DEFAULT_TOOLBAR_STATE
        : {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            h1: editor.isActive("heading", { level: 1 }),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            codeBlock: editor.isActive("codeBlock"),
            blockquote: editor.isActive("blockquote"),
            codeLanguage: editor.getAttributes("codeBlock").language as string | undefined,
          },
  })

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (!editor) return null

  const activeCodeLanguage = toolbarState.codeLanguage || preferredCodeLanguage

  return (
    <div className="flex flex-col w-full h-full">

      {/* ═══════════════ TOOLBAR ═══════════════ */}
      <div
        className="flex flex-wrap items-center gap-1 sticky top-0 z-10 flex-shrink-0"
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
          <Btn label="B"  title="Bold"   active={toolbarState.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
            style={{ fontWeight: 700 }}
          />
          <Btn label="I"  title="Italic" active={toolbarState.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            style={{ fontStyle: "italic" }}
          />
          <Btn label="U" title="Underline" active={toolbarState.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            style={{ textDecoration: "underline", textDecorationThickness: "1.5px" }}
          />
        </ToolGroup>

        <Divider />

        {/* ── Heading group ── */}
        <ToolGroup>
          <Btn label="H1" title="Heading 1"
            active={toolbarState.h1}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <Btn label="H2" title="Heading 2"
            active={toolbarState.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <Btn label="H3" title="Heading 3"
            active={toolbarState.h3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
        </ToolGroup>

        <Divider />

        {/* ── List group ── */}
        <ToolGroup>
          <Btn label="•"  title="Bullet List"
            active={toolbarState.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <Btn label="1." title="Numbered List"
            active={toolbarState.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </ToolGroup>

        <Divider />

        {/* ── Block group ── */}
        <ToolGroup>
          <Btn label="<>" title="Code Block"
            active={toolbarState.codeBlock}
            onClick={() => {
              if (toolbarState.codeBlock) {
                editor.chain().focus().toggleCodeBlock().run()
                return
              }
              editor.chain().focus().setCodeBlock({ language: preferredCodeLanguage }).run()
            }}
          />
          <Btn label="❝"  title="Blockquote"
            active={toolbarState.blockquote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </ToolGroup>

        <select
          value={activeCodeLanguage}
          onChange={e => {
            const language = e.target.value
            setPreferredCodeLanguage(language)
            if (editor.isActive("codeBlock")) {
              editor.chain().focus().updateAttributes("codeBlock", { language }).run()
            }
          }}
          title="Code Language"
          style={{
            marginLeft: "8px",
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
          {CODE_LANG_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

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
        className="flex-1 overflow-auto"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--glass-border)",
          borderTop: "none",
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "32px 40px 60px",
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
      type="button"
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
      onMouseDown={e => {
        // Keep editor selection/focus when clicking toolbar controls.
        e.preventDefault()
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
