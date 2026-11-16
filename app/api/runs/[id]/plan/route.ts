import { denied, hasAccess } from '@/lib/auth';
import { collectPlan, deleteHold } from '@/lib/run';

// Only the tab that started the run holds the code needed to collect its plan.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasAccess(req)) return denied();
  const { id } = await ctx.params;
  const plan = await collectPlan(id, req.headers.get('x-run-code') ?? '');
  if (!plan) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(plan, { headers: { 'cache-control': 'no-store' } });
}

// Called after a successful export: the server's copy is deleted.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasAccess(req)) return denied();
  const { id } = await ctx.params;
  const ok = await deleteHold(id, req.headers.get('x-run-code') ?? '');
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
