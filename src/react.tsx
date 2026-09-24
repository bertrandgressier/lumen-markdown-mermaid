import { createElement, memo, useEffect, useId, useRef, useState } from 'react'

import { extractMermaidTitle } from './index.js'
import { ensureMermaidInitialized } from './mermaid-init.js'
import type { MermaidTheme } from './types.js'

export const DEFAULT_MERMAID_FALLBACK_MESSAGE = 'Diagram not displayed — source preserved'
const DEFAULT_ARIA_LABEL = 'Mermaid diagram'

export interface MermaidDiagramProps {
  /**
   * Raw mermaid source carried by the `component` node
   * (`properties.source`). An empty or invalid source degrades gracefully:
   * never an empty panel, never an unbounded exception.
   */
  source?: string
  /**
   * Accessible label (`aria-label`). Default: title extracted from the source
   * (frontmatter `title:` / `accTitle:` directive), otherwise `'Mermaid diagram'`.
   */
  title?: string
  /**
   * Render theme: `'light'` | `'dark'` | `'auto'` (follows
   * `prefers-color-scheme`). Default `'light'`. Also accepts the string
   * forms `'true'`/`'false'` coming from the properties → props pass-through.
   */
  theme?: MermaidTheme | string
  /**
   * On-demand rendering via IntersectionObserver. Default `true`. Tolerates
   * the string form (`'false'`) when the prop arrives from the node properties.
   */
  lazy?: boolean | string
  /**
   * Short message displayed as fallback. Default `'Diagram not displayed — source preserved'`.
   */
  fallbackMessage?: string
  /** Additional classes on the root container. */
  className?: string
  /**
   * Optional callback invoked whenever a render fails (invalid source,
   * mermaid error, or dynamic import failure) — including renders
   * superseded by a newer source during streaming. When omitted, failures
   * are reported via `console.error('mermaid render failed', error)`.
   * Degradation behavior is identical either way.
   */
  onError?: (error: unknown) => void
}

type Status =
  | { state: 'pending' }
  | { state: 'ok'; svg: string }
  | { state: 'error' }

function coerceTheme(theme: MermaidTheme | string | undefined): 'light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'light'
}

function coerceLazy(lazy: boolean | string | undefined): boolean {
  if (lazy === undefined) return true
  return lazy !== false && lazy !== 'false'
}

/**
 * Resolves `prefers-color-scheme` and subscribes to its changes. Falls back
 * to `false` (light) when `matchMedia` is unavailable (SSR, test
 * environment without a mock).
 */
function usePrefersDark(enabled: boolean): boolean {
  // Lazy initializer: read the current scheme on the very first render so
  // `theme: 'auto'` never renders light-first on dark systems. SSR-safe:
  // returns false on the server; the initial JSX does not depend on the
  // theme (mermaid renders happen in effects only), so there is no
  // hydration mismatch.
  const [dark, setDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    setDark(mql.matches)
    if (typeof mql.addEventListener !== 'function') return
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [enabled])
  return dark
}

/**
 * Mermaid rendering component for `mermaidExtension()`.
 *
 * - mermaid.js is loaded via **dynamic import only** (never static): zero
 *   bundle cost as long as no diagram is visible.
 * - `lazy` (default `true`): rendering starts only when the diagram enters
 *   the viewport (IntersectionObserver, 200 px margin; immediate render
 *   when the API is missing).
 * - Honest degradation: invalid source, render error or load failure →
 *   short message + raw source in a `<pre>`. No exception ever leaks into
 *   the React render.
 * - Accessibility: `role="img"` container + `aria-label` (extracted title
 *   or prop), source technically present as `sr-only` in every state.
 *
 * Map via the renderer:
 *
 * ```tsx
 * import { Markdown } from '@tanstack/markdown/react'
 * import { mermaidExtension } from 'lumen-markdown-mermaid'
 * import { MermaidDiagram } from 'lumen-markdown-mermaid/react'
 *
 * <Markdown
 *   extensions={[mermaidExtension()]}
 *   components={{ MermaidDiagram }}
 * >
 *   {'```mermaid\ngraph TD; A-->B\n```'}
 * </Markdown>
 * ```
 */
export const MermaidDiagram = memo(function MermaidDiagram({
  source,
  title,
  theme,
  lazy,
  fallbackMessage = DEFAULT_MERMAID_FALLBACK_MESSAGE,
  className,
  onError,
}: MermaidDiagramProps) {
  const code = source ?? ''
  const wantsLazy = coerceLazy(lazy)
  const isAuto = theme === 'auto'
  const prefersDark = usePrefersDark(isAuto)
  const resolvedTheme: 'light' | 'dark' = isAuto
    ? prefersDark
      ? 'dark'
      : 'light'
    : coerceTheme(theme)

  const [status, setStatus] = useState<Status>({ state: 'pending' })
  const [visible, setVisible] = useState(!wantsLazy)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Always call the latest onError without adding it to the render-effect
  // deps (an inline callback must not trigger a mermaid re-render).
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  const rawId = useId()
  const mermaidId = `mmd-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  // On-demand rendering: IntersectionObserver on the root container.
  useEffect(() => {
    if (!wantsLazy || visible) return
    const element = containerRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setVisible(true)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [wantsLazy, visible])

  // Mermaid rendering: single dynamic import, strictly bounded errors.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    // Stale-while-revalidate: keep displaying the last good SVG while
    // re-rendering (e.g. after a source/theme change); only fall back to
    // the pending placeholder when no SVG has been rendered yet — no blank
    // flash during updates.
    setStatus((previous) => (previous.state === 'ok' ? previous : { state: 'pending' }))

    import('mermaid')
      .then(async (module) => {
        if (cancelled) return
        const mermaid = module.default
        // Memoized per theme: no repeated global config resets (see
        // mermaid-init.ts).
        ensureMermaidInitialized(mermaid, resolvedTheme)
        const { svg } = await mermaid.render(mermaidId, code)
        if (cancelled) return
        setStatus({ state: 'ok', svg })
      })
      .catch((error: unknown) => {
        // mermaid may leave an orphan error node in the DOM. The node id is
        // tied to this specific render attempt, so clean it up even when
        // the render has been superseded (cancelled).
        if (typeof document !== 'undefined') {
          document.getElementById(`d${mermaidId}`)?.remove()
          document.getElementById(mermaidId)?.remove()
        }
        if (onErrorRef.current) {
          onErrorRef.current(error)
        } else {
          console.error('mermaid render failed', error)
        }
        if (cancelled) return
        setStatus({ state: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [visible, code, resolvedTheme, mermaidId])

  const ariaLabel = title ?? extractMermaidTitle(code) ?? DEFAULT_ARIA_LABEL
  const rootClass = ['mermaid-diagram', className].filter(Boolean).join(' ')

  return createElement(
    'div',
    { className: rootClass, ref: containerRef, 'data-mermaid-theme': resolvedTheme },
    // Source technically present in every state (sr-only).
    createElement('span', { className: 'mermaid-sr-only' }, createElement('code', null, code)),
    status.state === 'ok'
      ? createElement('div', {
          className: 'mermaid-svg',
          role: 'img',
          'aria-label': ariaLabel,
          dangerouslySetInnerHTML: { __html: status.svg },
        })
      : status.state === 'error'
        ? [
            createElement(
              'p',
              { key: 'message', className: 'mermaid-fallback-message' },
              fallbackMessage,
            ),
            createElement('pre', { key: 'source', className: 'mermaid-fallback-source' }, code),
          ]
        : null,
  )
})

export type { MermaidTheme }
