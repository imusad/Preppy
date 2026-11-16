// A realistic full 14-day plan for tests and the preview page.
// Household: Iman eats lunch; Iman and Rohan eat dinner. Morning window 45 min, evening window 20 min.
import type { Flag, FlagKind, Ingredient, Plan, PlanDay, PlanDish, PlanRecipe, RecipeStep } from '../types';

const SOURCES: Record<string, string> = {
  'Hebbars Kitchen': 'https://hebbarskitchen.com/',
  "Archana's Kitchen": 'https://www.archanaskitchen.com/',
  'RecipeTin Eats': 'https://www.recipetineats.com/',
  'BBC Good Food': 'https://www.bbcgoodfood.com/',
  'Budget Bytes': 'https://www.budgetbytes.com/',
  'Ranveer Brar': 'https://ranveerbrar.com/',
  "Swasthi's Recipes": 'https://www.indianhealthyrecipes.com/',
  Tasty: 'https://tasty.co/',
  'Serious Eats': 'https://www.seriouseats.com/',
  'Bong Eats': 'https://www.bongeats.com/',
};

type Ing = [qty: number | null, unit: string, name: string];
type Row = [
  id: string, name: string, cuisine: string, kind: 'main' | 'side', min: number, fun: number,
  cost: number | null, source: string, video: boolean, link: boolean, ing: Ing[], steps: string[],
];

const ROWS: Row[] = [
  ['gpc', 'Goan prawn curry', 'Goan', 'main', 24, 4, 140, 'Hebbars Kitchen', true, true, [[200, 'g', 'prawns, cleaned'], [150, 'ml', 'coconut milk'], [1, '', 'onion, sliced'], [1, '', 'tomato, chopped'], [2, 'tbsp', 'Goan curry paste'], [2, '', 'kokum pieces'], [null, '', 'salt, to taste']], ['Sauté the onion until soft, add the curry paste and cook for 2 minutes.', 'Add tomato and kokum, cook until the tomato breaks down.', 'Pour in the coconut milk and simmer for 5 minutes.', 'Add the prawns and cook for 4 minutes until pink.', 'Garnish with coriander leaves.']],
  ['kach', 'Kachumber salad', 'Indian', 'side', 8, 3, 40, "Archana's Kitchen", true, true, [[1, '', 'cucumber, diced'], [1, '', 'tomato, diced'], [0.5, '', 'onion, diced'], [1, 'tsp', 'lemon juice'], [0.25, 'tsp', 'roasted cumin powder']], ['Dice the cucumber, tomato and onion.', 'Toss with lemon juice, cumin and a pinch of salt.', 'Serve chilled.']],
  ['tbc', 'Thai basil chicken', 'Thai', 'main', 25, 5, 150, 'RecipeTin Eats', true, true, [[150, 'g', 'chicken thigh, minced'], [4, '', 'garlic cloves'], [1, '', 'red chilli'], [10, '', 'Thai basil leaves'], [1, 'tbsp', 'soy sauce'], [1, 'tsp', 'oyster sauce']], ['Morning: marinate the chicken with soy sauce and chopped garlic.', 'Morning: slice the chilli and vegetables, then refrigerate.', 'Evening: stir-fry the chicken on high heat for 6 minutes.', 'Evening: add the sauces and basil, toss for 1 minute and serve.']],
  ['bok', 'Stir-fried bok choy', 'Chinese', 'side', 8, 3, 45, 'RecipeTin Eats', true, true, [[150, 'g', 'bok choy, halved'], [2, '', 'garlic cloves, sliced'], [1, 'tsp', 'sesame oil'], [1, 'tsp', 'soy sauce']], ['Heat the sesame oil and fry the garlic for 30 seconds.', 'Add the bok choy and toss for 3 minutes.', 'Season with soy sauce and serve.']],
  ['glf', 'Grilled lemon fish', 'Continental', 'main', 22, 4, 140, 'BBC Good Food', true, true, [[180, 'g', 'basa or seer fish fillet'], [1, 'tbsp', 'lemon juice'], [1, 'tsp', 'garlic paste'], [0.5, 'tsp', 'black pepper'], [1, 'tsp', 'olive oil']], ['Morning: marinate the fish with lemon, garlic, pepper and salt.', 'Evening: grill on a hot non-stick pan for 4 minutes a side.', 'Evening: finish with a squeeze of lemon.']],
  ['gbean', 'Garlic green beans', 'Continental', 'side', 10, 3, 25, 'Budget Bytes', true, true, [[120, 'g', 'green beans, trimmed'], [2, '', 'garlic cloves, sliced'], [1, 'tsp', 'olive oil']], ['Blanch the beans for 2 minutes.', 'Sauté the garlic in olive oil, add the beans and toss for 3 minutes.', 'Season and serve.']],
  ['pp', 'Palak paneer', 'North Indian', 'main', 30, 3, 160, 'Ranveer Brar', true, true, [[200, 'g', 'spinach'], [100, 'g', 'paneer, cubed'], [1, '', 'onion, chopped'], [1, '', 'tomato, chopped'], [1, 'tsp', 'ginger-garlic paste']], ['Blanch the spinach and blend to a purée.', 'Cook the onion, ginger-garlic and tomato into a masala.', 'Add the spinach purée and paneer and simmer for 5 minutes.', 'Garnish with coriander leaves.']],
  ['phul', 'Phulka', 'Indian', 'side', 15, 2, 20, "Swasthi's Recipes", false, true, [[60, 'g', 'whole-wheat flour'], [40, 'ml', 'water']], ['Knead a soft dough and rest it for 10 minutes.', 'Roll into thin rounds.', 'Cook on a tawa, then puff over the flame.']],
  ['raj', 'Rajma', 'North Indian', 'main', 35, 3, 45, 'Ranveer Brar', true, true, [[80, 'g', 'kidney beans, soaked overnight'], [1, '', 'onion, chopped'], [1, '', 'tomato, puréed'], [1, 'tsp', 'rajma masala']], ['Pressure-cook the soaked beans for 6 whistles.', 'Cook the onion and tomato into a masala with rajma masala.', 'Add the beans with their water and simmer for 10 minutes.', 'Garnish with coriander leaves.']],
  ['jeera', 'Jeera rice', 'Indian', 'side', 19, 2, 15, 'Hebbars Kitchen', true, true, [[75, 'g', 'basmati rice'], [0.5, 'tsp', 'cumin seeds'], [1, 'tsp', 'ghee']], ['Rinse and soak the rice for 10 minutes.', 'Temper cumin in ghee, add the rice and water.', 'Cook covered for 12 minutes.']],
  ['ter', 'Teriyaki salmon', 'Japanese', 'main', 20, 5, 200, 'Tasty', true, true, [[150, 'g', 'salmon fillet'], [2, 'tbsp', 'soy sauce'], [1, 'tbsp', 'honey'], [1, 'tsp', 'grated ginger']], ['Morning: marinate the salmon in soy, honey and ginger.', 'Evening: pan-sear skin side down for 5 minutes, flip for 3.', 'Evening: reduce the marinade into a glaze and spoon over.']],
  ['shak', 'Shakshuka', 'Middle Eastern', 'main', 22, 4, 120, 'Serious Eats', true, true, [[2, '', 'eggs'], [200, 'g', 'tomatoes, chopped'], [0.5, '', 'red bell pepper, sliced'], [0.5, 'tsp', 'smoked paprika']], ['Soften the pepper, add tomato and paprika and simmer for 8 minutes.', 'Make wells in the sauce and crack in the eggs.', 'Cover and cook until the whites set, about 6 minutes.']],
  ['moil', 'Fish moilee', 'Kerala', 'main', 32, 4, 150, "Archana's Kitchen", true, true, [[180, 'g', 'seer fish'], [200, 'ml', 'coconut milk'], [1, '', 'onion, sliced'], [2, '', 'green chillies, slit'], [0.25, 'tsp', 'turmeric']], ['Marinate the fish with turmeric and salt.', 'Sauté the onion and chillies, add thin coconut milk and simmer.', 'Add the fish, cook for 6 minutes and finish with thick coconut milk.']],
  ['mbir', 'Mutton biryani', 'Hyderabadi', 'main', 50, 5, 230, 'Ranveer Brar', true, true, [[180, 'g', 'mutton, bone-in'], [100, 'g', 'basmati rice'], [80, 'g', 'yogurt'], [1, 'tbsp', 'biryani masala'], [1, '', 'onion, fried']], ['Morning: marinate the mutton in yogurt and masala, par-boil the rice.', 'Evening: layer mutton and rice in a pressure cooker and cook for 2 whistles.', 'Evening: rest for 5 minutes before opening.']],
  ['sdon', 'Salmon donburi', 'Japanese', 'main', 20, 5, 170, 'Tasty', true, true, [[120, 'g', 'salmon fillet'], [75, 'g', 'sushi rice'], [1, 'tbsp', 'soy sauce'], [1, 'tsp', 'sesame seeds']], ['Morning: cook the rice and marinate the salmon.', 'Evening: sear the salmon for 3 minutes a side.', 'Evening: slice over warm rice, drizzle with soy and sesame.']],
  ['raita', 'Cucumber raita', 'Indian', 'side', 6, 2, 30, 'Hebbars Kitchen', false, true, [[100, 'g', 'yogurt'], [0.5, '', 'cucumber, grated'], [0.25, 'tsp', 'roasted cumin']], ['Whisk the yogurt.', 'Stir in the cucumber, cumin and salt.']],
  ['hakka', 'Hakka noodles with tofu', 'Indo-Chinese', 'main', 20, 4, 80, 'Hebbars Kitchen', true, true, [[75, 'g', 'noodles'], [100, 'g', 'firm tofu'], [1, '', 'carrot, julienned'], [0.5, '', 'capsicum, sliced'], [1, 'tbsp', 'soy sauce']], ['Morning: press and cube the tofu, slice the vegetables.', 'Evening: boil the noodles, drain and toss in a little oil.', 'Evening: stir-fry the tofu and vegetables, add the noodles and sauce.']],
  ['egg', 'Egg curry', 'Bengali', 'main', 25, 3, 90, 'Bong Eats', true, true, [[2, '', 'eggs, boiled'], [1, '', 'onion, chopped'], [1, '', 'tomato, chopped'], [0.5, 'tsp', 'garam masala']], ['Boil and peel the eggs.', 'Cook the onion and tomato into a masala.', 'Add the eggs and a little water and simmer for 8 minutes.', 'Garnish with coriander leaves.']],
  ['pasta', 'Prawn arrabbiata', 'Italian', 'main', 20, 4, 140, 'BBC Good Food', true, true, [[80, 'g', 'penne'], [120, 'g', 'prawns'], [200, 'g', 'crushed tomatoes'], [2, '', 'garlic cloves'], [0.5, 'tsp', 'chilli flakes']], ['Morning: simmer garlic, chilli and tomatoes into a sauce.', 'Evening: boil the penne.', 'Evening: cook the prawns in the sauce and toss with the pasta.']],
  ['chana', 'Chana masala', 'North Indian', 'main', 30, 3, 60, "Swasthi's Recipes", true, true, [[80, 'g', 'chickpeas, soaked'], [1, '', 'onion, chopped'], [1, '', 'tomato, chopped'], [1, 'tsp', 'chana masala']], ['Pressure-cook the chickpeas for 5 whistles.', 'Cook the onion and tomato with the masala.', 'Add the chickpeas and simmer for 10 minutes.', 'Garnish with coriander leaves.']],
  ['gfc', 'Goan fish curry', 'Goan', 'main', 28, 4, null, 'Hebbars Kitchen', true, false, [[180, 'g', 'kingfish steaks'], [150, 'ml', 'coconut milk'], [2, 'tbsp', 'Goan red masala'], [2, '', 'kokum pieces']], ['Simmer the masala in coconut milk for 5 minutes.', 'Add the kokum and fish.', 'Cook gently for 8 minutes without stirring.']],
  ['burr', 'Chicken burrito bowl', 'Mexican', 'main', 25, 5, 140, 'Budget Bytes', true, true, [[150, 'g', 'chicken breast'], [60, 'g', 'rice'], [60, 'g', 'black beans, cooked'], [0.5, '', 'avocado'], [2, 'tbsp', 'salsa']], ['Morning: cook the rice and beans, marinate the chicken.', 'Evening: sear the chicken and slice.', 'Evening: assemble bowls with rice, beans, chicken, avocado and salsa.']],
  ['greek', 'Greek salad', 'Greek', 'side', 10, 3, 45, 'BBC Good Food', true, true, [[0.5, '', 'cucumber, chopped'], [1, '', 'tomato, chopped'], [30, 'g', 'feta'], [6, '', 'olives']], ['Chop the vegetables.', 'Top with feta and olives, dress with olive oil and oregano.']],
  ['spin', 'Sautéed spinach', 'Continental', 'side', 8, 2, 40, 'Budget Bytes', true, false, [[150, 'g', 'spinach'], [2, '', 'garlic cloves'], [1, 'tsp', 'olive oil']], ['Sauté the garlic in olive oil.', 'Add the spinach and wilt for 2 minutes.', 'Season with salt and pepper.']],
  ['quin', 'Lemon quinoa', 'Continental', 'side', 15, 3, 70, 'Budget Bytes', true, true, [[60, 'g', 'quinoa'], [1, 'tsp', 'lemon juice'], [1, 'tsp', 'olive oil']], ['Rinse the quinoa and cook in double its volume of water for 12 minutes.', 'Fluff and stir in lemon juice and olive oil.']],
  ['rice', 'Steamed rice', 'Indian', 'side', 15, 1, 10, 'Hebbars Kitchen', false, false, [[75, 'g', 'rice (150 g cooked)']], ['Rinse the rice.', 'Cook covered with double the water for 12 minutes.']],
  ['thaicur', 'Thai green curry with vegetables', 'Thai', 'main', 25, 5, 110, 'RecipeTin Eats', true, true, [[2, 'tbsp', 'green curry paste'], [200, 'ml', 'coconut milk'], [150, 'g', 'mixed vegetables'], [5, '', 'Thai basil leaves']], ['Morning: chop the vegetables.', 'Evening: fry the curry paste, add coconut milk and simmer.', 'Evening: add the vegetables, cook for 6 minutes and finish with basil.']],
  ['dal', 'Moong dal tadka', 'Indian', 'main', 20, 3, 60, "Swasthi's Recipes", true, true, [[60, 'g', 'yellow moong dal'], [1, 'tsp', 'ghee'], [0.5, 'tsp', 'cumin seeds'], [2, '', 'garlic cloves']], ['Pressure-cook the dal for 3 whistles.', 'Temper cumin and garlic in ghee.', 'Pour the tempering over the dal.', 'Garnish with coriander leaves.']],
  ['pulao', 'Vegetable pulao', 'North Indian', 'main', 30, 3, 70, 'Hebbars Kitchen', true, true, [[75, 'g', 'basmati rice'], [100, 'g', 'mixed vegetables, diced'], [1, '', 'bay leaf'], [1, 'tsp', 'ghee'], [null, '', 'whole spices, a pinch']], ['Rinse the rice and soak for 10 minutes.', 'Fry the whole spices and vegetables in ghee for 3 minutes.', 'Add the rice and water and cook covered for 12 minutes.']],
  ['aloo', 'Aloo gobi', 'Punjabi', 'main', 28, 3, 55, 'Ranveer Brar', true, true, [[150, 'g', 'cauliflower florets'], [1, '', 'potato, cubed'], [1, '', 'tomato, chopped'], [0.5, 'tsp', 'turmeric'], [1, 'tsp', 'cumin seeds']], ['Temper the cumin, add potato and cook covered for 6 minutes.', 'Add the cauliflower, tomato and turmeric.', 'Cook covered on low heat for 12 minutes, stirring twice.']],
  ['tacos', 'Fish tacos', 'Mexican', 'main', 25, 5, 180, 'Serious Eats', true, true, [[150, 'g', 'white fish fillet'], [2, '', 'corn tortillas'], [50, 'g', 'cabbage, shredded'], [1, 'tbsp', 'lime juice'], [1, 'tbsp', 'yogurt']], ['Season the fish and pan-fry for 3 minutes a side.', 'Toss the cabbage with lime juice and salt.', 'Warm the tortillas and fill with fish, slaw and yogurt.']],
  ['beans', 'Beans poriyal', 'Tamil', 'side', 12, 3, 30, "Archana's Kitchen", true, true, [[120, 'g', 'green beans, chopped'], [1, 'tbsp', 'grated coconut'], [0.5, 'tsp', 'mustard seeds'], [1, '', 'dried red chilli']], ['Temper the mustard seeds and chilli.', 'Add the beans with a splash of water and cook for 7 minutes.', 'Stir in the coconut and serve.']],
];

function toSteps(lines: string[], totalMin: number): RecipeStep[] {
  const each = Math.max(1, Math.round(totalMin / lines.length));
  return lines.map((line, i) => {
    const m = /^(Morning|Evening):\s*(.*)$/.exec(line);
    const text = m ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : line;
    const when: RecipeStep['when'] = m ? (m[1] === 'Morning' ? 'ahead' : 'last') : i === lines.length - 1 ? 'last' : 'ahead';
    return { text, when, min: each };
  });
}

const recipes: Record<string, PlanRecipe> = {};
for (const [id, name, cuisine, kind, min, fun, cost, source, video, link, ing, steps] of ROWS) {
  recipes[id] = {
    id, name, cuisine, kind, source,
    sourceUrl: link ? SOURCES[source] : null,
    image: null,
    images: [],
    videoUrl: video ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} recipe ${source}`)}` : null,
    youtubeId: null,
    totalMin: min,
    ingredients: ing.map(([qty, unit, n]): Ingredient => ({ qty, unit, name: n })),
    steps: toSteps(steps, min),
    fun,
    costPerServing: cost,
    who: [],
  };
}

const IMAN = ['Iman'];
const ROHAN = ['Rohan'];
const BOTH = ['Iman', 'Rohan'];

const NC: Flag = { kind: 'non_compliant', label: 'Non-compliant with diet chart', short: 'Non-compliant' };
const PU: Flag = { kind: 'price_unavailable', label: 'Price unavailable', short: 'Price unavailable' };
const NR: Flag = { kind: 'no_recipe', label: 'No recipe found', short: 'No recipe found' };
const OT = (n: number): Flag => ({ kind: 'over_time', label: `Over time window (+${n} min)`, short: `+${n} min` });
const OB = (n: number): Flag => ({ kind: 'over_budget', label: `Over budget (+₹${n})`, short: 'Over budget' });

const split = (s: string) => s.split(', ').map((p) => p.charAt(0).toUpperCase() + p.slice(1));

function lunch(main: string, side: string, min: number, cost: number | null, flags: Flag[] = [], notes: string[] = []): PlanDish {
  return {
    who: IMAN, servings: 1, mainId: main, sideId: side, totalMin: min, morningMin: min, eveningMin: 0,
    eveningLabel: null, morningLabel: null, morningSteps: [], eveningSteps: [],
    cost, fun: recipes[main].fun, flags, notes,
  };
}

function dinner(
  who: string[], main: string, side: string, cost: number | null,
  prep: string, pm: number, fin: string, fm: number,
  flags: Flag[] = [], notes: string[] = [], eveningLabel?: string,
): PlanDish {
  return {
    who, servings: who.length, mainId: main, sideId: side, totalMin: pm + fm, morningMin: pm, eveningMin: fm,
    eveningLabel: eveningLabel ?? `Evening finish: ${fm} min`,
    morningLabel: prep, morningSteps: split(prep), eveningSteps: split(fin),
    cost, fun: recipes[main].fun, flags, notes,
  };
}

const noDinner: PlanDish = {
  who: BOTH, servings: 2, mainId: null, sideId: null,
  noRecipeReason: "Nothing we found fits both Iman's pescatarian diet and Rohan's diet chart with the utensils you have.",
  totalMin: 0, morningMin: 0, eveningMin: 0, eveningLabel: null, morningLabel: null,
  morningSteps: [], eveningSteps: [], cost: null, fun: 0, flags: [NR], notes: [],
};

const GARNISH = 'Skip the coriander garnish for Iman';

const MEALS: [PlanDish[], PlanDish[]][] = [
  [[lunch('gpc', 'kach', 32, 180, [], [GARNISH])], [dinner(BOTH, 'tbc', 'bok', 390, 'Marinate chicken, chop vegetables', 9, 'Stir-fry chicken and bok choy', 15)]],
  [[lunch('shak', 'spin', 30, 160)], [dinner(BOTH, 'raj', 'jeera', 120, 'Pressure-cook the soaked rajma', 15, 'Cook the masala, add rajma, make jeera rice', 19, [], ['Skip the coriander garnish for Iman and Rohan'])]],
  [[lunch('moil', 'kach', 40, 190, [OT(6)])], [dinner(BOTH, 'glf', 'gbean', 330, 'Marinate fish, trim and blanch beans', 11, 'Grill fish, sauté beans', 16)]],
  [[lunch('egg', 'phul', 40, 110, [], [GARNISH])], [dinner(BOTH, 'thaicur', 'rice', 240, 'Chop vegetables', 5, 'Simmer curry with coconut milk, steam rice', 24, [OT(4)])]],
  [[lunch('gfc', 'kach', 36, null, [PU])], [dinner(BOTH, 'hakka', 'bok', 250, 'Press and cube tofu, slice vegetables', 8, 'Boil noodles, toss everything in the wok', 15)]],
  [[lunch('dal', 'quin', 35, 130, [], [GARNISH])], [
    dinner(ROHAN, 'mbir', 'raita', 260, 'Marinate mutton, par-boil rice', 6, 'Pressure-cook biryani', 10, [NC], ["Red meat is on Rohan's avoid list. Nothing else matched his favourites this week."]),
    dinner(IMAN, 'sdon', 'spin', 210, 'Cook sushi rice, marinate salmon', 4, 'Sear salmon, wilt spinach', 8),
  ]],
  [[lunch('chana', 'kach', 38, 100, [], [GARNISH])], [dinner(BOTH, 'ter', 'spin', 480, 'Marinate salmon', 5, 'Pan-sear salmon, wilt spinach', 14, [OB(30)])]],
  [[lunch('pp', 'kach', 38, 200, [], [GARNISH])], [dinner(BOTH, 'burr', 'greek', 370, 'Cook rice and beans, marinate chicken', 7, 'Sear chicken, assemble bowls', 15)]],
  [[lunch('hakka', 'kach', 28, 120)], [dinner(BOTH, 'gpc', 'rice', 300, 'Cook the curry base', 15, 'Simmer curry, add prawns, steam rice', 23, [OT(3)], ['Skip the coriander garnish for Iman and Rohan'])]],
  [[lunch('egg', 'kach', 33, 130, [], [GARNISH])], [dinner(BOTH, 'glf', 'quin', 420, 'Marinate fish, cook quinoa', 10, 'Grill fish, warm quinoa', 14)]],
  [[lunch('shak', 'phul', 26, 140)], [dinner(BOTH, 'raj', 'jeera', 120, 'Cook rajma and jeera rice fully', 19, 'Reheat, garnish', 5, [], ["This dish can't be split, so it's cooked fully in the morning."], 'Reheat + garnish, 5 min')]],
  [[lunch('gfc', 'kach', 36, null, [NC, PU], ["Coconut-rich curry is outside Iman's diet chart."])], [dinner(BOTH, 'pasta', 'greek', 370, 'Make the arrabbiata sauce', 9, 'Boil pasta, toss with prawns and sauce', 16)]],
  [[lunch('dal', 'quin', 35, 130, [], [GARNISH])], [dinner(BOTH, 'ter', 'gbean', null, 'Marinate salmon, trim beans', 6, 'Pan-sear salmon, sauté beans', 15, [PU])]],
  [[lunch('pp', 'rice', 45, 170, [], [GARNISH])], [noDinner]],
];

const DOW: PlanDay['dow'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const sum = (dishes: PlanDish[], f: (d: PlanDish) => number) => dishes.reduce((a, d) => a + f(d), 0);

const days: PlanDay[] = MEALS.map(([l, d], i) => ({
  day: i + 1,
  dow: DOW[i % 7],
  week: i < 7 ? 1 : 2,
  lunch: { dishes: l },
  dinner: { dishes: d },
  morningUsed: sum(l, (x) => x.morningMin) + sum(d, (x) => x.morningMin),
  morningWindow: 45,
  eveningUsed: sum(d, (x) => x.eveningMin),
  eveningWindow: 20,
}));

// Who each recipe is for: the people who eat it in the plan; unused bank recipes suit everyone.
for (const day of days) {
  for (const dish of [...day.lunch.dishes, ...day.dinner.dishes]) {
    for (const id of [dish.mainId, dish.sideId]) {
      if (!id) continue;
      const r = recipes[id];
      r.who = BOTH.filter((n) => r.who.includes(n) || dish.who.includes(n));
    }
  }
}
for (const r of Object.values(recipes)) if (!r.who.length) r.who = [...BOTH];

const counts: Record<FlagKind, number> = { non_compliant: 0, over_time: 0, over_budget: 0, no_recipe: 0, price_unavailable: 0 };
for (const day of days) {
  for (const meal of [day.lunch, day.dinner]) {
    const kinds = new Set(meal.dishes.flatMap((d) => d.flags.map((f) => f.kind)));
    kinds.forEach((k) => { counts[k] += 1; });
  }
}

const weekCost = ([1, 2] as const).map((w) => {
  const priced = days.filter((d) => d.week === w).flatMap((d) => [...d.lunch.dishes, ...d.dinner.dishes]).filter((d) => d.cost !== null);
  return priced.length ? sum(priced, (d) => d.cost ?? 0) : null;
}) as [number | null, number | null];

export const samplePlan: Plan = {
  id: 'sample-plan',
  createdAt: '2026-11-16T06:30:00.000Z',
  days,
  recipes,
  bankIds: ROWS.map((r) => r[0]),
  weekCost,
  pricesChecked: 'Nov 2026',
  priceNote: 'Prices from Bengaluru',
  counts,
  people: BOTH,
  lunchWho: IMAN,
  dinnerWho: BOTH,
};
