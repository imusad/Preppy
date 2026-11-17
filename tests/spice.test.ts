import { describe, expect, it } from 'vitest';
import { isHotName, spiceLevelOf, spiceLimitFromText, spiceOf, withinSpice } from '@/lib/library/spice';
import { chartTagsOf, enforceableFoodTerms, meetsTag } from '@/lib/planner/chartFit';
import { recipe } from './library';
import { wordCategory } from '@/lib/library/tag';

// Quantities are per serving, as stored in the library.
const line = (name: string, qty: number | null, unit = '') => ({ name, qty, unit });

describe('spice level from ingredients', () => {
  it('no chilli at all is "none"; one dried chilli shared by four is mild', () => {
    expect(spiceLevelOf([line('basmati rice', 75, 'g'), line('bay leaf', 1), line('black pepper', 0.25, 'tsp')])).toBe('none');
    expect(spiceLevelOf([line('dried red chilli', 0.25), line('mustard seeds', 0.1, 'tsp')])).toBe('mild');
  });
  it('a couple of green chillies per serving is medium; chillies plus chilli powder is hot', () => {
    expect(spiceLevelOf([line('green chilli', 0.75)])).toBe('medium');
    expect(spiceLevelOf([line('green chilli', 1), line('red chilli powder', 0.5, 'tsp')])).toBe('hot');
  });
  it('capsicum, bell pepper and sweet chilli sauce do not count; kashmiri chilli counts half', () => {
    expect(isHotName('green capsicum')).toBe(false);
    expect(isHotName('red bell pepper')).toBe(false);
    expect(isHotName('sweet chilli sauce')).toBe(false);
    expect(isHotName('sriracha')).toBe(true);
    expect(spiceLevelOf([line('kashmiri red chilli powder', 0.25, 'tsp')])).toBe('mild');
  });
  it('"to taste" counts as a little heat', () => {
    expect(spiceLevelOf([line('chilli flakes', null)])).toBe('mild');
  });
  it('orders levels and falls back to ingredient names for unscored recipes', () => {
    expect(withinSpice('mild', 'medium')).toBe(true);
    expect(withinSpice('hot', 'medium')).toBe(false);
    expect(withinSpice('hot', null)).toBe(true);
    expect(spiceOf({ ingredientNames: ['onion', 'jalapeno'] })).toBe('medium');
    expect(spiceOf({ spiceLevel: 'hot', ingredientNames: [] })).toBe('hot');
  });
});

describe('spice limit from typed text', () => {
  it('reads heat limits but not cuisine limits', () => {
    expect(spiceLimitFromText('No spicy food')).toBe('mild');
    expect(spiceLimitFromText("Doesn't like spicy food")).toBe('mild');
    expect(spiceLimitFromText('mild only')).toBe('mild');
    expect(spiceLimitFromText('No chilli')).toBe('none');
    expect(spiceLimitFromText('No Indian spices')).toBeNull();
    expect(spiceLimitFromText('allergic to peanuts')).toBeNull();
  });
});

describe('what a diet chart favours', () => {
  it('reads protein, fibre, low-salt and fish from chart phrases and ignores the rest', () => {
    expect(chartTagsOf(['Lean protein at lunch and dinner', 'Low salt', 'Fish, dal and vegetables']).sort()).toEqual(['fibre', 'fish', 'lowSalt', 'protein']);
    expect(chartTagsOf(['Balanced meals'])).toEqual([]);
  });
  it('checks a recipe against each tag', () => {
    expect(meetsTag('protein', recipe({ id: 'a', keyIngredients: ['paneer'] }))).toBe(true);
    expect(meetsTag('protein', recipe({ id: 'b', keyIngredients: ['potato'], name: 'Aloo sabzi' }))).toBe(false);
    expect(meetsTag('lowSalt', recipe({ id: 'c', healthFlags: ['high salt'] }))).toBe(false);
    expect(meetsTag('lowFat', recipe({ id: 'd', healthFlags: ['deep-fried food'] }))).toBe(false);
    expect(meetsTag('fibre', recipe({ id: 'e', ingredientNames: ['white rice', 'onion'] }))).toBe(false);
    expect(meetsTag('fibre', recipe({ id: 'f', ingredientNames: ['ragi', 'onion'] }))).toBe(true);
  });
});

describe('real chart: "Food exclusions" line', () => {
  const lines: [string, string[]][] = [
    ['Added sugar', ['sugar']], ['refined flour', ['maida', 'refined flour']], ['processed foods', ['sausage']],
    ['deep fried items', ['deep fry']], ['excess oil', ['oil']], ['rice', ['rice', 'basmati']], ['oil', ['oil', 'olive oil']],
  ];
  it('keeps a real ingredient ban and drops limits, categories and kitchen staples', () => {
    const kept = lines.filter(([text, terms]) => enforceableFoodTerms(text, terms) !== null).map(([t]) => t);
    // Sugar, fried and refined flour also have their own chart flags, so the reader is told to leave them out.
    expect(kept).toEqual(['refined flour', 'rice']);
  });
  it('removes staple words from a rule that is otherwise a real ban', () => {
    expect(enforceableFoodTerms('mushrooms', ['mushroom', 'salt'])).toEqual(['mushroom']);
  });
});

describe('diet words found in the 2026-11-17 library audit', () => {
  it('hot dogs, bratwurst and bolognese are meat; lentil bolognese is not; kimchi may hide fish', () => {
    expect(wordCategory('Camping hot dogs', ['hot dogs', 'cheese'])).toBe('meat');
    expect(wordCategory('Beer brat nachos', ['bratwurst', 'cheddar cheese'])).toBe('meat');
    expect(wordCategory('Ravioli lasagna', ['ravioli', 'bolognese sauce'])).toBe('meat');
    expect(wordCategory('Lentil Bolognese', ['red lentils', 'tomato', 'olive oil'])).toBe('vegan');
    expect(wordCategory('Kimchi fried rice', ['kimchi', 'rice'])).toBe('fish');
    expect(wordCategory('Vegan kimchi rice', ['vegan kimchi', 'rice'])).toBe('vegan');
  });
});
