// Diet chart working state and wording. Pure, no React.
import type {
  Activity, BodyDetails, Chart, ChartField, Goal, Person, PhotoDetails, Pregnancy, Sex,
} from '../../lib/types';

/**
 * Screen-only state of one person's diet chart forms, stored in `person.chartDraft`.
 * Plain JSON, so the parent can persist it. The chosen photo file itself is not kept here.
 */
export interface ChartDraft {
  /** Which panel is open while no chart is accepted. */
  step: 'choose' | 'upload' | 'unreadable' | 'create' | 'review';
  /** Which "no chart" form is showing. */
  sub: 'body' | 'photo';
  /** Typed values, kept as typed. */
  age: string;
  heightCm: string;
  weightKg: string;
  sex: Sex | null;
  region: string | null;
  activity: Activity | null;
  goal: Goal | null;
  pregnancy: Pregnancy | null;
  /** Tile labels from CONDITIONS; ['None'] when none. */
  conditions: string[];
  /** True once "Create diet chart" was tapped with gaps, so the gaps are highlighted. */
  tried: boolean;
  /** Name of the photo picked for the photo path. */
  photoName: string | null;
  /** Reason the last photo could not be used. */
  photoError: string | null;
}

export type DraftField =
  | 'age' | 'heightCm' | 'weightKg' | 'sex' | 'region' | 'activity' | 'goal' | 'pregnancy' | 'conditions' | 'photo';

export function blankDraft(): ChartDraft {
  return {
    step: 'choose', sub: 'body', age: '', heightCm: '', weightKg: '', sex: null, region: null,
    activity: null, goal: null, pregnancy: null, conditions: [], tried: false, photoName: null, photoError: null,
  };
}

/** The person's draft, with defaults for anything absent. */
export function readDraft(person: Pick<Person, 'chartDraft' | 'chart'>): ChartDraft {
  const raw = person.chartDraft;
  const base = blankDraft();
  if (raw && typeof raw === 'object') return { ...base, ...(raw as Partial<ChartDraft>) };
  return person.chart ? { ...base, step: 'review' } : base;
}

export type ChartView = ChartDraft['step'] | 'accepted';

export function chartView(person: Pick<Person, 'chart' | 'chartAccepted' | 'chartDraft'>): ChartView {
  if (person.chart && person.chartAccepted) return 'accepted';
  const d = readDraft(person);
  if (d.step === 'review') return person.chart ? 'review' : 'choose';
  return d.step;
}

/** Ranges the server accepts (lib/chart.ts validBody uses the same numbers). */
export const BODY_RANGES = { age: [2, 110], heightCm: [60, 250], weightKg: [10, 300] } as const;

function inRange(v: string, [min, max]: readonly [number, number]): boolean {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
}

/** Fields still empty on the open "no chart" form. */
export function draftMissing(d: ChartDraft, hasPhoto: boolean): Set<DraftField> {
  const m = new Set<DraftField>();
  if (!inRange(d.age, BODY_RANGES.age)) m.add('age');
  if (!d.sex) m.add('sex');
  if (!d.goal) m.add('goal');
  if (d.sex === 'Female' && !d.pregnancy) m.add('pregnancy');
  if (d.conditions.length === 0) m.add('conditions');
  if (d.sub === 'body') {
    if (!inRange(d.heightCm, BODY_RANGES.heightCm)) m.add('heightCm');
    if (!inRange(d.weightKg, BODY_RANGES.weightKg)) m.add('weightKg');
    if (!d.activity) m.add('activity');
  } else {
    if (!d.region) m.add('region');
    if (!hasPhoto) m.add('photo');
  }
  return m;
}

export function toBodyDetails(d: ChartDraft): BodyDetails {
  return {
    age: Number(d.age), heightCm: Number(d.heightCm), weightKg: Number(d.weightKg),
    sex: d.sex as Sex, activity: d.activity as Activity, goal: d.goal as Goal,
    pregnancy: d.sex === 'Female' ? d.pregnancy : null,
    conditions: d.conditions,
  };
}

export function toPhotoDetails(d: ChartDraft): PhotoDetails {
  return {
    age: Number(d.age), sex: d.sex as Sex, region: d.region as string, goal: d.goal as Goal,
    pregnancy: d.sex === 'Female' ? d.pregnancy : null,
    conditions: d.conditions,
  };
}

export const UNREADABLE_MESSAGE =
  "We couldn't read this diet chart. Upload a clearer PDF or image, or create one from body details or a photo.";

export function photoUnusableMessage(reason: string): string {
  const r = reason.trim().replace(/[.\s]+$/, '') || 'it could not be checked';
  return `This photo can't be used because ${r}. Upload a full-length photo of one person in good light, or enter body details instead.`;
}

const UPLOAD_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'html', 'htm'];
const UPLOAD_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'text/html'];
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.html,.htm,application/pdf,image/png,image/jpeg,text/html';

/** PDF, PNG, JPG, JPEG or HTML. Anything else is treated as unreadable. */
export function isChartFile(file: { name: string; type: string }): boolean {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return UPLOAD_EXT.includes(ext) || UPLOAD_MIME.includes(file.type.toLowerCase());
}

export function sourceLine(chart: Chart): string {
  if (chart.source === 'upload') return chart.fileName ? 'Read from ' + chart.fileName : 'Read from your file';
  return chart.source === 'photo' ? 'Created from a photo' : 'Created from body details';
}

export function caloriesLine(chart: Chart): string {
  return chart.calories === null
    ? 'No calorie target stated'
    : chart.calories.toLocaleString('en-IN') + ' kcal a day';
}

export interface SummaryLine { key: string; text: string; unsure: boolean }

/** The lines shown for review: calories, recipe types, grams per serving, foods to avoid. */
export function summaryLines(chart: Chart): SummaryLine[] {
  const unsure = (f: ChartField) => chart.unsure.includes(f);
  const lines: SummaryLine[] = [
    { key: 'calories', text: caloriesLine(chart), unsure: unsure('calories') },
    {
      key: 'recipeTypes',
      text: chart.recipeTypes.length ? 'Recipe types: ' + chart.recipeTypes.join(', ') : 'No recipe types stated',
      unsure: unsure('recipeTypes'),
    },
    {
      key: 'gramsPerServing',
      text: chart.gramsPerServing === null
        ? 'No serving size stated'
        : chart.gramsPerServing.toLocaleString('en-IN') + ' g per serving',
      unsure: unsure('gramsPerServing'),
    },
  ];
  if (chart.avoid.length) lines.push({ key: 'avoid', text: 'Avoid: ' + chart.avoid.join(', '), unsure: false });
  return lines;
}

/** One line for the accepted state. */
export function acceptedLine(chart: Chart): string {
  const parts = [caloriesLine(chart)];
  if (chart.recipeTypes.length) parts.push(chart.recipeTypes.join(', '));
  if (chart.roughEstimate) parts.push('Rough estimate');
  return parts.join(' · ');
}
