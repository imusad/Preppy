// What a diet chart favours ("lean protein", "high fibre", "low oil"...) turned into plain checks on recipes.
// No AI: the chart reader already gave short phrases, and these words and tags decide the rest.
import { mentions } from '@/lib/library/wordlist';
import type { SlimRecipe } from '@/lib/library/types';

export type ChartTag = 'protein' | 'fibre' | 'lowFat' | 'lowSalt' | 'lowSugar' | 'fish';

const PROTEIN = ['chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'cod', 'basa', 'prawn', 'shrimp', 'crab', 'egg',
  'paneer', 'tofu', 'tempeh', 'chickpea', 'chana', 'lentil', 'dal', 'rajma', 'kidney bean', 'black bean', 'white bean', 'bean', 'edamame', 'soya chunk',
  'halloumi', 'cottage cheese', 'steak', 'mince', 'keema'];

const FIBRE = ['dal', 'lentil', 'chickpea', 'chana', 'rajma', 'bean', 'moong', 'toor', 'masoor', 'urad', 'sprouts', 'millet', 'ragi', 'jowar', 'bajra', 'oats',
  'brown rice', 'quinoa', 'barley', 'whole wheat', 'wholewheat', 'whole grain', 'multigrain', 'daliya', 'bulgur', 'farro'];

/** Does the dish have a real protein source among its defining ingredients? */
export function proteinRich(r: SlimRecipe): boolean {
  return mentions([...r.keyIngredients, r.name.toLowerCase()], PROTEIN);
}

/** Which kinds of food a chart favours, from its recipe-type phrases. Phrases we do not recognise are ignored. */
export function chartTagsOf(recipeTypes: string[]): ChartTag[] {
  const text = recipeTypes.join(' | ').toLowerCase();
  const tags: ChartTag[] = [];
  if (/protein/.test(text)) tags.push('protein');
  if (/fib(re|er)|whole ?grain|millet|\bdal\b|lentil|legume|pulse/.test(text)) tags.push('fibre');
  if (/low[- ](oil|fat)|less oil|little oil|light oil/.test(text)) tags.push('lowFat');
  if (/low[- ](salt|sodium)|less salt/.test(text)) tags.push('lowSalt');
  if (/low[- ]sugar|no sugar|sugar[- ]free|less sugar/.test(text)) tags.push('lowSugar');
  if (/\bfish\b|omega/.test(text)) tags.push('fish');
  return tags;
}

export function meetsTag(tag: ChartTag, r: SlimRecipe): boolean {
  switch (tag) {
    case 'protein': return proteinRich(r);
    case 'fibre': return mentions([...r.keyIngredients, ...r.ingredientNames, r.name.toLowerCase()], FIBRE);
    case 'lowFat': return !r.healthFlags.includes('high fat') && !r.healthFlags.includes('deep-fried food');
    case 'lowSalt': return !r.healthFlags.includes('high salt');
    case 'lowSugar': return !r.healthFlags.includes('sugary food');
    case 'fish': return r.category === 'fish';
  }
}

/** Tags a recipe is a real positive for. Negative-only tags (low fat, salt, sugar) count only when the dish also has substance. */
export function tagsMet(tags: ChartTag[], r: SlimRecipe): ChartTag[] {
  return tags.filter((t) => meetsTag(t, r));
}

/** Words that make a chart line a limit or a broad category rather than a ban on one food ("excess oil", "processed foods"). */
const LIMIT_WORDS = /\b(excess|excessive|extra|limit|limited|minimal|minimise|minimize|reduce|reduced|less|moderate|moderation|processed|packaged|junk|fried|frying)\b/i;
/** Things almost every recipe uses: banning the word would empty the library. */
const KITCHEN_STAPLES = ['oil', 'olive oil', 'vegetable oil', 'cooking oil', 'salt', 'water', 'sugar', 'spice', 'spices', 'onion', 'tomato', 'garlic', 'ginger', 'pepper', 'black pepper'];

/**
 * Can a food the chart says to avoid be enforced by ingredient words? Returns the usable terms, or null when the
 * line is a limit or category, or only names kitchen staples. (Sugar, refined flour and fried food have their own chart flags.)
 */
export function enforceableFoodTerms(text: string, terms: string[]): string[] | null {
  if (LIMIT_WORDS.test(text)) return null;
  const usable = terms.map((t) => t.toLowerCase().trim()).filter((t) => t && !KITCHEN_STAPLES.includes(t));
  return usable.length > 0 ? usable : null;
}
