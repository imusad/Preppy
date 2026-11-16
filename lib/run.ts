// One plan-generation run (PDD MMP-BE-S4 to S6). Each exported step* function is one durable
// step of the workflow. Steps are given only the run id; everything else lives in the run's row,
// which is emptied when the run ends, so names and health details never sit in run history.
import { createHash, randomBytes } from 'node:crypto';
import { askJson, askMany, hasAiKey } from '@/lib/ai';
import { RESTRICTIONS } from '@/lib/data/catalog';
import { INGREDIENT_TERMS } from '@/lib/library/wordlist';
import { kvGet, kvSet, q } from '@/lib/db';
import { extractRecipe, fetchText } from '@/lib/library/extract';
import { tagNow } from '@/lib/library/pipeline';
import { findExtracted, loadFull, loadPrices, loadSlim } from '@/lib/library/store';
import { DIETS_FOR, type RawRecipe, type SlimRecipe } from '@/lib/library/types';
import { mealPeople, type PlannerExtras, type TypedRule } from '@/lib/planner/groups';
import { assemble, schedule } from '@/lib/planner/schedule';
import { CUISINES, settings } from '@/lib/settings';
import type { Plan, RunProgress, Setup } from '@/lib/types';

interface Work {
  extras: PlannerExtras;
  costUsd: number;
  models: Record<string, number>;
  topUps: number;
  topUpRounds: number;
  stepMs: Record<string, number>;
  stepStarted: number;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

async function load(runId: string): Promise<{ setup: Setup; work: Work }> {
  const rows = await q<{ setup: Setup | null; work: Work | null }>('select setup, work from runs where id = $1', [runId]);
  if (!rows[0]?.setup) throw new Error('run not found');
  return {
    setup: rows[0].setup,
    work: rows[0].work ?? { extras: { typed: {}, aiExcluded: {} }, costUsd: 0, models: {}, topUps: 0, topUpRounds: 0, stepMs: {}, stepStarted: Date.now() },
  };
}

async function saveWork(runId: string, work: Work): Promise<void> {
  await q('update runs set work = $2::jsonb, progressed_at = now() where id = $1', [runId, JSON.stringify(work)]);
}

function spend(work: Work, r: { costUsd: number; model: string }): void {
  work.costUsd += r.costUsd;
  work.models[r.model] = (work.models[r.model] ?? 0) + 1;
}

// ---------- Starting, progress, collecting ----------

export class TooManyRuns extends Error {}

export async function createRun(setup: Setup): Promise<{ runId: string; code: string }> {
  const runId = randomBytes(12).toString('hex');
  const code = randomBytes(24).toString('hex');
  // Check and count in one statement, so requests sent at the same moment cannot all slip past the daily limit.
  const ok = await q(
    `insert into run_records (id) select $1 where (select count(*) from run_records where created_at > now() - interval '24 hours') < $2 returning id`,
    [runId, settings.maxRunsPerDay],
  );
  if (ok.length === 0) throw new TooManyRuns();
  const groups = new Set(setup.people.map((p) => `${p.diet}|${p.restrictions.join()}|${p.otherRestrictions.join()}|${p.favourites.join()}|${p.leastFavourites.join()}`)).size;
  const est = settings.estimate.base + settings.estimate.perGroup * groups;
  await q('insert into runs (id, code_hash, setup, est_seconds) values ($1, $2, $3::jsonb, $4)', [runId, hash(code), JSON.stringify(setup), est]);
  return { runId, code };
}

interface RunRow { status: string; step: number; est_seconds: number; started_at: string; progressed_at: string; plan_expires_at: string | null; plan: Plan | null; code_hash: string }

async function runRow(runId: string, code: string): Promise<RunRow | null> {
  const rows = await q<RunRow>('select status, step, est_seconds, started_at, progressed_at, plan_expires_at, plan, code_hash from runs where id = $1', [runId]);
  const row = rows[0];
  if (!row || row.code_hash !== hash(code)) return null; // another browser cannot collect the plan
  return row;
}

export async function getProgress(runId: string, code: string): Promise<RunProgress | null> {
  const row = await runRow(runId, code);
  if (!row) return null;
  if (row.status === 'done') {
    const expired = !row.plan || (row.plan_expires_at !== null && new Date(row.plan_expires_at).getTime() < Date.now());
    return { status: expired ? 'gone' : 'done', step: 3, secondsLeft: 0 };
  }
  if (row.status === 'failed') return { status: 'failed', step: row.step, secondsLeft: 0 };
  const idle = (Date.now() - new Date(row.progressed_at).getTime()) / 1000;
  if (idle > settings.stalledAfterSeconds) return { status: 'stopped', step: row.step, secondsLeft: 0 };
  const elapsed = (Date.now() - new Date(row.started_at).getTime()) / 1000;
  // Never promise less than what the remaining steps usually need.
  const floor = [45, 25, 10, 5][row.step] ?? 5;
  return { status: 'running', step: row.step, secondsLeft: Math.round(Math.max(floor, row.est_seconds - elapsed)) };
}

export async function collectPlan(runId: string, code: string): Promise<Plan | null> {
  const row = await runRow(runId, code);
  if (!row || row.status !== 'done' || !row.plan) return null;
  if (row.plan_expires_at !== null && new Date(row.plan_expires_at).getTime() < Date.now()) {
    await q('update runs set plan = null where id = $1', [runId]);
    return null;
  }
  return row.plan;
}

/** Export succeeded (or the hold expired): delete the server's copy. */
export async function deleteHold(runId: string, code?: string): Promise<boolean> {
  if (code !== undefined && !(await runRow(runId, code))) return false;
  await q('update runs set plan = null, setup = null, work = null where id = $1', [runId]);
  return true;
}

// ---------- Workflow steps ----------

/** Mark the run as still making progress during a long step, so it is not reported as stopped. */
async function touch(runId: string): Promise<void> {
  await q('update runs set progressed_at = now() where id = $1', [runId]);
}

export async function setStep(runId: string, step: number): Promise<void> {
  const rows = await q<{ work: Work | null; step: number }>('select work, step from runs where id = $1', [runId]);
  const work = rows[0]?.work;
  if (work) {
    work.stepMs[`step${rows[0].step}`] = (work.stepMs[`step${rows[0].step}`] ?? 0) + (Date.now() - work.stepStarted);
    work.stepStarted = Date.now();
  }
  await q('update runs set step = $2, work = coalesce($3::jsonb, work), progressed_at = now() where id = $1', [runId, step, work ? JSON.stringify(work) : null]);
}

const RULE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['rules'],
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['text', 'strict', 'terms', 'noun', 'avoidCuisines'],
        properties: {
          text: { type: 'string' }, strict: { type: 'boolean' }, terms: { type: 'array', items: { type: 'string' } }, noun: { type: 'string' },
          avoidCuisines: { type: 'array', items: { type: 'string', enum: CUISINES.filter((c) => c !== 'Other') } },
        },
      },
    },
  },
};

/** Step "Reading your profiles": interpret typed "Other" restrictions (A4). */
export async function stepPrepare(runId: string): Promise<void> {
  const { setup, work } = await load(runId);
  work.stepStarted = Date.now();
  for (const p of setup.people) {
    const typed = p.otherRestrictions.map((t) => t.trim()).filter(Boolean);
    if (typed.length === 0) continue;
    let rules: TypedRule[] | null = null;
    if (hasAiKey()) {
      const ai = await askJson<{ rules: TypedRule[] }>({
        task: 'typed-restrictions', model: settings.models.tagging, schema: RULE_SCHEMA, maxTokens: 1500,
        system: `A household cook typed food restrictions for one person. For each one, return: text (as typed); strict (true if it is an allergy, intolerance, medical or religious restriction, or could be one; false only when it is clearly a taste dislike such as "doesn't like"); terms (every lower-case ingredient word or phrase a recipe might use for it, including Indian names and common forms, for example "brinjal", "eggplant", "aubergine", "baingan"); noun (one short word for it); avoidCuisines (the listed cuisines this entry rules out as a whole, for example "no Indian spices" or "no Indian food" rules out every Indian cuisine, "nothing spicy" rules out none; leave it empty when the entry is about an ingredient). When unsure whether it is strict, say true.`,
        content: typed.map((t) => `- ${t}`).join('\n'),
      });
      spend(work, ai);
      rules = ai.data?.rules ?? null;
    }
    // Without an AI answer, treat every typed entry as strict and match on its own words.
    work.extras.typed[p.id] = rules ?? typed.map((text) => {
      const noun = text.toLowerCase().replace(/\b(no|not|never|doesn't|does not|don't|like|likes|eat|eats|allergic|allergy|to|raw|any)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
      return { text, strict: true, terms: noun ? [noun] : [], noun: noun || text, avoidCuisines: [] };
    });
  }
  // Religious "avoid" tiles (no pork, no beef) also get the AI check, not only the word list.
  for (const p of setup.people) {
    for (const id of p.restrictions) {
      const tile = RESTRICTIONS.find((t) => t.id === id);
      if (!tile || tile.kind !== 'avoid' || !tile.ingredient) continue;
      const terms = INGREDIENT_TERMS[tile.ingredient]?.terms ?? [tile.ingredient];
      work.extras.typed[p.id] = [...(work.extras.typed[p.id] ?? []), { text: tile.label, strict: true, terms, noun: tile.noun ?? tile.ingredient, avoidCuisines: [] }];
    }
  }
  await saveWork(runId, work);
}

const CHECK_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['flagged'],
  properties: { flagged: { type: 'array', items: { type: 'integer' } } },
};

/** Step "Finding recipes", part 1: AI check of every typed restriction over candidate recipes (A5). Unsure = excluded. */
export async function stepCheckTyped(runId: string): Promise<void> {
  const { setup, work } = await load(runId);
  // Dislikes are checked too: a typed dislike such as "no Indian spices" cannot be matched by ingredient words alone.
  const strictPeople = setup.people.filter((p) => (work.extras.typed[p.id] ?? []).length > 0);
  if (strictPeople.length === 0 || !hasAiKey()) return;
  const recipes = await loadSlim();
  for (const p of strictPeople) {
    const rules = work.extras.typed[p.id];
    const avoid = new Set(rules.flatMap((r) => r.avoidCuisines ?? []));
    const pool = recipes.filter((r) => p.diet && DIETS_FOR[r.category].includes(p.diet) && !avoid.has(r.cuisine));
    const chunks: SlimRecipe[][] = [];
    for (let i = 0; i < pool.length; i += 150) chunks.push(pool.slice(i, i + 150));
    const answers = await askMany<{ flagged: number[] }>(chunks.map((chunk) => ({
      task: 'typed-allergy-check', model: settings.models.tagging, schema: CHECK_SCHEMA, maxTokens: 8000,
      system: `You check recipes against a person's food restrictions and dislikes for a household meal planner. Return the numbers of every recipe that goes against any of them: one that contains, or might contain, a restricted item (including hidden sources in sauces, pastes, spice mixes and stocks), or whose flavour or style is what the person asked to avoid (for example "no Indian spices" rules out any dish built on masalas, garam masala, curry powder, turmeric-and-cumin tempering, tandoori or tikka spicing, whatever its cuisine label). If you are unsure about a recipe, include it. A missed item is far worse than a false alarm.`,
      content: `Restrictions and dislikes:\n${rules.map((r) => `- ${r.text}`).join('\n')}\n\nRecipes (cuisine in brackets):\n${chunk.map((r, i) => `${i}. ${r.name} (${r.cuisine}): ${[...r.ingredientNames, ...r.garnish].join(', ')}`).join('\n')}`,
    })), 5);
    const excluded: string[] = [];
    answers.forEach((a, ci) => {
      spend(work, a);
      // A failed check excludes the whole chunk: unsure means excluded.
      if (!a.data) excluded.push(...chunks[ci].map((r) => r.id));
      else for (const i of a.data.flagged) if (chunks[ci][i]) excluded.push(chunks[ci][i].id);
    });
    work.extras.aiExcluded[p.id] = excluded;
    await touch(runId);
  }
  await saveWork(runId, work);
}

async function youtubeFinds(dishes: string[], limit: number): Promise<RawRecipe[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || dishes.length === 0) return [];
  const day = new Date().toISOString().slice(0, 10);
  const quota = (await kvGet<{ day: string; used: number }>('youtube-quota')) ?? { day, used: 0 };
  if (quota.day !== day) { quota.day = day; quota.used = 0; }
  const hosts = settings.sources.map((s) => s.host.replace(/^www\./, ''));
  const out: RawRecipe[] = [];
  for (const dish of dishes) {
    if (out.length >= limit || quota.used >= settings.youtubeDailySearches) break;
    quota.used++;
    try {
      const search = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(`${dish} recipe`)}&key=${key}`, { signal: AbortSignal.timeout(10000) });
      if (!search.ok) continue;
      const ids = ((await search.json()) as { items?: { id?: { videoId?: string } }[] }).items?.map((i) => i.id?.videoId).filter(Boolean).join(',');
      if (!ids) continue;
      const vids = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}&key=${key}`, { signal: AbortSignal.timeout(10000) });
      if (!vids.ok) continue;
      const items = ((await vids.json()) as { items?: { id: string; snippet?: { description?: string }; statistics?: { viewCount?: string; likeCount?: string } }[] }).items ?? [];
      for (const v of items) {
        // The video must link to its written recipe on an approved site.
        const link = (v.snippet?.description ?? '').match(/https?:\/\/[^\s)]+/g)?.find((u) => hosts.some((h) => u.includes(h)));
        if (!link) continue;
        const src = settings.sources.find((s) => link.includes(s.host.replace(/^www\./, '')));
        const page = await fetchText(link);
        if (!page.ok || !src) continue;
        const res = extractRecipe(page.text, link.split('?')[0], src.id);
        if (!res.ok) continue;
        out.push({ ...res.recipe, youtubeId: v.id, videoUrl: `https://www.youtube.com/watch?v=${v.id}`, views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0) });
        break;
      }
    } catch { /* a failed search just means no find for this dish */ }
  }
  await kvSet('youtube-quota', quota);
  return out;
}

/**
 * Step "Finding recipes", part 2: one round of live top-up (A7–A8). Returns true when another
 * round is worth doing. Stops at 30 recipes per run and at the cost guard.
 */
export async function stepTopUp(runId: string): Promise<boolean> {
  const { setup, work } = await load(runId);
  if (!hasAiKey() || work.topUpRounds >= 4) return false;
  const room = settings.topUpMaxRecipes - work.topUps;
  if (room <= 0 || work.costUsd >= settings.runCostGuardUsd) return false;
  work.topUpRounds++;

  const [recipes, { prices }] = await Promise.all([loadSlim(), loadPrices()]);
  const { gaps } = schedule({ setup, recipes, prices, extras: work.extras });
  const short = gaps.shortGroups.reduce((n, g) => n + g.mains + g.sides, 0);
  if (gaps.wanted.length === 0 && short === 0) { await saveWork(runId, work); return false; }

  const batch = Math.min(room, 10);
  const raws: RawRecipe[] = [];
  const seen = new Set<string>();
  const add = (list: { raw: RawRecipe }[]) => { for (const c of list) if (raws.length < batch && !seen.has(c.raw.url)) { seen.add(c.raw.url); raws.push(c.raw); } };
  // Favourite dishes missing from the library come first: pages already read, then YouTube.
  for (const dish of gaps.wanted) add(await findExtracted(dish.split(' ').filter((w) => w.length > 3).slice(0, 2), 2));
  if (raws.length < batch && work.topUpRounds === 1) for (const r of await youtubeFinds(gaps.wanted, batch - raws.length)) if (!seen.has(r.url)) { seen.add(r.url); raws.push(r); }
  if (raws.length < batch && short > 0) add(await findExtracted([], batch - raws.length));
  if (raws.length === 0) { await saveWork(runId, work); return false; }

  await touch(runId);
  const outcome = await tagNow(raws, 6, settings.runCostCapUsd - work.costUsd);
  work.costUsd += outcome.costUsd;
  for (const [m, n] of Object.entries(outcome.models)) work.models[m] = (work.models[m] ?? 0) + n;
  work.topUps += outcome.saved.length;
  await q('update runs set est_seconds = est_seconds + $2 where id = $1', [runId, outcome.saved.length * settings.estimate.perTopUp]);
  await saveWork(runId, work);
  return outcome.saved.length > 0 && work.topUps < settings.topUpMaxRecipes;
}

/** Step "Building your 2 weeks" and costing: plain code. */
export async function stepBuild(runId: string): Promise<void> {
  const { setup, work } = await load(runId);
  const [recipes, table] = await Promise.all([loadSlim(), loadPrices()]);
  const draft = schedule({ setup, recipes, prices: table.prices, extras: work.extras });
  const full = await loadFull(Object.keys(draft.bank));
  const plan = assemble(draft, setup, new Map(recipes.map((r) => [r.id, r])), full, {
    id: runId, createdAt: new Date().toISOString(), pricesChecked: table.checked,
  });
  await q('update runs set plan = $2::jsonb, progressed_at = now() where id = $1', [runId, JSON.stringify(plan)]);
}

/** Put the plan in the 24-hour hold, drop the setup, and write the run record (no personal data). */
export async function stepFinish(runId: string): Promise<void> {
  const rows = await q<{ work: Work | null; plan: Plan | null }>('select work, plan from runs where id = $1', [runId]);
  const work = rows[0]?.work;
  const plan = rows[0]?.plan;
  // No work left means an earlier attempt of this step already wrote the record: do not overwrite it with zeros.
  if (work) {
    work.stepMs.step3 = Date.now() - work.stepStarted;
    await q(
      `update run_records set ai_cost_usd = $2, step_ms = $3::jsonb, topup_count = $4, flag_counts = $5::jsonb, models = $6::jsonb where id = $1`,
      [runId, work.costUsd, JSON.stringify(work.stepMs), work.topUps, JSON.stringify(plan?.counts ?? {}), JSON.stringify(work.models)],
    );
  }
  await q(
    `update runs set status = 'done', step = 3, setup = null, work = null, progressed_at = now(), plan_expires_at = now() + ($2 || ' hours')::interval where id = $1`,
    [runId, String(settings.holdHours)],
  );
}

export async function stepFail(runId: string, where: string): Promise<void> {
  await q(`update runs set status = 'failed', setup = null, work = null, plan = null, progressed_at = now() where id = $1`, [runId]);
  await q('update run_records set failure = $2 where id = $1', [runId, where.slice(0, 200)]);
}

/** Housekeeping: clear anything past its hold time (belt and braces alongside the workflow's own timer). */
export async function sweepExpired(): Promise<void> {
  // A run that died without finishing must not keep the household's details.
  await q(`update runs set status = 'failed', setup = null, work = null, plan = null where status = 'running' and progressed_at < now() - interval '1 hour'`);
  await q(`update runs set plan = null, setup = null, work = null where plan_expires_at < now() and plan is not null`);
  await q(`delete from runs where started_at < now() - interval '3 days'`);
}

export { mealPeople };
