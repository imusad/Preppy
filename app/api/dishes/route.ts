import { denied, hasAccess } from '@/lib/auth';
import { DISH_GRID, MORE_DISHES } from '@/lib/data/catalog';
import { dishNames } from '@/lib/library/store';

// Favourites search: plain text match against the grid, common dishes and the recipe library (A9).
export async function GET(req: Request) {
  if (!hasAccess(req)) return denied();
  const query = (new URL(req.url).searchParams.get('q') ?? '').toLowerCase().trim();
  if (query.length < 2) return Response.json({ results: [] });
  const words = query.split(/\s+/);
  let library: string[] = [];
  try { library = await dishNames(); } catch { /* library not reachable: built-in names still work */ }
  const all = [...DISH_GRID.flatMap((g) => g.items.map((d) => d.name)), ...MORE_DISHES, ...library];
  const seen = new Set<string>();
  const hits = all.filter((name) => {
    const n = name.toLowerCase();
    if (seen.has(n) || !words.every((w) => n.includes(w))) return false;
    seen.add(n);
    return true;
  });
  hits.sort((a, b) => Number(b.toLowerCase().startsWith(query)) - Number(a.toLowerCase().startsWith(query)) || a.length - b.length);
  return Response.json({ results: hits.slice(0, 12) });
}
