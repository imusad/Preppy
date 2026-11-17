import { start } from 'workflow/api';
import { isCron } from '@/lib/auth';
import { priceRefreshDue } from '@/lib/library/prices';
import { sweepExpired } from '@/lib/run';
import { settings } from '@/lib/settings';
import { refreshLibrary, refreshPriceTable } from '@/workflows/maintenance';

// Runs once a day (Vercel schedule). Always clears expired plans (the 24-hour hold promise).
// The monthly library refresh and quarterly price refresh spend API credit, so they only start
// when switched on (AUTO_LIBRARY_REFRESH=on, AUTO_PRICE_REFRESH=on).
export async function GET(req: Request) {
  if (!isCron(req)) return new Response('Unauthorized', { status: 401 });
  await sweepExpired();
  const started: string[] = [];
  if (settings.autoLibraryRefresh && new Date().getUTCDate() === 1) { await start(refreshLibrary, []); started.push('library'); }
  if (settings.autoPriceRefresh && await priceRefreshDue()) { await start(refreshPriceTable, []); started.push('prices'); }
  return Response.json({ ok: true, started });
}
