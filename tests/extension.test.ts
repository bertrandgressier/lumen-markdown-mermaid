import { describe, expect, it } from 'vitest'
import { parseMarkdown, renderHtml } from '@tanstack/markdown'
import { extractMermaidTitle, mermaidExtension } from '../src/index.js'
import type { ComponentNode } from '@tanstack/markdown'

function findMermaidNodes(doc: unknown): ComponentNode[] {
  const nodes: ComponentNode[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const node = n as { type?: unknown; name?: unknown }
    if (node.type === 'component' && node.name === 'mermaid') {
      nodes.push(n as ComponentNode)
    }
    for (const key of Object.keys(n as Record<string, unknown>)) {
      const value = (n as Record<string, unknown>)[key]
      if (Array.isArray(value)) value.forEach(walk)
    }
  }
  walk(doc)
  return nodes
}

function findCodeNodes(doc: unknown): string[] {
  const values: string[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const node = n as { type?: unknown; value?: unknown }
    if (node.type === 'code' && typeof node.value === 'string') {
      values.push(node.value)
    }
    for (const key of Object.keys(n as Record<string, unknown>)) {
      const value = (n as Record<string, unknown>)[key]
      if (Array.isArray(value)) value.forEach(walk)
    }
  }
  walk(doc)
  return values
}

const SIMPLE = 'graph TD; A-->B'

describe('mermaidExtension — parsing', () => {
  it('capture un bloc ```mermaid en nœud component avec la source brute', () => {
    const doc = parseMarkdown(`Avant.\n\n\`\`\`mermaid\n${SIMPLE}\n\`\`\`\n\nAprès.`, {
      extensions: [mermaidExtension()],
    })
    const nodes = findMermaidNodes(doc)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].tagName).toBe('MermaidDiagram')
    expect(nodes[0].properties?.source).toBe(SIMPLE)
    expect(nodes[0].children).toEqual([])
  })

  it('capture un bloc ~~~mermaid', () => {
    const doc = parseMarkdown(`~~~mermaid\n${SIMPLE}\n~~~`, {
      extensions: [mermaidExtension()],
    })
    expect(findMermaidNodes(doc)).toHaveLength(1)
    expect(findMermaidNodes(doc)[0].properties?.source).toBe(SIMPLE)
  })

  it('accepte les fences longues (4+ caractères) et le retour chariot', () => {
    const doc = parseMarkdown(`\`\`\`\`mermaid\r\n${SIMPLE}\r\n\`\`\`\``, {
      extensions: [mermaidExtension()],
    })
    expect(findMermaidNodes(doc)).toHaveLength(1)
    expect(findMermaidNodes(doc)[0].properties?.source).toBe(SIMPLE)
  })

  it('gère plusieurs blocs mermaid dans un même document', () => {
    const md = [
      '```mermaid',
      'graph TD; A-->B',
      '```',
      'texte',
      '~~~mermaid',
      'pie',
      '  "x" : 1',
      '~~~',
      '```mermaid',
      'sequenceDiagram',
      '  A->>B: hi',
      '```',
    ].join('\n')
    const doc = parseMarkdown(md, { extensions: [mermaidExtension()] })
    const nodes = findMermaidNodes(doc)
    expect(nodes).toHaveLength(3)
    expect(nodes[1].properties?.source).toBe('pie\n  "x" : 1')
    expect(nodes[2].properties?.source).toBe('sequenceDiagram\n  A->>B: hi')
  })

  it('capture un bloc mermaid indenté dans un item de liste', () => {
    const md = ['- item\n  ```mermaid\n  graph TD\n    A-->B\n  ```\n- suite'].join('\n')
    const doc = parseMarkdown(md, { extensions: [mermaidExtension()] })
    const nodes = findMermaidNodes(doc)
    expect(nodes).toHaveLength(1)
    // le contenu est désindenté du retrait de la fence
    expect(nodes[0].properties?.source).toBe('graph TD\n  A-->B')
  })

  it('laisse les fences non-mermaid au parseur de code natif', () => {
    const md = '```js\nconst x = 1\n```\n\n```mermaidinfo\nnot mermaid\n```'
    const doc = parseMarkdown(md, { extensions: [mermaidExtension()] })
    expect(findMermaidNodes(doc)).toHaveLength(0)
    expect(findCodeNodes(doc)[0]).toContain('const x = 1')
  })

  it('ignore une info string qui contient mermaid sans être mermaid', () => {
    const doc = parseMarkdown('```mermaidish\nfoo\n```', {
      extensions: [mermaidExtension()],
    })
    expect(findMermaidNodes(doc)).toHaveLength(0)
  })

  it('consomme une fence non clôturée jusqu’à la fin (streaming)', () => {
    const doc = parseMarkdown(`paragraphe\n\n\`\`\`mermaid\n${SIMPLE}`, {
      extensions: [mermaidExtension()],
    })
    const nodes = findMermaidNodes(doc)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].properties?.source).toBe(SIMPLE)
  })

  it('propage tagName, theme, lazy et fallbackMessage dans les properties', () => {
    const doc = parseMarkdown('```mermaid\nfoo\n```', {
      extensions: [
        mermaidExtension({
          tagName: 'MyDiagram',
          theme: 'dark',
          lazy: false,
          fallbackMessage: 'Pas de schéma',
        }),
      ],
    })
    expect(findMermaidNodes(doc)[0]).toMatchObject({
      tagName: 'MyDiagram',
      properties: { source: 'foo', theme: 'dark', lazy: 'false', fallbackMessage: 'Pas de schéma' },
    })
  })
})

describe('mermaidExtension — renderHtml (dégradation string)', () => {
  it('émet la source échappée dans un pre.mermaid-source pour le renderer HTML', () => {
    const html = renderHtml('```mermaid\ngraph TD; A-->B\n```', {
      extensions: [mermaidExtension()],
    })
    expect(html).toContain('<pre class="mermaid-source">')
    expect(html).toContain('graph TD; A--&gt;B')
    expect(html).not.toContain('<svg')
  })
})

describe('extractMermaidTitle', () => {
  it('extrait le title du frontmatter', () => {
    expect(extractMermaidTitle('---\ntitle: Cycle de Krebs\n---\ngraph TD; A-->B')).toBe(
      'Cycle de Krebs',
    )
  })

  it('extrait la directive accTitle', () => {
    expect(extractMermaidTitle('flowchart TD\naccTitle: Voie glycolytique\nA-->B')).toBe(
      'Voie glycolytique',
    )
  })

  it("retire les guillemets entourant la valeur et ignore les titres vides", () => {
    expect(extractMermaidTitle('---\ntitle: "Réflexe pupillaire"\n---\ngraph TD')).toBe(
      'Réflexe pupillaire',
    )
    expect(extractMermaidTitle('---\ntitle:\n---\ngraph TD')).toBeUndefined()
  })

  it('retourne undefined sans titre', () => {
    expect(extractMermaidTitle('graph TD; A-->B')).toBeUndefined()
  })
})
