# CA Docs

Public documentation portal for the ConnectionAgent (`ca-*`) ecosystem.

The site is intentionally a **cross-repository view**. Canonical machine contracts stay in
their owning repositories; this repository fetches and renders them into a human-readable
capability and API reference.

## First integrated component

- `ca-5gc-sim` — deterministic 5GC reference simulator

Its Fact and Operation inventories are generated from the canonical schemas in
`odango-chan/ca-5gc-sim`. HTTP routes are compared with the actual server registration
so implementation/documentation drift is visible instead of hidden.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` refreshes the upstream `ca-5gc-sim` contract snapshot before starting
Astro.

## Build

```bash
npm run build
```

The static output is written to `dist/`.

## Source-of-truth rule

`ca-docs` is **not** a second contract authority.

- OpenAPI / JSON Schema / implementation truth stays in the owner repository.
- This site derives inventories and counts from upstream sources at build time.
- Hand-written content here explains intent, ownership and usage; it must not redefine
  wire contracts.

## Deployment

`.github/workflows/pages.yml` deploys the site to GitHub Pages on pushes to `main`,
manual dispatches, and a periodic refresh so upstream public contract changes appear
without copying schemas into this repository.
