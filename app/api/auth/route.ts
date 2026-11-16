import { accessCookie, gateEnabled, hasAccess, passcodeMatches } from '@/lib/auth';

export async function GET(req: Request) {
  return Response.json({ ok: hasAccess(req) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (gateEnabled() && !passcodeMatches(String(body.passcode ?? ''))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { 'set-cookie': accessCookie() } });
}
