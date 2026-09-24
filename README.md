# lumen-markdown-mermaid

Rendu de diagrammes [Mermaid](https://mermaid.js.org) pour [`@tanstack/markdown`](https://tanstack.com/markdown) : capture les blocs clôturés ` ```mermaid ` / ` ~~~mermaid ` et les rend via un composant React accessible, paresseux et à dégradation honnête.

## Pourquoi ce package

`@tanstack/markdown` n'a pas de support mermaid natif. Ce package fournit une extension `parseBlock` qui émet un nœud `component` portant la source brute, et un composant React (`MermaidDiagram`) qui charge **mermaid.js en import dynamique uniquement** — aucun coût de bundle tant qu'aucun diagramme n'est visible.

Conçu pour les corpus denses (pages de cours, réponses de tuteur) où un diagramme invalide ne doit **jamais** casser la page : ni panneau vide, ni exception non bornée.

## Installation

```bash
pnpm add lumen-markdown-mermaid @tanstack/markdown react
# npm install lumen-markdown-mermaid @tanstack/markdown react
# yarn add lumen-markdown-mermaid @tanstack/markdown react
```

`@tanstack/markdown` est une peer dependency. `react` (>=18) est une peer optionnelle, uniquement requise pour le sous-path `lumen-markdown-mermaid/react`. `mermaid` est une dépendance directe du package, chargée dynamiquement.

## Démarrage rapide

### Avec le composant React (`@tanstack/markdown/react`)

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
      {`Voici la voie :

\`\`\`mermaid
graph TD; Glycolyse-->Pyruvate-->Krebs
\`\`\``}
    </Markdown>
  )
}
```

L'extension émet un nœud `component` (tag `MermaidDiagram`, source brute dans `properties.source`) ; le renderer React le mappe via `components`. Pas besoin de `allowHtml` pour le diagramme lui-même.

### Avec `parseMarkdown()`

```ts
import { parseMarkdown } from '@tanstack/markdown'
import { mermaidExtension } from 'lumen-markdown-mermaid'

const doc = parseMarkdown('```mermaid\ngraph TD; A-->B\n```', {
  extensions: [mermaidExtension()],
})
// → un nœud component { name: 'mermaid', tagName: 'MermaidDiagram', properties: { source } }
```

### Avec le renderer HTML string (`renderHtml`)

Le hook `renderHtml` de l'extension émet honnêtement la source échappée dans `<pre class="mermaid-source"><code>…</code></pre>` — un renderer string ne peut pas exécuter mermaid, la source est donc conservée telle quelle.

## API

```ts
import { mermaidExtension, extractMermaidTitle } from 'lumen-markdown-mermaid'
import type { MermaidOptions, MermaidTheme } from 'lumen-markdown-mermaid'
import { MermaidDiagram } from 'lumen-markdown-mermaid/react'
```

### `mermaidExtension(opts?): MarkdownExtension`

Capture les fences `mermaid` (3+ backticks ou tildes, jusqu'à 3 espaces d'indentation, info string `mermaid` ou `mermaid …`), imbriquées y compris dans des items de liste (dédent appliqué). Une fence non clôturée est consommée jusqu'à la fin du document — compatible streaming : le contenu partiel devient une source mermaid qui dégradera proprement tant qu'elle est invalide.

### `MermaidOptions`

| Option            | Type        | Défaut                            | Description                                                                                          |
| ----------------- | ----------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `tagName`         | `string`    | `'MermaidDiagram'`                | Tag du nœud `component`, à mapper via `components`.                                                  |
| `theme`           | `MermaidTheme` | `'light'`                       | `'light'` → thème mermaid `default`, `'dark'` → `dark`, `'auto'` suit `prefers-color-scheme`.        |
| `lazy`            | `boolean`   | `true`                            | Rendu à la demande via IntersectionObserver (marge 200 px).                                          |
| `fallbackMessage` | `string`    | `'Diagramme non affiché — texte conservé'` | Message court affiché en repli.                                                             |

Chaque option est propagée dans les `properties` du nœud — le composant mappé les reçoit comme valeurs par défaut (surchargeables en usage JSX direct).

### `MermaidDiagram` (React)

| Prop              | Type                          | Défaut                            | Description                                                       |
| ----------------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `source`          | `string`                      | —                                 | Source mermaid brute (`properties.source`).                       |
| `title`           | `string`                      | titre extrait de la source        | Libellé `aria-label` explicite.                                   |
| `theme`           | `'light' \| 'dark' \| 'auto'` | `'light'`                         | Thème de rendu ; `'auto'` re-rend au changement de scheme.        |
| `lazy`            | `boolean`                     | `true`                            | Rendu à l'entrée dans le viewport.                                |
| `fallbackMessage` | `string`                      | `'Diagramme non affiché — texte conservé'` | Message de repli.                                        |
| `className`       | `string`                      | —                                 | Classes additionnelles du conteneur racine.                      |

### `extractMermaidTitle(source): string | undefined`

Extrait le titre accessible d'une source mermaid : frontmatter `title:` en priorité, puis directive `accTitle:`. Utilisé par défaut pour l'`aria-label`.

## Dégradation honnête

Diagramme invalide, erreur de rendu ou échec de chargement de mermaid — y compris `import('mermaid')` qui rejette :

- **jamais** de panneau vide : un message court (`fallbackMessage`) est affiché ;
- **jamais** d'exception non bornée : tout est attrapé dans le composant ;
- la **source brute est conservée** dans un `<pre class="mermaid-fallback-source">` visible ;
- les nœuds d'erreur orphelins éventuellement laissés par mermaid dans le DOM sont nettoyés.

## Accessibilité

- Conteneur SVG : `role="img"` + `aria-label` (prop `title`, sinon titre extrait de la source, sinon `'Diagramme Mermaid'`).
- La source est **techniquement présente dans tous les états** : `<span class="mermaid-sr-only"><code>…</code></span>` (succès, chargement, attente lazy) ou `<pre>` visible (repli).
- Le package est headless : fournissez vous-même l'utilitaire `.mermaid-sr-only` (ex. `position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)`).

## Rendu à la demande

`lazy` (défaut `true`) : un `IntersectionObserver` (marge 200 px) déclenche le chargement de mermaid et le rendu à l'entrée dans le viewport. Sans l'API (vieux navigateurs), rendu immédiat.

## Limites connues

- `mermaid.initialize` est global (singleton mermaid) : des diagrammes simultanés avec des thèmes différents peuvent se court-circuiter en bord de course — le dernier `initialize` gagne. Utilisez un thème uniforme par page en cas de doute.
- Le rendu est strictement client : côté SSR, le composant rend le conteneur + source sr-only, le SVG apparaît à l'hydratation (pas d'écart d'hydratation).
- `securityLevel: 'strict'` (défaut mermaid) : les labels HTML dans les diagrammes sont échappés — c'est voulu pour du contenu non fiable.

## Licence

MIT © 2026 Bertrand Gressier
