import { describe, expect, it } from 'vitest';
import { dishHead, fits, formGroups, inspiredBy } from '@/lib/planner/groups';
import { schedule, type PlannerInput } from '@/lib/planner/schedule';
import { settings } from '@/lib/settings';
import type { Chart, Diet, Person, Setup } from '@/lib/types';
import { library, PRICES, recipe } from './library';

const chart: Chart = { source: 'body', calories: 1900, recipeTypes: [], gramsPerServing: 150, avoid: [], unsure: [], roughEstimate: false, advisory: null };
const person = (name: string, diet: Diet, over: Partial<Person> = {}): Person => ({
  id: name.toLowerCase(), name, budget: 200, diet, restrictions: ['none'], otherRestrictions: [], favourites: ['None'], leastFavourites: ['None'],
  utensils: ['kadhai'], chart, chartAccepted: true, ...over,
});
const setupOf = (people: Person[], over: Partial<Setup['household']> = {}): Setup => ({
  household: { morningMin: 45, eveningMin: 20, lunchCount: 1, dinnerCount: people.length, city: 'Bengaluru', ...over }, people,
});
const none = { typed: {}, aiExcluded: {} };
const input = (setup: Setup, recipes = library()): PlannerInput => ({ setup, recipes, prices: PRICES, extras: none });
const dishes = (d: ReturnType<typeof schedule>) => d.days.flatMap((x) => [...x.lunch, ...x.dinner]);

describe('dish groups', () => {
  const iman = person('Iman', 'Pescatarian');
  it('matching people share a dish', () => {
    expect(formGroups([iman, person('Rohan', 'Pescatarian')], [], none)).toHaveLength(1);
  });
  it('a shared dish uses the higher budget', () => {
    const [g] = formGroups([iman, person('Rohan', 'Pescatarian', { budget: 250 })], [], none);
    expect(g.budget).toBe(250);
  });
  it('six people with different needs get their own groups', () => {
    const diets: Diet[] = ['Vegetarian', 'Eggetarian', 'Pescatarian', 'Non-vegetarian', 'Vegan'];
    const people = [...diets.map((d, i) => person(`P${i}`, d)), person('P5', 'Vegan', { restrictions: ['allergen:peanuts'] })];
    const d = schedule(input(setupOf(people, { lunchCount: 6, morningMin: 400, eveningMin: 200 })));
    expect(d.groupCount).toBe(6);
    // A vegan, peanut-free dish suits all six, so they share one dish.
    expect(d.days[0].dinner).toHaveLength(1);
    expect(d.days[0].dinner[0].who).toHaveLength(6);
  });
});

describe('restrictions', () => {
  it('an allergen tile excludes recipes that contain it or are unsure', () => {
    const [g] = formGroups([person('A', 'Vegan', { restrictions: ['allergen:sesame'] })], [], none);
    expect(fits(g, recipe({ id: 'x', allergens: ['sesame'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'y', allergenUnsure: ['sesame'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'z' })).ok).toBe(true);
  });
  it('a garnish-only dislike keeps the recipe with a note', () => {
    const [g] = formGroups([person('Iman', 'Vegan', { restrictions: ['dislike:coriander'] })], [], none);
    expect(fits(g, recipe({ id: 'x', garnish: ['coriander leaves'] }))).toEqual({ ok: true, notes: ['Skip the coriander garnish for Iman'] });
    expect(fits(g, recipe({ id: 'y', ingredientNames: ['fresh coriander'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'z', ingredientNames: ['coriander powder'] })).ok).toBe(true);
  });
  it('a typed allergy the AI check was unsure of excludes the recipe', () => {
    const p = person('Rohan', 'Vegan', { restrictions: [], otherRestrictions: ['No kiwi'] });
    const [g] = formGroups([p], [], { typed: { rohan: [{ text: 'No kiwi', strict: true, terms: ['kiwi'], noun: 'kiwi' }] }, aiExcluded: { rohan: ['maybe'] } });
    expect(fits(g, recipe({ id: 'maybe' })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'k', garnish: ['kiwi'] })).ok).toBe(false);
  });
  it('a utensil nobody owns rules a recipe out; diet is never relaxed; least favourite wins', () => {
    const [g] = formGroups([person('A', 'Vegetarian', { favourites: ['Rajma chawal'], leastFavourites: ['Rajma chawal'] })], [person('A', 'Vegetarian')], none);
    expect(fits(g, recipe({ id: 'o', utensils: ['oven'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'm', category: 'meat' })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'r', dishKey: 'rajma chawal' })).ok).toBe(false);
  });
});

describe('the 2-week schedule', () => {
  const couple = setupOf([person('Iman', 'Pescatarian'), person('Rohan', 'Non-vegetarian', { budget: 250 })]);
  const draft = schedule(input(couple));

  it('fills 14 days with a main and a side per group', () => {
    expect(draft.days).toHaveLength(14);
    expect(draft.days[0].lunch).toHaveLength(1);
    expect(draft.days[0].dinner).toHaveLength(1);
    expect(draft.days[0].dinner[0].who).toEqual(['Iman', 'Rohan']);
    expect(dishes(draft).every((d) => d.mainId && d.sideId)).toBe(true);
  });
  it('never repeats a main, and a side only after at least 5 days', () => {
    const mains = dishes(draft).map((d) => d.mainId);
    expect(new Set(mains).size).toBe(mains.length);
    const lastDay = new Map<string, number>();
    for (const d of draft.days) for (const x of [...d.lunch, ...d.dinner]) {
      if (!x.sideId) continue;
      if (lastDay.has(x.sideId)) expect(d.day - (lastDay.get(x.sideId) as number)).toBeGreaterThanOrEqual(5);
      lastDay.set(x.sideId, d.day);
    }
  });
  it('gives the same plan for the same setup', () => {
    expect(schedule(input(couple))).toEqual(draft);
  });
  it('uses at least 6 cuisines and never one cuisine more than twice in a row', () => {
    const lib = new Map(library().map((r) => [r.id, r]));
    const solo = schedule(input(setupOf([person('Iman', 'Pescatarian')])));
    const cuisines = dishes(solo).map((d) => lib.get(d.mainId as string)!.cuisine);
    expect(new Set(cuisines).size).toBeGreaterThanOrEqual(6);
    for (let i = 2; i < cuisines.length; i++) expect(cuisines[i] === cuisines[i - 1] && cuisines[i] === cuisines[i - 2]).toBe(false);
  });
  it('an unsplittable dinner is reheated in the evening', () => {
    const only = [recipe({ id: 'stew', totalMin: 30, aheadMin: 30, lastMin: 0 }), recipe({ id: 'lunch', totalMin: 10, aheadMin: 10, lastMin: 0 })];
    const d = schedule(input(setupOf([person('A', 'Vegan')]), only));
    const dinner = d.days[0].dinner[0];
    expect(dinner.mode).toBe('reheat');
    expect(dinner.eveningMin).toBe(5);
  });
  it('relaxes time before budget, and labels it', () => {
    const slow = [recipe({ id: 'slow', totalMin: 49, aheadMin: 49, lastMin: 0 })];
    const d = schedule(input(setupOf([person('A', 'Vegan')], { dinnerCount: 1 }), slow));
    expect(d.days[0].lunch[0].flags.map((f) => f.label)).toContain('Over time window (+4 min)');
  });
  it('marks a slot "No recipe found" rather than break the diet', () => {
    const meatOnly = [recipe({ id: 'm1', category: 'meat' })];
    const d = schedule(input(setupOf([person('A', 'Pescatarian')]), meatOnly));
    expect(d.days[0].lunch[0].mainId).toBeNull();
    expect(d.days[0].lunch[0].flags[0].label).toBe('No recipe found');
  });
  it('never recommends a favourite that breaks the chart; a compliant dish of the same family is used instead', () => {
    const lib = [
      ...library(),
      recipe({ id: 'biryani', name: 'Chicken biryani', dishKey: 'chicken biryani', category: 'meat', healthFlags: ['red meat'] }),
      recipe({ id: 'vegbiryani', name: 'Veg biryani', dishKey: 'veg biryani', category: 'vegetarian' }),
    ];
    const rohan = person('Rohan', 'Non-vegetarian', { favourites: ['Chicken biryani'], chart: { ...chart, avoid: ['red meat'] } });
    const d = schedule(input(setupOf([rohan]), lib));
    expect(dishes(d).some((x) => x.mainId === 'biryani')).toBe(false);
    expect(dishes(d).some((x) => x.mainId === 'vegbiryani')).toBe(true);
    expect(dishes(d).some((x) => x.flags.some((f) => f.kind === 'non_compliant'))).toBe(false);
  });
  it('a missing ingredient price shows "Price unavailable"; a high price shows "Over budget"', () => {
    const lib = [recipe({ id: 'a', priced: [{ item: null, grams: 50 }] })];
    const d = schedule(input(setupOf([person('A', 'Vegan')], { dinnerCount: 1 }), lib));
    expect(d.days[0].lunch[0].flags.map((f) => f.label)).toContain('Price unavailable');
    const pricey = [recipe({ id: 'p', priced: [{ item: 'onion', grams: 10000 }] })];
    const d2 = schedule(input(setupOf([person('A', 'Vegan')], { dinnerCount: 1 }), pricey));
    expect(d2.days[0].lunch[0].flags.map((f) => f.label)).toContain('Over budget (+₹204)');
  });
  it('reports favourites missing from the library for top-up', () => {
    const d = schedule(input(setupOf([person('A', 'Vegan', { favourites: ['Pav bhaji'] })])));
    expect(d.gaps.wanted).toEqual(['pav bhaji']);
  });
});

describe('typed restrictions that rule out a cuisine', () => {
  it('"no Indian spices" keeps every Indian-cuisine recipe out of the plan', () => {
    const p = person('Iman', 'Vegan', { restrictions: [], otherRestrictions: ['No Indian spices'] });
    const indian = ['North Indian', 'South Indian', 'Bengali', 'Other Indian'];
    const extras = { typed: { iman: [{ text: 'No Indian spices', strict: false, terms: ['garam masala'], noun: 'Indian spices', avoidCuisines: indian }] }, aiExcluded: {} };
    const lib = new Map(library().map((r) => [r.id, r]));
    const d = schedule({ setup: setupOf([p]), recipes: library(), prices: PRICES, extras });
    const cuisines = dishes(d).flatMap((x) => [x.mainId, x.sideId]).filter(Boolean).map((id) => lib.get(id as string)!.cuisine);
    expect(cuisines.length).toBeGreaterThan(0);
    expect(cuisines.some((c) => indian.includes(c))).toBe(false);
  });
});

describe('word-list safety checks', () => {
  it('finds anchovies, soybeans, shellfish and yolks', async () => {
    const { scanAllergens } = await import('@/lib/library/wordlist');
    expect(scanAllergens(['4 anchovy fillets'])).toContain('fish');
    expect(scanAllergens(['anchovies, chopped'])).toContain('fish');
    expect(scanAllergens(['1 cup soybeans'])).toContain('soy');
    expect(scanAllergens(['mixed seafood'])).toEqual(expect.arrayContaining(['crustaceans', 'molluscs']));
    expect(scanAllergens(['2 egg yolks'])).toContain('eggs');
  });
  it('"No pork" catches lardons and mortadella', () => {
    const [g] = formGroups([person('A', 'Non-vegetarian', { restrictions: ['avoid:pork'] })], [person('A', 'Non-vegetarian')], none);
    expect(fits(g, recipe({ id: 'l', category: 'meat', ingredientNames: ['smoked lardons'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'm', category: 'meat', ingredientNames: ['mortadella'] })).ok).toBe(false);
  });
});

describe('not a dish', () => {
  it('leaves sauces and dressings on their own out of the plan', () => {
    const [g] = formGroups([person('A', 'Vegetarian')], [person('A', 'Vegetarian')], none);
    expect(fits(g, recipe({ id: 'h', name: 'Easy Hollandaise Sauce', kind: 'side' })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'd', name: 'Lemon Tahini Dressing', kind: 'side' })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'p', name: 'Penne in Tomato Sauce with Basil' })).ok).toBe(true);
  });
});

describe('shared dishes', () => {
  it('cooks separate dishes when no dish suits everyone', () => {
    const lib = [
      ...Array.from({ length: 30 }, (_, i) => recipe({ id: `v${i}`, name: `Mushroom dish ${i}`, dishKey: `mushroom dish ${i}`, category: 'vegan', ingredientNames: ['mushroom', 'onion'], cuisine: ['Italian', 'Thai', 'Mexican'][i % 3] })),
      ...Array.from({ length: 30 }, (_, i) => recipe({ id: `m${i}`, name: `Chicken dish ${i}`, dishKey: `chicken dish ${i}`, category: 'meat', ingredientNames: ['chicken'], cuisine: ['Italian', 'Thai', 'Mexican'][i % 3] })),
    ];
    const vegan = person('Asha', 'Vegan');
    const meatEater = person('Ravi', 'Non-vegetarian', { restrictions: ['dislike:mushrooms'] });
    const d = schedule(input(setupOf([vegan, meatEater], { lunchCount: 2, morningMin: 200, eveningMin: 200 }), lib));
    expect(d.days[0].lunch).toHaveLength(2);
  });
  it('a shared dish uses the higher budget and serves everyone', () => {
    const d = schedule(input(setupOf([person('Iman', 'Pescatarian'), person('Rohan', 'Non-vegetarian', { budget: 250 })], { lunchCount: 2 })));
    expect(d.days[0].lunch[0].servings).toBe(2);
  });
});

describe('the diet chart is a hard filter', () => {
  const flagged = () => library().map((r, i) => (r.kind === 'main' && i % 3 === 0 ? { ...r, healthFlags: ['high fat' as const, 'red meat' as const] } : r));
  it('no dish in the plan carries a flag the chart says to avoid', () => {
    const p = person('Asha', 'Non-vegetarian', { chart: { ...chart, avoid: ['red meat', 'high fat'] } });
    const lib = flagged();
    const byId = new Map(lib.map((r) => [r.id, r]));
    const d = schedule(input(setupOf([p]), lib));
    const picked = dishes(d).flatMap((x) => [x.mainId, x.sideId]).filter((id): id is string => id !== null);
    expect(picked.length).toBeGreaterThan(20);
    expect(picked.every((id) => !byId.get(id)?.healthFlags.length)).toBe(true);
  });
  it('says "No recipe found" rather than serve a recipe that breaks the chart', () => {
    const p = person('Asha', 'Non-vegetarian', { chart: { ...chart, avoid: ['red meat'] } });
    const lib = library().map((r) => ({ ...r, healthFlags: ['red meat' as const] }));
    const d = schedule(input(setupOf([p]), lib));
    expect(dishes(d).every((x) => x.mainId === null && x.flags[0].label === 'No recipe found')).toBe(true);
  });
  it('keeps every meal, side included, under the chart calorie ceiling', () => {
    const p = person('Asha', 'Non-vegetarian', { chart: { ...chart, calories: 1000 } });
    const lib = library();
    const byId = new Map(lib.map((r) => [r.id, r]));
    const ceiling = 1000 * 0.325 * settings.calorieOverFactor;
    const d = schedule(input(setupOf([p]), lib));
    const fed = dishes(d).filter((x) => x.mainId);
    expect(fed.length).toBeGreaterThan(20);
    for (const x of fed) {
      const kcal = (byId.get(x.mainId as string)?.kcal ?? 0) + (x.sideId ? byId.get(x.sideId)?.kcal ?? 0 : 0);
      expect(kcal).toBeLessThanOrEqual(ceiling);
    }
  });
  it('people whose charts differ get separate dish groups; near-identical charts share one', () => {
    const a = person('A', 'Vegetarian');
    const b = person('B', 'Vegetarian', { chart: { ...chart, avoid: ['red meat'] } });
    const c = person('C', 'Vegetarian', { chart: { ...chart, calories: 2000 } });
    expect(formGroups([a, b], [a, b], none)).toHaveLength(2);
    expect(formGroups([a, c], [a, c], none)).toHaveLength(1);
  });
});

describe('chart foods to avoid, with swaps', () => {
  const biryanis = () => [
    ...library(),
    recipe({ id: 'cb', name: 'Chicken biryani', dishKey: 'chicken biryani', category: 'meat', ingredientNames: ['basmati rice', 'chicken'], keyIngredients: ['chicken', 'rice'] }),
    recipe({ id: 'cfb', name: 'Cauliflower rice biryani', dishKey: 'cauliflower rice biryani', category: 'meat', ingredientNames: ['cauliflower rice', 'chicken'], keyIngredients: ['chicken', 'cauliflower'] }),
  ];
  const noRice = { typed: { rohan: [{ text: 'rice', strict: true, terms: ['rice'], except: ['cauliflower rice'], noun: 'rice', avoidCuisines: [], source: 'chart' as const }] }, aiExcluded: {} };
  it('"no rice" on the chart drops biryani with rice but keeps the cauliflower-rice version', () => {
    const rohan = person('Rohan', 'Non-vegetarian', { favourites: ['Biryani'] });
    const d = schedule({ setup: setupOf([rohan]), recipes: biryanis(), prices: PRICES, extras: noRice });
    expect(dishes(d).some((x) => x.mainId === 'cb')).toBe(false);
    expect(dishes(d).some((x) => x.mainId === 'cfb')).toBe(true);
  });
});

describe('spice limits', () => {
  it('"nothing spicy" rules out hot and medium dishes and keeps mild ones; no limit allows all', () => {
    const rules = { typed: { a: [{ text: 'no spicy food', strict: false, terms: [], noun: 'spice', avoidCuisines: [], maxSpice: 'mild' as const }] }, aiExcluded: {} };
    const a = person('A', 'Vegetarian');
    const [limited] = formGroups([a], [a], rules);
    const [open] = formGroups([a], [a], none);
    for (const [level, ok] of [['none', true], ['mild', true], ['medium', false], ['hot', false]] as const) {
      expect(fits(limited, recipe({ id: level, spiceLevel: level })).ok).toBe(ok);
      expect(fits(open, recipe({ id: level, spiceLevel: level })).ok).toBe(true);
    }
  });
  it('a recipe not yet scored for heat is judged by its ingredient names', () => {
    const rules = { typed: { a: [{ text: 'no spicy food', strict: false, terms: [], noun: 'spice', avoidCuisines: [], maxSpice: 'mild' as const }] }, aiExcluded: {} };
    const a = person('A', 'Vegetarian');
    const [g] = formGroups([a], [a], rules);
    expect(fits(g, recipe({ id: 'x', ingredientNames: ['onion', 'green chilli'] })).ok).toBe(false);
    expect(fits(g, recipe({ id: 'y', ingredientNames: ['onion', 'tomato'] })).ok).toBe(true);
  });
});

describe('favourites and least favourites as inspiration', () => {
  it('a favourite names a dish family: any biryani is inspired by "chicken biryani", a generic word is not', () => {
    expect(inspiredBy('chicken biryani', 'chicken biryani')).toBe('exact');
    expect(inspiredBy('millet biryani', 'chicken biryani')).toBe('family');
    expect(inspiredBy('palak paneer', 'chicken biryani')).toBeNull();
    expect(dishHead('chicken biryani')).toBe('biryani');
    expect(dishHead('palak curry')).toBeNull();
    expect(inspiredBy('beans curry', 'palak curry')).toBeNull();
  });
  const dal = recipe({ id: 'dal', name: 'Dal tadka', dishKey: 'dal tadka', keyIngredients: ['dal'], ingredientNames: ['toor dal', 'onion'] });
  const karela = recipe({ id: 'k', name: 'Karela sabzi', dishKey: 'karela sabzi' });
  it('a least favourite stays out unless the diet chart favours that kind of food, then it is allowed with a note', () => {
    const noChart = person('A', 'Vegetarian', { leastFavourites: ['Dal tadka', 'Karela sabzi'] });
    const protein = person('B', 'Vegetarian', { leastFavourites: ['Dal tadka', 'Karela sabzi'], chart: { ...chart, recipeTypes: ['Lean protein'] } });
    const [g0] = formGroups([noChart], [noChart], none);
    const [g1] = formGroups([protein], [protein], none);
    expect(fits(g0, dal).ok).toBe(false);
    const withChart = fits(g1, dal);
    expect(withChart.ok).toBe(true);
    expect(withChart.notes.join(' ')).toMatch(/diet chart, though not a favourite/);
    expect(fits(g1, karela).ok).toBe(false);
  });
  it('a least-favourite dish is ranked behind other options in the plan', () => {
    const protein = person('B', 'Vegetarian', { leastFavourites: ['Dal tadka'], chart: { ...chart, recipeTypes: ['Lean protein'] } });
    const d = schedule(input(setupOf([protein]), [...library(), dal]));
    const at = dishes(d).findIndex((x) => x.mainId === 'dal');
    expect(at === -1 || at > 20).toBe(true);
  });
});

describe('meal calories read from the chart', () => {
  it('a stated lunch/dinner calorie figure is used instead of a share of the daily target', () => {
    const a = person('A', 'Vegetarian', { chart: { ...chart, calories: 1300, mealKcal: 330 } });
    const b = person('B', 'Vegetarian', { chart: { ...chart, calories: 1300 } });
    expect(formGroups([a], [a], none)[0].mealKcal).toBe(330);
    expect(formGroups([b], [b], none)[0].mealKcal).toBe(Math.round(1300 * settings.mealCalorieShare));
  });
});

describe('library clean-up marks', () => {
  it('a recipe marked "not a dish" is never planned', () => {
    const a = person('A', 'Vegetarian');
    const [g] = formGroups([a], [a], none);
    expect(fits(g, recipe({ id: 'c', name: 'Garlic Chutney', notADish: true })).ok).toBe(false);
  });
});
