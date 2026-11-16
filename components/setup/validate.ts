// Pure rules for the Setup screen: defaults, what is missing, and the small list helpers.
// No React and no '@/…' imports here, so it runs under plain vitest.
import type { Person, Setup } from '../../lib/types';

export const NONE_RESTRICTION = 'none';
export const NONE_DISH = 'None';
/** Most people one plan can cover (the server accepts the same). */
export const MAX_PEOPLE = 8;

export type HouseholdField = 'city' | 'morningMin' | 'eveningMin' | 'lunchCount' | 'dinnerCount' | 'people';
export type PersonField =
  | 'name' | 'budget' | 'diet' | 'restrictions' | 'favourites' | 'leastFavourites' | 'utensils' | 'chart';

export interface MissingItem {
  /** null for household items. */
  personId: string | null;
  field: string;
  label: string;
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function blankPerson(): Person {
  return {
    id: newId(),
    name: '',
    budget: null,
    diet: null,
    restrictions: [],
    otherRestrictions: [],
    favourites: [],
    leastFavourites: [],
    utensils: [],
    chart: null,
    chartAccepted: false,
  };
}

export function blankSetup(): Setup {
  return {
    household: { morningMin: 45, eveningMin: 20, lunchCount: null, dinnerCount: null, city: null },
    people: [blankPerson()],
  };
}

/** "Iman", or "Person 2" while the name is empty. */
export function personLabel(person: Person, index: number): string {
  return person.name.trim() || 'Person ' + (index + 1);
}

/** DOM id of the element the missing-items stepper scrolls to. */
export function anchorId(personId: string | null, field: string): string {
  return 'setup-' + (personId ?? 'household') + '-' + field;
}

function isCount(n: number | null, people: number): boolean {
  return n !== null && Number.isInteger(n) && n >= 1 && n <= people;
}

export function isCountValid(n: number | null, people: number): boolean {
  return isCount(n, people);
}

const HOUSEHOLD_LABELS: Record<HouseholdField, string> = {
  city: 'Your city',
  morningMin: 'Morning cooking time',
  eveningMin: 'Evening cooking time',
  lunchCount: 'People at lunch',
  dinnerCount: 'People at dinner',
  people: 'Add at least one person',
};

const PERSON_LABELS: Record<PersonField, string> = {
  name: 'Name',
  budget: 'Budget per meal',
  diet: 'Dietary choice',
  restrictions: 'Restrictions and dislikes',
  favourites: 'Favourite meals',
  leastFavourites: 'Least favourite meals',
  utensils: 'Utensils',
  chart: 'Diet chart',
};

/** Profiles needed for the larger of the lunch and dinner counts. */
export function profilesNeeded(setup: Setup): number {
  const h = setup.household;
  return Math.max(isCount(h.lunchCount, MAX_PEOPLE) ? (h.lunchCount as number) : 0, isCount(h.dinnerCount, MAX_PEOPLE) ? (h.dinnerCount as number) : 0);
}

function peopleLabel(setup: Setup): string {
  if (setup.people.length > MAX_PEOPLE) return `Remove people (up to ${MAX_PEOPLE})`;
  const short = profilesNeeded(setup) - setup.people.length;
  if (setup.people.length === 0 || short <= 0) return HOUSEHOLD_LABELS.people;
  return `Add ${short} more ${short === 1 ? 'person' : 'people'} (${profilesNeeded(setup)} eat together)`;
}

export function householdMissing(setup: Setup): HouseholdField[] {
  const h = setup.household;
  const n = setup.people.length;
  const out: HouseholdField[] = [];
  if (!h.city) out.push('city');
  if (!(h.morningMin > 0)) out.push('morningMin');
  if (!(h.eveningMin > 0)) out.push('eveningMin');
  // Counts are checked against the household size limit, not the profiles added so far:
  // people often fill in the household first and add profiles afterwards.
  if (!isCount(h.lunchCount, MAX_PEOPLE)) out.push('lunchCount');
  if (!isCount(h.dinnerCount, MAX_PEOPLE)) out.push('dinnerCount');
  if (n === 0 || n > MAX_PEOPLE || profilesNeeded(setup) > n) out.push('people');
  return out;
}

export function personMissing(person: Person): PersonField[] {
  const out: PersonField[] = [];
  if (!person.name.trim()) out.push('name');
  if (person.budget === null || !(person.budget > 0)) out.push('budget');
  if (!person.diet) out.push('diet');
  if (person.restrictions.length === 0 && person.otherRestrictions.length === 0) out.push('restrictions');
  if (person.favourites.length === 0) out.push('favourites');
  if (person.leastFavourites.length === 0) out.push('leastFavourites');
  if (person.utensils.length === 0) out.push('utensils');
  if (!person.chart || !person.chartAccepted) out.push('chart');
  return out;
}

/** Everything still to fill, in page order. Empty = ready to generate. */
export function missingItems(setup: Setup): MissingItem[] {
  const out: MissingItem[] = householdMissing(setup).map((field) => ({
    personId: null, field, label: 'Household: ' + (field === 'people' ? peopleLabel(setup) : HOUSEHOLD_LABELS[field]),
  }));
  setup.people.forEach((p, i) => {
    for (const field of personMissing(p)) {
      out.push({ personId: p.id, field, label: personLabel(p, i) + ': ' + PERSON_LABELS[field] });
    }
  });
  return out;
}

/** "Complete", "1 thing missing", "3 things missing". */
export function missingText(n: number): string {
  if (n === 0) return 'Complete';
  return n + (n === 1 ? ' thing missing' : ' things missing');
}

/**
 * Multi-select toggle where one value means "none": picking it clears the rest,
 * picking anything else clears it.
 */
export function toggleWithNone(list: string[], value: string, none: string): string[] {
  if (value === none) return list.includes(none) ? [] : [none];
  const rest = list.filter((x) => x !== none);
  return rest.includes(value) ? rest.filter((x) => x !== value) : [...rest, value];
}

type RestrictionState = Pick<Person, 'restrictions' | 'otherRestrictions'>;

/** Tap on a restriction tile. "None" clears every other pick, typed ones included. */
export function pickRestriction(state: RestrictionState, id: string): RestrictionState {
  if (id === NONE_RESTRICTION) {
    return state.restrictions.includes(NONE_RESTRICTION)
      ? { restrictions: [], otherRestrictions: state.otherRestrictions }
      : { restrictions: [NONE_RESTRICTION], otherRestrictions: [] };
  }
  return {
    restrictions: toggleWithNone(state.restrictions, id, NONE_RESTRICTION),
    otherRestrictions: state.otherRestrictions,
  };
}

/** Typed "Other" restriction. Clears "None"; ignores blanks and repeats. */
export function addOtherRestriction(state: RestrictionState, text: string): RestrictionState {
  const v = text.trim().replace(/\s+/g, ' ');
  if (!v) return state;
  const dup = state.otherRestrictions.some((x) => x.toLowerCase() === v.toLowerCase());
  return {
    restrictions: state.restrictions.filter((x) => x !== NONE_RESTRICTION),
    otherRestrictions: dup ? state.otherRestrictions : [...state.otherRestrictions, v],
  };
}

/** New person copied from another: everything except name, dietary choice and diet chart. */
export function copyPerson(source: Person): Person {
  return {
    ...blankPerson(),
    budget: source.budget,
    restrictions: [...source.restrictions],
    otherRestrictions: [...source.otherRestrictions],
    favourites: [...source.favourites],
    leastFavourites: [...source.leastFavourites],
    utensils: [...source.utensils],
  };
}

/** Dishes picked as both favourite and least favourite. */
export function dishesInBoth(person: Pick<Person, 'favourites' | 'leastFavourites'>): string[] {
  return person.favourites.filter((d) => d !== NONE_DISH && person.leastFavourites.includes(d));
}

/** "Rajma chawal is in both lists. It will be left out of the plan." */
export function bothListsNote(dishes: string[]): string {
  if (dishes.length === 0) return '';
  if (dishes.length === 1) return dishes[0] + ' is in both lists. It will be left out of the plan.';
  return joinNames(dishes) + ' are in both lists. They will be left out of the plan.';
}

/** "Iman", "Iman and Rohan", "Iman, Rohan and Asha". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/** "Lunch is for Iman" — the server takes the first N people in the list. */
export function mealForLine(meal: 'Lunch' | 'Dinner', count: number | null, people: Person[]): string {
  if (!isCount(count, MAX_PEOPLE)) return '';
  if ((count as number) > people.length) {
    const short = (count as number) - people.length;
    return `Add ${short} more ${short === 1 ? 'person' : 'people'} below`;
  }
  if (count === people.length && count > 1) return meal + ' is for everyone';
  return meal + ' is for ' + joinNames(people.slice(0, count as number).map(personLabel));
}
