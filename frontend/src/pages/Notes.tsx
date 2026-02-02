import { useState } from "react"
import RichEditor from "../components/editor/RichEditor"

export default function Notes() {
  const [content, setContent] = useState({
    type: "doc",
    content: [],
  })

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Notes</h1>
      <RichEditor content={content} onChange={setContent} />
    </div>
  )
}
