# lumen-markdown-mermaid

[Mermaid](https://mermaid.js.org) diagram rendering for [`@tanstack/markdown`](https://tanstack.com/markdown): captures fenced ` ```mermaid ` / ` ~~~mermaid ` blocks and renders them through an accessible, lazily-loaded React component that degrades honestly.

## Why this package

`@tanstack/markdown` has no native mermaid support. This package provides a `parseBlock` extension that emits a `component` node carrying the raw source, plus a React component (`MermaidDiagram`) that loads **mermaid.js via dynamic import only** — zero bundle cost until a diagram is actually visible.

Built for dense corpora (course pages, tutor responses) where an invalid diagram must **never** break the page: no empty panel, no unbounded exception.

## Installation

The package is not yet published on npm. Install it as a git dependency:

```bash
pnpm add github:bertrandgressier/lumen-markdown-mermaid
# npm install github:bertrandgressier/lumen-markdown-mermaid
# yarn add github:bertrandgressier/lumen-markdown-mermaid
```

`dist/` is committed to the repository, so consumers need no build step.

- `@tanstack/markdown` is a peer dependency — install it yourself (`pnpm add @tanstack/markdown react`).
- `react` (>= 18) is an optional peer, only required for the `lumen-markdown-mermaid/react` subpath.
- `mermaid` is a direct dependency of the package, loaded dynamically.
- The package is ESM-only (no CommonJS entry).

### npm (once published)

Not available yet. When the package is published:

```bash
pnpm add lumen-markdown-mermaid @tanstack/markdown react
# npm install lumen-markdown-mermaid @tanstack/markdown react
# yarn add lumen-markdown-mermaid @tanstack/markdown react
```

## Quick start

### With the React component (`@tanstack/markdown/react`)

```tsx
import { Markdown } from '@tanstack/markdown/react'
import { mermaidExtension } from 'lumen-markdown-mermaid'
import { MermaidDiagram } from 'lumen-markdown-mermaid/react'

export function Page() {
  return (
    <Markdown
      extensions={[mermaidExtension()]}
      components={{ MermaidDiagram }}
    >
      {`Here is the pathway:

\`\`\`mermaid
graph TD; Glycolysis-->Pyruvate-->Krebs
\`\`\``}
    </Markdown>
  )
}
```

The extension emits a `component` node (tag `MermaidDiagram`, raw source in `properties.source`); the React renderer maps it through `components`. No `allowHtml` is needed for the diagram itself.

### With `parseMarkdown()`

```ts
import { parseMarkdown } from '@tanstack/markdown'
import { mermaidExtension } from 'lumen-markdown-mermaid'

const doc = parseMarkdown('```mermaid\ngraph TD; A-->B\n```', {
  extensions: [mermaidExtension()],
})
// → a component node { name: 'mermaid', tagName: 'MermaidDiagram', properties: { source } }
```

### With the string HTML renderer (`renderHtml`)

The extension's `renderHtml` hook honestly emits the escaped source inside `<pre class="mermaid-source"><code>…</code></pre>` — a string renderer cannot execute mermaid, so the source is preserved as-is.

## API

```ts
import { mermaidExtension, extractMermaidTitle } from 'lumen-markdown-mermaid'
import type { MermaidOptions, MermaidTheme } from 'lumen-markdown-mermaid'
import { MermaidDiagram } from 'lumen-markdown-mermaid/react'
```

### `mermaidExtension(opts?): MarkdownExtension`

Captures `mermaid` fences (3+ backticks or tildes, up to 3 spaces of indentation, info string `mermaid` or `mermaid …`), including fences nested inside list items (dedented). An unterminated fence is consumed to the end of the document — streaming-friendly: the partial content becomes a mermaid source that degrades cleanly for as long as it is invalid.

### `MermaidOptions`

| Option            | Type          | Default                                         | Description                                                                                 |
| ----------------- | ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tagName`         | `string`      | `'MermaidDiagram'`                              | Tag of the `component` node, to map via `components`.                                       |
| `theme`           | `MermaidTheme`| `'light'`                                       | `'light'` → mermaid `default` theme, `'dark'` → `dark`, `'auto'` follows `prefers-color-scheme`. |
| `lazy`            | `boolean`     | `true`                                          | Render on demand via IntersectionObserver (200 px margin).                                  |
| `fallbackMessage` | `string`      | `'Diagram not displayed — source preserved'`    | Short message shown on fallback.                                                            |

Each option is propagated into the node's `properties` — the mapped component receives them as defaults (overridable in direct JSX usage).

### `MermaidDiagram` (React)

| Prop              | Type                          | Default                                      | Description                                                                                                                        |
| ----------------- | ----------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source`          | `string`                      | —                                            | Raw mermaid source (`properties.source`).                                                                                          |
| `title`           | `string`                      | title extracted from the source              | Explicit `aria-label`.                                                                                                             |
| `theme`           | `'light' \| 'dark' \| 'auto'` | `'light'`                                    | Render theme; `'auto'` respects an initially-dark system from the first render and re-renders on scheme change.                    |
| `lazy`            | `boolean`                     | `true`                                       | Render when entering the viewport.                                                                                                 |
| `fallbackMessage` | `string`                      | `'Diagram not displayed — source preserved'` | Fallback message.                                                                                                                  |
| `onError`         | `(error: unknown) => void`    | —                                            | Called when rendering fails (invalid source, render error, or mermaid load failure). When not provided, failures are logged via `console.error`. |
| `className`       | `string`                      | —                                            | Additional classes on the root container.                                                                                          |

Rendering is flicker-free: when `source` or `theme` changes, the last rendered SVG stays visible until the new one is ready — no blank flash.

### `extractMermaidTitle(source): string | undefined`

Extracts the accessible title of a mermaid source: `title:` frontmatter first, then the `accTitle:` directive. Used by default for the `aria-label`.

## Honest degradation

Invalid diagram, render error, or mermaid load failure — including a rejecting `import('mermaid')`:

- **never** an empty panel: a short message (`fallbackMessage`) is shown;
- **never** an unbounded exception: everything is caught inside the component;
- the **raw source is preserved** in a visible `<pre class="mermaid-fallback-source">`;
- orphan error nodes mermaid may have left in the DOM are cleaned up;
- failures are reported through the optional `onError` prop, or logged via `console.error` when it is not provided.

## Accessibility

- SVG container: `role="img"` + `aria-label` (`title` prop, else title extracted from the source, else `'Mermaid diagram'`).
- The source is **technically present in every state**: `<span class="mermaid-sr-only"><code>…</code></span>` (success, loading, lazy wait) or a visible `<pre>` (fallback).
- The package is headless: you must provide the `.mermaid-sr-only` utility yourself. Required CSS:

```css
.mermaid-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
```

## Lazy rendering

`lazy` (default `true`): an `IntersectionObserver` (200 px margin) triggers mermaid loading and rendering when the container enters the viewport. Without the API (old browsers), rendering is immediate.

## Known limitations

- mermaid is a global singleton. `mermaid.initialize` is memoized per theme and no longer called on every render, but diagrams rendering simultaneously with different themes can still race on that singleton — the last `initialize` wins. Use a uniform theme per page when in doubt.
- Rendering is strictly client-side: during SSR the component renders the container + sr-only source, and the SVG appears on hydration (no hydration mismatch).
- `securityLevel: 'strict'` (mermaid default): HTML labels inside diagrams are escaped — intentional for untrusted content.

## License

MIT © 2026 Bertrand Gressier
