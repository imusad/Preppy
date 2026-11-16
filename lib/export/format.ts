// Small formatting helpers shared by the plan screens and the export files.
import type { Flag, FlagKind, Plan, PlanDay, PlanDish, PlanMeal } from '../types';

export type MealKind = 'lunch' | 'dinner';

export const FLAG_KINDS: FlagKind[] = ['non_compliant', 'over_time', 'over_budget', 'no_recipe', 'price_unavailable'];

export const FLAG_SUMMARY_LABEL: Record<FlagKind, string> = {
  non_compliant: 'non-compliant',
  over_time: 'over time',
  over_budget: 'over budget',
  no_recipe: 'no recipe found',
  price_unavailable: 'price unavailable',
};

/** "Iman", "Iman and Rohan", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function costText(n: number | null): string {
  return n === null ? 'Price unavailable' : money(n);
}

/** "Week 1 · ~₹4,850" or "Week 1 · Price unavailable". */
export function weekLabel(plan: Plan, week: 1 | 2): string {
  const c = plan.weekCost[week - 1];
  return `Week ${week} · ${c === null || c === undefined ? 'Price unavailable' : `~${money(c)}`}`;
}

export function dayLabel(d: PlanDay): string {
  return `Day ${d.day} · ${d.dow}`;
}

/** "Prices from Bengaluru · prices checked Nov 2026" (either part may be missing). */
export function pricesLine(plan: Plan): string | null {
  const parts: string[] = [];
  if (plan.priceNote) parts.push(plan.priceNote);
  if (plan.pricesChecked) parts.push(`prices checked ${plan.pricesChecked}`);
  return parts.length ? parts.join(' · ') : null;
}

const FRACTIONS: [number, string][] = [
  [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'],
];

/** A friendly number: 0.5 → "½", 1.5 → "1½", 300 → "300", 0.4 → "0.4". No long decimals. */
export function fmtNumber(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v >= 20) return String(Math.round(v));
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  if (frac < 0.04) return String(whole);
  if (frac > 0.96) return String(whole + 1);
  for (const [f, sym] of FRACTIONS) {
    if (Math.abs(frac - f) < 0.04) return `${whole || ''}${sym}`;
  }
  return String(Math.round(v * 10) / 10);
}

/** Quantity for N servings from a per-serving amount: "1½ tbsp", "300 g", "" when no amount. */
export function fmtQty(qty: number | null, unit: string, servings: number): string {
  const u = unit.trim();
  if (qty === null) return u;
  const num = fmtNumber(qty * servings);
  if (!num) return u;
  return u ? `${num} ${u}` : num;
}

export function servingsText(n: number): string {
  return `for ${n} ${n === 1 ? 'serving' : 'servings'}`;
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list));
}

export function mealWho(meal: PlanMeal, fallback: string[]): string[] {
  const who = uniq(meal.dishes.flatMap((d) => d.who));
  return who.length ? who : fallback;
}

/** Flags of one dish; a dish with no recipe always carries "No recipe found". */
export function dishFlags(dish: PlanDish): Flag[] {
  const out: Flag[] = [];
  for (const f of dish.flags) if (!out.some((o) => o.label === f.label)) out.push(f);
  if (dish.mainId === null && !out.some((f) => f.kind === 'no_recipe')) {
    out.push({ kind: 'no_recipe', label: 'No recipe found', short: 'No recipe found' });
  }
  return out;
}

export function mealFlags(meal: PlanMeal): Flag[] {
  const out: Flag[] = [];
  for (const d of meal.dishes) for (const f of dishFlags(d)) if (!out.some((o) => o.label === f.label)) out.push(f);
  return out;
}

export interface MealTotals {
  /** False when no dish group has a recipe. */
  hasRecipe: boolean;
  totalMin: number;
  morningMin: number;
  eveningMin: number;
  /** null when any dish with a recipe has no price. */
  cost: number | null;
  fun: number;
}

export function mealTotals(meal: PlanMeal): MealTotals {
  const found = meal.dishes.filter((d) => d.mainId !== null);
  const sum = (f: (d: PlanDish) => number) => found.reduce((a, d) => a + f(d), 0);
  return {
    hasRecipe: found.length > 0,
    totalMin: sum((d) => d.totalMin),
    morningMin: sum((d) => d.morningMin),
    eveningMin: sum((d) => d.eveningMin),
    cost: found.length === 0 || found.some((d) => d.cost === null) ? null : sum((d) => d.cost ?? 0),
    fun: found.reduce((a, d) => Math.max(a, d.fun), 0),
  };
}

/** Only http(s) links are ever put into href/src. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

const TINTS = ['#FCE3CF', '#DCEBD4', '#DCE6F8', '#FFF0C2', '#FBE0E6', '#F4F1FB'];

/** A stable soft colour for a recipe placeholder. */
export function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
