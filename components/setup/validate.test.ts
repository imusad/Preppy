import { describe, expect, it } from 'vitest';
import type { Chart, Person, Setup } from '../../lib/types';
import {
  addOtherRestriction, blankPerson, blankSetup, bothListsNote, copyPerson, dishesInBoth, mealForLine,
  missingItems, missingText, personMissing, pickRestriction, toggleWithNone,
} from './validate';

const chart: Chart = {
  source: 'upload', fileName: 'diet-chart.pdf', calories: 1900, recipeTypes: ['Lean protein'],
  gramsPerServing: 150, avoid: [], unsure: [], roughEstimate: false, advisory: null,
};

function iman(): Person {
  return {
    ...blankPerson(),
    name: 'Iman', budget: 200, diet: 'Pescatarian',
    restrictions: ['dislike:coriander'], otherRestrictions: ['No raw onion'],
    favourites: ['Goan fish curry', 'Kerala fish curry'], leastFavourites: ['Karela sabzi'],
    utensils: ['non-stick-pan', 'pressure-cooker'],
    chart, chartAccepted: true, chartDraft: { step: 'review' },
  };
}

function fullSetup(): Setup {
  return {
    household: { morningMin: 45, eveningMin: 20, lunchCount: 1, dinnerCount: 1, city: 'Kolkata' },
    people: [iman()],
  };
}

describe('defaults', () => {
  it('pre-fills the cooking windows with 45 and 20 minutes', () => {
    const s = blankSetup();
    expect(s.household.morningMin).toBe(45);
    expect(s.household.eveningMin).toBe(20);
    expect(s.people).toHaveLength(1);
  });

  it('gives every new person a different id', () => {
    expect(blankPerson().id).not.toBe(blankPerson().id);
  });
});

describe('missingItems', () => {
  it('is empty for a complete setup', () => {
    expect(missingItems(fullSetup())).toEqual([]);
  });

  it('lists a blank setup in page order', () => {
    const s = blankSetup();
    const items = missingItems(s);
    expect(items.map((m) => m.field)).toEqual([
      'city', 'lunchCount', 'dinnerCount',
      'name', 'budget', 'diet', 'restrictions', 'favourites', 'leastFavourites', 'utensils', 'chart',
    ]);
    expect(items.slice(0, 3).every((m) => m.personId === null)).toBe(true);
    expect(items.slice(3).every((m) => m.personId === s.people[0].id)).toBe(true);
  });

  it('flags only the city when every other household field is filled', () => {
    const s = fullSetup();
    s.household.city = null;
    expect(missingItems(s).map((m) => m.field)).toEqual(['city']);
  });

  it('counts no least favourites and an unaccepted chart as 2 things missing', () => {
    const p = { ...iman(), leastFavourites: [], chartAccepted: false };
    expect(personMissing(p)).toEqual(['leastFavourites', 'chart']);
    expect(missingText(personMissing(p).length)).toBe('2 things missing');
  });

  it('counts 3 things across household and people', () => {
    const s = fullSetup();
    s.household.city = null;
    s.people.push({ ...iman(), id: 'second', name: 'Rohan', utensils: [], chart: null, chartAccepted: false });
    s.household.dinnerCount = 2;
    const items = missingItems(s);
    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({ personId: 'second', field: 'utensils', label: 'Rohan: Utensils' });
  });

  it('treats a chart under review as missing until it is accepted', () => {
    const s = fullSetup();
    s.people[0].chartAccepted = false;
    expect(missingItems(s).map((m) => m.field)).toEqual(['chart']);
  });

  it('needs meal counts of at least 1, and a profile for everyone counted', () => {
    const s = fullSetup();
    s.household.lunchCount = 2;
    s.household.dinnerCount = 0;
    expect(missingItems(s).map((m) => m.field)).toEqual(['dinnerCount', 'people']);
  });

  it('accepts None and typed entries as answers', () => {
    const s = fullSetup();
    s.people[0] = { ...s.people[0], restrictions: [], otherRestrictions: ['No raw onion'], favourites: ['None'], leastFavourites: ['None'] };
    expect(missingItems(s)).toEqual([]);
    s.people[0] = { ...s.people[0], restrictions: ['none'], otherRestrictions: [] };
    expect(missingItems(s)).toEqual([]);
  });

  it('words the count', () => {
    expect(missingText(0)).toBe('Complete');
    expect(missingText(1)).toBe('1 thing missing');
    expect(missingText(3)).toBe('3 things missing');
  });
});

describe('None clears the others', () => {
  it('picking None leaves only None', () => {
    const next = pickRestriction(
      { restrictions: ['allergen:peanuts', 'dislike:mustard'], otherRestrictions: ['No raw onion'] }, 'none');
    expect(next).toEqual({ restrictions: ['none'], otherRestrictions: [] });
  });

  it('picking another tile clears None', () => {
    const next = pickRestriction({ restrictions: ['none'], otherRestrictions: [] }, 'allergen:milk');
    expect(next.restrictions).toEqual(['allergen:milk']);
  });

  it('tapping a picked tile again removes it', () => {
    expect(pickRestriction({ restrictions: ['allergen:milk'], otherRestrictions: [] }, 'allergen:milk').restrictions).toEqual([]);
    expect(pickRestriction({ restrictions: ['none'], otherRestrictions: [] }, 'none').restrictions).toEqual([]);
  });

  it('a typed restriction is added and clears None', () => {
    const next = addOtherRestriction({ restrictions: ['none'], otherRestrictions: [] }, '  No raw onion ');
    expect(next).toEqual({ restrictions: [], otherRestrictions: ['No raw onion'] });
    expect(addOtherRestriction(next, 'no raw ONION').otherRestrictions).toEqual(['No raw onion']);
    expect(addOtherRestriction(next, '   ')).toBe(next);
  });

  it('works for dish lists too', () => {
    expect(toggleWithNone(['Chole', 'Falafel'], 'None', 'None')).toEqual(['None']);
    expect(toggleWithNone(['None'], 'Chole', 'None')).toEqual(['Chole']);
    expect(toggleWithNone(['Chole'], 'Falafel', 'None')).toEqual(['Chole', 'Falafel']);
  });
});

describe('copyPerson', () => {
  it('copies everything except name, dietary choice and diet chart', () => {
    const src = iman();
    const copy = copyPerson(src);
    expect(copy.budget).toBe(200);
    expect(copy.restrictions).toEqual(src.restrictions);
    expect(copy.otherRestrictions).toEqual(src.otherRestrictions);
    expect(copy.favourites).toEqual(src.favourites);
    expect(copy.leastFavourites).toEqual(src.leastFavourites);
    expect(copy.utensils).toEqual(src.utensils);
    expect(copy.diet).toBeNull();
    expect(copy.chart).toBeNull();
    expect(copy.chartAccepted).toBe(false);
    expect(copy.chartDraft).toBeUndefined();
    expect(copy.name).toBe('');
    expect(copy.id).not.toBe(src.id);
    expect(personMissing(copy)).toEqual(['name', 'diet', 'chart']);
  });

  it('does not share arrays with the source', () => {
    const src = iman();
    const copy = copyPerson(src);
    copy.favourites.push('Chole');
    expect(src.favourites).not.toContain('Chole');
  });
});

describe('notes', () => {
  it('names a dish in both lists', () => {
    const both = dishesInBoth({ favourites: ['Rajma chawal', 'Chole'], leastFavourites: ['Rajma chawal'] });
    expect(bothListsNote(both)).toBe('Rajma chawal is in both lists. It will be left out of the plan.');
    expect(dishesInBoth({ favourites: ['None'], leastFavourites: ['None'] })).toEqual([]);
  });

  it('names who a meal is for', () => {
    const a = iman();
    const b = { ...iman(), id: 'b', name: '' };
    expect(mealForLine('Lunch', 1, [a, b])).toBe('Lunch is for Iman');
    expect(mealForLine('Dinner', 2, [a, b])).toBe('Dinner is for everyone');
    expect(mealForLine('Dinner', 3, [a, b])).toBe('Add 1 more person below');
    expect(mealForLine('Dinner', 9, [a, b])).toBe('');
    expect(mealForLine('Lunch', 2, [a, b, { ...a, id: 'c', name: 'Asha' }])).toBe('Lunch is for Iman and Person 2');
  });
});

describe('people at lunch and dinner', () => {
  it('accepts a count larger than the profiles added so far, and asks for the missing profiles', () => {
    const s = blankSetup();
    s.household.lunchCount = 3;
    s.household.dinnerCount = 2;
    const items = missingItems(s);
    expect(items.some((i) => i.field === 'lunchCount' || i.field === 'dinnerCount')).toBe(false);
    expect(items.find((i) => i.field === 'people')?.label).toBe('Household: Add 2 more people (3 eat together)');
  });
  it('rejects counts outside 1 to 8', () => {
    const s = blankSetup();
    s.household.lunchCount = 9;
    s.household.dinnerCount = 0;
    const fields = missingItems(s).map((i) => i.field);
    expect(fields).toContain('lunchCount');
    expect(fields).toContain('dinnerCount');
  });
});
