// Library builder stages (PDD MMP-BE-S3): find pages → read them → tag → save.
// Each stage works on the candidate queue, so a stopped build picks up where it left off
// and a failed refresh leaves the existing library untouched.
import { anthropic, askMany, buildParams, costOf, parseAnswer, type AiResult } from '@/lib/ai';
import { q } from '@/lib/db';
import { discoverUrls, extractRecipe, fetchText, linkWorks } from '@/lib/library/extract';
import { addCandidates, deleteRecipe, saveRecipe, setCandidate, takeCandidates } from '@/lib/library/store';
import { allergenDisputes, disputeRequest, finalise, recipeId, tagRequest, type TagAnswer } from '@/lib/library/tag';
import type { RawRecipe } from '@/lib/library/types';
import { settings } from '@/lib/settings';
import type { AllergenId } from '@/lib/types';

const NOT_MEAL = /\b(cake|cookie|cookies|brownie|muffin|cupcake|dessert|pudding|ice cream|kulfi|halwa|ladoo|laddu|barfi|burfi|payasam|kheer|jamun|jalebi|smoothie|milkshake|shake|juice|lassi|cocktail|mocktail|lemonade|tea|chai|coffee|latte|sharbat|frosting|icing|candy|fudge|chocolate|granola|pancake|pancakes|waffle|waffles|jam|syrup|masala powder|spice mix|chutney powder|podi|pickle|achar|cheesecake|tart|donut|doughnut|macaron|truffle|popsicle|sorbet|mousse|custard|cocktails|drink|drinks|biscuit|biscuits|scones|banana bread)\b/i;

/** Obvious sweets, drinks and baking are dropped before any AI is paid for. */
function notAMeal(r: RawRecipe): boolean {
  return NOT_MEAL.test(r.name) || /\b(dessert|desserts|drink|drinks|beverage|beverages|baking|sweets|cocktail)\b/i.test(r.categoryHint ?? '');
}

const sourceName = (id: string) => settings.sources.find((s) => s.id === id)?.name ?? id;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stage 1: collect recipe page links from each approved site. */
export async function discover(perSource: number, only?: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(settings.sources.filter((s) => !only || s.id === only).map(async (src) => {
    const urls = await discoverUrls(src, perSource);
    out[src.id] = await addCandidates(src.id, urls);
  }));
  return out;
}

/** Stage 2: read pages. One request at a time per site, with a pause between requests. */
export async function extractPending(limit: number): Promise<{ extracted: number; rejected: number }> {
  let extracted = 0, rejected = 0;
  await Promise.all(settings.sources.map(async (src) => {
    const todo = await takeCandidates('new', Math.ceil(limit / settings.sources.length), src.id);
    let failures = 0;
    for (const c of todo) {
      if (failures >= 8) break; // the site is refusing us: stop asking
      const page = await fetchText(c.url);
      if (!page.ok) {
        failures++;
        if (page.status === 404 || page.status === 410) { await setCandidate(c.url, 'rejected', { reason: 'page not found' }); rejected++; }
        else await setCandidate(c.url, 'new', { reason: `could not open (${page.status})` });
      } else {
        failures = 0;
        const res = extractRecipe(page.text, c.url, src.id);
        if (res.ok && notAMeal(res.recipe)) { await setCandidate(c.url, 'rejected', { reason: 'not a lunch or dinner recipe' }); rejected++; }
        else if (res.ok) { await setCandidate(c.url, 'extracted', { raw: res.recipe }); extracted++; }
        else { await setCandidate(c.url, 'rejected', { reason: res.reason }); rejected++; }
      }
      await sleep(900);
    }
  }));
  return { extracted, rejected };
}

export interface TagOutcome { saved: string[]; rejected: number; costUsd: number; models: Record<string, number> }

/** Second opinion, allergen ruling and saving for recipes that already have first-pass tags. */
async function settleAndSave(items: { raw: RawRecipe; tag: TagAnswer | null }[], out: TagOutcome): Promise<void> {
  const count = (r: AiResult<unknown>) => { out.costUsd += r.costUsd; out.models[r.model] = (out.models[r.model] ?? 0) + 1; };

  // Sonnet re-tags only the ones the first pass failed on. Recipes the tagger was unsure about keep
  // their tags; the safety checks (allergens, diet category) default to the cautious answer.
  const redo = items.filter((x) => !x.tag);
  const second = await askMany<TagAnswer>(redo.map((x) => tagRequest(x.raw, settings.models.recheck)), 4);
  second.forEach((r, i) => { count(r); if (r.data) redo[i].tag = r.data; });

  // Sonnet settles allergens where the word list and the tagger disagree.
  const disputed = items.map((x) => (x.tag && x.tag.complete ? allergenDisputes(x.raw, x.tag) : [])) as AllergenId[][];
  const asks = items.map((x, i) => ({ x, d: disputed[i] })).filter((p) => p.d.length > 0);
  const rulings = await askMany<Partial<Record<AllergenId, 'yes' | 'no' | 'unsure'>>>(asks.map((p) => disputeRequest(p.x.raw, p.d)), 4);
  const rulingFor = new Map<string, Partial<Record<AllergenId, 'yes' | 'no' | 'unsure'>>>();
  rulings.forEach((r, i) => { count(r); if (r.data) rulingFor.set(asks[i].x.raw.url, r.data); });

  for (const x of items) {
    const done = x.tag ? finalise(x.raw, x.tag, sourceName(x.raw.source), rulingFor.get(x.raw.url)) : { ok: false as const, reason: 'could not be tagged' };
    if (done.ok) {
      await saveRecipe(done.slim, done.full);
      await setCandidate(x.raw.url, 'done');
      out.saved.push(done.slim.id);
    } else {
      await setCandidate(x.raw.url, 'rejected', { reason: done.reason });
      out.rejected++;
    }
  }
}

/** Stage 3 (live): tag these pages now and save the good ones. Used by the first build and by top-up. */
export async function tagNow(raws: RawRecipe[], concurrency = 6): Promise<TagOutcome> {
  const out: TagOutcome = { saved: [], rejected: 0, costUsd: 0, models: {} };
  if (raws.length === 0) return out;
  const first = await askMany<TagAnswer>(raws.map((r) => tagRequest(r)), concurrency);
  first.forEach((r) => { out.costUsd += r.costUsd; out.models[r.model] = (out.models[r.model] ?? 0) + 1; });
  await settleAndSave(raws.map((raw, i) => ({ raw, tag: first[i].data })), out);
  return out;
}

export async function tagPending(limit: number, concurrency = 6): Promise<TagOutcome> {
  const todo = await takeCandidates('extracted', limit);
  return tagNow(todo.map((c) => c.raw).filter((r): r is RawRecipe => r !== null), concurrency);
}

/** Stage 3 (batch, half price): hand pending pages to Anthropic's batch service. Returns the batch id. */
export async function submitTagBatch(limit: number): Promise<string | null> {
  const todo = (await takeCandidates('extracted', limit)).filter((c) => c.raw !== null);
  if (todo.length === 0) return null;
  const batch = await anthropic().messages.batches.create({
    requests: todo.map((c) => ({ custom_id: recipeId(c.url), params: buildParams(tagRequest(c.raw as RawRecipe)) })),
  });
  for (const c of todo) await setCandidate(c.url, 'batched', { batchId: batch.id });
  return batch.id;
}

/** Collect a finished batch. Returns null while the batch is still being worked on. */
export async function collectTagBatch(batchId: string): Promise<TagOutcome | null> {
  const batch = await anthropic().messages.batches.retrieve(batchId);
  if (batch.processing_status !== 'ended') return null;
  const waiting = await q<{ url: string; raw: RawRecipe }>(`select url, raw from candidates where state = 'batched' and batch_id = $1`, [batchId]);
  const byId = new Map(waiting.map((w) => [recipeId(w.url), w.raw]));
  const out: TagOutcome = { saved: [], rejected: 0, costUsd: 0, models: {} };
  const items: { raw: RawRecipe; tag: TagAnswer | null }[] = [];
  for await (const entry of await anthropic().messages.batches.results(batchId)) {
    const raw = byId.get(entry.custom_id);
    if (!raw) continue;
    byId.delete(entry.custom_id);
    if (entry.result.type === 'succeeded') {
      out.costUsd += costOf(settings.models.tagging, entry.result.message.usage) / 2;
      items.push({ raw, tag: parseAnswer<TagAnswer>(entry.result.message) });
    } else {
      items.push({ raw, tag: null });
    }
  }
  out.models[settings.models.tagging] = items.length;
  for (const raw of byId.values()) await setCandidate(raw.url, 'extracted'); // not in the results: try again next time
  await settleAndSave(items, out);
  return out;
}

/** Monthly: remove recipes whose source link no longer opens. Checks the least recently checked first. */
export async function checkLinks(limit: number): Promise<{ checked: number; removed: number }> {
  const rows = await q<{ id: string; url: string }>('select id, url from recipes order by checked_at asc limit $1', [limit]);
  let removed = 0;
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const r = rows[next++];
      const works = await linkWorks(r.url);
      if (works === false) { await deleteRecipe(r.id); removed++; }
      else await q('update recipes set checked_at = now() where id = $1', [r.id]);
      await sleep(400);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  return { checked: rows.length, removed };
}
