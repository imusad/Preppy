// Shared passcode gate. One passcode for the household and friends; a signed cookie remembers it.
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'preppy_access';

function secret(): string {
  return process.env.AUTH_SECRET || process.env.PASSCODE || 'preppy-local-dev';
}

function token(): string {
  return createHmac('sha256', secret()).update(`access:${process.env.PASSCODE ?? ''}`).digest('hex');
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** With no PASSCODE set (local development) the gate is open. */
export function gateEnabled(): boolean {
  return Boolean(process.env.PASSCODE);
}

export function passcodeMatches(given: string): boolean {
  return gateEnabled() && same(given.trim(), process.env.PASSCODE as string);
}

export function hasAccess(req: Request): boolean {
  if (!gateEnabled()) return true;
  const cookies = req.headers.get('cookie') ?? '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
  return Boolean(m && same(m[1], token()));
}

export function accessCookie(): string {
  return `${COOKIE}=${token()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}${process.env.VERCEL ? '; Secure' : ''}`;
}

export function denied(): Response {
  return Response.json({ error: 'Passcode needed' }, { status: 401 });
}

/** Scheduled jobs are called by Vercel with this secret. */
export function isCron(req: Request): boolean {
  const s = process.env.CRON_SECRET;
  return Boolean(s) && req.headers.get('authorization') === `Bearer ${s}`;
}
