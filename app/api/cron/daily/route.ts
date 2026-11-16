import { start } from 'workflow/api';
import { isCron } from '@/lib/auth';
import { priceRefreshDue } from '@/lib/library/prices';
import { sweepExpired } from '@/lib/run';
import { refreshLibrary, refreshPriceTable } from '@/workflows/maintenance';

// Runs once a day (Vercel schedule). Clears expired plans; on the 1st of the month starts the
// library refresh; starts the price refresh when three months have passed.
export async function GET(req: Request) {
  if (!isCron(req)) return new Response('Unauthorized', { status: 401 });
  await sweepExpired();
  const started: string[] = [];
  if (new Date().getUTCDate() === 1) { await start(refreshLibrary, []); started.push('library'); }
  if (await priceRefreshDue()) { await start(refreshPriceTable, []); started.push('prices'); }
  return Response.json({ ok: true, started });
}
