// Dish groups, recipe eligibility, fun factor and cost. Plain code, no AI (TECH-2).
import { DISH_GRID, RESTRICTIONS } from '@/lib/data/catalog';
import { MINOR_COST_PER_SERVING_INR } from '@/lib/data/priceItems';
import { DIETS_FOR, type SlimRecipe } from '@/lib/library/types';
import { dishKey } from '@/lib/library/dishKey';
import { INGREDIENT_TERMS, mentions } from '@/lib/library/wordlist';
import { settings, type HealthFlag } from '@/lib/settings';
import type { AllergenId, Diet, Person, Setup } from '@/lib/types';

/** A typed "Other" restriction after it has been interpreted. */
export interface TypedRule {
  text: string;
  /** Allergy or medical: also applies to garnish and to anything the AI check was unsure of. */
  strict: boolean;
  terms: string[];
  /** Word for the garnish note, e.g. "onion". */
  noun: string;
}

export interface PlannerExtras {
  /** Person id → their interpreted typed restrictions. */
  typed: Record<string, TypedRule[]>;
  /** Person id → recipe ids excluded by the AI check of typed allergies (unsure = excluded). */
  aiExcluded: Record<string, string[]>;
}

interface IngredientRule { terms: string[]; except?: string[]; strict: boolean; noun: string; who: string[] }

export interface Group {
  key: string;
  names: string[];
  servings: number;
  diet: Diet;
  /** Rupees per meal per person: the highest in the group. */
  budget: number;
  allergens: AllergenId[];
  rules: IngredientRule[];
  least: string[];
  favourites: string[];
  favCuisines: Set<string>;
  utensils: Set<string>;
  chartAvoid: HealthFlag[];
  /** Calories one lunch or dinner should provide; null when no chart states a target. */
  mealKcal: number | null;
  aiExcluded: Set<string>;
}

const GRID_CUISINE = new Map(DISH_GRID.flatMap((g) => g.items.map((d) => [dishKey(d.name), g.cuisine] as const)));

function real(list: string[]): string[] {
  return list.filter((x) => x.toLowerCase() !== 'none');
}

function personKey(p: Person): string {
  return [
    p.diet, real(p.restrictions).sort().join(','), p.otherRestrictions.map((s) => s.toLowerCase().trim()).sort().join(','),
    real(p.favourites).map(dishKey).sort().join(','), real(p.leastFavourites).map(dishKey).sort().join(','),
  ].join('|');
}

/** People with the same dietary choice, restrictions and preferences share one dish group. */
export function formGroups(people: Person[], household: Person[], extras: PlannerExtras): Group[] {
  const byKey = new Map<string, Person[]>();
  for (const p of people) {
    const k = personKey(p);
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  // One kitchen: a utensil anyone in the household owns is available to every dish.
  const utensils = new Set(household.flatMap((p) => p.utensils));
  return [...byKey.entries()].map(([key, members]) => {
    const first = members[0];
    const names = members.map((m) => m.name);
    const tiles = real(first.restrictions).map((id) => RESTRICTIONS.find((r) => r.id === id)).filter((t) => t !== undefined);
    const rules: IngredientRule[] = [];
    for (const t of tiles) {
      if ((t.kind === 'avoid' || t.kind === 'dislike') && t.ingredient) {
        const def = INGREDIENT_TERMS[t.ingredient] ?? { terms: [t.ingredient] };
        rules.push({ terms: def.terms, except: def.except, strict: t.kind === 'avoid', noun: t.noun ?? t.ingredient, who: names });
      }
    }
    for (const rule of extras.typed[first.id] ?? []) rules.push({ terms: rule.terms, strict: rule.strict, noun: rule.noun, who: names });
    const favourites = real(first.favourites).map(dishKey);
    const targets = members.map((m) => (m.chartAccepted ? m.chart?.calories : null)).filter((c): c is number => typeof c === 'number');
    return {
      key, names, servings: members.length, diet: first.diet as Diet,
      budget: Math.max(...members.map((m) => m.budget ?? 0)),
      allergens: tiles.filter((t) => t.kind === 'allergen' && t.allergen).map((t) => t.allergen as AllergenId),
      rules,
      least: real(first.leastFavourites).map(dishKey),
      favourites,
      favCuisines: new Set(favourites.map((f) => GRID_CUISINE.get(f)).filter((c): c is string => Boolean(c))),
      utensils,
      chartAvoid: [...new Set(members.flatMap((m) => (m.chartAccepted ? (m.chart?.avoid ?? []) : []) as HealthFlag[]))],
      mealKcal: targets.length ? Math.round((targets.reduce((a, b) => a + b, 0) / targets.length) * settings.mealCalorieShare) : null,
      aiExcluded: new Set(members.flatMap((m) => extras.aiExcluded[m.id] ?? [])),
    };
  });
}

/** Does the recipe's dish name contain every word of the wanted dish? */
export function sameDish(recipeKey: string, wanted: string): boolean {
  if (!wanted) return false;
  const stem = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
  const have = new Set(recipeKey.split(' ').map(stem));
  return wanted.split(' ').map(stem).every((w) => have.has(w));
}

export interface Fit { ok: boolean; notes: string[] }

/** Can this group eat this recipe? Diet, utensils and restrictions are never relaxed. */
export function fits(g: Group, r: SlimRecipe): Fit {
  const no = { ok: false, notes: [] };
  if (!DIETS_FOR[r.category].includes(g.diet)) return no;
  if (r.utensils.some((u) => !g.utensils.has(u))) return no;
  if (g.allergens.some((a) => r.allergens.includes(a) || r.allergenUnsure.includes(a))) return no;
  if (g.aiExcluded.has(r.id)) return no;
  if (g.least.some((l) => sameDish(r.dishKey, l))) return no;
  const notes: string[] = [];
  for (const rule of g.rules) {
    if (mentions([...r.ingredientNames, r.name.toLowerCase()], rule.terms, rule.except)) return no;
    if (mentions(r.garnish, rule.terms, rule.except)) {
      if (rule.strict) return no;
      notes.push(`Skip the ${rule.noun} garnish for ${listNames(rule.who)}`);
    }
  }
  return { ok: true, notes };
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Techniques and key ingredients of the group's favourite dishes, to judge what is new to them. */
export function familiarTags(g: Group, recipes: SlimRecipe[]): Set<string> {
  const tags = new Set<string>();
  for (const r of recipes) {
    if (g.favourites.some((f) => sameDish(r.dishKey, f))) {
      r.techniques.forEach((t) => tags.add(t));
      r.keyIngredients.forEach((t) => tags.add(t));
      g.favCuisines.add(r.cuisine);
    }
  }
  return tags;
}

/** Fun factor, 1 to 5. */
export function funFactor(g: Group, r: SlimRecipe, familiar: Set<string>): number {
  const f = settings.fun;
  let score = f.base;
  if (!g.favCuisines.has(r.cuisine)) score += f.newCuisine;
  if ([...r.techniques, ...r.keyIngredients].some((t) => !familiar.has(t))) score += f.newTechniqueOrIngredient;
  if (r.popular) score += f.popular;
  return Math.min(5, score);
}

/** Rupees per serving, or null when any ingredient has no price. */
export function costPerServing(r: SlimRecipe, prices: Record<string, number>): number | null {
  let total = MINOR_COST_PER_SERVING_INR;
  for (const p of r.priced) {
    if (p.item === null) return null;
    const price = prices[p.item];
    if (price === undefined) return null;
    total += (p.grams / 1000) * price;
  }
  return Math.round(total);
}

/** Does the recipe go against the group's diet charts? */
export function breaksChart(g: Group, r: SlimRecipe, sideKcal = 0): boolean {
  if (r.healthFlags.some((f) => g.chartAvoid.includes(f))) return true;
  if (g.mealKcal !== null && r.kcal !== null && r.kcal + sideKcal > g.mealKcal * settings.calorieOverFactor) return true;
  return false;
}

export function mealPeople(setup: Setup): { lunch: Person[]; dinner: Person[] } {
  const n = setup.people.length;
  const clamp = (v: number | null) => Math.max(1, Math.min(n, v ?? n));
  return { lunch: setup.people.slice(0, clamp(setup.household.lunchCount)), dinner: setup.people.slice(0, clamp(setup.household.dinnerCount)) };
}
