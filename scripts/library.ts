// Build or top up the recipe library and price table from this computer.
//   npm run library -- status
//   npm run library -- build [target]     find, read and tag recipes until the library reaches the target
//   npm run library -- prices             refresh the Bengaluru price table
import './net';
import { discover, extractPending, tagPending } from '../lib/library/pipeline';
import { fillMissingPrices, refreshPrices } from '../lib/library/prices';
import { candidateCounts, loadPrices, recipeCount } from '../lib/library/store';
import { q } from '../lib/db';
import { cleanName, dishKey } from '../lib/library/dishKey';
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

async function build(target: number, readOnly: boolean, maxUsd = 1) {
  let cost = 0;
  const perSource = Math.ceil((target * 6) / settings.sources.length);
  console.log(`Finding up to ${perSource} recipe pages per site...`);
  console.log(await discover(perSource));
  for (let round = 1; round <= 200; round++) {
    const have = await recipeCount();
    if (have >= target) break;
    if (cost >= maxUsd) { console.log(`Stopped at the spending limit of $${maxUsd}.`); break; }
    const read = await extractPending(100);
    const tagged = readOnly ? { saved: [], rejected: 0, costUsd: 0 } : await tagPending(40, 8);
    cost += tagged.costUsd;
    console.log(`Round ${round}: read ${read.extracted} pages (${read.rejected} unusable), added ${tagged.saved.length} recipes, library ${have + tagged.saved.length}, AI cost so far $${cost.toFixed(2)}`);
    if (read.extracted + read.rejected === 0 && tagged.saved.length + tagged.rejected === 0) { console.log('Nothing left in the queue.'); break; }
  }
  await status();
}

/** Re-clean recipe names already in the library. */
async function tidy() {
  const rows = await q<{ id: string; slim: { name: string; dishKey: string } }>('select id, slim from recipes');
  let changed = 0;
  for (const r of rows) {
    const name = cleanName(r.slim.name);
    if (name === r.slim.name) continue;
    await q('update recipes set name = $2, slim = $3::jsonb where id = $1', [r.id, name, JSON.stringify({ ...r.slim, name, dishKey: dishKey(name) })]);
    changed++;
  }
  console.log('Names tidied:', changed, 'of', rows.length);
}

async function main() {
  const [cmd = 'status', arg, usd] = process.argv.slice(2);
  if (cmd === 'build') await build(Number(arg) || settings.libraryTarget, false, Number(usd) || 1);
  else if (cmd === 'read') await build(Number(arg) || settings.libraryTarget, true); // find and read pages only: no AI, no cost
  else if (cmd === 'tidy') await tidy();
  else if (cmd === 'prices-fill') console.log(await fillMissingPrices(Object.keys((await loadPrices()).prices), Number(arg) || 40, (l) => console.log(l)));
  else if (cmd === 'prices') console.log(await refreshPrices((l) => console.log(l)));
  else await status();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
