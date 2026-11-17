// How hot a recipe is, worked out in plain code from its ingredients (no AI, no cost).
// Heat points per serving: one fresh or dried chilli = 1, one teaspoon of chilli powder or flakes = 2,
// one tablespoon of a hot sauce or paste = 1.5. The cut-offs are in settings.spice.
import { hasWord } from '@/lib/library/wordlist';
import { settings } from '@/lib/settings';

export type SpiceLevel = 'none' | 'mild' | 'medium' | 'hot';
export const SPICE_ORDER: SpiceLevel[] = ['none', 'mild', 'medium', 'hot'];

const HOT_WORDS = [
  'chilli', 'chili', 'chile', 'chillies', 'chilies', 'jalapeno', 'serrano', 'habanero', 'scotch bonnet', 'bird eye', "bird's eye", 'cayenne', 'gochugaru',
  'sambal', 'sriracha', 'harissa', 'gochujang', 'chipotle', 'peri peri', 'piri piri', 'tabasco', 'hot sauce', 'red pepper flakes', 'crushed red pepper',
  'pepper flakes', 'curry paste', 'mirchi', 'mirch', 'lal mirch',
];
/** Names that contain a hot word but are not hot. */
const NOT_HOT = ['bell pepper', 'capsicum', 'chilli-free', 'sweet chilli', 'sweet chili', 'chili-free'];

function clean(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z' -]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isHotName(name: string): boolean {
  let n = clean(name);
  for (const x of NOT_HOT) n = n.split(x).join(' ');
  return HOT_WORDS.some((w) => hasWord(n, w));
}

/** Heat points for one ingredient line (quantities are per serving). */
export function heatOf(i: { qty: number | null; unit: string; name: string }): number {
  if (!isHotName(i.name)) return 0;
  const n = clean(i.name);
  const unit = i.unit.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
  const q = i.qty;
  const kind = /powder|flake|cayenne|gochugaru|ground/.test(n) ? 'powder' : /paste|sauce|sambal|sriracha|harissa|gochujang|oil|tabasco/.test(n) ? 'sauce' : 'fresh';
  let pts: number;
  if (q === null) pts = 0.5; // "to taste"
  else if (kind === 'powder') pts = q * ({ tsp: 2, teaspoon: 2, tbsp: 6, tablespoon: 6, g: 0.8, gram: 0.8, pinch: 0.3 }[unit] ?? 2);
  else if (kind === 'sauce') pts = q * ({ tsp: 0.5, teaspoon: 0.5, tbsp: 1.5, tablespoon: 1.5, g: 0.1, ml: 0.1, jar: 4, can: 4, cup: 12 }[unit] ?? 1);
  else pts = q * ({ tsp: 0.5, teaspoon: 0.5, tbsp: 1.5, tablespoon: 1.5, g: 0.2, gram: 0.2, cup: 8, jar: 4, can: 4, tin: 4 }[unit] ?? 1);
  return /kashmiri/.test(n) ? pts * 0.5 : pts;
}

export function spiceLevelOf(ingredients: { qty: number | null; unit: string; name: string }[]): SpiceLevel {
  // Lines with no amount ("to taste", "as needed") add a little heat each, but at most 1 point together.
  const known = ingredients.filter((i) => i.qty !== null).reduce((t, i) => t + heatOf(i), 0);
  const unknown = Math.min(1, ingredients.filter((i) => i.qty === null).reduce((t, i) => t + heatOf(i), 0));
  const score = known + unknown;
  const s = settings.spice;
  if (score <= 0) return 'none';
  if (score <= s.mildMax) return 'mild';
  if (score <= s.mediumMax) return 'medium';
  return 'hot';
}

/** A recipe's level; when only its ingredient names are known (not yet backfilled), any hot word counts as medium. */
export function spiceOf(r: { spiceLevel?: SpiceLevel; ingredientNames: string[] }): SpiceLevel {
  if (r.spiceLevel) return r.spiceLevel;
  return r.ingredientNames.some(isHotName) ? 'medium' : 'none';
}

export function withinSpice(level: SpiceLevel, max: SpiceLevel | null): boolean {
  return max === null || SPICE_ORDER.indexOf(level) <= SPICE_ORDER.indexOf(max);
}

/**
 * A spice limit read from typed text, as a safety net for when the AI reading is missing.
 * "no spicy food" / "can't take heat" → mild; "no chilli" → none. "No Indian spices" is not a heat limit.
 */
export function spiceLimitFromText(text: string): SpiceLevel | null {
  const t = text.toLowerCase();
  if (/\b(no|without|avoid|zero)\s+(chilli|chili|chillies|chilies|mirchi)\b/.test(t)) return 'none';
  if (/\b(no|not|nothing|without|avoid|low|less|can'?t (take|eat|handle)|doesn'?t like|does not like|don'?t like|dislike|hate|mild)\b[^.,;]*\b(spicy|hot food|heat|pungent)\b/.test(t) || /\b(mild|non[- ]spicy)\b/.test(t)) return 'mild';
  return null;
}
