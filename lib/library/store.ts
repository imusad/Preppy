// Reading and writing the recipe library, the candidate queue and the price table.
import { q, kvGet, kvSet } from '@/lib/db';
import type { FullRecipe, RawRecipe, SlimRecipe } from '@/lib/library/types';

export async function saveRecipe(slim: SlimRecipe, full: FullRecipe): Promise<void> {
  await q(
    `insert into recipes (id, url, source, name, slim, full_data, checked_at)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
     on conflict (id) do update set slim = excluded.slim, full_data = excluded.full_data, name = excluded.name, checked_at = now()`,
    [slim.id, full.url, slim.source, slim.name, JSON.stringify(slim), JSON.stringify(full)],
  );
}

export async function loadSlim(): Promise<SlimRecipe[]> {
  const rows = await q<{ slim: SlimRecipe }>('select slim from recipes order by id');
  return rows.map((r) => r.slim);
}

export async function loadFull(ids: string[]): Promise<Map<string, FullRecipe>> {
  const out = new Map<string, FullRecipe>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const marks = chunk.map((_, k) => `$${k + 1}`).join(',');
    const rows = await q<{ full_data: FullRecipe }>(`select full_data from recipes where id in (${marks})`, chunk);
    for (const r of rows) out.set(r.full_data.id, r.full_data);
  }
  return out;
}

export async function recipeCount(): Promise<number> {
  const rows = await q<{ n: number | string }>('select count(*) as n from recipes');
  return Number(rows[0]?.n ?? 0);
}

export async function dishNames(): Promise<string[]> {
  const cached = await kvGet<{ names: string[]; at: number }>('dish-names');
  if (cached && Date.now() - cached.at < 6 * 3600_000) return cached.names;
  const rows = await q<{ name: string }>('select name from recipes order by name');
  const names = [...new Set(rows.map((r) => r.name))];
  await kvSet('dish-names', { names, at: Date.now() });
  return names;
}

export async function deleteRecipe(id: string): Promise<void> {
  await q('delete from recipes where id = $1', [id]);
}

// ---------- Candidate queue (pages found but not yet in the library) ----------

export async function addCandidates(source: string, urls: string[]): Promise<number> {
  let added = 0;
  for (const url of urls) {
    const rows = await q(
      `insert into candidates (url, source) select $1, $2
       where not exists (select 1 from recipes where url = $1)
       on conflict (url) do nothing returning url`,
      [url, source],
    );
    added += rows.length;
  }
  return added;
}

export async function takeCandidates(state: string, limit: number, source?: string): Promise<{ url: string; source: string; raw: RawRecipe | null }[]> {
  return source
    ? q('select url, source, raw from candidates where state = $1 and source = $3 order by url limit $2', [state, limit, source])
    : q('select url, source, raw from candidates where state = $1 order by md5(url) limit $2', [state, limit]);
}

export async function setCandidate(url: string, state: string, opts: { raw?: RawRecipe; reason?: string; batchId?: string } = {}): Promise<void> {
  await q(
    `update candidates set state = $2, raw = coalesce($3::jsonb, raw), reason = $4, batch_id = coalesce($5, batch_id), updated_at = now() where url = $1`,
    [url, state, opts.raw ? JSON.stringify(opts.raw) : null, opts.reason ?? null, opts.batchId ?? null],
  );
}

export async function candidateCounts(): Promise<Record<string, number>> {
  const rows = await q<{ state: string; n: number | string }>('select state, count(*) as n from candidates group by state');
  return Object.fromEntries(rows.map((r) => [r.state, Number(r.n)]));
}

/** Extracted pages whose name contains any of the words: used by live top-up. */
export async function findExtracted(words: string[], limit: number): Promise<{ url: string; source: string; raw: RawRecipe }[]> {
  if (words.length === 0) return q(`select url, source, raw from candidates where state = 'extracted' order by md5(url) limit $1`, [limit]);
  const conds = words.map((_, i) => `lower(raw->>'name') like $${i + 2}`).join(' or ');
  return q(`select url, source, raw from candidates where state = 'extracted' and (${conds}) order by md5(url) limit $1`, [limit, ...words.map((w) => `%${w.toLowerCase()}%`)]);
}

// ---------- Price table ----------

export interface PriceTable { prices: Record<string, number>; checked: string | null }

export async function loadPrices(): Promise<PriceTable> {
  const rows = await q<{ item: string; inr_per_kg: number | string | null; checked_on: string | Date | null }>('select item, inr_per_kg, checked_on from prices');
  const prices: Record<string, number> = {};
  let latest: Date | null = null;
  for (const r of rows) {
    if (r.inr_per_kg !== null) prices[r.item] = Number(r.inr_per_kg);
    if (r.checked_on) { const d = new Date(r.checked_on); if (!latest || d > latest) latest = d; }
  }
  const checked = latest ? latest.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
  return { prices, checked };
}

export async function savePrices(prices: Record<string, number | null>, on: Date): Promise<void> {
  const day = on.toISOString().slice(0, 10);
  for (const [item, price] of Object.entries(prices)) {
    await q(
      `insert into prices (item, inr_per_kg, checked_on) values ($1, $2, $3)
       on conflict (item) do update set inr_per_kg = excluded.inr_per_kg, checked_on = excluded.checked_on`,
      [item, price, day],
    );
  }
}
