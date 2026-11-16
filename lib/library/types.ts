// Recipe library shapes. "Slim" is what the planner needs for every recipe;
// "Full" adds the text shown on the recipe screen and is only loaded for chosen recipes.
import type { AllergenId, Diet, Ingredient, RecipeStep } from '@/lib/types';
import type { HealthFlag } from '@/lib/settings';

/** What the dish is made of, from most to least restrictive. */
export type FoodCategory = 'vegan' | 'vegetarian' | 'egg' | 'fish' | 'meat';

export const DIETS_FOR: Record<FoodCategory, Diet[]> = {
  vegan: ['Vegan', 'Vegetarian', 'Eggetarian', 'Pescatarian', 'Non-vegetarian'],
  vegetarian: ['Vegetarian', 'Eggetarian', 'Pescatarian', 'Non-vegetarian'],
  egg: ['Eggetarian', 'Pescatarian', 'Non-vegetarian'],
  fish: ['Pescatarian', 'Non-vegetarian'],
  meat: ['Non-vegetarian'],
};

export interface SlimRecipe {
  id: string;
  name: string;
  /** Lower-case name without filler words, for matching favourites and least favourites. */
  dishKey: string;
  source: string;
  cuisine: string;
  kind: 'main' | 'side';
  category: FoodCategory;
  /** Utensil tile ids the recipe cannot be made without. */
  utensils: string[];
  techniques: string[];
  keyIngredients: string[];
  /** Lower-case names of every ingredient that is not a garnish. */
  ingredientNames: string[];
  /** Lower-case names of garnish ingredients. */
  garnish: string[];
  /** Allergens the recipe contains. */
  allergens: AllergenId[];
  /** Allergens the two checks could not settle: treated as present. */
  allergenUnsure: AllergenId[];
  healthFlags: HealthFlag[];
  kcal: number | null;
  totalMin: number;
  /** Minutes of steps that can be done ahead (morning). */
  aheadMin: number;
  /** Minutes of last-minute steps (evening finish). 0 = cannot be split. */
  lastMin: number;
  popular: boolean;
  /** Rupees per serving from the price table; null when an ingredient has no price. Filled at run time. */
  costPerServing?: number | null;
  /** Price-table item → grams per serving, for costing. null entry = an ingredient with no price item. */
  priced: { item: string | null; grams: number }[];
}

export interface FullRecipe {
  id: string;
  url: string;
  sourceName: string;
  image: string | null;
  images: string[];
  videoUrl: string | null;
  youtubeId: string | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

/** What the page reader pulls from a recipe page before any AI tagging. */
export interface RawRecipe {
  url: string;
  source: string;
  name: string;
  images: string[];
  videoUrl: string | null;
  youtubeId: string | null;
  ingredientLines: string[];
  stepLines: string[];
  totalMin: number | null;
  servings: number | null;
  kcal: number | null;
  rating: number | null;
  ratingCount: number | null;
  cuisineHint: string | null;
  categoryHint: string | null;
  views?: number | null;
  likes?: number | null;
}
