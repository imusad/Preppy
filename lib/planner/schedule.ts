// Fills 14 days of lunch and dinner (PDD MMP-BE-S5). Plain code: the same setup, library and
// price table always give the same plan.
import type { FullRecipe, SlimRecipe } from '@/lib/library/types';
import {
  breaksChart, costPerServing, familiarTags, fits, formGroups, funFactor, listNames, mealPeople, sameDish,
  type Group, type PlannerExtras,
} from '@/lib/planner/groups';
import { settings } from '@/lib/settings';
import type { Flag, FlagKind, Plan, PlanDay, PlanDish, PlanRecipe, Setup } from '@/lib/types';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type Mode = 'lunch' | 'split' | 'reheat' | 'evening';

interface Candidate {
  r: SlimRecipe;
  fun: number;
  cost: number | null;
  notes: string[];
  isFavourite: boolean;
}

interface GroupPool {
  group: Group;
  mains: Candidate[];
  sides: Candidate[];
}

interface GroupHistory {
  cuisines: string[];
  outside: number;
  favouritesDone: Set<string>;
  lastFavouriteAt: number;
}

/** A dish as chosen by the scheduler, before recipe text is attached. */
export interface DraftDish {
  who: string[];
  servings: number;
  mainId: string | null;
  sideId: string | null;
  noRecipeReason?: string;
  mode: Mode;
  morningMin: number;
  eveningMin: number;
  /** Is the side made in the evening (dinner only)? */
  sideInEvening: boolean;
  cost: number | null;
  fun: number;
  flags: Flag[];
  notes: string[];
}

export interface DraftDay { day: number; lunch: DraftDish[]; dinner: DraftDish[]; morningUsed: number; eveningUsed: number }

export interface Draft {
  days: DraftDay[];
  /** Bank recipe id → who it suits and its fun factor. */
  bank: Record<string, { who: string[]; fun: number; cost: number | null }>;
  usedIds: string[];
  groupCount: number;
  /** Favourite dishes with no recipe in the library, and groups short of recipes: what top-up should look for. */
  gaps: { wanted: string[]; shortGroups: { diet: string; mains: number; sides: number }[] };
}

export interface PlannerInput {
  setup: Setup;
  recipes: SlimRecipe[];
  prices: Record<string, number>;
  extras: PlannerExtras;
}

function flag(kind: FlagKind, n = 0): Flag {
  switch (kind) {
    case 'over_time': return { kind, label: `Over time window (+${n} min)`, short: `+${n} min` };
    case 'over_budget': return { kind, label: `Over budget (+₹${n})`, short: 'Over budget' };
    case 'non_compliant': return { kind, label: 'Non-compliant with diet chart', short: 'Non-compliant' };
    case 'price_unavailable': return { kind, label: 'Price unavailable', short: 'Price unavailable' };
    default: return { kind: 'no_recipe', label: 'No recipe found', short: 'No recipe found' };
  }
}

function buildPools(input: PlannerInput): { lunch: GroupPool[]; dinner: GroupPool[]; all: Map<string, GroupPool> } {
  const { setup, recipes, prices, extras } = input;
  const who = mealPeople(setup);
  const all = new Map<string, GroupPool>();
  const poolsFor = (people: typeof setup.people): GroupPool[] =>
    formGroups(people, setup.people, extras).map((group) => {
      const familiar = familiarTags(group, recipes);
      const mains: Candidate[] = [];
      const sides: Candidate[] = [];
      for (const r of recipes) {
        const fit = fits(group, r);
        if (!fit.ok) continue;
        const c: Candidate = {
          r, notes: fit.notes, fun: funFactor(group, r, familiar), cost: costPerServing(r, prices),
          isFavourite: group.favourites.some((f) => sameDish(r.dishKey, f)),
        };
        if (r.kind === 'main') mains.push(c);
        else if (r.totalMin <= settings.sideMaxMin) sides.push(c);
      }
      const pool = { group, mains, sides };
      // The same group can appear at lunch and dinner with different members; keep the larger one for the bank.
      const seen = all.get(group.key);
      if (!seen || seen.group.names.length < group.names.length) all.set(group.key, pool);
      return pool;
    });
  return { lunch: poolsFor(who.lunch), dinner: poolsFor(who.dinner), all };
}

const INDIAN = new Set(['North Indian', 'South Indian', 'Bengali', 'Other Indian']);
const family = (c: string) => (INDIAN.has(c) ? 'Indian' : c);

/** Work out the 14 days. */
export function schedule(input: PlannerInput): Draft {
  const { setup } = input;
  const morningWin = setup.household.morningMin;
  const eveningWin = setup.household.eveningMin;
  const pools = buildPools(input);
  const used = new Set<string>();
  const history = new Map<string, GroupHistory>();
  const hist = (g: Group): GroupHistory => {
    let h = history.get(g.key);
    if (!h) { h = { cuisines: [], outside: 0, favouritesDone: new Set(), lastFavouriteAt: -10 }; history.set(g.key, h); }
    return h;
  };

  const days: DraftDay[] = [];
  for (let day = 1; day <= settings.days; day++) {
    const state = { morning: 0, evening: 0 };

    const pick = (pool: GroupPool, meal: 'lunch' | 'dinner'): DraftDish => {
      const g = pool.group;
      const h = hist(g);
      const base = { who: g.names, servings: g.servings };
      const freeSides = pool.sides.filter((s) => !used.has(s.r.id));
      const sideReserve = freeSides.length ? Math.min(...freeSides.map((s) => s.r.totalMin)) : 0;
      const sideCostReserve = freeSides.length ? Math.min(...freeSides.map((s) => s.cost ?? 0)) : 0;

      interface Option { c: Candidate; mode: Mode; m: number; e: number; over: number; overBudget: number; score: number; broken: boolean }
      const options: Option[] = [];
      const streak = h.cuisines.slice(-settings.maxSameCuisineInARow);
      const cuisinesSoFar = new Set(h.cuisines);
      const mealNo = h.cuisines.length;

      for (const c of pool.mains) {
        if (used.has(c.r.id)) continue;
        const r = c.r;
        const timings: { mode: Mode; m: number; e: number }[] =
          meal === 'lunch'
            ? [{ mode: 'lunch', m: r.totalMin, e: 0 }]
            : [
                ...(r.lastMin > 0 && r.aheadMin > 0 ? [{ mode: 'split' as Mode, m: r.aheadMin, e: r.lastMin }] : []),
                ...(r.lastMin === 0 ? [{ mode: 'reheat' as Mode, m: r.totalMin, e: settings.reheatMin }] : []),
                { mode: 'evening' as Mode, m: 0, e: r.totalMin },
              ];
        let best: { mode: Mode; m: number; e: number; over: number } | null = null;
        for (const t of timings) {
          // Leave room for the side: in the morning if it fits there, otherwise the evening (dinner only).
          const sideEvening = meal === 'dinner' && state.morning + t.m + sideReserve > morningWin && state.evening + t.e + sideReserve <= eveningWin;
          const m = state.morning + t.m + (sideEvening ? 0 : sideReserve);
          const e = state.evening + t.e + (sideEvening ? sideReserve : 0);
          const over = Math.max(0, m - morningWin) + Math.max(0, e - eveningWin);
          if (!best || over < best.over) best = { ...t, over };
        }
        if (!best) continue;
        const overBudget = c.cost === null ? 0 : Math.max(0, c.cost + sideCostReserve - g.budget);
        const broken = breaksChart(g, r);
        const favouriteDue = c.isFavourite && !g.favourites.every((f) => h.favouritesDone.has(f) || !sameDish(r.dishKey, f));
        const outsideFav = !g.favCuisines.has(r.cuisine);

        let score = c.fun * 3;
        if (favouriteDue && mealNo - h.lastFavouriteAt >= 3) score += 40;
        if (streak.length === settings.maxSameCuisineInARow && streak.every((x) => x === r.cuisine)) score -= 1000;
        if (h.cuisines[h.cuisines.length - 1] === r.cuisine) score -= 3;
        if (!cuisinesSoFar.has(r.cuisine) && cuisinesSoFar.size < settings.minCuisines) score += 6;
        if (outsideFav && h.outside * settings.outsideFavouritesEvery < mealNo + 1) score += 8;
        if (broken) score -= favouriteDue ? 0 : 100;
        if (g.mealKcal !== null && r.kcal !== null) score -= (Math.abs(r.kcal - g.mealKcal * 0.8) / g.mealKcal) * (favouriteDue ? 10 : 4);
        options.push({ c, ...best, overBudget, score, broken });
      }

      if (options.length === 0) {
        const reason = pool.mains.length === 0
          ? `Nothing in the recipe library fits ${listNames(g.names)}'s diet, restrictions and utensils.`
          : `Every recipe that fits ${listNames(g.names)}'s diet is already in the plan.`;
        return { ...base, mainId: null, sideId: null, noRecipeReason: reason, mode: meal === 'lunch' ? 'lunch' : 'evening', morningMin: 0, eveningMin: 0, sideInEvening: false, cost: null, fun: 0, flags: [flag('no_recipe')], notes: [] };
      }

      // Fallback order: everything fits → relax time → relax budget too. Diet is never relaxed.
      const byScore = (a: Option, b: Option) => b.score - a.score || (a.c.r.id < b.c.r.id ? -1 : 1);
      const tierA = options.filter((o) => o.over === 0 && o.overBudget === 0).sort(byScore);
      const tierB = options.filter((o) => o.overBudget === 0).sort((a, b) => a.over - b.over || byScore(a, b));
      const tierC = [...options].sort((a, b) => a.over - b.over || a.overBudget - b.overBudget || byScore(a, b));
      const chosen = tierA[0] ?? tierB[0] ?? tierC[0];
      const main = chosen.c;
      used.add(main.r.id);

      // Side: quick, unused, and as compatible as possible.
      let morning = state.morning + chosen.m;
      let evening = state.evening + chosen.e;
      let side: Candidate | null = null;
      let sideInEvening = false;
      const sideOptions = freeSides
        .map((s) => {
          const inEvening = meal === 'dinner' && morning + s.r.totalMin > morningWin && evening + s.r.totalMin <= eveningWin;
          const over = inEvening ? 0 : Math.max(0, morning + s.r.totalMin - morningWin) - Math.max(0, morning - morningWin);
          const budgetOver = main.cost === null || s.cost === null ? 0 : Math.max(0, main.cost + s.cost - g.budget);
          const match = family(s.r.cuisine) === family(main.r.cuisine) ? 0 : 1;
          return { s, inEvening, over, budgetOver, match };
        })
        .sort((a, b) => a.over - b.over || a.budgetOver - b.budgetOver || a.match - b.match || b.s.fun - a.s.fun || (a.s.r.id < b.s.r.id ? -1 : 1));
      if (sideOptions.length) {
        side = sideOptions[0].s;
        sideInEvening = sideOptions[0].inEvening;
        used.add(side.r.id);
        if (sideInEvening) evening += side.r.totalMin; else morning += side.r.totalMin;
      }

      const flags: Flag[] = [];
      const overNow = Math.max(0, morning - morningWin) + Math.max(0, evening - eveningWin);
      const overBefore = Math.max(0, state.morning - morningWin) + Math.max(0, state.evening - eveningWin);
      if (overNow > overBefore) flags.push(flag('over_time', overNow - overBefore));
      const perServing = main.cost === null || (side && side.cost === null) ? null : main.cost + (side?.cost ?? 0);
      if (perServing === null) flags.push(flag('price_unavailable'));
      else if (perServing > g.budget) flags.push(flag('over_budget', perServing - g.budget));
      if (breaksChart(g, main.r, side?.r.kcal ?? 0)) flags.push(flag('non_compliant'));

      const dish: DraftDish = {
        ...base, mainId: main.r.id, sideId: side?.r.id ?? null, mode: chosen.mode,
        morningMin: morning - state.morning, eveningMin: evening - state.evening, sideInEvening,
        cost: perServing === null ? null : perServing * g.servings,
        fun: main.fun, flags, notes: [...main.notes, ...(side?.notes ?? [])],
      };
      state.morning = morning;
      state.evening = evening;
      h.cuisines.push(main.r.cuisine);
      if (!g.favCuisines.has(main.r.cuisine)) h.outside++;
      if (main.isFavourite) {
        g.favourites.filter((f) => sameDish(main.r.dishKey, f)).forEach((f) => h.favouritesDone.add(f));
        h.lastFavouriteAt = h.cuisines.length - 1;
      }
      return dish;
    };

    const lunch = pools.lunch.map((p) => pick(p, 'lunch'));
    const dinner = pools.dinner.map((p) => pick(p, 'dinner'));
    days.push({ day, lunch, dinner, morningUsed: state.morning, eveningUsed: state.evening });
  }

  // Recipe bank: everything found for this household, most fun first, plan recipes always included.
  const bank: Draft['bank'] = {};
  for (const pool of pools.all.values()) {
    for (const c of [...pool.mains, ...pool.sides]) {
      const b = bank[c.r.id] ?? (bank[c.r.id] = { who: [], fun: 0, cost: c.cost });
      for (const n of pool.group.names) if (!b.who.includes(n)) b.who.push(n);
      b.fun = Math.max(b.fun, c.fun);
    }
  }
  const ranked = Object.keys(bank).sort((a, b) => Number(used.has(b)) - Number(used.has(a)) || bank[b].fun - bank[a].fun || (a < b ? -1 : 1));
  const kept = new Set(ranked.slice(0, Math.max(settings.bankMaxRecipes, used.size)));
  for (const id of Object.keys(bank)) if (!kept.has(id)) delete bank[id];

  const meals = settings.days * 2;
  const wanted = new Set<string>();
  const shortGroups: Draft['gaps']['shortGroups'] = [];
  for (const pool of pools.all.values()) {
    for (const f of pool.group.favourites) {
      if (!pool.group.least.includes(f) && !pool.mains.some((c) => sameDish(c.r.dishKey, f))) wanted.add(f);
    }
    if (pool.mains.length < meals || pool.sides.length < meals) {
      shortGroups.push({ diet: pool.group.diet, mains: Math.max(0, meals - pool.mains.length), sides: Math.max(0, meals - pool.sides.length) });
    }
  }
  return { days, bank, usedIds: [...used], groupCount: pools.all.size, gaps: { wanted: [...wanted], shortGroups } };
}

// ---------- Turning the draft into the plan the screens show ----------

function stepTexts(full: FullRecipe | undefined, when?: 'ahead' | 'last'): string[] {
  if (!full) return [];
  return full.steps.filter((s) => !when || s.when === when).map((s) => s.text);
}

export function assemble(
  draft: Draft, setup: Setup, slim: Map<string, SlimRecipe>, full: Map<string, FullRecipe>,
  meta: { id: string; createdAt: string; pricesChecked: string | null },
): Plan {
  const recipes: Record<string, PlanRecipe> = {};
  for (const [id, b] of Object.entries(draft.bank)) {
    const s = slim.get(id);
    const f = full.get(id);
    if (!s || !f) continue;
    recipes[id] = {
      id, name: s.name, cuisine: s.cuisine, kind: s.kind, source: f.sourceName, sourceUrl: f.url || null,
      image: f.image, images: f.images, videoUrl: f.videoUrl, youtubeId: f.youtubeId,
      totalMin: s.totalMin, ingredients: f.ingredients, steps: f.steps, fun: b.fun, costPerServing: b.cost, who: b.who,
    };
  }

  const toDish = (d: DraftDish, meal: 'lunch' | 'dinner'): PlanDish => {
    const main = d.mainId ? full.get(d.mainId) : undefined;
    const side = d.sideId ? full.get(d.sideId) : undefined;
    const sideSteps = stepTexts(side);
    let morningSteps: string[] = [];
    let eveningSteps: string[] = [];
    let eveningLabel: string | null = null;
    let morningLabel: string | null = null;
    if (d.mainId) {
      if (meal === 'lunch') morningSteps = [...stepTexts(main), ...sideSteps];
      else {
        if (d.mode === 'split') {
          morningSteps = stepTexts(main, 'ahead');
          eveningSteps = stepTexts(main, 'last');
          morningLabel = 'Prep ahead';
        } else if (d.mode === 'reheat') {
          morningSteps = stepTexts(main);
          eveningSteps = ['Reheat and garnish.'];
          morningLabel = 'Cook fully';
        } else {
          eveningSteps = stepTexts(main);
        }
        if (d.sideInEvening) eveningSteps = [...eveningSteps, ...sideSteps]; else morningSteps = [...morningSteps, ...sideSteps];
        if (morningSteps.length && !morningLabel) morningLabel = 'Make the side';
        if (morningLabel) morningLabel = `${morningLabel}, ${d.morningMin} min`;
        eveningLabel = d.mode === 'reheat' && (!side || !d.sideInEvening)
          ? `Reheat + garnish, ${settings.reheatMin} min`
          : `Evening finish: ${d.eveningMin} min`;
      }
    }
    return {
      who: d.who, servings: d.servings, mainId: d.mainId && recipes[d.mainId] ? d.mainId : null,
      sideId: d.sideId && recipes[d.sideId] ? d.sideId : null, noRecipeReason: d.noRecipeReason,
      totalMin: d.morningMin + d.eveningMin, morningMin: d.morningMin, eveningMin: d.eveningMin,
      eveningLabel, morningLabel, morningSteps, eveningSteps, cost: d.cost, fun: d.fun, flags: d.flags, notes: d.notes,
    };
  };

  const days: PlanDay[] = draft.days.map((d) => ({
    day: d.day, dow: DOW[(d.day - 1) % 7], week: d.day <= 7 ? 1 : 2,
    lunch: { dishes: d.lunch.map((x) => toDish(x, 'lunch')) },
    dinner: { dishes: d.dinner.map((x) => toDish(x, 'dinner')) },
    morningUsed: d.morningUsed, morningWindow: setup.household.morningMin,
    eveningUsed: d.eveningUsed, eveningWindow: setup.household.eveningMin,
  }));

  const counts: Record<FlagKind, number> = { non_compliant: 0, over_time: 0, over_budget: 0, no_recipe: 0, price_unavailable: 0 };
  const weekCost: [number | null, number | null] = [null, null];
  for (const day of days) {
    for (const meal of [day.lunch, day.dinner]) {
      const kinds = new Set(meal.dishes.flatMap((x) => x.flags.map((f) => f.kind)));
      kinds.forEach((k) => counts[k]++);
      for (const dish of meal.dishes) if (dish.cost !== null) weekCost[day.week - 1] = (weekCost[day.week - 1] ?? 0) + dish.cost;
    }
  }

  const who = mealPeople(setup);
  const city = setup.household.city;
  return {
    id: meta.id, createdAt: meta.createdAt, days, recipes,
    bankIds: Object.keys(recipes).sort((a, b) => (recipes[a].name < recipes[b].name ? -1 : 1)),
    weekCost, pricesChecked: meta.pricesChecked,
    priceNote: meta.pricesChecked && city !== settings.priceCity ? `Prices from ${settings.priceCity}` : null,
    counts, people: setup.people.map((p) => p.name), lunchWho: who.lunch.map((p) => p.name), dinnerWho: who.dinner.map((p) => p.name),
  };
}
