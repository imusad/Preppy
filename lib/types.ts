// Shared data shapes for the whole app. Screens and server both import from here.

export type Diet = 'Vegetarian' | 'Eggetarian' | 'Pescatarian' | 'Non-vegetarian' | 'Vegan';

export type AllergenId =
  | 'gluten' | 'crustaceans' | 'eggs' | 'fish' | 'peanuts' | 'soy' | 'milk' | 'tree-nuts'
  | 'celery' | 'mustard' | 'sesame' | 'sulphites' | 'lupin' | 'molluscs';

// ---------- Diet chart ----------

export type ChartField = 'calories' | 'recipeTypes' | 'gramsPerServing';

export interface Chart {
  source: 'upload' | 'body' | 'photo';
  fileName?: string;
  /** Daily calorie target. null when an uploaded chart states none. */
  calories: number | null;
  /** Recipe types to favour, e.g. "Lean protein", "Low salt". */
  recipeTypes: string[];
  gramsPerServing: number | null;
  /** Foods the chart advises against, in plain words (e.g. "red meat", "fried food"). */
  avoid: string[];
  /** Values the reader was unsure of; highlighted with "Please check this value". */
  unsure: ChartField[];
  /** True for photo charts: labelled "Rough estimate". */
  roughEstimate: boolean;
  /** "Because of diabetes, please check this plan with a doctor or dietitian." */
  advisory: string | null;
}

export type Sex = 'Female' | 'Male';
export type Activity = 'Mostly sitting' | 'Lightly active' | 'Active' | 'Very active';
export type Goal = 'Lose weight' | 'Stay as I am' | 'Build muscle';
export type Pregnancy = 'Pregnant' | 'Breastfeeding' | 'Neither';

export interface BodyDetails {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
  /** Only asked when sex is Female. */
  pregnancy: Pregnancy | null;
  /** Tile labels from CONDITIONS; ['None'] when none. */
  conditions: string[];
}

export interface PhotoDetails {
  age: number;
  sex: Sex;
  region: string;
  goal: Goal;
  pregnancy: Pregnancy | null;
  conditions: string[];
}

// ---------- Setup ----------

export interface Person {
  id: string;
  name: string;
  /** Rupees per meal. */
  budget: number | null;
  diet: Diet | null;
  /** Restriction tile ids from RESTRICTIONS (lib/data/catalog), or ['none']. Empty = not answered. */
  restrictions: string[];
  /** Typed "Other" restrictions, free text. */
  otherRestrictions: string[];
  /** Dish names, or ['None']. Empty = not answered. */
  favourites: string[];
  leastFavourites: string[];
  /** Utensil ids from UTENSILS. */
  utensils: string[];
  chart: Chart | null;
  chartAccepted: boolean;
  /**
   * Screen-only working state for the chart forms (which option is open, typed body
   * details, etc.) so "Edit" can return with values kept. Never sent to the server.
   */
  chartDraft?: unknown;
}

export interface Household {
  morningMin: number;
  eveningMin: number;
  /** How many people eat lunch / dinner. The first N people in the list. */
  lunchCount: number | null;
  dinnerCount: number | null;
  city: string | null;
}

export interface Setup {
  household: Household;
  people: Person[];
}

// ---------- Plan ----------

export type FlagKind = 'non_compliant' | 'over_time' | 'over_budget' | 'no_recipe' | 'price_unavailable';

export interface Flag {
  kind: FlagKind;
  /** Full wording: "Over time window (+4 min)", "Non-compliant with diet chart", "Over budget (+₹30)". */
  label: string;
  /** Short wording for the exported image: "+4 min", "Non-compliant", "Over budget". */
  short: string;
}

export interface Ingredient {
  /** Quantity for ONE serving; null when the source gives no amount ("salt to taste"). */
  qty: number | null;
  unit: string;
  name: string;
}

export interface RecipeStep {
  text: string;
  when: 'ahead' | 'last';
  min: number;
}

export interface PlanRecipe {
  id: string;
  name: string;
  cuisine: string;
  kind: 'main' | 'side';
  /** Site or channel name for "Recipe from [source]". */
  source: string;
  /** null → show "Source link unavailable". */
  sourceUrl: string | null;
  image: string | null;
  images: string[];
  /** Link that opens the recipe video; null → "Video unavailable for this recipe". */
  videoUrl: string | null;
  /** YouTube video id when the video is on YouTube (used for a thumbnail); otherwise null. */
  youtubeId: string | null;
  totalMin: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  /** 1–5. */
  fun: number;
  /** Rupees per serving; null → "Price unavailable". */
  costPerServing: number | null;
  /** Names of the people this recipe suits. */
  who: string[];
}

export interface PlanDish {
  /** People eating this dish (one dish group). */
  who: string[];
  servings: number;
  /** null when no recipe was found for this group. */
  mainId: string | null;
  sideId: string | null;
  /** Why nothing was found, when mainId is null. */
  noRecipeReason?: string;
  totalMin: number;
  /** Minutes of this dish cooked in the morning. */
  morningMin: number;
  /** Minutes in the evening (0 for lunch). */
  eveningMin: number;
  /** Dinner only: "Evening finish: 15 min" or "Reheat + garnish, 5 min". */
  eveningLabel: string | null;
  /** Dinner only: short summary of the morning prep, e.g. "Marinate chicken, cook rice". */
  morningLabel: string | null;
  morningSteps: string[];
  eveningSteps: string[];
  /** Rupees for all servings of main + side; null → "Price unavailable". */
  cost: number | null;
  fun: number;
  flags: Flag[];
  /** e.g. "Skip the coriander garnish for Iman". */
  notes: string[];
}

export interface PlanMeal {
  dishes: PlanDish[];
}

export interface PlanDay {
  /** 1–14. Day 1 is a Monday. */
  day: number;
  dow: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  week: 1 | 2;
  lunch: PlanMeal;
  dinner: PlanMeal;
  morningUsed: number;
  morningWindow: number;
  eveningUsed: number;
  eveningWindow: number;
}

export interface Plan {
  id: string;
  createdAt: string;
  days: PlanDay[];
  /** Every recipe referenced by the plan or listed in the bank. */
  recipes: Record<string, PlanRecipe>;
  /** Recipe bank: every recipe found in this run. */
  bankIds: string[];
  /** Estimated cost per week in rupees; null → "Price unavailable". */
  weekCost: [number | null, number | null];
  /** "Nov 2026"; null when no price table exists yet. */
  pricesChecked: string | null;
  /** "Prices from Bengaluru" when the household city is not Bengaluru. */
  priceNote: string | null;
  /** Count of meals carrying each flag, across both weeks. */
  counts: Record<FlagKind, number>;
  people: string[];
  lunchWho: string[];
  dinnerWho: string[];
}

// ---------- Server API contract ----------

export type ChartUploadResult = { status: 'ok'; chart: Chart } | { status: 'unreadable' };
export type PhotoResult = { status: 'ok'; chart: Chart } | { status: 'unusable'; reason: string };
export type BodyChartResult = { status: 'ok'; chart: Chart };

export const PROGRESS_STEPS = ['Reading your profiles', 'Finding recipes', 'Building your 2 weeks', 'Estimating costs'] as const;

export interface RunProgress {
  status: 'running' | 'done' | 'failed' | 'stopped' | 'gone';
  /** Index into PROGRESS_STEPS of the step being worked on. */
  step: number;
  secondsLeft: number;
}
