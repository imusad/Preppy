// Reading uploaded diet charts and photos (PDD MMP-BE-S1). The file is held in memory only
// for the length of the request: nothing is written to disk or to the database.
import type Anthropic from '@anthropic-ai/sdk';
import { askJson } from '@/lib/ai';
import { chartFromBody } from '@/lib/chart';
import { HEALTH_FLAGS, settings } from '@/lib/settings';
import type { Chart, ChartField, ChartUploadResult, PhotoDetails, PhotoResult } from '@/lib/types';

const IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export function fileKind(name: string, type: string): 'pdf' | 'image' | 'html' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if ((IMAGE_TYPES as readonly string[]).includes(type) || ['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
  if (type === 'text/html' || ['html', 'htm'].includes(ext)) return 'html';
  return null;
}

function imageType(name: string, type: string): ImageType {
  return type === 'image/png' || name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

const sureness = { type: 'string', enum: ['sure', 'unsure'] };

const CHART_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'calories', 'caloriesCertainty', 'recipeTypes', 'recipeTypesCertainty', 'gramsPerServing', 'gramsCertainty', 'avoid', 'avoidFoods', 'avoidFoodsCertainty', 'mealKcal'],
  properties: {
    readable: { type: 'boolean' },
    calories: { type: ['integer', 'null'] },
    caloriesCertainty: sureness,
    recipeTypes: { type: 'array', items: { type: 'string' } },
    recipeTypesCertainty: sureness,
    gramsPerServing: { type: ['integer', 'null'] },
    gramsCertainty: sureness,
    avoid: { type: 'array', items: { type: 'string', enum: [...HEALTH_FLAGS] } },
    avoidFoods: { type: 'array', items: { type: 'string' } },
    avoidFoodsCertainty: sureness,
    mealKcal: { type: ['integer', 'null'] },
  },
};

const CHART_SYSTEM = `You read diet charts written by dietitians and return a few facts for a meal-planning app.

Return:
- readable: false if the document is not a diet chart, or is too blurry, cropped or faint to read with confidence. When false, leave the other values empty or null.
- calories: the daily calorie target in kcal if the chart states one. Use null if it states none. Never work one out yourself.
- recipeTypes: up to 5 short phrases (2 to 6 words each) naming the kinds of food the chart favours for lunch and dinner, such as "Lean protein at lunch and dinner", "Low salt", "Fish, dal and vegetables".
- gramsPerServing: the grams of the main cooked staple (rice, roti equivalent or similar) the chart allows per lunch or dinner. If the chart gives cups, katoris or pieces, convert to grams and mark it unsure. Use null if nothing like it is stated.
- avoid: which of the listed things the chart tells the person to avoid or strictly limit.
- avoidFoods: up to 8 specific foods the chart says to stop or cut out completely, each a short lower-case word or phrase (for example "rice", "potato", "paneer", "mushrooms"). Only a real food or ingredient the chart itself names. Leave out limits ("excess oil", "minimal sugar", "reduce salt"), broad categories ("processed foods", "fried food", "sugar", "refined flour") and anything covered by the avoid list above. Leave it empty when none are named, and never add foods from your own knowledge of the condition.
- mealKcal: the calories of one lunch or dinner, if the chart's own lunch and dinner options show them (for example options marked about 350 kcal each: use the typical value). Use null if they are not shown. Where a meal's header and its options disagree, trust the options. Never work one out yourself.
- For each of the values, say "unsure" whenever the text was hard to read, you had to convert or infer, or the chart is ambiguous. Say "sure" only when the chart states it plainly.

A wrong value marked sure is the worst outcome. When in doubt, mark it unsure.`;

interface ChartAnswer {
  readable: boolean;
  calories: number | null;
  caloriesCertainty: 'sure' | 'unsure';
  recipeTypes: string[];
  recipeTypesCertainty: 'sure' | 'unsure';
  gramsPerServing: number | null;
  gramsCertainty: 'sure' | 'unsure';
  avoid: string[];
  avoidFoods: string[];
  avoidFoodsCertainty: 'sure' | 'unsure';
  mealKcal: number | null;
}

export async function readChartFile(name: string, type: string, bytes: Buffer): Promise<{ result: ChartUploadResult; costUsd: number }> {
  const kind = fileKind(name, type);
  if (!kind || bytes.length === 0) return { result: { status: 'unreadable' }, costUsd: 0 };
  // Very large files would cost a large share of the AI credit; a diet chart is never this big.
  if (kind === 'pdf' && bytes.length > 3_000_000) return { result: { status: 'unreadable' }, costUsd: 0 };

  const content: Anthropic.ContentBlockParam[] = [];
  if (kind === 'pdf') {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } });
  } else if (kind === 'image') {
    content.push({ type: 'image', source: { type: 'base64', media_type: imageType(name, type), data: bytes.toString('base64') } });
  } else {
    const text = bytes.toString('utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 40 || text.length > 30000) return { result: { status: 'unreadable' }, costUsd: 0 };
    content.push({ type: 'text', text: `<diet_chart>\n${text}\n</diet_chart>` });
  }
  content.push({ type: 'text', text: 'Read this diet chart.' });

  const ai = await askJson<ChartAnswer>({
    task: 'chart-read', model: settings.models.chartReading, system: CHART_SYSTEM, content, schema: CHART_SCHEMA, maxTokens: 2000,
  });
  const a = ai.data;
  if (!a || !a.readable || (a.calories === null && a.recipeTypes.length === 0 && a.gramsPerServing === null)) {
    return { result: { status: 'unreadable' }, costUsd: ai.costUsd };
  }
  const unsure: ChartField[] = [];
  if (a.calories !== null && a.caloriesCertainty === 'unsure') unsure.push('calories');
  if (a.recipeTypes.length > 0 && a.recipeTypesCertainty === 'unsure') unsure.push('recipeTypes');
  if (a.gramsPerServing !== null && a.gramsCertainty === 'unsure') unsure.push('gramsPerServing');
  const avoidFoods = [...new Set((a.avoidFoods ?? []).map((f) => f.toLowerCase().trim()).filter(Boolean))].slice(0, 8);
  if (avoidFoods.length > 0 && a.avoidFoodsCertainty === 'unsure') unsure.push('avoidFoods');
  const chart: Chart = {
    source: 'upload',
    fileName: name,
    calories: a.calories,
    recipeTypes: a.recipeTypes.slice(0, 5),
    gramsPerServing: a.gramsPerServing,
    avoid: a.avoid,
    avoidFoods,
    mealKcal: a.mealKcal && a.mealKcal >= 150 && a.mealKcal <= 1200 ? Math.round(a.mealKcal) : null,
    unsure,
    roughEstimate: false,
    advisory: null,
  };
  return { result: { status: 'ok', chart }, costUsd: ai.costUsd };
}

const PHOTO_REASONS = ['shows more than one person', 'is too dark', 'is not full length', 'does not show a person clearly'] as const;

const PHOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['usable', 'reason', 'heightCm', 'weightKg'],
  properties: {
    usable: { type: 'boolean' },
    reason: { type: ['string', 'null'], enum: [...PHOTO_REASONS, null] },
    heightCm: { type: ['integer', 'null'] },
    weightKg: { type: ['integer', 'null'] },
  },
};

const PHOTO_SYSTEM = `You help a household meal-planning app set food portions for a family member who has no dietitian's chart. The person's household uploaded this photo for that purpose and gave their age, sex and region.

First check the photo is usable: exactly one person, shown full length (head to feet), in enough light to see their build. If not, set usable to false and pick the matching reason.

If it is usable, give a rough estimate of body build only, as an approximate height in cm and weight in kg, using the stated age, sex and region as context. Do not guess anything else about the person and do not identify them. The estimate is only used to pick portion sizes and is shown to the user as a rough estimate to review.`;

interface PhotoAnswer { usable: boolean; reason: string | null; heightCm: number | null; weightKg: number | null }

export async function readPhoto(name: string, type: string, bytes: Buffer, d: PhotoDetails): Promise<{ result: PhotoResult; costUsd: number }> {
  if (fileKind(name, type) !== 'image' || bytes.length === 0) {
    return { result: { status: 'unusable', reason: 'it is not a PNG or JPG photo' }, costUsd: 0 };
  }
  const ai = await askJson<PhotoAnswer>({
    task: 'photo-read', model: settings.models.chartReading, system: PHOTO_SYSTEM, schema: PHOTO_SCHEMA, maxTokens: 1500,
    content: [
      { type: 'image', source: { type: 'base64', media_type: imageType(name, type), data: bytes.toString('base64') } },
      { type: 'text', text: `Age: ${d.age}. Sex: ${d.sex}. Region: ${d.region}.` },
    ],
  });
  const a = ai.data;
  if (!a) return { result: { status: 'unusable', reason: 'it could not be read' }, costUsd: ai.costUsd };
  if (!a.usable || !a.heightCm || !a.weightKg) {
    const reason = a.reason ?? 'does not show a person clearly';
    return { result: { status: 'unusable', reason: `it ${reason}` }, costUsd: ai.costUsd };
  }
  const chart = chartFromBody({
    age: d.age, sex: d.sex, heightCm: a.heightCm, weightKg: a.weightKg,
    activity: 'Lightly active', goal: d.goal, pregnancy: d.pregnancy, conditions: d.conditions,
  }, 'photo');
  return { result: { status: 'ok', chart }, costUsd: ai.costUsd };
}
