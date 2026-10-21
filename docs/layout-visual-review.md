# Documentation layout review checklist

This is a repeatable **manual visual check** for the published site. It complements CSS regression tests; a passing build is not visual acceptance.

## Before reviewing

1. Open the published site after the latest Pages deployment has completed.
2. Hard-refresh the page to avoid inspecting cached CSS.
3. Use the browser's responsive design mode and set the viewport sizes listed below.
4. Record the browser, date, viewport, page, and any issue found. Do not mark a viewport as checked unless it was actually viewed.

## Pages to inspect

| Page | What it covers |
| --- | --- |
| `/` and `/en/` | Chinese and English homepage headings, reading list, component index table |
| `/components/sandbox/` and `/en/components/sandbox/` | Long owner-published Markdown, Chinese/English headings, prose, lists, tables, and code blocks |
| `/benchmark/` and `/en/benchmark/` | Benchmark overview, flow diagram/code block, reading links |
| `/components/ca-benchmarks/` and `/en/components/ca-benchmarks/` | Owner Markdown and asset semantics |
| `/components/ca-benchmark-engine/` and `/en/components/ca-benchmark-engine/` | Execution lifecycle, result semantics, longer technical sections |
| `/api/` and `/en/api/` | API overview and document index |
| `/components/ca-5gc-sim/api/` | Dense API details, response lists, examples, and wide tables |

## Viewports

| Label | Width × height | Main risk |
| --- | ---: | --- |
| Desktop | 1440 × 900 | Content measure, sidebar spacing, title hierarchy |
| Compact desktop | 1024 × 768 | Header navigation and sidebar/content balance |
| Tablet portrait | 768 × 1024 | Sidebar transition and remaining article width |
| Mobile | 390 × 844 | Navigation wrapping/overflow, heading wrap, table scrolling |
| Narrow mobile | 320 × 720 | Minimum-width overflow and cramped controls |

## Checklist at each relevant page and viewport

- [ ] Page title is not artificially narrowed by a Latin `ch` width cap; Chinese and English headings wrap naturally.
- [ ] Main article uses the available content column. The paragraph/list line length remains comfortable without narrowing the entire Markdown wrapper.
- [ ] Tables and code blocks can scroll horizontally when their intrinsic width exceeds the viewport; the whole page does not gain unintended horizontal overflow.
- [ ] Markdown headings, lists, blockquotes, links, and source/version notes have clear spacing and hierarchy.
- [ ] Desktop navigation and sidebar do not collide with the article. At narrow widths, navigation remains usable and the sidebar changes to the compact layout.
- [ ] The header does not wrap navigation into an accidental second row; at medium widths, horizontal scrolling behaves intentionally.
- [ ] Keyboard focus remains visible on links and controls.

## Review record

Copy and fill one row for every viewport actually checked.

| Date / browser | Page | Viewport | Result | Evidence / issue |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Not checked | No manual visual acceptance recorded yet |

## Exit criteria

- All listed page families have been checked at the relevant viewport sizes.
- Any defect has a reproducible page/viewport and a screenshot or written observation.
- Fixes are rechecked at the viewport where the issue occurred and at one adjacent breakpoint.
- Automated test/build status and manual visual review are recorded separately.
