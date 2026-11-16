// The one settings list (PDD D-008). Change a value here, or set the matching
// environment variable in Vercel, to tune the app without touching other code.

const num = (name: string, fallback: number) => {
  const v = process.env[name];
  return v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : fallback;
};
const str = (name: string, fallback: string) => process.env[name] || fallback;

export const settings = {
  // ---- AI models (INT-1, NFR-8). Model choice is a setting, not code. ----
  models: {
    chartReading: str('MODEL_CHART_READING', 'claude-sonnet-5-5'),
    tagging: str('MODEL_TAGGING', 'claude-haiku-5-5'),
    recheck: str('MODEL_RECHECK', 'claude-sonnet-5-5'),
    /** Second look at allergens where the word list and the tagger disagree. */
    allergenCheck: str('MODEL_ALLERGEN_CHECK', 'claude-haiku-5-5'),
    prices: str('MODEL_PRICES', 'claude-haiku-5-5'),
  },
  /** US dollars per million tokens: [input, output]. Used for the run cost total. */
  modelPrices: {
    'claude-sonnet-5-5': [2, 10],
    'claude-haiku-5-5': [0.1, 0.5],
    'claude-opus-5-5': [4, 20],
  } as Record<string, [number, number]>,
  webSearchUsdPerSearch: 0.01,

  // ---- Cost guard (TECH-3) ----
  runCostCapUsd: num('RUN_COST_CAP_USD', 0.25),
  /** Top-up stops once the run's AI cost reaches this. */
  runCostGuardUsd: num('RUN_COST_GUARD_USD', 0.2),
  topUpMaxRecipes: num('TOPUP_MAX_RECIPES', 30),
  /** Stops friends (or strangers) running up the bill. */
  maxRunsPerDay: num('MAX_RUNS_PER_DAY', 12),

  // ---- Plan hold (TECH-1) ----
  holdHours: num('HOLD_HOURS', 24),
  /** A run with no progress for this long is reported as stopped. */
  stalledAfterSeconds: 300,

  // ---- Setup defaults ----
  defaultMorningMin: 45,
  defaultEveningMin: 20,

  // ---- Planner rules ----
  days: 14,
  sideMaxMin: num('SIDE_MAX_MIN', 15),
  reheatMin: 5,
  minCuisines: 6,
  maxSameCuisineInARow: 2,
  /** At least 1 in this many meals comes from outside the group's favourite cuisines. */
  outsideFavouritesEvery: 4,
  bankMaxRecipes: 400,
  /** Share of the daily calorie target that one lunch or dinner should provide. */
  mealCalorieShare: 0.325,
  /** A meal this far above its calorie share is treated as breaking the chart. */
  calorieOverFactor: 1.5,

  // ---- Fun factor ----
  fun: { base: 1, newCuisine: 2, newTechniqueOrIngredient: 1, popular: 1 },
  popularity: { minStars: 4.5, minRatings: 50, minViews: 100_000, minLikeRatio: 0.03 },

  // ---- Waiting estimate (seconds) ----
  estimate: { base: 30, perGroup: 30, perTopUp: 5 },

  // ---- Library and prices ----
  libraryTarget: num('LIBRARY_TARGET', 3000),
  priceCity: 'Bengaluru',
  priceRefreshMonths: 3,
  priceSearchCap: num('PRICE_SEARCH_CAP', 48),
  youtubeDailySearches: 95,

  /** Approved recipe sources (INT-3). Remove a line to stop using a site. */
  sources: [
    { id: 'hebbars', name: 'Hebbars Kitchen', host: 'hebbarskitchen.com', include: '^https://hebbarskitchen\\.com/[a-z0-9-]+-recipe[a-z0-9-]*/$' },
    { id: 'archanas', name: "Archana's Kitchen", host: 'www.archanaskitchen.com', include: '^https://www\\.archanaskitchen\\.com/recipe/[a-z0-9-]+$' },
    { id: 'ranveer', name: 'Ranveer Brar', host: 'ranveerbrar.com', include: '^https://ranveerbrar\\.com/recipes/[a-z0-9-]+/$' },
    { id: 'swasthi', name: "Swasthi's Recipes", host: 'www.indianhealthyrecipes.com', include: '^https://www\\.indianhealthyrecipes\\.com/[a-z0-9-]+/$' },
    { id: 'bongeats', name: 'Bong Eats', host: 'www.bongeats.com', include: '^https://www\\.bongeats\\.com/recipe/[a-z0-9-]+$' },
    { id: 'bbcgoodfood', name: 'BBC Good Food', host: 'www.bbcgoodfood.com', include: '^https://www\\.bbcgoodfood\\.com/recipes/[a-z0-9-]+$' },
    { id: 'tasty', name: 'Tasty', host: 'tasty.co', include: '^https://tasty\\.co/recipe/[a-z0-9-]+$' },
    { id: 'recipetineats', name: 'RecipeTin Eats', host: 'www.recipetineats.com', include: '^https://www\\.recipetineats\\.com/[a-z0-9-]+/$' },
    { id: 'seriouseats', name: 'Serious Eats', host: 'www.seriouseats.com', include: '^https://www\\.seriouseats\\.com/[a-z0-9-]+-recipe-?[0-9]*$' },
    // Healthy, English-language sites added for variety beyond Indian food.
    { id: 'minimalistbaker', name: 'Minimalist Baker (vegan)', host: 'minimalistbaker.com', include: '^https://minimalistbaker\\.com/[a-z0-9-]+/$' },
    { id: 'rainbowplantlife', name: 'Rainbow Plant Life (vegan)', host: 'rainbowplantlife.com', include: '^https://rainbowplantlife\\.com/[a-z0-9-]+/$' },
    { id: 'pipingpotcurry', name: 'Piping Pot Curry', host: 'pipingpotcurry.com', include: '^https://pipingpotcurry\\.com/[a-z0-9-]+/$' },
    { id: 'isabeleats', name: 'Isabel Eats (Mexican)', host: 'www.isabeleats.com', include: '^https://www\\.isabeleats\\.com/[a-z0-9-]+/$' },
    { id: 'rustickitchen', name: 'Inside the Rustic Kitchen (Italian)', host: 'www.insidetherustickitchen.com', include: '^https://www\\.insidetherustickitchen\\.com/[a-z0-9-]+/$' },
    { id: 'mediterraneandish', name: 'The Mediterranean Dish', host: 'www.themediterraneandish.com', include: '^https://www\\.themediterraneandish\\.com/[a-z0-9-]+/$' },
    { id: 'seonkyoung', name: 'Seonkyoung Longest (Korean)', host: 'seonkyounglongest.com', include: '^https://seonkyounglongest\\.com/[a-z0-9-]+/$' },
    { id: 'koreanbapsang', name: 'Korean Bapsang', host: 'www.koreanbapsang.com', include: '^https://www\\.koreanbapsang\\.com/[a-z0-9-]+/$' },
    { id: 'chopstickchronicles', name: 'Chopstick Chronicles (Japanese)', host: 'www.chopstickchronicles.com', include: '^https://www\\.chopstickchronicles\\.com/[a-z0-9-]+/$' },
    { id: 'budgetbytes', name: 'Budget Bytes', host: 'www.budgetbytes.com', include: '^https://www\\.budgetbytes\\.com/[a-z0-9-]+/$' },
  ],
  /** How this app introduces itself to recipe sites. */
  userAgent: 'PreppyMealPlanner/1.0 (private household meal planner)',
};

export type SourceConfig = (typeof settings.sources)[number];

export const CUISINES = [
  'North Indian', 'South Indian', 'Bengali', 'Indo-Chinese', 'Italian', 'Middle Eastern', 'Thai', 'Mexican',
  'Japanese and Korean', 'Other Indian', 'Other',
] as const;

/** Things a diet chart can advise against; recipes carry the same words as health flags. */
export const HEALTH_FLAGS = ['red meat', 'deep-fried food', 'sugary food', 'refined flour', 'high salt', 'high fat'] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];
