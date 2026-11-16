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

## Live (2026-11-16)
- Site: https://preppy-woad.vercel.app (Vercel project `iman-runners/preppy`, functions in iad1 next to the Neon database in us-east-1). Passcode is in `.env.local` (PASSCODE) and in Vercel env.
- Verified on the live site: passcode gate, chart upload read by AI, chart from body details, dish search, full plan run (about 90 s), collect plan.
- Deploy with `npx vercel deploy --prod --yes`. Logs: `npx vercel logs --since 10m`.
- Library: `npm run library -- status | build <target> <maxUsd> | prices | prices-fill <searches> | tidy`. Scripts import `scripts/net.ts` because the owner's network DNS refuses neon.tech lookups.
- Price table: 88 of 91 items (cauliflower, green beans, pork missing). "stock or broth" manually set to 60/litre.

## Lessons (do not repeat)
- Workflow step functions must be exported and written multi-line with `"use step";` on its own line, or they are not registered in the deployed flow function (works in dev, fails on Vercel).
- Sonnet re-tagging made the library cost $0.035 per recipe; Haiku-only with cautious defaults is about $0.002. Owner has only $5 of API credit: always pass a spending cap.
- Recipe sites: Swasthi and Serious Eats refuse requests, Bong Eats has no sitemap. About 25% of pages become recipes (most rejections: no video).

## Still to do
- [ ] Run `npm run library -- tidy` after any build (cleans names), then spot-check a live plan
- [ ] Not yet tested with a real person: photo-based chart, typed "Other" restrictions, ZIP/HTML export in a phone browser
- [ ] Log decisions in the PDD (Neon instead of Upstash, browser-side exports, 12 runs/day limit, Haiku-only tagging, library size ~400 not 3,000, side dishes up to 15 min)
- [ ] Optional: YouTube API key (YOUTUBE_API_KEY) for favourite-dish top-up; GitHub push; monthly refresh cron is wired but untested
