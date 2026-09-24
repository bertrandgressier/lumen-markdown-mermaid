import { createElement, memo, useEffect, useId, useRef, useState } from 'react'

import { extractMermaidTitle } from './index.js'
import type { MermaidTheme } from './types.js'

export const DEFAULT_MERMAID_FALLBACK_MESSAGE = 'Diagramme non affiché — texte conservé'
const DEFAULT_ARIA_LABEL = 'Diagramme Mermaid'

export interface MermaidDiagramProps {
  /**
   * Source mermaid brute portée par le nœud `component`
   * (`properties.source`). Une source vide ou invalide dégrade proprement :
   * jamais de panneau vide, jamais d'exception non bornée.
   */
  source?: string
  /**
   * Libellé accessible (`aria-label`). Default : titre extrait de la source
   * (frontmatter `title:` / directive `accTitle:`), sinon `'Diagramme Mermaid'`.
   */
  title?: string
  /**
   * Thème de rendu : `'light'` | `'dark'` | `'auto'` (suit
   * `prefers-color-scheme`). Default `'light'`. Accepte aussi les strings
   * `'true'`/`'false'` du passage properties → props.
   */
  theme?: MermaidTheme | string
  /**
   * Rendu à la demande via IntersectionObserver. Default `true`. Tolère la
   * forme string (`'false'`) quand la prop arrive des properties du nœud.
   */
  lazy?: boolean | string
  /**
   * Message court affiché en repli. Default `'Diagramme non affiché — texte conservé'`.
   */
  fallbackMessage?: string
  /** Classes additionnelles sur le conteneur racine. */
  className?: string
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
 * Résout `prefers-color-scheme` et s'abonne à ses changements. Retombe sur
 * `false` (light) quand `matchMedia` est indisponible (SSR, environnement de
 * test sans mock).
 */
function usePrefersDark(enabled: boolean): boolean {
  const [dark, setDark] = useState(false)
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
 * Composant de rendu mermaid pour `mermaidExtension()`.
 *
 * - mermaid.js est chargé en **import dynamique uniquement** (jamais
 *   statique) : aucun coût de bundle tant qu'aucun diagramme n'est visible.
 * - `lazy` (défaut `true`) : le rendu ne démarre qu'à l'entrée dans le
 *   viewport (IntersectionObserver, marge de 200 px ; rendu immédiat si
 *   l'API est absente).
 * - Dégradation honnête : source invalide, erreur de rendu ou échec du
 *   chargement → message court + source brute dans un `<pre>`. Aucune
 *   exception ne fuit vers le rendu React.
 * - Accessibilité : conteneur `role="img"` + `aria-label` (titre extrait ou
 *   prop), source techniquement présente en `sr-only` dans tous les états.
 *
 * Mapper via le renderer :
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

  const rawId = useId()
  const mermaidId = `mmd-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  // Rendu à la demande : IntersectionObserver sur le conteneur racine.
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

  // Rendu mermaid : import dynamique unique, erreurs strictement bornées.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setStatus({ state: 'pending' })

    import('mermaid')
      .then(async (module) => {
        if (cancelled) return
        const mermaid = module.default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        })
        const { svg } = await mermaid.render(mermaidId, code)
        if (cancelled) return
        setStatus({ state: 'ok', svg })
      })
      .catch(() => {
        if (cancelled) return
        // mermaid peut laisser un nœud d'erreur orphelin dans le DOM.
        if (typeof document !== 'undefined') {
          document.getElementById(`d${mermaidId}`)?.remove()
          document.getElementById(mermaidId)?.remove()
        }
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
    // Source techniquement présente dans tous les états (sr-only).
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
