import './net';
import { q } from '../lib/db';
(async () => {
  const r = await q<{ n: string; c: string; mx: string }>('select count(*) n, coalesce(sum(ai_cost_usd),0) c, coalesce(max(ai_cost_usd),0) mx from run_records');
  console.log('runs', r[0]);
  const kv = await q<{ key: string; value: unknown }>(`select key, value from kv where key in ('price-refresh')`);
  console.log(JSON.stringify(kv));
  const src = await q<{ source: string; n: string }>('select source, count(*) n from recipes group by 1 order by 2 desc');
  console.log(src.map((s) => `${s.source}:${s.n}`).join(' | '));
  const cu = await q<{ c: string; n: string }>(`select slim->>'cuisine' c, count(*) n from recipes group by 1 order by 2 desc`);
  console.log(cu.map((s) => `${s.c}:${s.n}`).join(' | '));
  const cat = await q<{ c: string; n: string }>(`select slim->>'category' c, count(*) n from recipes group by 1 order by 2 desc`);
  console.log(cat.map((s) => `${s.c}:${s.n}`).join(' | '));
  process.exit(0);
})();
