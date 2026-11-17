// Give every library recipe a spice level (plain code, no AI, no cost).
// Dry run (shows counts and examples): npx tsx --env-file=.env.local scripts/backfill-spice.ts
// Save:                                 npx tsx --env-file=.env.local scripts/backfill-spice.ts --write
import './net';
import { q } from '../lib/db';
import { heatOf, spiceLevelOf, type SpiceLevel } from '../lib/library/spice';
import type { FullRecipe, SlimRecipe } from '../lib/library/types';

async function main() {
  const write = process.argv.includes('--write');
  const rows = await q<{ id: string; slim: SlimRecipe; full_data: FullRecipe }>('select id, slim, full_data from recipes order by id');
  const counts: Record<SpiceLevel, number> = { none: 0, mild: 0, medium: 0, hot: 0 };
  const examples: Record<SpiceLevel, string[]> = { none: [], mild: [], medium: [], hot: [] };
  for (const r of rows) {
    const level = spiceLevelOf(r.full_data.ingredients);
    counts[level]++;
    if (examples[level].length < 12) {
      const heat = r.full_data.ingredients.filter((i) => heatOf(i) > 0).map((i) => `${i.qty ?? '?'} ${i.unit} ${i.name}`.replace(/\s+/g, ' ')).join('; ');
      examples[level].push(`${r.slim.name}${heat ? `  [${heat}]` : ''}`);
    }
    if (write && r.slim.spiceLevel !== level) {
      await q(`update recipes set slim = jsonb_set(slim, '{spiceLevel}', to_jsonb($2::text)) where id = $1`, [r.id, level]);
    }
  }
  console.log(`${rows.length} recipes:`, counts);
  for (const l of Object.keys(examples) as SpiceLevel[]) console.log(`\n--- ${l} ---\n` + examples[l].join('\n'));
  console.log(write ? '\nSaved.' : '\nDry run: nothing saved. Add --write to save.');
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
