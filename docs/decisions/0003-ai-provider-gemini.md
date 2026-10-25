# 0003: Gemini through the Vercel AI SDK

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The app uses AI to propose cleaning tasks, durations, and frequencies from the home inventory, and later to map a home from a video. The user has a ChatGPT Plus subscription, but that does not include API access; any provider API is billed separately by usage. Usage is personal and low-volume.

## Decision

- **Provider: Google Gemini API.**
  - Its free tier covers development and light personal use.
  - Paid usage at this volume costs cents per month.
  - It has native video understanding, which phase 3 (home mapping from video) needs.
- **SDK: Vercel AI SDK** (`ai` + `@ai-sdk/google`):
  - Typed **structured output** validated with **Zod** schemas, so AI responses are parsed and rejected if invalid rather than trusted as free text.
  - Provider-agnostic: switching to OpenAI or another provider is a configuration change, not a rewrite.
- **Model**: a Flash-tier Gemini model by default, configured through an environment variable (`AI_MODEL`) rather than hard-coded, so it can be upgraded without code changes.
- **Server-only**: all AI calls run in Server Actions or route handlers. The API key (`GOOGLE_GENERATIVE_AI_API_KEY`) never reaches the client.
- **AI proposes, never schedules.** AI output becomes a reviewable proposal. Scheduling is deterministic code (see `docs/ARCHITECTURE.md`).

## Consequences

- Prompts and Zod schemas live together in a dedicated module (`src/lib/ai/`), versioned and unit tested with recorded fixtures instead of live calls.
- On Gemini's free tier, Google may use prompts to improve its products. The inventory is non-sensitive household data, but enable billing (paid tier) if that becomes a concern.
- The AI SDK adds a dependency layer; its version is pinned and upgraded deliberately.
