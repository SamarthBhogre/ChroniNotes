import { useEffect, useState } from "react"
import { useTimerStore } from "../store/timer.store"

function format(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`
}

export default function Timer() {
  const {
  tool,
  setTool,
  seconds,
  isRunning,
  workMinutes,
  breakMinutes,
  start,
  stop,
  loadSettings,
  updateSettings,
  updateFromMain,
} = useTimerStore()


  const [workInput, setWorkInput] = useState(workMinutes)
  const [breakInput, setBreakInput] = useState(breakMinutes)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    setWorkInput(workMinutes)
    setBreakInput(breakMinutes)
  }, [workMinutes, breakMinutes])

  useEffect(() => {
    window.electron.on("timer:update", updateFromMain)
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Timer</h1>

      <div className="bg-zinc-800 p-6 rounded-lg text-center space-y-4">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setTool("pomodoro")}
            className={tool === "pomodoro" ? "font-bold" : ""}
          >
            Pomodoro
          </button>
          <button
            onClick={() => setTool("stopwatch")}
            className={tool === "stopwatch" ? "font-bold" : ""}
          >
            Stopwatch
          </button>
        </div>

        <div className="text-5xl font-mono">
          {format(seconds)}
        </div>

        <div className="flex justify-center gap-4">
          {!isRunning ? (
            <button onClick={start} className="bg-green-600 px-4 py-2 rounded">
              Start
            </button>
          ) : (
            <button onClick={stop} className="bg-red-600 px-4 py-2 rounded">
              Stop
            </button>
          )}
        </div>

        {tool === "pomodoro" && (
          <div className="space-y-3 border-t border-zinc-700 pt-4">
            <div className="flex justify-center gap-4">
              <input
                type="number"
                value={workInput}
                disabled={isRunning}
                onChange={(e) => setWorkInput(+e.target.value)}
                className="w-20 bg-zinc-700 rounded text-center"
              />
              <input
                type="number"
                value={breakInput}
                disabled={isRunning}
                onChange={(e) => setBreakInput(+e.target.value)}
                className="w-20 bg-zinc-700 rounded text-center"
              />
            </div>

            <button
              disabled={isRunning}
              onClick={() =>
                updateSettings(workInput, breakInput)
              }
              className="bg-indigo-600 px-4 py-2 rounded disabled:opacity-50"
            >
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
