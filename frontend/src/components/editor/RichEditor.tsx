import { useEffect, useRef, useState, useCallback } from "react"
import { EditorContent, useEditor, useEditorState, Node, mergeAttributes } from "@tiptap/react"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import FontFamily from "@tiptap/extension-font-family"
import Underline from "@tiptap/extension-underline"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import { Extension, Node as TiptapNode } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { createLowlight } from "lowlight"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import python from "highlight.js/lib/languages/python"
import java from "highlight.js/lib/languages/java"
import c from "highlight.js/lib/languages/c"
import cpp from "highlight.js/lib/languages/cpp"
import css from "highlight.js/lib/languages/css"
import xml from "highlight.js/lib/languages/xml"
import sql from "highlight.js/lib/languages/sql"
import { useNotesStore, type Difficulty } from "../../store/notes.store"

/* ────────────────────────────────────────
   Props
──────────────────────────────────────── */
interface Props {
  noteId:     string
  content:    any
  title:      string
  icon:       string
  tags:       string[]
  difficulty: Difficulty
  saving:     boolean
  onSave:          (json: any) => void
  onTitleChange:   (t: string) => void
  onIconChange:    (i: string) => void
}

/* ── Lowlight setup ── */
const lowlight = createLowlight()
lowlight.register("javascript", javascript); lowlight.register("typescript", typescript)
lowlight.register("python", python);         lowlight.register("java", java)
lowlight.register("c", c);                  lowlight.register("cpp", cpp)
lowlight.register("css", css);              lowlight.register("xml", xml)
lowlight.register("sql", sql)
lowlight.registerAlias({ javascript: ["js","jsx","react"], typescript: ["ts","tsx"], cpp: ["c++"], xml: ["html"] })

const CODE_LANGS = [
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python",     value: "python"     },
  { label: "Java",       value: "java"       },
  { label: "C",          value: "c"          },
  { label: "C++",        value: "cpp"        },
  { label: "CSS",        value: "css"        },
  { label: "HTML",       value: "xml"        },
  { label: "SQL",        value: "sql"        },
] as const

const TAG_PALETTE = ["#818cf8","#60a5fa","#34d399","#fbbf24","#f472b6","#a78bfa","#38bdf8","#fb923c"]
function tagColor(tag: string) {
  let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

const DIFF_CFG: Record<NonNullable<Difficulty>, { label: string; color: string; bg: string; border: string }> = {
  easy:   { label: "Easy",   color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  },
  medium: { label: "Medium", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  hard:   { label: "Hard",   color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
}

/* ════════════════════════════════════════
   TABBED CODE BLOCK
════════════════════════════════════════ */
interface CodeTab { label: string; language: string; code: string }

const TabbedCodeNode = TiptapNode.create({
  name: "tabbedCode", group: "block", atom: true,
  addAttributes() {
    return {
      tabs:      { default: [{ label: "main.ts", language: "typescript", code: "" }] },
      activeTab: { default: 0 },
    }
  },
  parseHTML()  { return [{ tag: "div[data-tabbed-code]" }] },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-tabbed-code": "" })] },
  addNodeView() { return ReactNodeViewRenderer(TabbedCodeView) },
})

function TabbedCodeView({ node, updateAttributes }: { node: any; updateAttributes: (a: any) => void }) {
  const tabs: CodeTab[] = node.attrs.tabs ?? []
  const activeTab: number = node.attrs.activeTab ?? 0
  const active = tabs[activeTab] ?? tabs[0]
  const [editingLabel, setEditingLabel] = useState<number | null>(null)
  const [labelVal, setLabelVal]         = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const setActive   = (i: number) => updateAttributes({ activeTab: i })
  const updateCode  = (code: string) => updateAttributes({ tabs: tabs.map((t, i) => i === activeTab ? { ...t, code } : t) })
  const addTab      = () => { const next = [...tabs, { label: `file${tabs.length + 1}.ts`, language: "typescript", code: "" }]; updateAttributes({ tabs: next, activeTab: next.length - 1 }) }
  const removeTab   = (i: number, e: React.MouseEvent) => { e.stopPropagation(); if (tabs.length <= 1) return; const next = tabs.filter((_, idx) => idx !== i); updateAttributes({ tabs: next, activeTab: Math.min(activeTab, next.length - 1) }) }
  const startRename = (i: number, e: React.MouseEvent) => { e.stopPropagation(); setLabelVal(tabs[i].label); setEditingLabel(i) }
  const commitLabel = () => { if (editingLabel === null) return; updateAttributes({ tabs: tabs.map((t, i) => i === editingLabel ? { ...t, label: labelVal.trim() || t.label } : t) }); setEditingLabel(null) }
  const setLang     = (lang: string) => updateAttributes({ tabs: tabs.map((t, i) => i === activeTab ? { ...t, language: lang } : t) })

  useEffect(() => {
    const el = textareaRef.current; if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(120, el.scrollHeight) + "px"
  }, [active?.code, activeTab])

  return (
    <NodeViewWrapper>
      <div contentEditable={false} style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--code-border)", background: "var(--code-bg)", margin: "16px 0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid var(--code-border)", padding: "0 4px", gap: "1px", overflowX: "auto", minHeight: "36px" }}>
          {tabs.map((tab, i) => (
            <div key={i} onClick={() => setActive(i)} style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "0 10px 0 12px", height: "36px",
              fontSize: "11px", fontWeight: i === activeTab ? 600 : 400,
              color: i === activeTab ? "var(--code-text)" : "var(--code-muted)",
              background: i === activeTab ? "var(--code-bg)" : "transparent",
              borderTop: i === activeTab ? "2px solid var(--accent)" : "2px solid transparent",
              borderRadius: "4px 4px 0 0", cursor: "pointer", flexShrink: 0, transition: "all 0.12s",
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
            }}>
              {editingLabel === i ? (
                <input value={labelVal} onChange={e => setLabelVal(e.target.value)}
                  onBlur={commitLabel} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") commitLabel() }}
                  onClick={e => e.stopPropagation()} autoFocus
                  style={{ width: `${Math.max(40, labelVal.length * 7 + 10)}px`, fontSize: "11px", background: "rgba(255,255,255,0.08)", border: "1px solid var(--accent-border)", borderRadius: "3px", color: "var(--code-text)", outline: "none", padding: "1px 4px", fontFamily: "inherit" }}
                />
              ) : (
                <span onDoubleClick={e => startRename(i, e)} title="Double-click to rename">{tab.label}</span>
              )}
              {tabs.length > 1 && (
                <button onClick={e => removeTab(i, e)}
                  style={{ width: "14px", height: "14px", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "var(--code-muted)", background: "none", border: "none", cursor: "pointer", opacity: i === activeTab ? 1 : 0, transition: "opacity 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--color-red)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--code-muted)"}
                >✕</button>
              )}
            </div>
          ))}
          <button onClick={addTab} title="Add file" style={{ width: "28px", height: "28px", borderRadius: "6px", marginLeft: "2px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "var(--code-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, transition: "color 0.1s, background 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--code-text)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--code-muted)"; e.currentTarget.style.background = "none" }}
          >+</button>
          <select value={active?.language ?? "typescript"} onChange={e => setLang(e.target.value)}
            style={{ marginLeft: "auto", marginRight: "6px", fontSize: "10px", padding: "3px 6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", color: "var(--code-muted)", cursor: "pointer", flexShrink: 0 }}>
            {CODE_LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        {/* Code textarea */}
        <textarea ref={textareaRef} value={active?.code ?? ""} onChange={e => updateCode(e.target.value)}
          spellCheck={false} placeholder={`// ${active?.label ?? ""}…`}
          style={{ width: "100%", display: "block", resize: "none", background: "transparent", border: "none", outline: "none", padding: "16px 20px", color: "var(--code-text)", fontFamily: "'JetBrains Mono','Fira Code',ui-monospace,monospace", fontSize: "13px", lineHeight: 1.65, minHeight: "120px", overflowY: "hidden", boxSizing: "border-box", caretColor: "var(--accent)" }}
        />
      </div>
    </NodeViewWrapper>
  )
}

/* ════════════════════════════════════════
   PAGE LINK NODE
════════════════════════════════════════ */
const PageLinkNode = Node.create({
  name: "pageLink", group: "inline", inline: true, atom: true,
  addAttributes() { return { noteId: { default: null }, noteTitle: { default: "Untitled" }, noteIcon: { default: "◉" } } },
  parseHTML()  { return [{ tag: "span[data-page-link]" }] },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes, { "data-page-link": "" }), 0] },
  addNodeView() { return ReactNodeViewRenderer(PageLinkView) },
})

function PageLinkView({ node }: { node: any }) {
  return (
    <NodeViewWrapper as="span">
      <span className="page-link-chip" contentEditable={false}
        onClick={() => node.attrs.noteId && useNotesStore.getState().setActiveNote(node.attrs.noteId)}
        title={`Open: ${node.attrs.noteTitle}`}>
        <span style={{ fontSize: "12px", marginRight: "4px" }}>{node.attrs.noteIcon}</span>
        {node.attrs.noteTitle}
      </span>
    </NodeViewWrapper>
  )
}

/* ════════════════════════════════════════
   IMAGE DROP + PASTE
════════════════════════════════════════ */
const ImageDropExtension = Extension.create({
  name: "imageDrop",
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey("imageDrop"),
      props: {
        handleDOMEvents: {
          drop(view, event) {
            const images = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith("image/"))
            if (!images.length) return false
            event.preventDefault()
            const coords = { left: event.clientX, top: event.clientY }
            images.forEach(file => {
              const reader = new FileReader()
              reader.onload = () => {
                const src = reader.result as string
                const node = view.state.schema.nodes.image?.create({ src, alt: file.name })
                if (!node) return
                const pos = view.posAtCoords(coords)?.pos ?? view.state.doc.content.size
                view.dispatch(view.state.tr.insert(pos, node))
              }
              reader.readAsDataURL(file)
            })
            return true
          },
          paste(view, event) {
            const images = Array.from(event.clipboardData?.items ?? []).filter(i => i.type.startsWith("image/"))
            if (!images.length) return false
            event.preventDefault()
            images.forEach(item => {
              const file = item.getAsFile(); if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const src = reader.result as string
                const node = view.state.schema.nodes.image?.create({ src, alt: "Pasted image" })
                if (!node) return
                view.dispatch(view.state.tr.replaceSelectionWith(node))
              }
              reader.readAsDataURL(file)
            })
            return true
          },
        },
      },
    })]
  },
})

/* ════════════════════════════════════════
   Slash state
════════════════════════════════════════ */
interface SlashState { visible: boolean; query: string; pos: number; top: number; left: number }
const DEFAULT_SLASH: SlashState = { visible: false, query: "", pos: -1, top: 0, left: 0 }

const DEFAULT_TOOLBAR = {
  bold: false, italic: false, underline: false,
  h1: false, h2: false, h3: false,
  bulletList: false, orderedList: false, codeBlock: false, blockquote: false,
  codeLanguage: undefined as string | undefined,
}

/* ════════════════════════════════════════
   RICH EDITOR — owns the full UI:
   [title-bar] [toolbar] [scroll-area]
════════════════════════════════════════ */
export default function RichEditor({
  noteId, content,
  title, icon, tags, difficulty, saving,
  onSave, onTitleChange, onIconChange,
}: Props) {
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const [prefLang, setPrefLang]       = useState("typescript")
  const [slash, setSlash]             = useState<SlashState>(DEFAULT_SLASH)
  const [slashIdx, setSlashIdx]       = useState(0)
  const [imgDropOver, setImgDropOver] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal]         = useState(title)
  const [editingIcon, setEditingIcon]   = useState(false)
  const [iconVal, setIconVal]           = useState(icon)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef  = useRef<HTMLInputElement>(null)
  const { notes } = useNotesStore()

  /* sync external title/icon → local state when note switches */
  useEffect(() => { setTitleVal(title); setIconVal(icon) }, [noteId, title, icon])
  useEffect(() => { if (editingTitle && titleInputRef.current) { titleInputRef.current.focus(); titleInputRef.current.select() } }, [editingTitle])
  useEffect(() => { if (editingIcon  && iconInputRef.current)  { iconInputRef.current.focus();  iconInputRef.current.select()  } }, [editingIcon])

  const commitTitle = () => {
    const t = titleVal.trim()
    if (t && t !== title) onTitleChange(t)
    else setTitleVal(title)
    setEditingTitle(false)
  }
  const commitIcon = () => {
    const ic = iconVal.trim() || icon
    if (ic !== icon) onIconChange(ic)
    else setIconVal(icon)
    setEditingIcon(false)
  }

  const slashResults = notes.filter(n => !n.isFolder && n.title.toLowerCase().includes(slash.query.toLowerCase())).slice(0, 8)
  const closeSlash   = useCallback(() => setSlash(DEFAULT_SLASH), [])

  const insertPageLink = useCallback((noteEntry: typeof notes[0], editor: any) => {
    if (slash.pos < 0) return
    const from = slash.pos
    const to   = from + 1 + slash.query.length
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, {
      type: "pageLink",
      attrs: { noteId: noteEntry.id, noteTitle: noteEntry.title, noteIcon: noteEntry.icon },
    }).run()
    closeSlash()
  }, [slash, closeSlash])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "typescript" }),
      TextStyle, FontFamily, Underline,
      Image.configure({ inline: false, allowBase64: true }),
      ImageDropExtension, PageLinkNode, TabbedCodeNode,
      Placeholder.configure({ placeholder: "Start writing… type /link to connect pages", emptyEditorClass: "is-editor-empty" }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => onSave(editor.getJSON()), 500)

      /* slash detection */
      const { selection, doc } = editor.state
      const { from } = selection
      const textBefore = doc.textBetween(Math.max(0, from - 30), from, "\n", "\0")
      const m = textBefore.match(/\/link\s?(\S*)$/)
      if (m) {
        const query  = m[1] ?? ""
        const pos    = from - m[0].length
        const domPos = editor.view.coordsAtPos(from)
        const edRect = editorWrapRef.current?.getBoundingClientRect() ?? { top: 0, left: 0 }
        setSlash({ visible: true, query, pos, top: domPos.bottom - edRect.top + 4, left: Math.min(domPos.left - edRect.left, 220) })
        setSlashIdx(0)
      } else {
        closeSlash()
      }
    },
    editorProps: { attributes: { class: "focus:outline-none" } },
  })

  /* Sync content when noteId changes */
  useEffect(() => {
    if (editor && content) {
      const cur = JSON.stringify(editor.getJSON())
      const inc = JSON.stringify(content)
      if (cur !== inc) editor.commands.setContent(content)
    }
  }, [noteId])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  /* Keyboard nav for slash menu */
  useEffect(() => {
    if (!slash.visible) return
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown")  { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, slashResults.length - 1)) }
      if (e.key === "ArrowUp")    { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)) }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (slashResults[slashIdx] && editor) insertPageLink(slashResults[slashIdx], editor) }
      if (e.key === "Escape")     closeSlash()
    }
    window.addEventListener("keydown", h, true)
    return () => window.removeEventListener("keydown", h, true)
  }, [slash.visible, slashIdx, slashResults, editor, insertPageLink, closeSlash])

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => !editor ? DEFAULT_TOOLBAR : {
      bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
      h1: editor.isActive("heading", { level: 1 }), h2: editor.isActive("heading", { level: 2 }), h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"), orderedList: editor.isActive("orderedList"),
      codeBlock: editor.isActive("codeBlock"), blockquote: editor.isActive("blockquote"),
      codeLanguage: editor.getAttributes("codeBlock").language as string | undefined,
    },
  })

  if (!editor) return null
  const activeLang = toolbarState.codeLanguage || prefLang
  const diffCfg    = difficulty ? DIFF_CFG[difficulty] : null

  return (
    /* Full-height flex column — no outer padding, fills whatever container it's in */
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" }}>

      {/* ═══════════════════════════════════════
          TITLE BAR — icon · title · tags · save
      ═══════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 20px 9px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--glass-border)",
      }}>
        {/* Icon button */}
        {editingIcon ? (
          <input ref={iconInputRef} value={iconVal} onChange={e => setIconVal(e.target.value)}
            onBlur={commitIcon}
            onKeyDown={e => { if (e.key === "Enter") commitIcon(); if (e.key === "Escape") { setIconVal(icon); setEditingIcon(false) } }}
            style={{ width: "34px", height: "34px", textAlign: "center", fontSize: "18px", borderRadius: "9px", background: "var(--glass-bg)", border: "1px solid var(--accent-border)", color: "var(--text-primary)", outline: "none", flexShrink: 0 }}
          />
        ) : (
          <button onClick={() => setEditingIcon(true)} title="Change icon" style={{
            width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "border-color 0.12s, background 0.12s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "var(--accent-dim)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--glass-border)";  e.currentTarget.style.background = "var(--glass-bg)"  }}
          >{icon}</button>
        )}

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input ref={titleInputRef} value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") { setTitleVal(title); setEditingTitle(false) } }}
              style={{ width: "100%", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px", background: "transparent", border: "none", borderBottom: "2px solid var(--accent-border)", color: "var(--text-primary)", outline: "none", padding: "0 0 2px" }}
            />
          ) : (
            <h1 onClick={() => setEditingTitle(true)} title="Click to rename" style={{
              margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2,
              cursor: "text", color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              padding: "2px 6px", borderRadius: "6px", transition: "background 0.12s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--glass-bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >{title}</h1>
          )}
        </div>

        {/* Tags */}
        {tags.slice(0, 4).map(t => (
          <span key={t} style={{ padding: "2px 7px", borderRadius: "20px", background: tagColor(t) + "22", border: `1px solid ${tagColor(t)}44`, color: tagColor(t), fontSize: "10px", fontWeight: 600, flexShrink: 0 }}>
            #{t}
          </span>
        ))}

        {/* Difficulty */}
        {diffCfg && (
          <span style={{ padding: "2px 8px", borderRadius: "7px", background: diffCfg.bg, border: `1px solid ${diffCfg.border}`, color: diffCfg.color, fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>
            {diffCfg.label}
          </span>
        )}

        {/* Save status */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: saving ? "var(--color-yellow)" : "var(--text-tertiary)", padding: "2px 7px", borderRadius: "6px", background: saving ? "rgba(251,191,36,0.08)" : "transparent", transition: "all 0.2s", flexShrink: 0 }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: saving ? "var(--color-yellow)" : "var(--color-green)", transition: "background 0.2s", flexShrink: 0 }} />
          {saving ? "Saving…" : "Saved"}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          TOOLBAR
      ═══════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1px",
        padding: "5px 12px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--glass-border)",
      }}>
        <ToolGroup>
          <Btn label="B"  title="Bold"      active={toolbarState.bold}      onClick={() => editor.chain().focus().toggleBold().run()}      style={{ fontWeight: 700 }} />
          <Btn label="I"  title="Italic"    active={toolbarState.italic}    onClick={() => editor.chain().focus().toggleItalic().run()}    style={{ fontStyle: "italic" }} />
          <Btn label="U"  title="Underline" active={toolbarState.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} style={{ textDecoration: "underline" }} />
        </ToolGroup>
        <TDivider />
        <ToolGroup>
          <Btn label="H1" title="Heading 1" active={toolbarState.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
          <Btn label="H2" title="Heading 2" active={toolbarState.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
          <Btn label="H3" title="Heading 3" active={toolbarState.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        </ToolGroup>
        <TDivider />
        <ToolGroup>
          <Btn label="•"  title="Bullet list"   active={toolbarState.bulletList}  onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <Btn label="1." title="Numbered list" active={toolbarState.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        </ToolGroup>
        <TDivider />
        <ToolGroup>
          <Btn label="{ }" title="Code block" active={toolbarState.codeBlock} onClick={() => { if (toolbarState.codeBlock) editor.chain().focus().toggleCodeBlock().run(); else editor.chain().focus().setCodeBlock({ language: prefLang }).run() }} />
          <Btn label="❝"   title="Blockquote" active={toolbarState.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          <Btn label="⊞ Tabs" title="Insert tabbed code block (multi-file)" active={false}
            onClick={() => editor.chain().focus().insertContent({ type: "tabbedCode", attrs: { tabs: [{ label: "main.ts", language: "typescript", code: "" }], activeTab: 0 } }).run()}
            style={{ fontSize: "10px" }}
          />
        </ToolGroup>
        <TDivider />
        <Btn label="⌘ link" title="Insert page link — or type /link" active={false}
          onClick={() => editor.chain().focus().insertContent("/link ").run()}
          style={{ fontSize: "10px" }}
        />
        <select value={activeLang} onChange={e => { setPrefLang(e.target.value); if (editor.isActive("codeBlock")) editor.chain().focus().updateAttributes("codeBlock", { language: e.target.value }).run() }}
          style={{ marginLeft: "4px", height: "26px", padding: "0 6px", borderRadius: "6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "10px", cursor: "pointer" }}>
          {CODE_LANGS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
          style={{ marginLeft: "auto", height: "26px", padding: "0 6px", borderRadius: "6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "10px", cursor: "pointer" }}>
          <option value="">Default font</option>
          <option value="Inter">Inter</option>
          <option value="ui-monospace">Mono</option>
          <option value="serif">Serif</option>
        </select>
      </div>

      {/* ═══════════════════════════════════════
          SCROLL AREA — fills all remaining height
      ═══════════════════════════════════════ */}
      <div ref={editorWrapRef}
        style={{
          flex: 1, minHeight: 0,
          overflowY: "auto", overflowX: "hidden",
          background: "var(--glass-bg)",
          position: "relative",
          outline: imgDropOver ? "2px dashed var(--accent)" : "none",
          outlineOffset: "-2px",
        }}
        onDragOver={e => { e.preventDefault(); setImgDropOver(true) }}
        onDragLeave={() => setImgDropOver(false)}
        onDrop={() => setImgDropOver(false)}
      >
        {/* Image-drop overlay */}
        {imgDropOver && (
          <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", pointerEvents: "none" }}>
            <div style={{ padding: "20px 32px", borderRadius: "14px", background: "var(--accent-dim)", border: "2px dashed var(--accent-border)", color: "var(--accent)", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>🖼</span> Drop image here
            </div>
          </div>
        )}

        {/* ── The tiptap content itself — centered, max-width, fills viewport ── */}
        <div style={{ maxWidth: "780px", margin: "0 auto", padding: "32px 40px 80px" }}>
          <EditorContent editor={editor} className="tiptap" />
        </div>

        {/* Slash menu (positioned relative to scroll area) */}
        {slash.visible && (
          <div style={{ position: "absolute", top: slash.top, left: slash.left + 40, zIndex: 300, background: "var(--modal-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "12px", padding: "6px", minWidth: "230px", maxHeight: "280px", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.5)", animation: "menuSlideIn 0.15s ease" }}>
            <div style={{ padding: "4px 8px 6px", fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid var(--glass-border)", marginBottom: "4px" }}>
              🔗 Link to page {slash.query && <span style={{ color: "var(--accent)" }}>"{slash.query}"</span>}
            </div>
            {slashResults.length === 0
              ? <div style={{ padding: "10px 8px", fontSize: "11px", color: "var(--text-tertiary)", textAlign: "center" }}>No pages found</div>
              : slashResults.map((note, i) => (
                <button key={note.id} onMouseDown={e => { e.preventDefault(); insertPageLink(note, editor) }} onMouseEnter={() => setSlashIdx(i)}
                  style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: "8px", background: i === slashIdx ? "var(--accent-dim)" : "transparent", border: "none", color: i === slashIdx ? "var(--accent)" : "var(--text-secondary)", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "background 0.1s" }}>
                  <span style={{ fontSize: "14px", flexShrink: 0 }}>{note.icon}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</span>
                </button>
              ))}
            <div style={{ padding: "4px 8px 2px", fontSize: "9px", color: "var(--text-tertiary)", borderTop: "1px solid var(--glass-border)", marginTop: "4px" }}>↑↓ navigate · Enter insert · Esc cancel</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   TOOLBAR HELPERS
═══════════════════════════════════════ */
function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: "1px" }}>{children}</div>
}
function TDivider() {
  return <div style={{ width: "1px", height: "16px", background: "var(--glass-border-strong)", margin: "0 3px", flexShrink: 0 }} />
}
function Btn({ label, title, active, onClick, style }: { label: string; title: string; active: boolean; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button type="button" title={title} onClick={onClick} onMouseDown={e => e.preventDefault()}
      style={{ height: "26px", padding: "0 8px", borderRadius: "5px", fontSize: "11.5px", fontWeight: active ? 600 : 500, color: active ? "var(--accent)" : "var(--text-secondary)", background: active ? "var(--accent-dim)" : "transparent", border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`, cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", ...style }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)" } }}
    >{label}</button>
  )
}
