# Site layout and typography contract

This document defines the shared layout rules for the Sandbox documentation site. It is the reference for future page additions and visual fixes; avoid introducing page-specific width overrides when a shared rule can express the intent.

## Design principles

1. **One site shell.** The header, footer, homepage, and documentation pages share a small set of outer-width and gutter tokens.
2. **One documentation column rule.** Every documentation article fills the space available to it beside the sidebar. A page must not opt into a separate `wide` mode to avoid an arbitrary article-width cap.
3. **Layout width is not reading width.** Tables, diagrams, API references, code blocks, and navigation lists can use the full article column. Only long-form paragraphs and list items receive a reading measure.
4. **Respect script-specific typography.** Latin `ch` units are appropriate for English reading measures, but are too narrow for Chinese glyphs. The reading token therefore changes with the document language.
5. **Use shared hierarchy tokens.** Homepage and documentation titles, section headings, lead text, and vertical spacing share responsive tokens. Components may have different structures, but should not invent competing typography scales.
6. **Keep evidence separate from appearance.** A successful build proves the page can be generated; it does not prove that the layout looks correct at every viewport.

## Shared layout tokens

| Token | Default | Purpose |
| --- | --- | --- |
| `--site-max-width` | `1440px` | Maximum outer shell width for header, footer, and documentation frame |
| `--content-max-width` | `1120px` | Maximum centered width of the homepage content |
| `--page-gutter` | `clamp(1rem, 3vw, 2rem)` | Shared responsive left/right page inset |
| `--sidebar-width` | `15rem` | Documentation navigation column |
| `--layout-gap` | `clamp(1.5rem, 3vw, 2.5rem)` | Gap between sidebar and article |
| `--section-space` | `clamp(1.5rem, 3vw, 2.25rem)` | Vertical rhythm between major sections |
| `--reading-width` | `72ch` in English; `44em` in Chinese | Maximum line measure for long-form prose |

## Page families

### Homepage and overview pages

- The homepage uses a centered content frame capped by `--content-max-width`.
- Architecture and Benchmark overview pages use the normal documentation shell, including the same sidebar and article column as other documentation pages.
- Overview lead paragraphs and section introductions use the available content width so they align with diagrams, reading lists, and other structural blocks.
- The page title and section headings use the shared responsive type scale.

### Owner documentation and component reference pages

- The documentation frame uses `--site-max-width`, the shared gutter, sidebar width, and layout gap.
- The article wrapper is always `width: 100%; min-width: 0`; do not reintroduce a fixed `940px` cap or a page-specific `wide` flag.
- Markdown headings, tables, diagrams, images, and fenced code blocks can use the full article column.
- Paragraphs and list items use `--reading-width`. This keeps long-form text readable without shrinking the whole document.
- Source/version metadata and implementation-status statements remain visible and retain their existing meaning.

## Responsive behavior

| Viewport | Expected behavior |
| --- | --- |
| Above `1100px` | Full outer shell, desktop sidebar, article fills the remaining main column |
| `701–1100px` | Header navigation moves to its compact row; sidebar and inter-column gap shrink through local layout tokens |
| `700px` and below | Documentation frame becomes one column; sidebar links become a compact wrapping group; tables remain horizontally scrollable |
| `320px` minimum | No unintended page-level horizontal overflow; wide tables/code scroll inside their own containers |

The breakpoints are structural transitions, not page-specific width presets. If a new component needs special behavior, scope it to that component rather than changing the shared shell.

## Change and acceptance workflow

1. Change shared tokens or canonical layout selectors before adding local exceptions.
2. Add a regression assertion when changing a width, breakpoint, or typography rule.
3. Run the Node layout tests and Astro build.
4. After deployment, inspect the page families and viewport sizes in [the visual review checklist](./layout-visual-review.md).
5. Record automated validation and manual visual acceptance separately. Do not mark visual acceptance complete based only on CI.
