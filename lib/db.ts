// Database access. On Vercel this is Neon Postgres (DATABASE_URL). On a laptop with no
// DATABASE_URL it falls back to an in-process Postgres stored in .data/ so the app runs offline.
import { neon } from '@neondatabase/serverless';

type Row = Record<string, unknown>;
type Runner = (text: string, params: unknown[]) => Promise<Row[]>;

let runner: Promise<Runner> | null = null;
let schemaReady: Promise<void> | null = null;

async function makeRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = neon(url);
    return async (text, params) => (await sql.query(text, params)) as Row[];
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL is not set');
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PREPPY_LOCAL_DB ?? '.data/pg';
  if (dir !== 'memory') (await import('node:fs')).mkdirSync(dir, { recursive: true });
  const db = dir === 'memory' ? new PGlite() : new PGlite(dir);
  return async (text, params) => (await db.query(text, params as never[])).rows as Row[];
}

const SCHEMA = [
  `create table if not exists recipes (
     id text primary key,
     url text unique not null,
     source text not null,
     name text not null,
     slim jsonb not null,
     full_data jsonb not null,
     checked_at timestamptz not null default now(),
     created_at timestamptz not null default now()
   )`,
  `create table if not exists candidates (
     url text primary key,
     source text not null,
     state text not null default 'new',
     raw jsonb,
     reason text,
     batch_id text,
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists candidates_state on candidates (state)`,
  `create table if not exists prices (
     item text primary key,
     inr_per_kg numeric,
     checked_on date
   )`,
  `create table if not exists kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`,
  `create table if not exists runs (
     id text primary key,
     code_hash text not null,
     status text not null default 'running',
     step int not null default 0,
     setup jsonb,
     work jsonb,
     plan jsonb,
     est_seconds int not null default 180,
     started_at timestamptz not null default now(),
     progressed_at timestamptz not null default now(),
     plan_expires_at timestamptz
   )`,
  `create table if not exists run_records (
     id text primary key,
     created_at timestamptz not null default now(),
     ai_cost_usd numeric not null default 0,
     step_ms jsonb,
     topup_count int not null default 0,
     flag_counts jsonb,
     models jsonb,
     failure text
   )`,
];

async function getRunner(): Promise<Runner> {
  if (!runner) runner = makeRunner();
  const r = await runner;
  if (!schemaReady) {
    schemaReady = (async () => { for (const s of SCHEMA) await r(s, []); })();
    schemaReady.catch(() => { schemaReady = null; });
  }
  await schemaReady;
  return r;
}

/** Run one SQL statement. Pass JSON values as JSON.stringify(x) with a ::jsonb cast. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await getRunner();
  try {
    return (await r(text, params)) as T[];
  } catch (err) {
    // One retry when the connection to the database could not be made at all.
    if (!(err instanceof Error) || !/connecting to database|fetch failed/i.test(err.message)) throw err;
    await new Promise((res) => setTimeout(res, 800));
    return (await r(text, params)) as T[];
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const rows = await q<{ value: T }>('select value from kv where key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await q(
    `insert into kv (key, value, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
