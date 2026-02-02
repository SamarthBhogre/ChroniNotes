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
        bulletList: {
          keepMarks: true,
        },
        orderedList: {
          keepMarks: true,
        },
        codeBlock: false, // disable default code block
      }),

      CodeBlockLowlight.configure({
        lowlight,
      }),

      TextStyle,
      FontFamily,

      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],

    content,

    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },

    editorProps: {
      attributes: {
        class:
          "focus:outline-none w-full min-h-full px-4 py-4 text-zinc-100",
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex flex-col w-full h-full rounded-lg border border-zinc-700 bg-zinc-800">
      {/* ================= TOOLBAR ================= */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-700 p-2 bg-zinc-900">
        <Btn
          label="B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />

        <Btn
          label="I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />

        <Btn
          label="H1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />

        <Btn
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />

        <Btn
          label="• List"
          active={editor.isActive("bulletList")}
          onClick={() =>
            editor.chain().focus().toggleBulletList().run()
          }
        />

        <Btn
          label="1. List"
          active={editor.isActive("orderedList")}
          onClick={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
        />

        <Btn
          label="Code"
          active={editor.isActive("codeBlock")}
          onClick={() =>
            editor.chain().focus().toggleCodeBlock().run()
          }
        />

        {/* Font selector */}
        <select
          onChange={(e) =>
            editor
              .chain()
              .focus()
              .setFontFamily(e.target.value)
              .run()
          }
          className="ml-2 bg-zinc-700 rounded px-2 py-1 text-sm text-white"
        >
          <option value="">Default</option>
          <option value="Inter">Inter</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
          <option value="serif">Serif</option>
        </select>
      </div>

      {/* ================= EDITOR ================= */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="tiptap w-full h-full"
        />
      </div>
    </div>
  )
}

/* ================= BUTTON ================= */

function Btn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-zinc-700 hover:bg-zinc-600"
      }`}
    >
      {label}
    </button>
  )
}
