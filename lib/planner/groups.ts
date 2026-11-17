// Dish groups, recipe eligibility, fun factor and cost. Plain code, no AI (TECH-2).
import { DISH_GRID, RESTRICTIONS } from '@/lib/data/catalog';
import { MINOR_COST_PER_SERVING_INR } from '@/lib/data/priceItems';
import { DIETS_FOR, type SlimRecipe } from '@/lib/library/types';
import { dishKey } from '@/lib/library/dishKey';
import { INGREDIENT_TERMS, mentions } from '@/lib/library/wordlist';
import { spiceOf, withinSpice, SPICE_ORDER, type SpiceLevel } from '@/lib/library/spice';
import { chartTagsOf, proteinRich, tagsMet, type ChartTag } from '@/lib/planner/chartFit';
import { settings, type HealthFlag } from '@/lib/settings';
import type { AllergenId, Diet, Person, Setup } from '@/lib/types';

/** A typed "Other" restriction after it has been interpreted. */
export { proteinRich };

export interface TypedRule {
  text: string;
  /** Allergy or medical: also applies to garnish and to anything the AI check was unsure of. */
  strict: boolean;
  terms: string[];
  /** Word for the garnish note, e.g. "onion". */
  noun: string;
  /** Whole cuisines this entry rules out, e.g. "no Indian spices" → the Indian cuisines. */
  avoidCuisines?: string[];
  /** Recipes that contain these are still fine, e.g. "cauliflower rice" for a no-rice rule. */
  except?: string[];
  /** Hottest dish allowed, from "nothing spicy" (mild) or "no chilli" (none). null or missing = no limit. */
  maxSpice?: SpiceLevel | null;
  /** Where it came from: typed by the cook, or read from the diet chart. Chart rules are matched by words only (no AI check). */
  source?: 'typed' | 'chart';
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
  /** A member's chart asks for high or lean protein. */
  wantsProtein: boolean;
  /** Kinds of food the members' charts favour (protein, fibre, low oil...). */
  chartTags: ChartTag[];
  /** Hottest dish allowed for this group; null = no limit. */
  maxSpice: SpiceLevel | null;
  /** Calories one lunch or dinner should provide; null when no chart states a target. */
  mealKcal: number | null;
  aiExcluded: Set<string>;
  avoidCuisines: Set<string>;
}

const GRID_CUISINE = new Map(DISH_GRID.flatMap((g) => g.items.map((d) => [dishKey(d.name), g.cuisine] as const)));

function real(list: string[]): string[] {
  return list.filter((x) => x.toLowerCase() !== 'none');
}

/** Two people share a dish group only when their diet charts ask for the same things. */
function chartKey(p: Person): string {
  const c = p.chartAccepted ? p.chart : null;
  if (!c) return 'nochart';
  return [
    c.calories === null ? '' : Math.round(c.calories / 200) * 200, c.mealKcal ? Math.round(c.mealKcal / 100) * 100 : '',
    [...c.avoid].sort().join(','), [...(c.avoidFoods ?? [])].map((f) => f.toLowerCase().trim()).sort().join(','),
    chartTagsOf(c.recipeTypes).sort().join(','),
  ].join('/');
}

function personKey(p: Person): string {
  return [
    p.diet, chartKey(p), real(p.restrictions).sort().join(','), p.otherRestrictions.map((s) => s.toLowerCase().trim()).sort().join(','),
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
  const utensils = new Set(household.flatMap((p) => p.utensils).filter((u) => u !== 'none'));
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
    for (const rule of extras.typed[first.id] ?? []) {
      if (rule.terms.length) rules.push({ terms: rule.terms, except: rule.except, strict: rule.strict, noun: rule.noun, who: names });
    }
    const spiceLimits = (extras.typed[first.id] ?? []).map((r) => r.maxSpice).filter((m): m is SpiceLevel => Boolean(m));
    const maxSpice = spiceLimits.length ? spiceLimits.reduce((a, b) => (SPICE_ORDER.indexOf(a) <= SPICE_ORDER.indexOf(b) ? a : b)) : null;
    const chartTags = [...new Set(members.flatMap((m) => (m.chartAccepted ? chartTagsOf(m.chart?.recipeTypes ?? []) : [])))];
    const favourites = real(first.favourites).map(dishKey);
    // A meal's calories: what the chart's own lunch/dinner options show, otherwise a share of the daily target.
    const targets = members
      .map((m) => (!m.chartAccepted ? null : m.chart?.mealKcal ?? (typeof m.chart?.calories === 'number' ? m.chart.calories * settings.mealCalorieShare : null)))
      .filter((c): c is number => typeof c === 'number');
    return {
      key, names, servings: members.length, diet: first.diet as Diet,
      budget: Math.max(...members.map((m) => m.budget ?? 0)),
      allergens: tiles.filter((t) => t.kind === 'allergen' && t.allergen).map((t) => t.allergen as AllergenId),
      rules,
      least: real(first.leastFavourites).map(dishKey),
      favourites,
      favCuisines: new Set(favourites.map((f) => GRID_CUISINE.get(f)).filter((c): c is string => Boolean(c))),
      utensils,
      wantsProtein: chartTags.includes('protein'), chartTags, maxSpice,
      chartAvoid: [...new Set(members.flatMap((m) => (m.chartAccepted ? (m.chart?.avoid ?? []) : []) as HealthFlag[]))],
      mealKcal: targets.length ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : null,
      aiExcluded: new Set(members.flatMap((m) => extras.aiExcluded[m.id] ?? [])),
      avoidCuisines: new Set((extras.typed[first.id] ?? []).flatMap((rule) => rule.avoidCuisines ?? [])),
    };
  });
}

/** Does the recipe's dish name contain every word of the wanted dish? */
/** Common spellings of the same word, so a typed favourite still finds its dish. */
const SAME_WORD: Record<string, string> = {
  beetroot: 'beet', biriyani: 'biryani', biriani: 'biryani', briyani: 'biryani', chilly: 'chilli', chili: 'chilli', chille: 'chilli',
  hummous: 'hummus', houmous: 'hummus', humus: 'hummus', croissant: 'croissant', pizzas: 'pizza', spagetti: 'spaghetti', tartufo: 'truffle',
};

export function stemWord(w: string): string {
  const s = w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
  return SAME_WORD[s] ?? SAME_WORD[w] ?? s;
}

/** A dish's core name (words before any bracket, stemmed, sorted), to spot near-duplicate recipes. */
export function coreName(name: string): string {
  return [...new Set(name.toLowerCase().split('(')[0].replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 || /\d/.test(w)).map(stemWord))].sort().join(' ');
}

/** Dishes that are really accompaniments even when tagged as a main. */
export function sideLike(r: SlimRecipe): boolean {
  if (/\b(chutney|thogayal|thuvaiyal|pachadi|podi|raita|pickle|achar)\b/i.test(r.name)) return true;
  if (/\b(salad|slaw|coleslaw|bread|toast|fries|straws|chips|hummus|crisps)\b/i.test(r.name) && !proteinRich(r) && (r.kcal ?? 0) < 400) return true;
  if (r.kcal !== null && r.kcal < 150) return true;
  return r.kcal !== null && r.kcal < 180 && !proteinRich(r);
}

/** Words too general to mark a dish family: "curry" does not make two dishes alike. */
const GENERIC_HEAD = new Set(['curry', 'rice', 'soup', 'salad', 'sabzi', 'sabji', 'masala', 'fry', 'stir', 'bowl', 'wrap', 'roll', 'sandwich', 'gravy', 'stew',
  'mix', 'special', 'style', 'recipe', 'dish', 'bake', 'baked', 'grilled', 'roast', 'roasted', 'dry', 'sauce', 'bites', 'balls', 'veg', 'vegetable', 'with', 'and']);

/** The word that names a dish family: "chicken biryani" → "biryani". null when the name is too general. */
export function dishHead(wanted: string): string | null {
  const words = wanted.split(' ').filter(Boolean).map(stemWord);
  const head = words[words.length - 1];
  return head && head.length > 3 && !GENERIC_HEAD.has(head) ? head : null;
}

/** Is the recipe the wanted dish itself, or from the same dish family (any biryani for "chicken biryani")? */
export function inspiredBy(recipeKey: string, wanted: string): 'exact' | 'family' | null {
  if (sameDish(recipeKey, wanted)) return 'exact';
  const head = dishHead(wanted);
  return head && new Set(recipeKey.split(' ').map(stemWord)).has(head) ? 'family' : null;
}

export function sameDish(recipeKey: string, wanted: string): boolean {
  if (!wanted) return false;
  const have = new Set(recipeKey.split(' ').map(stemWord));
  return wanted.split(' ').map(stemWord).every((w) => have.has(w));
}

export interface Fit { ok: boolean; notes: string[] }

/** Is this recipe a least-favourite dish, or from the same family as one? */
export function isLeast(g: Group, r: SlimRecipe): boolean {
  return g.least.some((l) => inspiredBy(r.dishKey, l) !== null);
}

/** Can this group eat this recipe? Diet, utensils and restrictions are never relaxed. */
export function fits(g: Group, r: SlimRecipe): Fit {
  const no = { ok: false, notes: [] };
  if (r.notADish) return no;
  if (!DIETS_FOR[r.category].includes(g.diet)) return no;
  if (r.utensils.some((u) => !g.utensils.has(u))) return no;
  if (g.allergens.some((a) => r.allergens.includes(a) || r.allergenUnsure.includes(a))) return no;
  if (g.aiExcluded.has(r.id)) return no;
  if (g.avoidCuisines.has(r.cuisine)) return no;
  // A sauce, dressing or dip on its own is not a dish to serve.
  if (/\b(sauce|dressing|dip|marinade|seasoning|spice rub|rub|gravy)( for [a-z ]+)?$/i.test(r.name.replace(/\s*\(.*\)\s*$/, ''))) return no;
  // The diet chart is never relaxed: nothing that goes against it is recommended.
  if (breaksChart(g, r)) return no;
  if (!withinSpice(spiceOf(r), g.maxSpice)) return no;
  const notes: string[] = [];
  // A least-favourite dish (or one like it) is kept out unless the diet chart favours that kind of food.
  if (isLeast(g, r)) {
    if (tagsMet(g.chartTags.filter((t) => t !== 'lowFat' && t !== 'lowSalt' && t !== 'lowSugar'), r).length === 0) return no;
    notes.push('On the diet chart, though not a favourite');
  }
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
