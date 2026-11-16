// Tile lists shown in Setup. The server uses the same ids to filter recipes.
import type { AllergenId, Diet } from '@/lib/types';

export const CITIES = ['Kolkata', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Other'] as const;

export const DIETS: Diet[] = ['Vegetarian', 'Eggetarian', 'Pescatarian', 'Non-vegetarian', 'Vegan'];

export interface RestrictionTile {
  id: string;
  label: string;
  /** allergen: strict, two checks. avoid: strict ingredient ban. dislike: taste, garnish can be skipped. */
  kind: 'none' | 'allergen' | 'avoid' | 'dislike';
  allergen?: AllergenId;
  /** Ingredient key the planner filters on for avoid / dislike tiles. */
  ingredient?: string;
  /** Word used in notes: "Skip the coriander garnish for Iman". */
  noun?: string;
}

export const RESTRICTIONS: RestrictionTile[] = [
  { id: 'none', label: 'None', kind: 'none' },
  { id: 'allergen:gluten', label: 'No gluten', kind: 'allergen', allergen: 'gluten' },
  { id: 'allergen:crustaceans', label: 'No crustaceans', kind: 'allergen', allergen: 'crustaceans' },
  { id: 'allergen:eggs', label: 'No eggs', kind: 'allergen', allergen: 'eggs' },
  { id: 'allergen:fish', label: 'No fish', kind: 'allergen', allergen: 'fish' },
  { id: 'allergen:peanuts', label: 'No peanuts', kind: 'allergen', allergen: 'peanuts' },
  { id: 'allergen:soy', label: 'No soy', kind: 'allergen', allergen: 'soy' },
  { id: 'allergen:milk', label: 'No dairy', kind: 'allergen', allergen: 'milk' },
  { id: 'allergen:tree-nuts', label: 'No tree nuts', kind: 'allergen', allergen: 'tree-nuts' },
  { id: 'allergen:celery', label: 'No celery', kind: 'allergen', allergen: 'celery' },
  { id: 'allergen:mustard', label: 'No mustard', kind: 'allergen', allergen: 'mustard' },
  { id: 'allergen:sesame', label: 'No sesame', kind: 'allergen', allergen: 'sesame' },
  { id: 'allergen:sulphites', label: 'No sulphites', kind: 'allergen', allergen: 'sulphites' },
  { id: 'allergen:lupin', label: 'No lupin', kind: 'allergen', allergen: 'lupin' },
  { id: 'allergen:molluscs', label: 'No molluscs', kind: 'allergen', allergen: 'molluscs' },
  { id: 'avoid:pork', label: 'No pork', kind: 'avoid', ingredient: 'pork', noun: 'pork' },
  { id: 'avoid:beef', label: 'No beef', kind: 'avoid', ingredient: 'beef', noun: 'beef' },
  { id: 'dislike:coriander', label: "Doesn't like coriander leaves", kind: 'dislike', ingredient: 'coriander leaves', noun: 'coriander' },
  { id: 'dislike:mustard', label: "Doesn't like mustard", kind: 'dislike', ingredient: 'mustard', noun: 'mustard' },
  { id: 'dislike:karela', label: "Doesn't like karela", kind: 'dislike', ingredient: 'karela', noun: 'karela' },
  { id: 'dislike:mushrooms', label: "Doesn't like mushrooms", kind: 'dislike', ingredient: 'mushroom', noun: 'mushroom' },
  { id: 'dislike:coconut', label: "Doesn't like coconut", kind: 'dislike', ingredient: 'coconut', noun: 'coconut' },
];

export const UTENSILS = [
  { id: 'non-stick-pan', label: 'Non-stick pan' },
  { id: 'pressure-cooker', label: 'Pressure cooker' },
  { id: 'microwave', label: 'Microwave' },
  { id: 'kadhai', label: 'Kadhai' },
  { id: 'tawa', label: 'Tawa' },
  { id: 'oven', label: 'Oven' },
  { id: 'air-fryer', label: 'Air fryer' },
  { id: 'mixer-grinder', label: 'Mixer grinder' },
  { id: 'steamer', label: 'Steamer' },
] as const;

/** Code for the diets a dish suits: V vegetarian, Vg vegan, E egg, P fish/seafood, M meat. */
export type DishDiet = 'V' | 'Vg' | 'E' | 'P' | 'M';

export interface DishTile { name: string; diet: DishDiet }

/** The 54-tile favourites grid (architecture Appendix A). */
export const DISH_GRID: { cuisine: string; items: DishTile[] }[] = [
  { cuisine: 'North Indian', items: [
    { name: 'Butter chicken', diet: 'M' }, { name: 'Rogan josh', diet: 'M' }, { name: 'Dal makhani', diet: 'V' },
    { name: 'Rajma chawal', diet: 'Vg' }, { name: 'Chole', diet: 'Vg' }, { name: 'Palak paneer', diet: 'V' }] },
  { cuisine: 'South Indian', items: [
    { name: 'Chettinad chicken', diet: 'M' }, { name: 'Kerala fish curry', diet: 'P' }, { name: 'Masala dosa', diet: 'V' },
    { name: 'Bisi bele bath', diet: 'V' }, { name: 'Avial', diet: 'V' }, { name: 'Lemon rice', diet: 'Vg' }] },
  { cuisine: 'Bengali', items: [
    { name: 'Kosha mangsho', diet: 'M' }, { name: 'Shorshe ilish', diet: 'P' }, { name: 'Chingri malai curry', diet: 'P' },
    { name: 'Aloo posto', diet: 'Vg' }, { name: 'Shukto', diet: 'V' }, { name: 'Cholar dal', diet: 'V' }] },
  { cuisine: 'Indo-Chinese', items: [
    { name: 'Chilli chicken', diet: 'M' }, { name: 'Garlic prawns', diet: 'P' }, { name: 'Hakka noodles', diet: 'Vg' },
    { name: 'Veg Manchurian', diet: 'Vg' }, { name: 'Chilli paneer', diet: 'V' }, { name: 'Egg fried rice', diet: 'E' }] },
  { cuisine: 'Italian', items: [
    { name: 'Chicken alfredo pasta', diet: 'M' }, { name: 'Lasagne', diet: 'M' }, { name: 'Spaghetti aglio e olio', diet: 'Vg' },
    { name: 'Penne arrabbiata', diet: 'Vg' }, { name: 'Mushroom risotto', diet: 'V' }, { name: 'Margherita pizza', diet: 'V' }] },
  { cuisine: 'Middle Eastern', items: [
    { name: 'Chicken shawarma', diet: 'M' }, { name: 'Lamb kofta', diet: 'M' }, { name: 'Falafel', diet: 'Vg' },
    { name: 'Hummus with pita', diet: 'Vg' }, { name: 'Shakshuka', diet: 'E' }, { name: 'Mujadara', diet: 'Vg' }] },
  { cuisine: 'Thai', items: [
    { name: 'Thai green curry', diet: 'M' }, { name: 'Basil chicken', diet: 'M' }, { name: 'Pad Thai with prawns', diet: 'P' },
    { name: 'Tom yum soup', diet: 'P' }, { name: 'Red curry with vegetables', diet: 'Vg' }, { name: 'Som tam', diet: 'Vg' }] },
  { cuisine: 'Mexican', items: [
    { name: 'Chicken fajitas', diet: 'M' }, { name: 'Fish tacos', diet: 'P' }, { name: 'Burrito bowl', diet: 'V' },
    { name: 'Bean quesadilla', diet: 'V' }, { name: 'Mexican rice', diet: 'Vg' }, { name: 'Huevos rancheros', diet: 'E' }] },
  { cuisine: 'Japanese and Korean', items: [
    { name: 'Chicken teriyaki', diet: 'M' }, { name: 'Katsu curry', diet: 'M' }, { name: 'Salmon donburi', diet: 'P' },
    { name: 'Bibimbap', diet: 'E' }, { name: 'Kimchi fried rice', diet: 'E' }, { name: 'Vegetable ramen', diet: 'Vg' }] },
];

/** Extra dish names the search box can always find, before the recipe library is consulted. */
export const MORE_DISHES = [
  'Goan fish curry', 'Chicken biryani', 'Karela sabzi', 'Lauki chana dal', 'Pav bhaji', 'Prawn malai curry',
  'Chole bhature', 'Fish moilee', 'Egg curry', 'Aloo gobi', 'Baingan bharta', 'Tinda masala', 'Thai basil chicken',
  'Teriyaki salmon', 'Grilled lemon fish', 'Moong dal khichdi',
];

export const SEXES = ['Female', 'Male'] as const;
export const REGIONS = ['South Asian', 'East Asian', 'Southeast Asian', 'Middle Eastern', 'African', 'European', 'Latin American', 'Mixed or other'] as const;
export const ACTIVITIES = ['Mostly sitting', 'Lightly active', 'Active', 'Very active'] as const;
export const GOALS = ['Lose weight', 'Stay as I am', 'Build muscle'] as const;
export const PREGNANCY = ['Pregnant', 'Breastfeeding', 'Neither'] as const;
export const CONDITIONS = ['None', 'Diabetes', 'High blood pressure', 'Thyroid', 'PCOS', 'High cholesterol'] as const;

/** Soft tile background tints from the design. */
export const TINTS = ['#FCE3CF', '#DCEBD4', '#DCE6F8', '#E9DFFB', '#FBE0E6', '#FFF0C2'];
