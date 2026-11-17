// Find and read every recipe page on the listed sites (no AI, no cost). Keeps the video rule.
//   npx tsx --env-file=.env.local scripts/read-all.ts [siteId,siteId,...]
// Finding uses each site's sitemap; reading turns pages into raw recipes waiting to be tagged.
import './net';
import { discover, extractPending } from '../lib/library/pipeline';
import { candidateCounts } from '../lib/library/store';
import { settings } from '../lib/settings';

async function main() {
  const only = process.argv[2]?.split(',').filter(Boolean) ?? settings.sources.map((s) => s.id);
  for (const id of only) console.log('found', id, JSON.stringify(await discover(5000, id)));
  console.log('Queue before reading:', await candidateCounts());
  for (let round = 1; round <= 400; round++) {
    let r;
    try { r = await extractPending(settings.sources.length * 30); }
    catch (e) { console.log(`round ${round}: connection problem, retrying`, (e as Error).message); await new Promise((x) => setTimeout(x, 15000)); continue; }
    console.log(`round ${round}: kept ${r.extracted}, rejected ${r.rejected}`);
    if (r.extracted + r.rejected === 0) break;
  }
  console.log('Queue after reading:', await candidateCounts());
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
