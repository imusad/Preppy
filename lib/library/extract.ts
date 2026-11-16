// Reads a recipe page in the standard recipe format (schema.org Recipe JSON-LD). Plain code, no AI.
// A page is kept only if it has a link, photo, video, steps, cooking time and ingredients (TECH-5).
import { settings, type SourceConfig } from '@/lib/settings';
import type { RawRecipe } from '@/lib/library/types';

type Json = Record<string, unknown>;

export async function fetchText(url: string, timeoutMs = 20000): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': settings.userAgent, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : '' };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

/** Does the link still open? Used by the monthly refresh. */
export async function linkWorks(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'user-agent': settings.userAgent }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (res.status === 404 || res.status === 410) return false;
    if (res.ok) return true;
    return null; // blocked or temporary error: unknown, keep the recipe
  } catch {
    return null;
  }
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&frac12;/g, '½').replace(/&frac14;/g, '¼').replace(/&frac34;/g, '¾')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

function isType(node: Json, type: string): boolean {
  return asArray(node['@type'] as string | string[]).includes(type);
}

function findRecipe(node: unknown): Json | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n); if (r) return r; }
    return null;
  }
  const obj = node as Json;
  if (isType(obj, 'Recipe')) return obj;
  if (obj['@graph']) return findRecipe(obj['@graph']);
  return null;
}

/** ISO 8601 duration ("PT1H30M") to minutes. */
export function minutes(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

function stepsFrom(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x) return;
    // Split before decoding: decode() turns newlines into spaces.
    const pieces = (t: string) => t.split(/\n+|<br\s*\/?>|<\/p>|<\/li>/i).map(decode).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s));
    if (typeof x === 'string') { pieces(x); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const o = x as Json;
    if (o.itemListElement) walk(o.itemListElement);
    else if (typeof o.text === 'string') pieces(o.text);
    else if (typeof o.name === 'string') pieces(o.name);
  };
  walk(v);
  return out.filter((s) => s.length > 3);
}

function imagesFrom(v: unknown): string[] {
  const out: string[] = [];
  for (const x of asArray(v as unknown)) {
    if (typeof x === 'string') out.push(x);
    else if (x && typeof x === 'object' && typeof (x as Json).url === 'string') out.push((x as Json).url as string);
  }
  return [...new Set(out.filter((u) => /^https?:\/\//.test(u)))].slice(0, 4);
}

export function youtubeIdFrom(text: string): string | null {
  const m = text.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function firstNumber(v: unknown): number | null {
  for (const x of asArray(v as unknown)) {
    const m = String(x).match(/\d+(?:\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

export type ExtractResult = { ok: true; recipe: RawRecipe } | { ok: false; reason: string };

/** Pull a recipe out of a page's HTML. */
export function extractRecipe(html: string, url: string, source: string): ExtractResult {
  let node: Json | null = null;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while (!node && (m = re.exec(html))) {
    try { node = findRecipe(JSON.parse(m[1].trim())); } catch { /* not valid JSON: skip this block */ }
  }
  if (!node) return { ok: false, reason: 'no standard recipe format' };

  const name = decode(String(node.name ?? ''));
  const ingredientLines = asArray(node.recipeIngredient as string[]).map((s) => decode(String(s))).filter(Boolean);
  const stepLines = stepsFrom(node.recipeInstructions);
  const images = imagesFrom(node.image);
  const totalMin = minutes(node.totalTime) ?? ((minutes(node.prepTime) ?? 0) + (minutes(node.cookTime) ?? 0) || null);

  const video = asArray(node.video as Json | Json[])[0];
  const videoFields = video ? [video.embedUrl, video.contentUrl, video.url].filter((x): x is string => typeof x === 'string') : [];
  const youtubeId = youtubeIdFrom(videoFields.join(' ')) ?? youtubeIdFrom(html);
  const videoUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : videoFields.find((u) => /^https?:\/\//.test(u)) ?? null;

  if (!name) return { ok: false, reason: 'no name' };
  if (ingredientLines.length < 2) return { ok: false, reason: 'no ingredients' };
  if (stepLines.length < 1) return { ok: false, reason: 'no steps' };
  if (images.length < 1) return { ok: false, reason: 'no photo' };
  if (!totalMin) return { ok: false, reason: 'no cooking time' };
  if (!videoUrl) return { ok: false, reason: 'no video' };

  const rating = node.aggregateRating as Json | undefined;
  const nutrition = node.nutrition as Json | undefined;
  return {
    ok: true,
    recipe: {
      url, source, name, images, videoUrl, youtubeId, ingredientLines, stepLines, totalMin,
      servings: firstNumber(node.recipeYield),
      kcal: nutrition ? firstNumber(nutrition.calories) : null,
      rating: rating ? firstNumber(rating.ratingValue) : null,
      ratingCount: rating ? firstNumber(rating.ratingCount ?? rating.reviewCount) : null,
      cuisineHint: asArray(node.recipeCuisine as string | string[]).map(String).join(', ') || null,
      categoryHint: asArray(node.recipeCategory as string | string[]).map(String).join(', ') || null,
    },
  };
}

// ---------- Finding recipe pages on a site ----------

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

/** Paths the site asks all crawlers to stay out of. */
function disallowed(robots: string): string[] {
  const out: string[] = [];
  let applies = false;
  for (const line of robots.split(/\r?\n/)) {
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') applies = val === '*';
    else if (applies && key === 'disallow' && val) out.push(val);
  }
  return out;
}

/** Collect up to `limit` recipe page links from a site's sitemaps. */
export async function discoverUrls(src: SourceConfig, limit: number): Promise<string[]> {
  const base = `https://${src.host}`;
  const include = new RegExp(src.include);
  const robots = await fetchText(`${base}/robots.txt`);
  const blocked = robots.ok ? disallowed(robots.text) : [];
  const starts = robots.ok ? [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  const queue = starts.length ? starts : [`${base}/sitemap_index.xml`, `${base}/sitemap.xml`];
  const seen = new Set<string>();
  const found = new Set<string>();
  let fetched = 0;
  while (queue.length && found.size < limit * 3 && fetched < 40) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const res = await fetchText(sm, 30000);
    fetched++;
    if (!res.ok) continue;
    for (const loc of locs(res.text)) {
      if (/\.xml(\.gz)?(\?.*)?$/.test(loc)) {
        // Prefer sitemaps that look like recipe or post lists.
        if (/recipe|post/i.test(loc)) queue.unshift(loc); else if (!/image|video|author|tag|categor|page-sitemap|news/i.test(loc)) queue.push(loc);
      } else if (include.test(loc)) {
        const path = new URL(loc).pathname;
        // Wildcard rules are cut at the first *; a rule that leaves no real prefix is ignored.
        if (!blocked.some((b) => { const prefix = b.replace(/\*.*$/, ''); return prefix.length > 1 && path.startsWith(prefix); })) found.add(loc);
      }
    }
  }
  // Spread the picks across the list so a site is not only its newest or oldest recipes.
  const all = [...found].sort();
  if (all.length <= limit) return all;
  const step = all.length / limit;
  return Array.from({ length: limit }, (_, i) => all[Math.floor(i * step)]);
}
