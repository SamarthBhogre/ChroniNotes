import { useState } from "react"
import RichEditor from "../components/editor/RichEditor"

export default function Notes() {
  const [content, setContent] = useState({
    type: "doc",
    content: [],
  })

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div
      className="h-full flex flex-col"
      style={{ color: "var(--text-primary)" }}
    >
      {/* ── Header ── */}
      <header
        className="flex-shrink-0"
        style={{
          padding: "48px 64px 24px",
          borderBottom: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Page tag */}
        <div
          className="inline-flex items-center gap-2 mb-4"
          style={{
            padding: "3px 10px",
            borderRadius: "20px",
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-border)",
            fontSize: "10.5px",
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.3px",
          }}
        >
          ◉ Notes
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "2.4rem",
            fontWeight: 700,
            letterSpacing: "-0.5px",
            lineHeight: 1.15,
            marginBottom: "8px",
            background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Notes
        </h1>

        {/* Date */}
        <p style={{ fontSize: "13px", color: "var(--text-tertiary)", fontWeight: 500 }}>
          {today}
        </p>
      </header>

      {/* ── Editor container ── */}
      <div className="flex-1 overflow-auto">
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            padding: "40px 64px 80px",
          }}
        >
          <RichEditor content={content} onChange={setContent} />
        </div>
      </div>
    </div>
  )
}