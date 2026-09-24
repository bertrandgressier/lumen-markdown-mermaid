import type { MermaidTheme } from './types.js';
export declare const DEFAULT_MERMAID_FALLBACK_MESSAGE = "Diagramme non affich\u00E9 \u2014 texte conserv\u00E9";
export interface MermaidDiagramProps {
    /**
     * Source mermaid brute portée par le nœud `component`
     * (`properties.source`). Une source vide ou invalide dégrade proprement :
     * jamais de panneau vide, jamais d'exception non bornée.
     */
    source?: string;
    /**
     * Libellé accessible (`aria-label`). Default : titre extrait de la source
     * (frontmatter `title:` / directive `accTitle:`), sinon `'Diagramme Mermaid'`.
     */
    title?: string;
    /**
     * Thème de rendu : `'light'` | `'dark'` | `'auto'` (suit
     * `prefers-color-scheme`). Default `'light'`. Accepte aussi les strings
     * `'true'`/`'false'` du passage properties → props.
     */
    theme?: MermaidTheme | string;
    /**
     * Rendu à la demande via IntersectionObserver. Default `true`. Tolère la
     * forme string (`'false'`) quand la prop arrive des properties du nœud.
     */
    lazy?: boolean | string;
    /**
     * Message court affiché en repli. Default `'Diagramme non affiché — texte conservé'`.
     */
    fallbackMessage?: string;
    /** Classes additionnelles sur le conteneur racine. */
    className?: string;
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
export declare const MermaidDiagram: import("react").MemoExoticComponent<({ source, title, theme, lazy, fallbackMessage, className, }: MermaidDiagramProps) => import("react").DetailedReactHTMLElement<{
    className: string;
    ref: import("react").RefObject<HTMLDivElement | null>;
    'data-mermaid-theme': "dark" | "light";
}, HTMLDivElement>>;
export type { MermaidTheme };
//# sourceMappingURL=react.d.ts.map