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

## 2026-11-16 evening
- Fixed: lunch/dinner count no longer capped by profiles added so far (1-8; Generate asks for missing profiles); typed restrictions now checked by AI even when they are dislikes, and can rule out whole cuisines ("No Indian spices"); 25 code-review findings fixed (see git log 7056ce5); sauces/dressings no longer scheduled as dishes.
- Library 517 recipes. Added 9 healthy English sources (vegan, Italian, Mexican, Korean, Japanese, Mediterranean, healthy Indian). English names for all recipes (scripts/rename.ts). Recipe bank shows the source on each row and has a Source filter.
- No usable Tibetan recipe site found (yowangdu has no recipe format). Japanese and Mexican are still thin (spending cap).
- API credit: estimated ~$2.95 spent of $5 by end of day (owner must confirm in console Billing). Keep further builds small; `scripts/park.ts` sets aside queued pages from chosen sites so a build spends only on others.

## Still to do
- [ ] Run `npm run library -- tidy` after any build (cleans names), then spot-check a live plan
- [ ] Not yet tested with a real person: photo-based chart, typed "Other" restrictions, ZIP/HTML export in a phone browser
- [ ] Log decisions in the PDD (Neon instead of Upstash, browser-side exports, 12 runs/day limit, Haiku-only tagging, library size ~400 not 3,000, side dishes up to 15 min)
- [ ] Optional: YouTube API key (YOUTUBE_API_KEY) for favourite-dish top-up; GitHub push; monthly refresh cron is wired but untested

## 2026-11-17: recommendation engine follows profile and diet chart (NOT yet deployed)
- Owner decisions: chart is a hard filter for every dish ("No recipe found" rather than break it); favourites are inspiration (exact dish or same family, e.g. any biryani, only if it passes the chart); least favourites stay out unless the chart favours that kind of food (then ranked low, with a note); spice is now modelled.
- New cost rule: **run cap $0.05** (`runCostCapUsd`, guard $0.04). Only **$1 API credit** left: do not test with the owner's key; tests and checks run with `ANTHROPIC_API_KEY` unset.
- Code: `lib/planner/chartFit.ts` (chart favour tags), `lib/library/spice.ts` (heat level, typed spice limit), `groups.ts` (chart/spice/least-favourite in `fits`, dish families `inspiredBy`/`dishHead`, chart signature in group key), `schedule.ts` (scoring; no chart waiver; sides kept under calorie ceiling), `chartRead.ts` (`avoidFoods`), `run.ts` (chart foods → word rules with swaps; AI check only on typed rules and only on recipes that pass plain-code filters).
- Library: spice level saved on all 517 recipes (`scripts/backfill-spice.ts`, no AI): none 245, mild 127, medium 94, hot 51.
- Verified: 78 tests pass; real-library check with two profiles found 0 chart/spice/rice breaches.
- Not verified (needs AI): chart-reading of "foods to avoid" and the typed spice/except fields in the live prompts.
- Deploy: `npx vercel deploy --prod --yes` once the owner says so.
- Follow-up (same day), found by reading the owner's real chart (Coach Garbo): "excess oil" would have banned the word "oil" (81% of recipes). Fixed: the reader prompt only takes real foods (not limits or categories); code safety net `enforceableFoodTerms` (lib/planner/chartFit.ts) drops limit words and kitchen staples. Chart may now carry `mealKcal` (lunch/dinner calories from the chart's own options); calorie ceiling factor lowered 1.5 → 1.3. 81 tests pass; real-library run with that chart: 0/28 empty slots, 0 over ceiling. Still unverified: the live AI reading of the chart (needs a call, ~$0.05).
- Noticed, not fixed: library has non-dishes ("Fish Seasoning Spice Mix" served as a main) and some wrong diet tags (e.g. Chickpea and Potato Curry tagged meat). Run `npm run library -- tidy`-style cleanup later.
- Library clean-up done (scripts/clean-library.ts, no AI; backup in library-backups/clean-2026-11-17.json): 3 misnamed dishes renamed (e.g. "Fish Seasoning Spice Mix" → "Spice-Rubbed Pan-Fried Fish"), 4 condiments marked `notADish`, 6 over-strict diet tags corrected, 3 under-strict tags tightened by new words (hot dog, bratwurst, bolognese; kimchi = may contain fish). Tagging prompt now names the dish instead of the sauce. 83 tests pass.
- Library gaps measured 2026-11-17 (usable 513: 423 mains, 90 sides). Healthy, mild mains per diet: vegan 14, vegetarian 20, eggetarian 24 — fewer than the 28 a 2-week plan needs. Bengali 3 mains, Thai 2, Indian fish 2. Queue: 2,542 pages found but unread; 911 pages rejected only for "no video".
- Recipe bank expansion (2026-11-17), owner decisions: keep the video rule; tag in Claude Code chat instead of API credit; no monthly auto job.
  - Scheduled jobs that spend credit are OFF by default (`AUTO_LIBRARY_REFRESH`, `AUTO_PRICE_REFRESH` = on to enable). Daily plan clean-up still runs. **Must deploy before 1 Dec** or the old live code runs the monthly AI tagging.
  - 8 healthy general sites added after testing with the app's reader: Fit Foodie Finds, Clean & Delicious, Ministry of Curry, Kitchen of Debjani (Bengali), Well Plated, Feel Good Foodie, Cookie and Kate, Downshiftology. Rejected: Skinnytaste and Tarla Dalal (no readable sitemap), EatingWell (403), Love and Lemons (no recipe data), and video-poor sites.
  - `scripts/read-all.ts` finds and reads every page (no AI). `scripts/chat-tag.ts export|import|release` = chat tagging; it saves through `saveTagged()` (lib/library/pipeline.ts), the same path API tagging uses, with the same schema check (`lib/library/schemaCheck.ts`). Exported pages sit in candidate state `chat` until imported.
