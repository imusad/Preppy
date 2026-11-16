# Preppy build progress

Resume note for Claude: read this file first, then continue from "Next up".
Source documents: `../MVP /mvp-meal-planner-pdd.md` and `../MVP /mvp-meal-planner-architecture.md`.
Design: https://claude.ai/artifact/BnDvTBxPD39zC2wyjvAahW (copies of the screens in `.design-reference/`).

## Decisions made with the product owner (2026-11-16)
- Friends will use the app → a shared passcode gate in front of everything.
- All 10 recipe sites kept (owner's call). Source list is a setting.
- Owner has GitHub and Google accounts and a new Vercel Hobby account. No Anthropic API key yet: guide them to create one; key goes in `.env.local`, never in chat.
- Engineering: plan hold lives in Neon Postgres (not Upstash) with a 24-hour expiry enforced on read plus a durable workflow sleep that deletes it. One less account to set up.
- Engineering: export files are built in the browser (the tab already has the plan); the server only deletes its held copy.
- Engineering: first library build runs without the batch service for speed (cost difference under $1); monthly refresh uses batch.

## Done
- [x] Whole app built: screens (`components/shell`, `components/setup`, `components/plan`), exports (`lib/export`), server (`lib/*`, `app/api/*`), workflows (`workflows/generate.ts`, `workflows/maintenance.ts`), library script (`npm run library -- status|read|build|prices`)
- [x] 52 tests pass (`npm test`), `tsc` clean, `next build` passes
- [x] Local end-to-end run verified with sample recipes (`npx tsx scripts/seed-local.ts`, then `npx next dev`): run → progress → plan → wrong code refused → export deletes hold
- [x] Preview pages: `/preview` (plan with sample data), `/preview/setup`

## Not yet verified (needs the Anthropic key)
- Chart/photo reading, recipe tagging, typed restrictions, price refresh: code written, never run against the real API. Expect small fixes on first run (e.g. `output_config.format` shape, web search tool version for Haiku).
- Recipe site reading: sitemap patterns in `lib/settings.ts` are best guesses; run `npm run library -- read 200` (no AI cost) and check `status` for per-site yield.

## Next up (in order)
- [ ] Owner: create Anthropic key + YouTube key into `.env.local`; approve `vercel login`
- [ ] Neon database via Vercel, env vars (ANTHROPIC_API_KEY, PASSCODE, AUTH_SECRET, CRON_SECRET, YOUTUBE_API_KEY, DATABASE_URL), deploy
- [ ] First library build + price refresh (run from this Mac: `npm run library`)
- [ ] End-to-end test on the live site, hand over link and passcode; log decisions D-023+ in the PDD
