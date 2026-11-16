// Print a few library recipes with their tags, for a quality check: npx tsx --env-file=.env.local scripts/sample.ts
import './net';
import { q } from '../lib/db';
import type { SlimRecipe } from '../lib/library/types';

async function main() {
  const rows = await q<{ slim: SlimRecipe }>('select slim from recipes order by md5(id) limit 12');
  for (const { slim: r } of rows) {
    console.log(`${r.name} | ${r.source} | ${r.cuisine} | ${r.kind} | ${r.category} | ${r.totalMin}m (ahead ${r.aheadMin}, last ${r.lastMin}) | ${r.kcal} kcal`);
    console.log(`   allergens: ${r.allergens.join(', ') || '-'} | unsure: ${r.allergenUnsure.join(', ') || '-'} | flags: ${r.healthFlags.join(', ') || '-'} | utensils: ${r.utensils.join(', ') || '-'} | unpriced: ${r.priced.filter((p) => p.item === null).length}/${r.priced.length}`);
  }
  const mix = await q<{ k: string; n: string }>(`select slim->>'category' || ' ' || (slim->>'kind') as k, count(*) as n from recipes group by 1 order by 1`);
  console.log(Object.fromEntries(mix.map((m) => [m.k, Number(m.n)])));
  process.exit(0);
}
main();
