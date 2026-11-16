// Set aside queued pages from the given sites so a build only spends on the others.
//   npx tsx --env-file=.env.local scripts/park.ts hebbars tasty ...     (park)
//   npx tsx --env-file=.env.local scripts/park.ts --undo                (put everything back in the queue)
import './net';
import { q } from '../lib/db';

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--undo') {
    const r = await q(`update candidates set state = case when raw is null then 'new' else 'extracted' end where state = 'parked' returning url`);
    console.log('Unparked', r.length);
  } else {
    const r = await q(`update candidates set state = 'parked' where state in ('new', 'extracted') and source = any($1) returning url`, [args]);
    console.log('Parked', r.length);
  }
  process.exit(0);
})();
