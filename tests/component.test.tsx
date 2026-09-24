// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const mermaidInitialize = vi.fn()
const mermaidRender = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender,
  },
}))

import { MermaidDiagram } from '../src/react.js'

const SVG = '<svg viewBox="0 0 100 100"><circle r="40"/></svg>'
const SIMPLE = 'graph TD; A-->B'

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  static reset() {
    MockIntersectionObserver.instances = []
  }
  private callback: IntersectionObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }
  simulateIntersecting() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  MockIntersectionObserver.reset()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

function diagram(props: Record<string, unknown> = {}) {
  return render(createElement(MermaidDiagram, { source: SIMPLE, lazy: false, ...props }))
}

describe('MermaidDiagram — rendu nominal', () => {
  it('rend le SVG via mermaid (import dynamique) avec role="img"', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    const svgBox = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('.mermaid-svg')
      expect(el).not.toBeNull()
      return el
    })
    expect(svgBox.getAttribute('role')).toBe('img')
    expect(svgBox.innerHTML).toContain('<svg')
    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: 'strict', theme: 'default' }),
    )
    expect(mermaidRender).toHaveBeenCalledWith(expect.any(String), SIMPLE)
    expect(container.querySelector('.mermaid-fallback-message')).toBeNull()
  })

  it('garde la source techniquement présente (sr-only) en état succès', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(container.querySelector('.mermaid-sr-only code')?.textContent).toBe(SIMPLE)
  })
})

describe('MermaidDiagram — dégradation honnête', () => {
  it('affiche message court + source brute dans un pre quand mermaid throw', async () => {
    mermaidRender.mockRejectedValue(new Error('Parse error'))
    const { container } = diagram()
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-message')).not.toBeNull()
    })
    expect(container.querySelector('.mermaid-fallback-message')?.textContent).toBe(
      'Diagramme non affiché — texte conservé',
    )
    expect(container.querySelector('.mermaid-fallback-source')?.textContent).toBe(SIMPLE)
    expect(container.querySelector('.mermaid-svg')).toBeNull()
  })

  it('nétoie le nœud d’erreur orphelin laissé par mermaid dans le DOM', async () => {
    mermaidRender.mockImplementation((_id: string) => {
      const orphan = document.createElement('div')
      orphan.id = `d${_id}`
      document.body.appendChild(orphan)
      return Promise.reject(new Error('boom'))
    })
    const { container } = diagram()
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-message')).not.toBeNull()
    })
    expect(document.querySelector('[id^="dmmd-"]')).toBeNull()
  })

  it('dégrade aussi quand l’import dynamique de mermaid échoue', async () => {
    mermaidRender.mockRejectedValue(new Error('network'))
    const { container } = diagram({ source: 'flowchart TD; A-->B' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-source')?.textContent).toBe(
        'flowchart TD; A-->B',
      )
    })
  })

  it('libellé de repli paramétrable via prop', async () => {
    mermaidRender.mockRejectedValue(new Error('x'))
    const { container } = diagram({ fallbackMessage: 'Schéma indisponible' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-message')?.textContent).toBe(
        'Schéma indisponible',
      )
    })
  })
})

describe('MermaidDiagram — accessibilité', () => {
  it('aria-label par défaut : Diagramme Mermaid', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Diagramme Mermaid',
      )
    })
  })

  it('aria-label depuis le titre du diagramme (frontmatter title)', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ source: '---\ntitle: Cycle de Krebs\n---\ngraph TD; A-->B' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Cycle de Krebs',
      )
    })
  })

  it('aria-label explicite via la prop title, prioritaire', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({
      source: '---\ntitle: Ignoré\n---\ngraph TD',
      title: 'Voie métabolique',
    })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Voie métabolique',
      )
    })
  })
})

describe('MermaidDiagram — rendu à la demande (lazy)', () => {
  it('ne rend rien hors viewport quand lazy, rend à l’intersection', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: true })
    // Hors viewport : observer en place, aucun rendu.
    expect(MockIntersectionObserver.instances).toHaveLength(1)
    expect(mermaidRender).not.toHaveBeenCalled()
    expect(container.querySelector('.mermaid-svg')).toBeNull()
    // La source sr-only reste présente même en attente.
    expect(container.querySelector('.mermaid-sr-only code')?.textContent).toBe(SIMPLE)

    MockIntersectionObserver.instances[0].simulateIntersecting()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidRender).toHaveBeenCalledTimes(1)
  })

  it('lazy={false} rend immédiatement sans observer', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: false })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it("lazy='false' (properties string) rend immédiatement aussi", async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: 'false' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
  })

  it('rend immédiatement quand IntersectionObserver est indisponible', async () => {
    vi.unstubAllGlobals()
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidRender).toHaveBeenCalledTimes(1)
  })
})

describe('MermaidDiagram — thème', () => {
  it('theme dark → initialize avec le thème mermaid dark', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ theme: 'dark' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
  })

  it("theme auto suit prefers-color-scheme et re-rend au changement", async () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = []
    const mql = {
      matches: false,
      addEventListener: (_t: string, cb: (event: MediaQueryListEvent) => void) => {
        listeners.push(cb)
      },
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ theme: 'auto' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidInitialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: 'default' }),
    )
    expect(container.querySelector('.mermaid-diagram')?.getAttribute('data-mermaid-theme')).toBe(
      'light',
    )

    // Bascule système vers dark → re-rendu avec le thème dark.
    await act(async () => {
      listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent))
    })
    await waitFor(() =>
      expect(mermaidInitialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' })),
    )
    expect(container.querySelector('.mermaid-diagram')?.getAttribute('data-mermaid-theme')).toBe(
      'dark',
    )
  })
})
