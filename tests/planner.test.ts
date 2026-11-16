import { describe, expect, it } from 'vitest';
import { fits, formGroups } from '@/lib/planner/groups';
import { schedule, type PlannerInput } from '@/lib/planner/schedule';
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
    expect(d.days[0].dinner).toHaveLength(6);
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
    expect(draft.days[0].dinner).toHaveLength(2);
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
  it('keeps a favourite that breaks the chart and flags it', () => {
    const lib = [...library(), recipe({ id: 'biryani', name: 'Chicken biryani', dishKey: 'chicken biryani', category: 'meat', healthFlags: ['red meat'] })];
    const rohan = person('Rohan', 'Non-vegetarian', { favourites: ['Chicken biryani'], chart: { ...chart, avoid: ['red meat'] } });
    const d = schedule(input(setupOf([rohan]), lib));
    const hit = dishes(d).find((x) => x.mainId === 'biryani');
    expect(hit?.flags.map((f) => f.label)).toContain('Non-compliant with diet chart');
    expect(dishes(d).filter((x) => x.flags.some((f) => f.kind === 'non_compliant'))).toHaveLength(1);
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
