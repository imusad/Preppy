// Build or top up the recipe library and price table from this computer.
//   npm run library -- status
//   npm run library -- build [target]     find, read and tag recipes until the library reaches the target
//   npm run library -- prices             refresh the Bengaluru price table
import { discover, extractPending, tagPending } from '../lib/library/pipeline';
import { refreshPrices } from '../lib/library/prices';
import { candidateCounts, loadPrices, recipeCount } from '../lib/library/store';
import { q } from '../lib/db';
import { settings } from '../lib/settings';

async function status() {
  const bySource = await q<{ source: string; n: string }>('select source, count(*) as n from recipes group by source order by source');
  const prices = await loadPrices();
  console.log('Recipes in library:', await recipeCount());
  console.log('By source:', Object.fromEntries(bySource.map((r) => [r.source, Number(r.n)])));
  console.log('Queue:', await candidateCounts());
  console.log('Prices:', Object.keys(prices.prices).length, 'items, checked', prices.checked ?? 'never');
  const rejected = await q<{ reason: string; n: string }>(`select reason, count(*) as n from candidates where state = 'rejected' group by reason order by 2 desc limit 8`);
  console.log('Rejected because:', Object.fromEntries(rejected.map((r) => [r.reason, Number(r.n)])));
}

async function build(target: number, readOnly: boolean) {
  let cost = 0;
  const perSource = Math.ceil((target * 2.5) / settings.sources.length);
  console.log(`Finding up to ${perSource} recipe pages per site...`);
  console.log(await discover(perSource));
  for (let round = 1; round <= 200; round++) {
    const have = await recipeCount();
    if (have >= target) break;
    const read = await extractPending(100);
    const tagged = readOnly ? { saved: [], rejected: 0, costUsd: 0 } : await tagPending(60, 8);
    cost += tagged.costUsd;
    console.log(`Round ${round}: read ${read.extracted} pages (${read.rejected} unusable), added ${tagged.saved.length} recipes, library ${have + tagged.saved.length}, AI cost so far $${cost.toFixed(2)}`);
    if (read.extracted + read.rejected === 0 && tagged.saved.length + tagged.rejected === 0) { console.log('Nothing left in the queue.'); break; }
  }
  await status();
}

async function main() {
  const [cmd = 'status', arg] = process.argv.slice(2);
  if (cmd === 'build') await build(Number(arg) || settings.libraryTarget, false);
  else if (cmd === 'read') await build(Number(arg) || settings.libraryTarget, true); // find and read pages only: no AI, no cost
  else if (cmd === 'prices') console.log(await refreshPrices((l) => console.log(l)));
  else await status();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
