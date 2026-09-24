import type { MermaidTheme } from './types.js';
export declare const DEFAULT_MERMAID_FALLBACK_MESSAGE = "Diagram not displayed \u2014 source preserved";
export interface MermaidDiagramProps {
    /**
     * Raw mermaid source carried by the `component` node
     * (`properties.source`). An empty or invalid source degrades gracefully:
     * never an empty panel, never an unbounded exception.
     */
    source?: string;
    /**
     * Accessible label (`aria-label`). Default: title extracted from the source
     * (frontmatter `title:` / `accTitle:` directive), otherwise `'Mermaid diagram'`.
     */
    title?: string;
    /**
     * Render theme: `'light'` | `'dark'` | `'auto'` (follows
     * `prefers-color-scheme`). Default `'light'`. Also accepts the string
     * forms `'true'`/`'false'` coming from the properties → props pass-through.
     */
    theme?: MermaidTheme | string;
    /**
     * On-demand rendering via IntersectionObserver. Default `true`. Tolerates
     * the string form (`'false'`) when the prop arrives from the node properties.
     */
    lazy?: boolean | string;
    /**
     * Short message displayed as fallback. Default `'Diagram not displayed — source preserved'`.
     */
    fallbackMessage?: string;
    /** Additional classes on the root container. */
    className?: string;
    /**
     * Optional callback invoked whenever a render fails (invalid source,
     * mermaid error, or dynamic import failure) — including renders
     * superseded by a newer source during streaming. When omitted, failures
     * are reported via `console.error('mermaid render failed', error)`.
     * Degradation behavior is identical either way.
     */
    onError?: (error: unknown) => void;
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
export declare const MermaidDiagram: import("react").MemoExoticComponent<({ source, title, theme, lazy, fallbackMessage, className, onError, }: MermaidDiagramProps) => import("react").DetailedReactHTMLElement<{
    className: string;
    ref: import("react").RefObject<HTMLDivElement | null>;
    'data-mermaid-theme': "dark" | "light";
}, HTMLDivElement>>;
export type { MermaidTheme };
//# sourceMappingURL=react.d.ts.map