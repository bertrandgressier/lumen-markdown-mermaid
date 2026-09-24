/**
 * Thème appliqué au rendu mermaid.
 *
 * - `'light'` : thème mermaid `default`.
 * - `'dark'` : thème mermaid `dark`.
 * - `'auto'` : suit `prefers-color-scheme` (re-rendu au changement de scheme),
 *   retombe sur `light` quand l'API est indisponible (SSR, vieux navigateurs).
 */
export type MermaidTheme = 'light' | 'dark' | 'auto'

/**
 * Options de l'extension mermaid. Chaque option est propagée dans les
 * `properties` du nœud `component` produit, de sorte que le composant React
 * mappé (`components: { MermaidDiagram }`) les reçoit comme valeurs par
 * défaut — restent surchargeables en usage direct JSX.
 */
export interface MermaidOptions {
  /**
   * Nom du tag du nœud `component`, à mapper via l'option `components` du
   * renderer. Default `'MermaidDiagram'`.
   */
  tagName?: string
  /**
   * Thème de rendu. Default `'light'`.
   */
  theme?: MermaidTheme
  /**
   * Rendu à la demande via IntersectionObserver. Default `true`.
   */
  lazy?: boolean
  /**
   * Message court affiché en repli quand le diagramme ne peut pas être rendu.
   * Default `'Diagramme non affiché — texte conservé'`.
   */
  fallbackMessage?: string
}
