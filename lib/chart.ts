// Diet chart from body details: plain calculation, no AI (PDD MMP-BE-S2, REG-1, REG-2).
import { BODY_RANGES } from '@/components/setup/chart';
import type { BodyDetails, Chart, Goal, Pregnancy } from '@/lib/types';
import type { HealthFlag } from '@/lib/settings';

const ACTIVITY_FACTOR: Record<BodyDetails['activity'], number> = {
  'Mostly sitting': 1.2, 'Lightly active': 1.375, Active: 1.55, 'Very active': 1.725,
};

/** Mifflin-St Jeor resting energy, in kcal a day. */
export function restingKcal(d: Pick<BodyDetails, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number {
  return 10 * d.weightKg + 6.25 * d.heightCm - 5 * d.age + (d.sex === 'Male' ? 5 : -161);
}

/** Daily calorie target, rounded to 50 kcal, never below 1,000. */
export function calorieTarget(d: BodyDetails): number {
  let k = restingKcal(d) * ACTIVITY_FACTOR[d.activity];
  const expecting = d.sex === 'Female' && (d.pregnancy === 'Pregnant' || d.pregnancy === 'Breastfeeding');
  // About 0.5 kg a week is a 500 kcal daily deficit. Not applied during pregnancy or breastfeeding.
  if (d.goal === 'Lose weight' && !expecting) k -= 500;
  if (d.goal === 'Build muscle') k += 300;
  if (d.sex === 'Female' && d.pregnancy === 'Pregnant') k += 350;
  if (d.sex === 'Female' && d.pregnancy === 'Breastfeeding') k += 500;
  return Math.max(1000, Math.round(k / 50) * 50);
}

const CONDITION_RULES: Record<string, { favour: string[]; avoid: HealthFlag[] }> = {
  Diabetes: { favour: ['Low sugar', 'High-fibre carbs'], avoid: ['sugary food', 'refined flour'] },
  'High blood pressure': { favour: ['Low salt'], avoid: ['high salt'] },
  Thyroid: { favour: ['Balanced meals'], avoid: [] },
  PCOS: { favour: ['Low sugar', 'High fibre'], avoid: ['sugary food', 'refined flour'] },
  'High cholesterol': { favour: ['Low oil', 'High fibre'], avoid: ['deep-fried food', 'red meat', 'high fat'] },
};

const GOAL_RULES: Record<Goal, { favour: string[]; avoid: HealthFlag[] }> = {
  'Lose weight': { favour: ['Lean protein', 'High fibre', 'Low oil'], avoid: ['deep-fried food', 'sugary food'] },
  'Stay as I am': { favour: ['Lean protein', 'Two portions of vegetables per meal'], avoid: [] },
  'Build muscle': { favour: ['Extra protein', 'Whole grains'], avoid: [] },
};

export function advisoryFor(sex: string, pregnancy: Pregnancy | null, conditions: string[]): string | null {
  let cause = '';
  if (sex === 'Female' && pregnancy === 'Pregnant') cause = 'pregnancy';
  else if (sex === 'Female' && pregnancy === 'Breastfeeding') cause = 'breastfeeding';
  else {
    const first = conditions.find((c) => c !== 'None');
    if (first) cause = first === 'PCOS' ? 'PCOS' : first.toLowerCase();
  }
  return cause ? `Because of ${cause}, please check this plan with a doctor or dietitian.` : null;
}

/** Recipe guidance shared by body-details and photo charts. */
export function guidanceFor(goal: Goal, conditions: string[]): { recipeTypes: string[]; avoid: HealthFlag[] } {
  const favour = [...GOAL_RULES[goal].favour];
  const avoid = [...GOAL_RULES[goal].avoid];
  for (const c of conditions) {
    const rule = CONDITION_RULES[c];
    if (!rule) continue;
    favour.push(...rule.favour);
    avoid.push(...rule.avoid);
  }
  return { recipeTypes: [...new Set(favour)], avoid: [...new Set(avoid)] };
}

/** Grams of cooked staple (rice or equivalent) per meal, scaled from 150 g at 1,900 kcal. */
export function gramsPerServing(calories: number): number {
  return Math.round(((calories / 1900) * 150) / 10) * 10;
}

export function chartFromBody(d: BodyDetails, source: 'body' | 'photo' = 'body'): Chart {
  const calories = calorieTarget(d);
  const { recipeTypes, avoid } = guidanceFor(d.goal, d.conditions);
  return {
    source,
    calories,
    recipeTypes,
    gramsPerServing: gramsPerServing(calories),
    avoid,
    unsure: [],
    roughEstimate: source === 'photo',
    advisory: advisoryFor(d.sex, d.pregnancy, d.conditions),
  };
}

export function validBody(d: Partial<BodyDetails>): d is BodyDetails {
  return (
    typeof d.age === 'number' && d.age >= BODY_RANGES.age[0] && d.age <= BODY_RANGES.age[1] &&
    typeof d.heightCm === 'number' && d.heightCm >= BODY_RANGES.heightCm[0] && d.heightCm <= BODY_RANGES.heightCm[1] &&
    typeof d.weightKg === 'number' && d.weightKg >= BODY_RANGES.weightKg[0] && d.weightKg <= BODY_RANGES.weightKg[1] &&
    (d.sex === 'Female' || d.sex === 'Male') &&
    typeof d.activity === 'string' && d.activity in ACTIVITY_FACTOR &&
    typeof d.goal === 'string' && d.goal in GOAL_RULES &&
    Array.isArray(d.conditions)
  );
}
