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
import { __resetInitializedThemesForTests } from '../src/mermaid-init.js'

const SVG = '<svg viewBox="0 0 100 100"><circle r="40"/></svg>'
const SVG_ALT = '<svg viewBox="0 0 100 100"><rect width="10" height="10"/></svg>'
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
  __resetInitializedThemesForTests()
  MockIntersectionObserver.reset()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

function diagram(props: Record<string, unknown> = {}) {
  return render(createElement(MermaidDiagram, { source: SIMPLE, lazy: false, ...props }))
}

describe('MermaidDiagram — nominal rendering', () => {
  it('renders the SVG via mermaid (dynamic import) with role="img"', async () => {
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

  it('keeps the source technically present (sr-only) in the success state', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(container.querySelector('.mermaid-sr-only code')?.textContent).toBe(SIMPLE)
  })
})

describe('MermaidDiagram — honest degradation', () => {
  it('shows a short message + raw source in a pre when mermaid throws', async () => {
    mermaidRender.mockRejectedValue(new Error('Parse error'))
    const { container } = diagram()
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-message')).not.toBeNull()
    })
    expect(container.querySelector('.mermaid-fallback-message')?.textContent).toBe(
      'Diagram not displayed — source preserved',
    )
    expect(container.querySelector('.mermaid-fallback-source')?.textContent).toBe(SIMPLE)
    expect(container.querySelector('.mermaid-svg')).toBeNull()
  })

  it('cleans up the orphan error node mermaid leaves in the DOM', async () => {
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

  it('also degrades when the dynamic import of mermaid fails', async () => {
    mermaidRender.mockRejectedValue(new Error('network'))
    const { container } = diagram({ source: 'flowchart TD; A-->B' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-source')?.textContent).toBe(
        'flowchart TD; A-->B',
      )
    })
  })

  it('fallback message configurable via prop', async () => {
    mermaidRender.mockRejectedValue(new Error('x'))
    const { container } = diagram({ fallbackMessage: 'Diagram unavailable' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-fallback-message')?.textContent).toBe(
        'Diagram unavailable',
      )
    })
  })

  it('removes the orphan error node and keeps the last SVG when a render is superseded', async () => {
    const onError = vi.fn()
    let rejectSecond!: (error: Error) => void
    let resolveThird!: (value: { svg: string }) => void
    mermaidRender
      .mockImplementationOnce(() => Promise.resolve({ svg: SVG }))
      .mockImplementationOnce((_id: string) => {
        // mermaid leaves an orphan error node behind when render fails.
        const orphan = document.createElement('div')
        orphan.id = `d${_id}`
        document.body.appendChild(orphan)
        return new Promise<{ svg: string }>((_resolve, reject) => {
          rejectSecond = reject
        })
      })
      .mockImplementationOnce(
        () =>
          new Promise<{ svg: string }>((resolve) => {
            resolveThird = resolve
          }),
      )

    const { container, rerender } = diagram({ source: SIMPLE, onError })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())

    // A deferred (doomed) render is superseded by a newer source before settling.
    rerender(createElement(MermaidDiagram, { source: 'graph TD; B-->C', lazy: false, onError }))
    await waitFor(() => expect(mermaidRender).toHaveBeenCalledTimes(2))
    rerender(createElement(MermaidDiagram, { source: 'graph TD; C-->D', lazy: false, onError }))
    await waitFor(() => expect(mermaidRender).toHaveBeenCalledTimes(3))
    expect(document.querySelector('[id^="dmmd-"]')).not.toBeNull()

    await act(async () => {
      rejectSecond(new Error('superseded failure'))
    })

    // The orphan error node is removed even though the render was cancelled…
    expect(document.querySelector('[id^="dmmd-"]')).toBeNull()
    // …the failure is still reported to onError…
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    // …and the last good SVG is not clobbered by the cancelled failure.
    expect(container.querySelector('.mermaid-svg')?.innerHTML).toContain('<circle')
    expect(container.querySelector('.mermaid-fallback-message')).toBeNull()

    // The superseding render eventually resolves and swaps the SVG.
    await act(async () => {
      resolveThird({ svg: SVG_ALT })
    })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')?.innerHTML).toContain('<rect'))
  })
})

describe('MermaidDiagram — stale-while-revalidate', () => {
  it('keeps displaying the previous SVG while re-rendering after a source change (no blank flash)', async () => {
    let resolveSecond!: (value: { svg: string }) => void
    mermaidRender
      .mockImplementationOnce(() => Promise.resolve({ svg: SVG }))
      .mockImplementationOnce(
        () =>
          new Promise<{ svg: string }>((resolve) => {
            resolveSecond = resolve
          }),
      )

    const { container, rerender } = diagram({ source: SIMPLE })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.innerHTML).toContain('<circle')
    })

    rerender(createElement(MermaidDiagram, { source: 'graph TD; B-->C', lazy: false }))
    await waitFor(() => expect(mermaidRender).toHaveBeenCalledTimes(2))

    // While the new render is in flight, the old SVG stays visible —
    // no pending placeholder, no fallback, no blank flash.
    const svgBox = container.querySelector<HTMLElement>('.mermaid-svg')
    expect(svgBox).not.toBeNull()
    expect(svgBox?.innerHTML).toContain('<circle')
    expect(container.querySelector('.mermaid-fallback-message')).toBeNull()

    await act(async () => {
      resolveSecond({ svg: SVG_ALT })
    })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.innerHTML).toContain('<rect')
    })
  })
})

describe('MermaidDiagram — error reporting', () => {
  it('calls onError with the error when a render fails', async () => {
    const onError = vi.fn()
    mermaidRender.mockRejectedValue(new Error('Parse error'))
    const { container } = diagram({ onError })
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    // Degradation behavior stays identical.
    expect(container.querySelector('.mermaid-fallback-message')).not.toBeNull()
    expect(container.querySelector('.mermaid-fallback-source')?.textContent).toBe(SIMPLE)
    expect(container.querySelector('.mermaid-svg')).toBeNull()
  })

  it('logs via console.error when onError is not provided', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mermaidRender.mockRejectedValue(new Error('Parse error'))
      const { container } = diagram()
      await waitFor(() => {
        expect(container.querySelector('.mermaid-fallback-message')).not.toBeNull()
      })
      expect(consoleError).toHaveBeenCalledWith('mermaid render failed', expect.any(Error))
    } finally {
      consoleError.mockRestore()
    }
  })
})

describe('MermaidDiagram — accessibility', () => {
  it('default aria-label: Mermaid diagram', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Mermaid diagram',
      )
    })
  })

  it('aria-label from the diagram title (frontmatter title)', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ source: '---\ntitle: Krebs cycle\n---\ngraph TD; A-->B' })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Krebs cycle',
      )
    })
  })

  it('explicit aria-label via the title prop takes precedence', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({
      source: '---\ntitle: Ignored\n---\ngraph TD',
      title: 'Metabolic pathway',
    })
    await waitFor(() => {
      expect(container.querySelector('.mermaid-svg')?.getAttribute('aria-label')).toBe(
        'Metabolic pathway',
      )
    })
  })
})

describe('MermaidDiagram — lazy (on-demand) rendering', () => {
  it('renders nothing outside the viewport when lazy, renders on intersection', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: true })
    // Outside the viewport: observer in place, no render.
    expect(MockIntersectionObserver.instances).toHaveLength(1)
    expect(mermaidRender).not.toHaveBeenCalled()
    expect(container.querySelector('.mermaid-svg')).toBeNull()
    // The sr-only source stays present even while waiting.
    expect(container.querySelector('.mermaid-sr-only code')?.textContent).toBe(SIMPLE)

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateIntersecting()
    })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidRender).toHaveBeenCalledTimes(1)
  })

  it('lazy={false} renders immediately without an observer', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: false })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it("lazy='false' (string from properties) also renders immediately", async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ lazy: 'false' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
  })

  it('renders immediately when IntersectionObserver is unavailable', async () => {
    vi.unstubAllGlobals()
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidRender).toHaveBeenCalledTimes(1)
  })
})

describe('MermaidDiagram — theme', () => {
  it('theme dark → initializes with the mermaid dark theme', async () => {
    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ theme: 'dark' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
  })

  it('theme auto follows prefers-color-scheme and re-renders on change', async () => {
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

    // System switches to dark → re-render with the dark theme.
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

  it('theme auto renders dark-first when the system initially prefers dark', async () => {
    const mql = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    mermaidRender.mockResolvedValue({ svg: SVG })
    const { container } = diagram({ theme: 'auto' })
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    // The very first render already uses the dark theme — no light-first flash.
    expect(mermaidInitialize).toHaveBeenCalledTimes(1)
    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
    expect(container.querySelector('.mermaid-diagram')?.getAttribute('data-mermaid-theme')).toBe(
      'dark',
    )
  })

  it('initializes mermaid once per theme, not on every render', async () => {
    mermaidRender.mockResolvedValueOnce({ svg: SVG }).mockResolvedValueOnce({ svg: SVG_ALT })
    const { container, rerender } = diagram()
    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())

    // Source change (streaming update) re-runs the render effect…
    rerender(createElement(MermaidDiagram, { source: 'graph TD; A-->C', lazy: false }))
    await waitFor(() =>
      expect(container.querySelector('.mermaid-svg')?.innerHTML).toContain('rect'),
    )
    expect(mermaidRender).toHaveBeenCalledTimes(2)
    // …but the global mermaid config is not re-initialized for the same theme.
    expect(mermaidInitialize).toHaveBeenCalledTimes(1)
  })
})
