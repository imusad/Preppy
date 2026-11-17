import { describe, expect, it } from 'vitest';
import { schemaErrors, type Schema } from '@/lib/library/schemaCheck';
import { TAG_SCHEMA, finalise, type TagAnswer } from '@/lib/library/tag';
import type { RawRecipe } from '@/lib/library/types';

const raw: RawRecipe = {
  url: 'https://example.com/dal', source: 'cookieandkate', name: 'Red Lentil Dal', images: ['a.jpg'], videoUrl: 'https://www.youtube.com/watch?v=x', youtubeId: 'x',
  ingredientLines: ['1 cup red lentils', '1 onion', '2 green chillies', '1 tbsp ghee'], stepLines: ['Cook lentils.', 'Fry onion and chilli in ghee, add to dal.'],
  totalMin: 30, servings: 2, kcal: null, rating: null, ratingCount: null, cuisineHint: null, categoryHint: null,
};
const no = Object.fromEntries(['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'tree-nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'].map((a) => [a, 'no']));
const tag = {
  englishName: 'Red Lentil Dal', complete: true, unsure: false, cuisine: 'North Indian', kind: 'main', category: 'vegan', utensils: [], techniques: ['simmering', 'tempering'],
  keyIngredients: ['red lentils'], servings: 2, kcalPerServing: 330, healthFlags: [], allergens: no,
  ingredients: [
    { name: 'red lentils', qty: 1, unit: 'cup', grams: 200, garnish: false, priceItem: 'none' },
    { name: 'onion', qty: 1, unit: '', grams: 110, garnish: false, priceItem: 'onion' },
    { name: 'green chilli', qty: 2, unit: '', grams: 10, garnish: false, priceItem: 'green chilli' },
    { name: 'ghee', qty: 1, unit: 'tbsp', grams: 14, garnish: false, priceItem: 'none' },
  ],
  steps: [{ when: 'ahead', min: 20 }, { when: 'last', min: 8 }],
} as unknown as TagAnswer;

describe('tags written in a chat are held to the API format and safety checks', () => {
  it('a correct tag passes; wrong values and extra fields are caught', () => {
    expect(schemaErrors(TAG_SCHEMA as Schema, tag)).toEqual([]);
    expect(schemaErrors(TAG_SCHEMA as Schema, { ...tag, cuisine: 'Martian' }).join()).toMatch(/cuisine/);
    expect(schemaErrors(TAG_SCHEMA as Schema, { ...tag, extra: 1 }).join()).toMatch(/not allowed/);
    const missing = Object.fromEntries(Object.entries(tag).filter(([k]) => k !== 'kind'));
    expect(schemaErrors(TAG_SCHEMA as Schema, missing).join()).toMatch(/kind: missing/);
  });
  it('the word list still overrules a too-generous diet tag (ghee makes it vegetarian), and spice is scored', () => {
    const done = finalise(raw, tag, 'Cookie and Kate', {});
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.slim.category).toBe('vegetarian');
      expect(done.slim.spiceLevel).toBe('medium');
      expect(done.slim.allergenUnsure).toContain('milk');
    }
  });
});
