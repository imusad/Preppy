// Tag recipes in a Claude Code chat instead of spending API credit. The result is identical to API tagging:
// the same instructions (TAG_SYSTEM), the same answer format (TAG_SCHEMA) and the same save path (saveTagged).
//
//   npx tsx --env-file=.env.local scripts/chat-tag.ts export 40 [gaps|vegetarian|bengali|fish|sides|any]
//       → library-batches/batch-<time>.json  (recipes to tag; they are set aside so no one tags them twice)
//   Claude writes library-batches/batch-<time>.tags.json:  { "<url>": { "tag": {...TagAnswer}, "ruling"?: {...} } }
//   npx tsx --env-file=.env.local scripts/chat-tag.ts import library-batches/batch-<time>.json
//   npx tsx --env-file=.env.local scripts/chat-tag.ts release library-batches/batch-<time>.json   (put untagged ones back)
import './net';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { q } from '../lib/db';
import { saveTagged } from '../lib/library/pipeline';
import { setCandidate } from '../lib/library/store';
import { allergenDisputes, recipeText, TAG_SCHEMA, TAG_SYSTEM, type TagAnswer } from '../lib/library/tag';
import type { RawRecipe } from '../lib/library/types';
import type { AllergenId } from '../lib/types';
import { schemaErrors, type Schema } from '../lib/library/schemaCheck';

const FOCUS: Record<string, (r: RawRecipe) => number> = {
  vegetarian: (r) => (/\b(paneer|tofu|tempeh|dal|daal|lentil|chana|chickpea|rajma|beans?|moong|quinoa|soya|edamame|egg|eggs)\b/i.test(text(r)) && !MEATFISH.test(text(r)) ? 3 : 0),
  bengali: (r) => (r.source === 'kitchenofdebjani' || /\b(bengali|jhol|bhapa|shorshe|posto|kosha|dalna|chorchori|macher)\b/i.test(r.name) ? 3 : 0),
  fish: (r) => (/\b(fish|salmon|cod|tuna|prawns?|shrimp|rohu|bhetki|hilsa|pomfret|tilapia|mackerel|sardines?)\b/i.test(text(r)) && !/\b(chicken|beef|pork|lamb|mutton)\b/i.test(text(r)) ? 2 : 0),
  sides: (r) => (/\b(salad|raita|poriyal|thoran|sabzi|stir[- ]fry|slaw|roasted|sauteed|greens)\b/i.test(r.name) ? 1 : 0),
};
const MEATFISH = /\b(chicken|beef|pork|lamb|mutton|turkey|bacon|ham|sausage|fish|salmon|shrimp|prawns?|tuna)\b/i;
const text = (r: RawRecipe) => `${r.name} ${r.ingredientLines.join(' ')}`;
const score = (focus: string, r: RawRecipe) => (focus === 'any' ? 1 : focus === 'gaps' ? Object.values(FOCUS).reduce((t, f) => t + f(r), 0) : FOCUS[focus](r));

async function exportBatch(n: number, focus: string) {
  if (focus !== 'any' && focus !== 'gaps' && !FOCUS[focus]) throw new Error(`focus must be one of gaps, any, ${Object.keys(FOCUS).join(', ')}`);
  const rows = await q<{ url: string; source: string; raw: RawRecipe }>("select url, source, raw from candidates where state = 'extracted' and raw is not null");
  const picked = rows.map((x) => ({ ...x, s: score(focus, x.raw) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || (a.url < b.url ? -1 : 1)).slice(0, n);
  const file = `library-batches/batch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({
    instructions: TAG_SYSTEM,
    answerFormat: TAG_SCHEMA,
    recipes: picked.map((x) => ({ url: x.url, source: x.source, text: recipeText(x.raw) })),
  }, null, 1));
  for (const x of picked) await setCandidate(x.url, 'chat');
  console.log(`${picked.length} recipes (focus: ${focus}) written to ${file}. ${rows.length - picked.length} others still waiting.`);
}

async function importBatch(file: string) {
  const batch = JSON.parse(readFileSync(file, 'utf8')) as { recipes: { url: string }[] };
  const tagsFile = file.replace(/\.json$/, '.tags.json');
  if (!existsSync(tagsFile)) throw new Error(`No tags yet: ${tagsFile}`);
  const tags = JSON.parse(readFileSync(tagsFile, 'utf8')) as Record<string, { tag: TagAnswer; ruling?: Partial<Record<AllergenId, 'yes' | 'no' | 'unsure'>> }>;
  let saved = 0, rejected = 0, invalid = 0;
  for (const { url } of batch.recipes) {
    const entry = tags[url];
    if (!entry) continue;
    const errs = schemaErrors(TAG_SCHEMA as Schema, entry.tag);
    const [row] = await q<{ raw: RawRecipe }>('select raw from candidates where url = $1', [url]);
    if (errs.length || !row?.raw) { invalid++; console.log('NOT SAVED (fix and import again):', url, errs.slice(0, 3).join('; ') || 'page not in queue'); continue; }
    // Allergens the word list finds but the tag says "no": only a ruling from the chat may clear them; otherwise "unsure".
    const disputed = allergenDisputes(row.raw, entry.tag);
    const ruling = Object.fromEntries(disputed.map((a) => [a, entry.ruling?.[a] ?? 'unsure']));
    const id = await saveTagged(row.raw, entry.tag, ruling, 'tagged in Claude Code chat');
    if (id) saved++; else rejected++;
  }
  console.log(`Saved ${saved}, rejected ${rejected} (not a usable lunch or dinner), not saved ${invalid}.`);
}

async function release(file: string) {
  const batch = JSON.parse(readFileSync(file, 'utf8')) as { recipes: { url: string }[] };
  let n = 0;
  for (const { url } of batch.recipes) {
    const rows = await q("update candidates set state = 'extracted' where url = $1 and state = 'chat' returning url", [url]);
    n += rows.length;
  }
  console.log(`${n} untagged recipes put back in the queue.`);
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'export') await exportBatch(Number(a) || 40, b || 'gaps');
  else if (cmd === 'import') await importBatch(a);
  else if (cmd === 'release') await release(a);
  else console.log('Use: export <n> [focus] | import <batch file> | release <batch file>');
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
