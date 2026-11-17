// Turns a raw recipe page into a tagged library recipe (PDD MMP-BE-S3, decision points B2–B7).
// Haiku tags; the fixed word list checks allergens independently; Sonnet settles disagreements.
import { createHash } from 'node:crypto';
import { cleanName, dishKey } from '@/lib/library/dishKey';
import type { AiRequest } from '@/lib/ai';
import { PRICE_ITEMS } from '@/lib/data/priceItems';
import { UTENSILS } from '@/lib/data/catalog';
import { spiceLevelOf } from '@/lib/library/spice';
import { ALLERGEN_IDS, mentions, scanAllergens } from '@/lib/library/wordlist';
import type { FoodCategory, FullRecipe, RawRecipe, SlimRecipe } from '@/lib/library/types';
import { CUISINES, HEALTH_FLAGS, settings, type HealthFlag } from '@/lib/settings';
import type { AllergenId } from '@/lib/types';

export function recipeId(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

export { dishKey };

const yesNo = { type: 'string', enum: ['yes', 'no', 'unsure'] };

export const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['englishName', 'complete', 'unsure', 'cuisine', 'kind', 'category', 'utensils', 'techniques', 'keyIngredients', 'servings', 'kcalPerServing', 'healthFlags', 'allergens', 'ingredients', 'steps'],
  properties: {
    englishName: { type: 'string' },
    complete: { type: 'boolean' },
    unsure: { type: 'boolean' },
    cuisine: { type: 'string', enum: [...CUISINES] },
    kind: { type: 'string', enum: ['main', 'side', 'neither'] },
    category: { type: 'string', enum: ['vegan', 'vegetarian', 'egg', 'fish', 'meat'] },
    utensils: { type: 'array', items: { type: 'string', enum: UTENSILS.map((u) => u.id) } },
    techniques: { type: 'array', items: { type: 'string' } },
    keyIngredients: { type: 'array', items: { type: 'string' } },
    servings: { type: 'integer' },
    kcalPerServing: { type: 'integer' },
    healthFlags: { type: 'array', items: { type: 'string', enum: [...HEALTH_FLAGS] } },
    allergens: {
      type: 'object', additionalProperties: false, required: [...ALLERGEN_IDS],
      properties: Object.fromEntries(ALLERGEN_IDS.map((a) => [a, yesNo])),
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'qty', 'unit', 'grams', 'garnish', 'priceItem'],
        properties: {
          name: { type: 'string' },
          qty: { type: ['number', 'null'] },
          unit: { type: 'string' },
          grams: { type: 'number' },
          garnish: { type: 'boolean' },
          priceItem: { type: 'string', enum: [...PRICE_ITEMS, 'minor', 'none'] },
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['when', 'min'],
        properties: { when: { type: 'string', enum: ['ahead', 'last'] }, min: { type: 'integer' } },
      },
    },
  },
};

export const TAG_SYSTEM = `You tag real recipes for a household meal planner in India. The cook makes lunch and the first part of dinner in a short morning window, then finishes dinner in a short evening window. Your tags drive safety filters and scheduling, so accuracy matters more than generosity.

Fill every field:

- englishName: the dish name in plain English for an English-speaking reader. Keep a well-known dish name and add a short English description in brackets when the name alone would not be understood, for example "Palak Paneer (Spinach and Cottage Cheese Curry)", "Cluster Beans Stir-Fry (Gavar Phali Sabzi)". No Hindi or other non-Latin script, no site or author name, no words like "recipe", "easy" or "best". Use title case.

- complete: false if this is not a cookable lunch or dinner recipe with real ingredients and steps (for example a drink, dessert, breakfast-only item, snack, baking project, spice mix, round-up article, or steps too thin to cook from).
- unsure: true if you had to guess at any tag that affects safety or scheduling (category, allergens, the ahead/last split, times).
- cuisine: the closest listed cuisine. Goan, Gujarati, Maharashtrian, Punjabi street food and so on go under the nearest Indian choice or "Other Indian". Chinese-style dishes cooked the Indian way are "Indo-Chinese". Anything else is "Other".
- If the title names a sauce, seasoning, spice mix, rub, brine or marinade but the recipe also cooks the main ingredient (fish, chicken, vegetables) to serve as the meal, treat it as that dish and give an englishName that names the dish, for example "Spice-Rubbed Pan-Fried Fish". If it only makes the sauce, condiment or mix, set complete to false.
- kind: "main" for a dish that anchors a meal (curry with protein or dal, rice dish, noodles, pasta, one-pot meals, stuffed breads). "side" for a small accompaniment that takes about 10 minutes or less of work (salad, raita, plain rice, simple stir-fried vegetable, chutney, roti). "neither" for anything else.
- category: what the dish contains, checking every ingredient including stocks, sauces and pastes: "meat" (any meat or poultry, including meat stock, gelatine, lard), "fish" (fish or seafood, including fish sauce, oyster sauce, shrimp paste, anchovies), "egg" (eggs but no meat or fish), "vegetarian" (dairy or honey but no eggs, meat or fish), "vegan" (no animal products at all).
- utensils: only the listed utensils the recipe cannot reasonably be made without. A normal pot, pan or stove is assumed and not listed.
- techniques: 1 to 3 short cooking techniques (for example "tempering", "pressure cooking", "stir-frying", "grilling", "steaming").
- keyIngredients: the 2 to 4 ingredients that define the dish, lower case.
- servings: how many adult portions the recipe makes as written.
- kcalPerServing: your best estimate of calories per portion.
- healthFlags: which listed things apply to a portion: "red meat" (mutton, lamb, beef, pork), "deep-fried food", "sugary food", "refined flour" (maida, white bread, regular pasta or noodles as the base), "high salt" (pickles, cured or very salty sauces as a main flavour), "high fat" (lots of cream, butter, cheese, ghee or oil).
- allergens: for each of the 14 allergens say "yes", "no" or "unsure". Think about hidden sources: soy sauce contains soy and gluten; curry pastes often contain mustard, shrimp or fish; ghee, paneer and curd are milk; hing usually contains wheat; stock cubes often contain celery; tahini is sesame; Worcestershire sauce contains fish. If an ingredient is a bought paste, sauce or mix whose contents you cannot know, say "unsure" for the allergens it might hide.
- ingredients: one entry per ingredient line, in order. name is the plain ingredient in lower case ("onion", "coriander leaves", "soy sauce"). qty and unit are the amount for the WHOLE recipe as written (qty null for "to taste"). grams is your estimate of the weight used for the whole recipe (millilitres for liquids). garnish is true only when the ingredient is sprinkled or placed on at the end and the dish works without it. priceItem is the closest item in the list; use "minor" for salt, water, spices, dried herbs and anything used in tiny amounts, and "none" only when nothing in the list is close.
- steps: one entry per step, in the same order as given. when is "last" for anything that must happen just before eating: frying or crisping, tempering (tadka), searing fish or meat, stir-frying, dressing a salad, adding fresh herbs or garnish, making rotis or dosas, cooking pasta or noodles, anything "serve immediately". Everything else (chopping, marinating, making a base or gravy, cooking rice or dal, pressure cooking) is "ahead". min is the hands-on and cooking minutes for that step; leave out unattended soaking, marinating, resting or chilling time.`;

export interface TagAnswer {
  englishName?: string;
  complete: boolean;
  unsure: boolean;
  cuisine: string;
  kind: 'main' | 'side' | 'neither';
  category: FoodCategory;
  utensils: string[];
  techniques: string[];
  keyIngredients: string[];
  servings: number;
  kcalPerServing: number;
  healthFlags: HealthFlag[];
  allergens: Record<AllergenId, 'yes' | 'no' | 'unsure'>;
  ingredients: { name: string; qty: number | null; unit: string; grams: number; garnish: boolean; priceItem: string }[];
  steps: { when: 'ahead' | 'last'; min: number }[];
}

export function recipeText(raw: RawRecipe): string {
  return [
    `Name: ${raw.name}`,
    raw.cuisineHint ? `Site cuisine label: ${raw.cuisineHint}` : '',
    raw.categoryHint ? `Site category label: ${raw.categoryHint}` : '',
    raw.servings ? `Serves: ${raw.servings}` : '',
    raw.totalMin ? `Total time on the page: ${raw.totalMin} min` : '',
    '',
    'Ingredients:',
    ...raw.ingredientLines.map((l, i) => `${i + 1}. ${l}`),
    '',
    'Steps:',
    ...raw.stepLines.map((l, i) => `${i + 1}. ${l.slice(0, 700)}`),
  ].filter((l) => l !== '').join('\n');
}

export function tagRequest(raw: RawRecipe, model = settings.models.tagging): AiRequest {
  return {
    task: model === settings.models.tagging ? 'tag' : 'tag-recheck',
    model, system: TAG_SYSTEM, schema: TAG_SCHEMA, maxTokens: 6000,
    content: `<recipe>\n${recipeText(raw)}\n</recipe>\n\nTag this recipe.`,
  };
}

// ---------- Allergen disagreement (Sonnet decides) ----------

/** Allergens where the word list says "contains" but the tagger said "no" or "unsure". */
export function allergenDisputes(raw: RawRecipe, tag: TagAnswer): AllergenId[] {
  const words = new Set(scanAllergens([raw.name, ...raw.ingredientLines]));
  // Only a real disagreement gets a second look. The tagger's own "unsure" stays unsure (treated as present).
  return ALLERGEN_IDS.filter((a) => words.has(a) && tag.allergens[a] === 'no');
}

export function disputeRequest(raw: RawRecipe, disputed: AllergenId[]): AiRequest {
  return {
    task: 'allergen-recheck', model: settings.models.allergenCheck, maxTokens: 1500,
    system: `You settle allergen questions about a recipe for a household meal planner. For each allergen asked about, answer "yes" if any ingredient contains it or very commonly contains it, "no" only if you are confident none does, and "unsure" if it depends on a bought product whose contents are unknown. A missed allergen is far worse than a false alarm.`,
    schema: {
      type: 'object', additionalProperties: false, required: disputed,
      properties: Object.fromEntries(disputed.map((a) => [a, yesNo])),
    },
    content: `<recipe>\nName: ${raw.name}\nIngredients:\n${raw.ingredientLines.join('\n')}\n</recipe>\n\nDoes this recipe contain: ${disputed.join(', ')}?`,
  };
}

// ---------- Building the stored recipe ----------

function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

const MEAT_TERMS = ['hot dog', 'hotdog', 'bratwurst', 'frankfurter', 'wiener', 'bolognese', 'pastrami', 'brisket', 'oxtail', 'chicken', 'mutton', 'lamb', 'beef', 'pork', 'bacon', 'ham', 'turkey', 'duck', 'sausage', 'salami', 'pepperoni', 'chorizo', 'prosciutto', 'pancetta', 'keema', 'kheema', 'gosht', 'murgh', 'meat', 'steak', 'veal', 'venison', 'goat', 'lard', 'gelatin', 'gelatine', 'bone broth', 'meatball', 'mince', 'qeema'];
// Phrases cut out of the text before matching (not whole lines skipped).
const MEAT_EXCEPT = ['lentil bolognese', 'vegan bolognese', 'vegetarian bolognese', 'veggie bolognese', 'mushroom bolognese', 'vegan hot dog', 'veggie hot dog', 'vegan sausage', 'vegetarian sausage', 'vegan chicken', 'mock meat', 'meatless', 'soya chunk', 'soya mince', 'soy chunk', 'soy mince', 'plant-based meat', 'plant based meat', 'jackfruit', 'coconut meat', 'hamburger bun', 'duck sauce', 'vegetarian meatball', 'vegan meatball', 'veggie mince'];
const RANK: Record<FoodCategory, number> = { vegan: 0, vegetarian: 1, egg: 2, fish: 3, meat: 4 };

/** Plain-code second check of the diet category: the more restrictive of the tagger's answer and the word list wins. */
function safeCategory(tagged: FoodCategory, raw: RawRecipe): FoodCategory {
  const words = wordCategory(raw.name, raw.ingredientLines);
  return RANK[words] > RANK[tagged] ? words : tagged;
}

/** What the fixed word list alone says a recipe is (used at tagging and by library clean-ups). */
export function wordCategory(name: string, ingredientLines: string[]): FoodCategory {
  const raw = { name };
  const lines = ingredientLines.map((l) => l.toLowerCase());
  const found = new Set(scanAllergens(lines));
  let words: FoodCategory = 'vegan';
  if (found.has('milk') || mentions(lines, ['honey', 'shahad', 'madhu'], ['vegan honey', 'honey substitute'])) words = 'vegetarian';
  if (found.has('eggs')) words = 'egg';
  if (found.has('fish') || found.has('crustaceans') || found.has('molluscs')) words = 'fish';
  if (mentions([raw.name.toLowerCase(), ...lines], MEAT_TERMS, MEAT_EXCEPT)) words = 'meat';
  return words;
}

export function stricterCategory(a: FoodCategory, b: FoodCategory): FoodCategory {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Matching words from both the English name and the original page title, so favourites match either. */
export function bothKeys(english: string, original: string): string {
  const words = `${dishKey(english.replace(/[()]/g, ' '))} ${dishKey(cleanName(original))}`.split(' ').filter(Boolean);
  return [...new Set(words)].join(' ');
}

export type Finalised = { ok: true; slim: SlimRecipe; full: FullRecipe } | { ok: false; reason: string };

/**
 * Combine the page, the tags and the allergen ruling into a library recipe.
 * `ruling` holds Sonnet's answers for disputed allergens; a disputed allergen with no ruling stays unsure.
 */
export function finalise(raw: RawRecipe, tag: TagAnswer, sourceName: string, ruling: Partial<Record<AllergenId, 'yes' | 'no' | 'unsure'>> = {}): Finalised {
  if (!tag.complete || tag.kind === 'neither') return { ok: false, reason: 'not a lunch or dinner recipe' };
  // Timings are lined up with the page's steps one to one; a different count would give wrong times.
  if (tag.steps.length !== raw.stepLines.length) return { ok: false, reason: 'steps could not be matched' };
  const stepTag = (i: number) => tag.steps[i];
  const servings = Math.max(1, tag.servings || raw.servings || 2);

  const words = new Set(scanAllergens([raw.name, ...raw.ingredientLines]));
  const allergens: AllergenId[] = [];
  const allergenUnsure: AllergenId[] = [];
  for (const a of ALLERGEN_IDS) {
    const ai = tag.allergens[a];
    if (ai === 'yes') { allergens.push(a); continue; }
    if (ai === 'no' && !words.has(a)) continue;
    const r = ruling[a];
    if (r === 'yes') allergens.push(a);
    else if (r !== 'no') allergenUnsure.push(a);
  }

  const steps = raw.stepLines.map((text, i) => ({ text, when: stepTag(i).when, min: Math.max(0, Math.round(stepTag(i).min)) }));
  const aheadMin = steps.filter((s) => s.when === 'ahead').reduce((t, s) => t + s.min, 0);
  const lastMin = steps.filter((s) => s.when === 'last').reduce((t, s) => t + s.min, 0);
  const totalMin = aheadMin + lastMin;
  if (totalMin < 3 || totalMin > 240) return { ok: false, reason: 'cooking time not usable' };

  const kind = tag.kind === 'side' && totalMin > settings.sideMaxMin ? 'main' : tag.kind;
  // (Sides must be quick: anything slower is planned as a main.)
  const id = recipeId(raw.url);
  const pop = settings.popularity;
  const popular =
    ((raw.rating ?? 0) >= pop.minStars && (raw.ratingCount ?? 0) >= pop.minRatings) ||
    ((raw.views ?? 0) >= pop.minViews && (raw.likes ?? 0) >= pop.minLikeRatio * (raw.views ?? 0));

  const slim: SlimRecipe = {
    id, name: cleanName(tag.englishName || raw.name), dishKey: bothKeys(tag.englishName ?? '', raw.name), source: sourceName,
    cuisine: tag.cuisine, kind, category: safeCategory(tag.category, raw),
    utensils: tag.utensils, techniques: tag.techniques.map((t) => t.toLowerCase()), keyIngredients: tag.keyIngredients.map((t) => t.toLowerCase()),
    ingredientNames: tag.ingredients.filter((i) => !i.garnish).map((i) => i.name.toLowerCase()),
    garnish: tag.ingredients.filter((i) => i.garnish).map((i) => i.name.toLowerCase()),
    allergens, allergenUnsure, healthFlags: tag.healthFlags,
    spiceLevel: spiceLevelOf(tag.ingredients.map((i) => ({ qty: i.qty === null ? null : i.qty / servings, unit: i.unit, name: i.name }))),
    kcal: raw.kcal && raw.kcal > 30 ? Math.round(raw.kcal) : tag.kcalPerServing || null,
    totalMin, aheadMin, lastMin, popular,
    priced: tag.ingredients.filter((i) => i.priceItem !== 'minor').map((i) => ({ item: i.priceItem === 'none' ? null : i.priceItem, grams: round(i.grams / servings, 1) })),
  };
  const full: FullRecipe = {
    id, url: raw.url, sourceName, image: raw.images[0] ?? null, images: raw.images, videoUrl: raw.videoUrl, youtubeId: raw.youtubeId,
    ingredients: tag.ingredients.map((i) => ({ qty: i.qty === null ? null : round(i.qty / servings, 3), unit: i.unit, name: i.name })),
    steps,
  };
  return { ok: true, slim, full };
}
