import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Markdown } from '@tanstack/markdown/react'
import { mermaidExtension } from '../../src/index'
import { MermaidDiagram, type MermaidDiagramProps } from '../../src/react'

import { SAMPLE_MARKDOWN } from './sample'

type ThemeMode = 'light' | 'dark' | 'auto'

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto']

/** Reserves space while a lazy diagram is pending — no layout jump on reveal. */
const DIAGRAM_MIN_HEIGHT = 220

const STREAM_TICK_MS = 120

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function App() {
  // --- Document -----------------------------------------------------------
  const [text, setText] = useState(SAMPLE_MARKDOWN)
  const linesRef = useRef(SAMPLE_MARKDOWN.split('\n'))
  useEffect(() => {
    linesRef.current = text.split('\n')
  }, [text])

  // --- Theme (drives page chrome AND the mermaid extension) ---------------
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  // --- Streaming simulation ------------------------------------------------
  // `visibleLines === null` means the full document is shown.
  const [streaming, setStreaming] = useState(false)
  const [visibleLines, setVisibleLines] = useState<number | null>(null)
  const totalLines = linesRef.current.length

  useEffect(() => {
    if (!streaming) return
    const id = window.setInterval(() => {
      const total = linesRef.current.length
      // Reveal 2–4 lines per tick, like an LLM answering in chunks.
      setVisibleLines((prev) =>
        Math.min(total, (prev ?? 0) + 2 + Math.floor(Math.random() * 3)),
      )
    }, STREAM_TICK_MS)
    return () => window.clearInterval(id)
  }, [streaming])

  useEffect(() => {
    if (!streaming || visibleLines === null) return
    if (visibleLines >= linesRef.current.length) {
      setStreaming(false)
      setVisibleLines(null)
    }
  }, [streaming, visibleLines])

  const previewText =
    visibleLines === null ? text : linesRef.current.slice(0, visibleLines).join('\n')

  const startStream = useCallback(() => {
    setVisibleLines(0)
    setStreaming(true)
  }, [])
  const stopStream = useCallback(() => setStreaming(false), [])
  const resetStream = useCallback(() => {
    setStreaming(false)
    setVisibleLines(null)
    setErrorCount(0)
  }, [])

  // --- Render-error counter (demonstrates the `onError` prop) -------------
  const [errorCount, setErrorCount] = useState(0)
  const handleError = useCallback(() => setErrorCount((count) => count + 1), [])

  const components = useMemo(
    () => ({
      MermaidDiagram: (props: MermaidDiagramProps) => (
        <MermaidDiagram
          {...props}
          minHeight={props.minHeight ?? DIAGRAM_MIN_HEIGHT}
          onError={handleError}
        />
      ),
    }),
    [handleError],
  )

  // --- Status line ---------------------------------------------------------
  let statusText: string | null = null
  if (streaming && visibleLines !== null) {
    statusText = `Streaming · ${visibleLines}/${totalLines} lines`
  } else if (visibleLines !== null) {
    statusText = `Paused · ${visibleLines}/${totalLines} lines`
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>tanstack-markdown-mermaid</h1>
          <p>Mermaid diagrams in @tanstack/markdown — lazy, accessible, streaming-friendly</p>
        </div>
        <div className="theme-switch" role="group" aria-label="Theme">
          {THEME_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={themeMode === mode}
              onClick={() => setThemeMode(mode)}
            >
              {capitalize(mode)}
            </button>
          ))}
        </div>
      </header>

      <main className="panes">
        <section className="pane pane-editor" aria-label="Editor">
          <div className="pane-header">
            <span className="pane-label">Editor</span>
          </div>
          <textarea
            className="editor"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            aria-label="Markdown source"
          />
        </section>

        <section className="pane pane-preview" aria-label="Preview">
          <div className="pane-header">
            <span className="pane-label">Preview</span>
            <span className="pane-status">
              {statusText && <span className="stream-status">{statusText}</span>}
              {errorCount > 0 && (
                <span
                  className="error-badge"
                  title="Mermaid render failures reported through the onError prop"
                >
                  {errorCount} render {errorCount === 1 ? 'error' : 'errors'}
                </span>
              )}
            </span>
            <span className="pane-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={startStream}
                disabled={streaming}
              >
                Stream
              </button>
              <button type="button" className="btn" onClick={stopStream} disabled={!streaming}>
                Stop
              </button>
              <button
                type="button"
                className="btn"
                onClick={resetStream}
                disabled={!streaming && visibleLines === null && errorCount === 0}
              >
                Reset
              </button>
            </span>
          </div>
          <div className="pane-body">
            <article className="markdown-body">
              <Markdown
                extensions={[mermaidExtension({ theme: themeMode })]}
                components={components}
              >
                {previewText}
              </Markdown>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
