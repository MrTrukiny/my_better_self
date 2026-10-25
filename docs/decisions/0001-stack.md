# 0001: Base stack

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

We are building a responsive web app that must be installable as a PWA and is developed mainly by AI coding agents. The stack needs strong conventions, good type safety, fast feedback loops, and up-to-date docs that agents can read.

## Decision

- **Next.js 16 App Router** with Turbopack, Cache Components, Partial Prefetching, and `experimental.useOffline`. Next ships version-matched docs in `node_modules/next/dist/docs/`, which agents read before using APIs.
- **TypeScript strict**, **React 19**.
- **Tailwind CSS v4 + shadcn/ui** (Base UI primitives): components live in the repo, so agents can read and adapt them.
- **Serwist (`@serwist/turbopack`)** for the service worker: precaching, runtime caching, and offline fallback. Next's docs recommend it for Turbopack.
- **Biome** for lint and format: one fast tool, one config.
- **Vitest + Testing Library** for unit tests, **Playwright** for e2e against a production build.
- **Lefthook** for pre-commit checks, **GitHub Actions** for CI.
- **pnpm** and **Node 24**.

## Consequences

- The Serwist route handler cannot export route segment config because of Cache Components; it renders on demand and bundles the worker with `esbuild` at runtime, so `esbuild` and `serwist` are production dependencies.
- PWA behavior must be verified against `next build && next start`, not `next dev`.
- Data layer, auth, and hosting are still open and will get their own ADRs.
