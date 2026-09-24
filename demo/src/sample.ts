const fence = '```'

/**
 * Sample document rendered on load. Exercises the library end to end:
 * plain markdown coexisting with mermaid blocks, an `accTitle:` directive
 * (accessible title extraction), three valid diagram types, and one
 * deliberately invalid block to show the honest fallback.
 */
export const SAMPLE_MARKDOWN = `# Release notes — Sprint 42

This page mixes regular markdown with mermaid diagrams. Headings, lists and
\`inline code\` all flow around diagram blocks, and each diagram is rendered
lazily, the first time it scrolls into view.

## What shipped

- Lazy-loaded diagram renderer (\`lazy: true\`)
- Screen-reader source kept in the DOM (\`srOnlySource\`)
- Honest fallback for invalid diagrams — no blank panels, no crashes

## Onboarding flow

${fence}mermaid
flowchart TD
  accTitle: Onboarding flow
  accDescr: From first open to the dashboard, with or without signing in.
  Start([Open app]) --> Gate{Signed in?}
  Gate -- no --> Login[Login screen]
  Gate -- yes --> Dashboard[Dashboard]
  Login --> Dashboard
${fence}

The \`accTitle:\` directive above becomes the diagram's accessible label.

## Save handshake

${fence}mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant C as Client
  participant S as Server
  U->>C: Click Save
  C->>S: POST /notes
  S-->>C: 201 Created
  C-->>U: Toast "Saved"
${fence}

## Where review time goes

${fence}mermaid
pie showData
  title Review time by area
  "Parser" : 38
  "Renderer" : 27
  "Accessibility" : 20
  "Docs" : 15
${fence}

## When a diagram is invalid

A block that fails to parse never renders blank and never throws. The
renderer shows a short message and keeps the raw source visible, so nothing
is lost while a document is still streaming:

${fence}mermaid
graph TD;
  A -->
${fence}

The source above is preserved exactly as written, ready to be fixed.
`
