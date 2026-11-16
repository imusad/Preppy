import { denied, hasAccess } from '@/lib/auth';
import { getProgress } from '@/lib/run';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasAccess(req)) return denied();
  const { id } = await ctx.params;
  const progress = await getProgress(id, req.headers.get('x-run-code') ?? '');
  if (!progress) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(progress, { headers: { 'cache-control': 'no-store' } });
}
