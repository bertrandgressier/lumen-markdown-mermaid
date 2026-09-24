/**
 * Internal mermaid initialization memo. Not exposed through the package
 * `exports` map — do not import from application code.
 */
/**
 * `mermaid.initialize` mutates a global singleton: calling it on every render
 * would repeatedly stomp any configuration the host app set for its own
 * mermaid usage (fonts, theme variables, security level, …). Memoize per
 * theme so each theme is initialized at most once per page load.
 *
 * Mixing different themes across simultaneously rendering diagrams can still
 * race on the singleton — prefer a uniform theme per page when in doubt.
 */
const initializedThemes = new Set();
export function ensureMermaidInitialized(mermaid, theme) {
    if (initializedThemes.has(theme))
        return;
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'dark' ? 'dark' : 'default',
    });
    initializedThemes.add(theme);
}
/** Test-only: reset the per-theme memo between tests. */
export function __resetInitializedThemesForTests() {
    initializedThemes.clear();
}
