import type { BlockNode, ComponentNode, MarkdownExtension } from '@tanstack/markdown'
import type { MermaidOptions } from './types.js'

const MERMAID_COMPONENT_NAME = 'mermaid'
const DEFAULT_MERMAID_TAG_NAME = 'MermaidDiagram'

/**
 * Extrait le titre accessible d'une source mermaid, dans l'ordre :
 * 1. frontmatter `---\ntitle: X\n---`,
 * 2. directive `accTitle: X`.
 *
 * Retourne `undefined` quand aucun titre n'est présent — l'appelant fournit
 * alors son propre libellé aria.
 */
export function extractMermaidTitle(source: string): string | undefined {
  const normalized = source.replace(/\r\n/g, '\n')
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---/)
  const scopes = frontmatter ? [frontmatter[1], normalized] : [normalized]
  for (const scope of scopes) {
    const match = scope.match(/^[ \t]*(?:title|accTitle)[ \t]*:[ \t]*(.+?)[ \t]*$/m)
    if (match) {
      const value = match[1].trim().replace(/^["']+|["']+$/g, '')
      if (value) return value
    }
  }
  return undefined
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Ouvre une fence : jusqu'à 3 espaces, 3+ backticks ou tildes, info string. */
const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/

/**
 * Retire au plus `max` espaces en tête (dédent des blocs imbriqués dans des
 * listes), comme le parseur de fences natif.
 */
function stripUpTo(line: string, max: number): string {
  let n = 0
  while (n < max && line[n] === ' ') n++
  return line.slice(n)
}

function isMermaidInfo(info: string): boolean {
  const token = info.trim().toLowerCase()
  return token === 'mermaid' || token.startsWith('mermaid ')
}

function isMermaidComponentNode(node: BlockNode): node is ComponentNode {
  return node.type === 'component' && node.name === MERMAID_COMPONENT_NAME
}

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
export function mermaidExtension(opts?: MermaidOptions): MarkdownExtension {
  const tagName = opts?.tagName ?? DEFAULT_MERMAID_TAG_NAME

  const emit = (source: string): BlockNode => {
    const properties: Record<string, string> = { source }
    if (opts?.theme !== undefined) properties.theme = opts.theme
    if (opts?.lazy !== undefined) properties.lazy = String(opts.lazy)
    if (opts?.fallbackMessage !== undefined) {
      properties.fallbackMessage = opts.fallbackMessage
    }
    return {
      type: 'component',
      name: MERMAID_COMPONENT_NAME,
      attributes: {},
      tagName,
      properties,
      children: [],
    }
  }

  return {
    name: 'mermaid',
    parseBlock(context) {
      const line = context.lines[context.index] ?? ''
      const open = line.match(FENCE_OPEN_RE)
      if (!open || !isMermaidInfo(open[3])) return undefined

      const indent = open[1].length
      const fence = open[2]
      const fenceChar = fence[0]
      // CommonMark : la fence fermante utilise le même caractère, longueur >=
      // l'ouvrante, jusqu'à 3 espaces d'indentation, rien d'autre sur la ligne.
      const closeRe = new RegExp(`^ {0,3}${fenceChar}{${fence.length},}[ \t]*$`)

      let i = context.index + 1
      const content: string[] = []
      while (i < context.lines.length) {
        const l = context.lines[i] ?? ''
        if (closeRe.test(l)) {
          i++
          break
        }
        content.push(stripUpTo(l, indent))
        i++
      }
      // Fence non clôturée : consommée jusqu'à la fin (streaming).
      context.consume(i - context.index)
      return emit(content.join('\n'))
    },
    renderHtml(node) {
      if (!isMermaidComponentNode(node)) return undefined
      const source = node.properties?.source ?? ''
      return `<pre class="mermaid-source"><code>${escapeHtml(source)}</code></pre>`
    },
  }
}

export type { MermaidOptions, MermaidTheme }
