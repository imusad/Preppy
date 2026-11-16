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

## Deployment state (2026-11-16)
- Vercel: logged in via CLI as `imusad`, project `iman-runners/preppy` created and linked (`.vercel/`). PASSCODE, AUTH_SECRET, CRON_SECRET added to Vercel production env (values in `.env.local`).
- WAITING ON OWNER: (1) accept Neon terms at https://vercel.com/iman-runners/~/integrations/accept-terms/neon?source=cli then rerun `npx vercel integration add neon`; (2) paste Anthropic key into `.env.local` (ANTHROPIC_API_KEY=).
- Recipe reader checked with `npm run library -- read`: works for hebbars, tasty, recipetineats, budgetbytes, bbcgoodfood, archanas, ranveer. Swasthi and Serious Eats refuse the app's requests; Bong Eats has no sitemap. Many pages are rejected for "no video".

## Next up (in order)
- [ ] After Neon: `npx vercel env pull`-style check that DATABASE_URL exists in production, add ANTHROPIC_API_KEY to Vercel (`vercel env add`), `npx vercel deploy --prod`
- [ ] With key: test `/api/chart/upload` locally, fix any API shape errors; `npm run library -- build 300` against Neon first (set DATABASE_URL in `.env.local`), check quality, then full build; `npm run library -- prices`
- [ ] End-to-end test on the live site; give owner link + passcode; log decisions D-023+ in the PDD; optional GitHub push
