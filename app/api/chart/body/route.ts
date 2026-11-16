import { denied, hasAccess } from '@/lib/auth';
import { chartFromBody, validBody } from '@/lib/chart';
import type { BodyDetails } from '@/lib/types';

// Plain calculation, nothing stored (PDD MMP-BE-S2).
export async function POST(req: Request) {
  if (!hasAccess(req)) return denied();
  const d = (await req.json().catch(() => ({}))) as Partial<BodyDetails>;
  if (!validBody(d)) return Response.json({ error: 'Body details are incomplete or out of range' }, { status: 400 });
  return Response.json({ status: 'ok', chart: chartFromBody(d) });
}
