# AGENTS.md

Guide for AI coding agents working in this repo. Keep it short; details live in `docs/` and `.cursor/rules/`.

## Language

The user talks in **Spanish**; reply in chat in Spanish. Everything written to the repo or a remote is in **English**: code, comments, UI copy, docs, specs, commits, branches, PRs.

## Product

**Better Myself** is a responsive, installable PWA. Product context: [`docs/PRODUCT.md`](docs/PRODUCT.md). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Decisions: [`docs/decisions/`](docs/decisions/).

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components, Partial Prefetching, `experimental.useOffline`)
- React 19, TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (`base-nova` style, Base UI primitives, lucide icons)
- Serwist (`@serwist/turbopack`) for the service worker and offline fallback
- Biome (lint + format), Vitest + Testing Library (unit), Playwright (e2e), Lefthook (git hooks)
- pnpm, Node 24

## Commands

| Command                     | What it does                                                                    |
| --------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server (service worker is not reliable here; use a prod build for PWA work) |
| `pnpm build && pnpm start`  | Production build and server                                                     |
| `pnpm typecheck`            | `next typegen` + `tsc --noEmit`                                                 |
| `pnpm lint` / `pnpm format` | Biome check / Biome check with fixes                                            |
| `pnpm test`                 | Vitest unit tests                                                               |
| `pnpm test:e2e`             | Playwright against a prod build, desktop + mobile viewports                     |
| `pnpm check:fast`           | typecheck + lint + unit tests (run often)                                       |
| `pnpm check`                | `check:fast` + e2e (run before declaring a task done)                           |

## Layout

```
src/
  app/                 Routes (App Router). sw.ts = service worker source.
    serwist/[path]/    Route handler that builds and serves /serwist/sw.js
    ~offline/          Offline fallback page (precached)
    manifest.ts        Web app manifest
  components/          App components (app-shell, theme, offline banner)
    ui/                shadcn/ui components (generated; edit sparingly)
  lib/                 Utilities and app config
e2e/                   Playwright specs
docs/                  Product, architecture, specs, ADRs
.cursor/rules/         Scoped agent rules
.cursor/skills/        Workflow skills (spec -> plan -> implement -> review)
```

## Tools (MCP, configured in `.cursor/mcp.json`)

- **context7**: current docs for third-party libraries. Use it instead of relying on memory.
- **playwright**: drive a real browser to check UI at 360px and desktop widths, and to inspect console errors.
- **next-devtools**: inspect Next.js runtime errors, routes, and build state of the running dev server.

## Workflow

Non-trivial work follows spec-driven development, with a human checkpoint after each step:

1. **write-spec**: idea -> `docs/specs/NNN-slug.md` (goal, user stories, acceptance criteria, out of scope).
2. **plan-feature**: spec -> task list in the same spec file, with files touched per task.
3. **implement-feature**: task by task, test first, `pnpm check:fast` after each task, small commits.
4. **review-changes**: verify against the spec, accessibility, responsive layout, PWA behavior; then open a PR.

Skills live in `.cursor/skills/<name>/SKILL.md`. Small fixes can skip straight to implementation.

## Definition of done

- Acceptance criteria in the spec are met and covered by tests.
- `pnpm check` passes (typecheck, lint, unit, e2e).
- UI works at 360px wide and on desktop, in light and dark mode, with keyboard only.
- No new console errors or hydration warnings.

## Do

- Read the Next.js docs in `node_modules/next/dist/docs/` before using a Next API; this version differs from most training data.
- Default to Server Components; add `"use client"` only for interactivity, and push it to the leaves.
- Use existing shadcn/ui components before writing new primitives (`pnpm dlx shadcn@latest add <name>`).
- Keep app-wide constants in `src/lib/app-config.ts`.
- Write tests next to the code (`*.test.ts(x)`); e2e flows go in `e2e/`.
- Record significant decisions as an ADR in `docs/decisions/`.

## Don't

- Don't add route segment config (`dynamic`, `revalidate`, `dynamicParams`); it conflicts with Cache Components.
- Don't add ESLint or Prettier; Biome owns lint and format.
- Don't commit secrets; use `.env.local` and document variables in `.env.example`.
- Don't bypass hooks (`--no-verify`) or weaken tests to make them pass.
- Don't add dependencies without a reason stated in the PR description.

## Git

- Branches: `mrtrukiny/<short-kebab-description>` (prefix with a ticket key in uppercase if there is one).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
