import { describe, expect, it } from 'vitest';
import { calorieTarget, chartFromBody } from '@/lib/chart';
import type { BodyDetails } from '@/lib/types';

const base: BodyDetails = { age: 34, sex: 'Male', heightCm: 176, weightKg: 74, activity: 'Active', goal: 'Stay as I am', pregnancy: null, conditions: ['None'] };

describe('diet chart from body details', () => {
  it('uses Mifflin-St Jeor, rounded to 50 kcal', () => {
    const expected = Math.round(((10 * 74 + 6.25 * 176 - 5 * 34 + 5) * 1.55) / 50) * 50;
    expect(calorieTarget(base)).toBe(expected);
    expect(expected).toBe(2600);
  });
  it('never drops a weight-loss target below 1,000 kcal', () => {
    expect(calorieTarget({ ...base, sex: 'Female', age: 80, heightCm: 140, weightKg: 35, activity: 'Mostly sitting', goal: 'Lose weight' })).toBe(1000);
  });
  it('high blood pressure favours low salt', () => {
    expect(chartFromBody({ ...base, conditions: ['High blood pressure'] }).recipeTypes).toContain('Low salt');
  });
  it('pregnancy adds the advisory', () => {
    expect(chartFromBody({ ...base, sex: 'Female', pregnancy: 'Pregnant' }).advisory).toBe('Because of pregnancy, please check this plan with a doctor or dietitian.');
  });
  it('several conditions: advisory names the first, guidance applies all', () => {
    const c = chartFromBody({ ...base, conditions: ['Diabetes', 'High blood pressure'] });
    expect(c.advisory).toBe('Because of diabetes, please check this plan with a doctor or dietitian.');
    expect(c.recipeTypes).toEqual(expect.arrayContaining(['Low sugar', 'Low salt']));
  });
  it('photo charts are rough estimates', () => {
    expect(chartFromBody(base, 'photo').roughEstimate).toBe(true);
  });
});
