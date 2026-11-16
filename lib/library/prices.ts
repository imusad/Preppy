// Quarterly Bengaluru price table (PDD INT-4, TECH-9, D-019): Haiku with web search, in ingredient
// groups, hard-capped on searches. A refresh that hits the cap or fails keeps the previous table.
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, costOf } from '@/lib/ai';
import { kvGet, kvSet } from '@/lib/db';
import { PRICE_GROUPS } from '@/lib/data/priceItems';
import { savePrices } from '@/lib/library/store';
import { settings } from '@/lib/settings';

const SYSTEM = `You find current retail grocery prices in ${settings.priceCity}, India, for a household meal planner.

For each ingredient in the list, search for its current price on Indian grocery sites that serve ${settings.priceCity} (for example BigBasket, Blinkit, Zepto, Swiggy Instamart, JioMart, Amazon Fresh) and work out the price in rupees per kilogram (per litre for liquids; for eggs, per kilogram assuming 55 g an egg). Use an ordinary everyday product, not premium or organic. Group several ingredients into one search where you can, to keep the number of searches low.

When you have finished, reply with only a JSON object inside a \`\`\`json block, mapping each ingredient name exactly as given to a number (rupees per kilogram), or null if you could not find a trustworthy price. Do not guess.`;

export interface PriceRefreshResult { ok: boolean; priced: number; total: number; searches: number; costUsd: number; reason?: string }

async function priceGroup(items: string[], maxSearches: number, toolType: string): Promise<{ prices: Record<string, number | null>; searches: number; costUsd: number }> {
  const model = settings.models.prices;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `Ingredients:\n${items.map((i) => `- ${i}`).join('\n')}` }];
  let searches = 0, costUsd = 0, text = '';
  for (let turn = 0; turn < 4; turn++) {
    const res = await anthropic().messages.create({
      model, max_tokens: 8000, system: SYSTEM, messages,
      tools: [{ type: toolType, name: 'web_search', max_uses: Math.max(1, maxSearches - searches), user_location: { type: 'approximate', city: 'Bengaluru', country: 'IN' } } as unknown as Anthropic.ToolUnion],
    });
    const used = (res.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
    searches += used;
    costUsd += costOf(model, res.usage, used);
    text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }
  const m = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const parsed = m ? (JSON.parse(m[1]) as Record<string, unknown>) : {};
  const prices: Record<string, number | null> = {};
  for (const item of items) {
    const v = parsed[item];
    prices[item] = typeof v === 'number' && v > 0 && v < 20000 ? Math.round(v) : null;
  }
  return { prices, searches, costUsd };
}

interface Partial { prices: Record<string, number | null>; searches: number; costUsd: number; toolType: string; failed?: string }

const TOTAL = PRICE_GROUPS.reduce((n, g) => n + g.items.length, 0);

/** Price one ingredient group (one workflow step). Group 0 starts a fresh refresh. */
export async function priceGroupStep(index: number): Promise<string> {
  const fresh: Partial = { prices: {}, searches: 0, costUsd: 0, toolType: 'web_search_20260209' };
  const part = index === 0 ? fresh : (await kvGet<Partial>('price-partial')) ?? fresh;
  const g = PRICE_GROUPS[index];
  if (part.failed) return part.failed;
  const left = settings.priceSearchCap - part.searches;
  if (left <= 0) {
    part.failed = 'search cap reached; previous table kept';
  } else {
    const budget = Math.min(Math.floor(settings.priceSearchCap / PRICE_GROUPS.length), left);
    try {
      let res;
      try {
        res = await priceGroup(g.items, budget, part.toolType);
      } catch (err) {
        if (!(err instanceof Anthropic.BadRequestError) || part.toolType === 'web_search_20250305') throw err;
        part.toolType = 'web_search_20250305'; // this model takes the earlier version of the search tool
        res = await priceGroup(g.items, budget, part.toolType);
      }
      Object.assign(part.prices, res.prices);
      part.searches += res.searches;
      part.costUsd += res.costUsd;
    } catch (err) {
      part.failed = `failed: ${err instanceof Error ? err.message : 'unknown error'}; previous table kept`;
    }
  }
  await kvSet('price-partial', part);
  return part.failed ?? `${g.group}: ${g.items.filter((i) => part.prices[i] != null).length}/${g.items.length} priced, ${part.searches} searches so far`;
}

/** Save the new table if the refresh completed; otherwise keep the previous one. Records the cost either way. */
export async function finishPrices(): Promise<PriceRefreshResult> {
  const part = (await kvGet<Partial>('price-partial')) ?? { prices: {}, searches: 0, costUsd: 0, toolType: '', failed: 'no refresh in progress' };
  const priced = Object.values(part.prices).filter((p) => p !== null).length;
  let result: PriceRefreshResult;
  if (part.failed) result = { ok: false, priced: 0, total: TOTAL, searches: part.searches, costUsd: part.costUsd, reason: part.failed };
  else if (priced < TOTAL / 2) result = { ok: false, priced, total: TOTAL, searches: part.searches, costUsd: part.costUsd, reason: 'too few prices found; previous table kept' };
  else {
    await savePrices(part.prices, new Date());
    result = { ok: true, priced, total: TOTAL, searches: part.searches, costUsd: part.costUsd };
  }
  await kvSet('price-refresh', { ...result, at: new Date().toISOString() });
  return result;
}

export async function refreshPrices(log: (line: string) => void = () => {}): Promise<PriceRefreshResult> {
  for (let i = 0; i < PRICE_GROUPS.length; i++) log(await priceGroupStep(i));
  return finishPrices();
}

/** Is a refresh due (none yet, or the last good one is older than the refresh interval)? */
export async function priceRefreshDue(): Promise<boolean> {
  const last = await kvGet<{ ok: boolean; at: string }>('price-refresh');
  if (!last || !last.ok) return true;
  const months = (Date.now() - new Date(last.at).getTime()) / (30 * 86400_000);
  return months >= settings.priceRefreshMonths;
}
