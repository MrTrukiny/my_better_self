# Better Myself

A responsive, installable PWA built with Next.js 16.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. To test PWA behavior (service worker, offline), use a production build: `pnpm build && pnpm start`.

## Scripts

- `pnpm check:fast`: typecheck, lint, unit tests
- `pnpm check`: everything above plus Playwright e2e

## Working with AI agents

Start with [`AGENTS.md`](AGENTS.md). Product context is in [`docs/PRODUCT.md`](docs/PRODUCT.md), and features are specified in [`docs/specs/`](docs/specs/).
