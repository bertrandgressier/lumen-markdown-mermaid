import type { MarkdownExtension } from '@tanstack/markdown';
import type { MermaidOptions, MermaidTheme } from './types.js';
/**
 * Extrait le titre accessible d'une source mermaid, dans l'ordre :
 * 1. frontmatter `---\ntitle: X\n---`,
 * 2. directive `accTitle: X`.
 *
 * Retourne `undefined` quand aucun titre n'est présent — l'appelant fournit
 * alors son propre libellé aria.
 */
export declare function extractMermaidTitle(source: string): string | undefined;
/**
 * Extension markdown mermaid pour `@tanstack/markdown`.
 *
 * Capture les blocs clôturés ` ```mermaid ` et ` ~~~mermaid ` (fence de 3+
 * caractères, jusqu'à 3 espaces d'indentation, imbriquables dans des listes)
 * et émet un nœud `component` portant la source brute dans `properties.source`.
 *
 * Le renderer React mappe le tag (`MermaidDiagram` par défaut) vers le
 * composant de rendu via `components: { MermaidDiagram }` — voir le sous-path
 * `lumen-markdown-mermaid/react`. Le hook `renderHtml` du renderer HTML
 * string, qui ne peut pas exécuter mermaid, émet honnêtement la source dans
 * un `<pre class="mermaid-source">`.
 *
 * Une fence non clôturée est consommée jusqu'à la fin du document
 * (compatibilité streaming) : le contenu partiel devient une source mermaid
 * et le composant dégradera proprement tant qu'elle est invalide.
 */
export declare function mermaidExtension(opts?: MermaidOptions): MarkdownExtension;
export type { MermaidOptions, MermaidTheme };
//# sourceMappingURL=index.d.ts.map