// A fixed, made-up recipe library for planner tests (NFR-7).
import type { FoodCategory, SlimRecipe } from '@/lib/library/types';
import type { AllergenId } from '@/lib/types';

const CUISINES = ['North Indian', 'South Indian', 'Bengali', 'Indo-Chinese', 'Italian', 'Middle Eastern', 'Thai', 'Mexican', 'Japanese and Korean'];
const CATS: FoodCategory[] = ['vegan', 'vegetarian', 'egg', 'fish', 'meat'];

export function recipe(over: Partial<SlimRecipe> & { id: string }): SlimRecipe {
  return {
    name: over.id, dishKey: over.id, source: 'Test Kitchen', cuisine: 'North Indian', kind: 'main', category: 'vegan',
    utensils: [], techniques: ['simmering'], keyIngredients: ['onion'], ingredientNames: ['onion', 'tomato'], garnish: [],
    allergens: [], allergenUnsure: [], healthFlags: [], kcal: 450, totalMin: 25, aheadMin: 15, lastMin: 10, popular: false,
    priced: [{ item: 'onion', grams: 100 }], ...over,
  };
}

/** 9 cuisines × 5 food categories × 6 mains, plus 12 quick sides per category. */
export function library(): SlimRecipe[] {
  const out: SlimRecipe[] = [];
  CUISINES.forEach((cuisine, ci) => CATS.forEach((category, ki) => {
    for (let n = 0; n < 6; n++) {
      const id = `m-${ci}-${ki}-${n}`;
      const total = 18 + ((ci + ki + n) % 4) * 5;
      const splittable = n % 3 !== 0;
      out.push(recipe({
        id, name: `${cuisine} ${category} main ${n}`, dishKey: `${cuisine.toLowerCase()} ${category} main ${n}`, cuisine, category,
        totalMin: total, aheadMin: splittable ? total - 8 : total, lastMin: splittable ? 8 : 0, popular: n === 1,
        kcal: 380 + n * 30, garnish: n === 2 ? ['coriander leaves'] : [],
        ingredientNames: ['onion', 'tomato', ...(n === 4 ? ['mustard seeds'] : [])],
        allergens: (n === 5 ? ['peanuts'] : []) as AllergenId[],
      }));
    }
  }));
  CATS.forEach((category, ki) => {
    for (let n = 0; n < 12; n++) {
      out.push(recipe({ id: `s-${ki}-${n}`, name: `${category} side ${n}`, dishKey: `${category} side ${n}`, kind: 'side', category, cuisine: CUISINES[n % 9], totalMin: 5 + (n % 3), aheadMin: 5 + (n % 3), lastMin: 0, kcal: 80 }));
    }
  });
  return out;
}

export const PRICES = { onion: 40 };
