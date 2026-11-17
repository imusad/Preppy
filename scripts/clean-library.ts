// Library clean-up (plain code, no AI). Reviewed by hand on 2026-11-17 against each recipe's ingredient list.
// Dry run: npx tsx --env-file=.env.local scripts/clean-library.ts      Save: add --write
// Every changed recipe's previous version is saved to library-backups/ first, so a change can be undone.
import './net';
import { writeFileSync } from 'node:fs';
import { q } from '../lib/db';
import { dishKey } from '../lib/library/dishKey';
import { stricterCategory, wordCategory } from '../lib/library/tag';
import type { FoodCategory, FullRecipe, SlimRecipe } from '../lib/library/types';

/** Diet tags the tagger made stricter than the ingredients show (checked by hand). Never set below the word list. */
const CATEGORY_FIXES: Record<string, { to: FoodCategory; why: string }> = {
  '6a446cd3d9f5': { to: 'fish', why: 'Brazilian fish stew: fish and fish stock, no meat' },
  '744dcc5f1955': { to: 'fish', why: 'Baked shrimp: prawns, no meat' },
  'aa29944907ec': { to: 'vegan', why: 'Chili garlic tofu: every ingredient is plant-based' },
  'f50b786c9ec4': { to: 'vegetarian', why: 'Jewelled pilaf: vegetable stock and ghee, no meat' },
  '841c2ecd3a5d': { to: 'vegan', why: 'Apple cucumber salad: fruit, mint, lemon' },
  'ba8a5c70c6c4': { to: 'vegan', why: 'Khaman dhokla: besan, oil, no dairy' },
  '6b1855ccff95': { to: 'vegan', why: 'Masala dosa: rice, dal, potato, oil' },
  'f23aea8780be': { to: 'vegan', why: 'Masala dosa: rice, dal, potato, oil' },
  'fbb4b4ef81fb': { to: 'vegan', why: 'Cabbage soup: soy milk and miso, no dairy' },
};
/** Real dishes whose names read like a component. */
const RENAMES: Record<string, string> = {
  '1b5556e564bb': 'Spice-Rubbed Pan-Fried Fish (with Homemade Fish Seasoning)',
  'd2a4fa114cd7': 'Brined Roast Chicken',
  'b9129fe3a95f': 'Coconut Lentil Curry with Pumpkin and Spinach',
};
/** Condiments and components: kept in the library but never planned as a meal. */
const NOT_A_DISH_IDS = ['9d41fc2ec569']; // Garlic chutney stored as a 950 kcal main
const NOT_A_DISH_NAMES = /^(cranberry sauce|easy hollandaise sauce|lemon butter sauce for fish)$/i;
const ANIMAL_ALLERGENS = ['milk', 'eggs', 'fish', 'crustaceans', 'molluscs'];

async function main() {
  const write = process.argv.includes('--write');
  const rows = await q<{ id: string; slim: SlimRecipe; full_data: FullRecipe }>('select id, slim, full_data from recipes order by id');
  const backup: { id: string; slim: SlimRecipe }[] = [];
  const changes: { id: string; slim: SlimRecipe; notes: string[] }[] = [];
  for (const r of rows) {
    const s: SlimRecipe = { ...r.slim };
    const notes: string[] = [];
    const lines = r.full_data.ingredients.map((i) => i.name);
    const byWords = wordCategory(s.name, lines);
    // 1. Safety first: never less strict than the word list (catches hot dogs, bratwurst, bolognese, kimchi).
    const safer = stricterCategory(s.category, byWords);
    if (safer !== s.category) { notes.push(`diet ${s.category} → ${safer} (word list)`); s.category = safer; }
    if (/\bkimchi\b/i.test(lines.join(' ')) && !/vegan kimchi/i.test(lines.join(' ')) && !s.allergens.includes('fish') && !s.allergenUnsure.includes('fish')) {
      s.allergenUnsure = [...s.allergenUnsure, 'fish']; notes.push('fish allergen unsure (kimchi)');
    }
    // 2. Hand-checked corrections, never below the word list and never vegan/vegetarian with animal allergens.
    const fix = CATEGORY_FIXES[r.id];
    if (fix) {
      const to = stricterCategory(fix.to, byWords);
      const conflict = (to === 'vegan' && s.allergens.some((a) => ANIMAL_ALLERGENS.includes(a)))
        || (to === 'vegetarian' && s.allergens.some((a) => ['eggs', 'fish', 'crustaceans', 'molluscs'].includes(a)));
      if (conflict) notes.push(`SKIPPED ${s.category} → ${to}: allergens ${s.allergens.join(',')}`);
      else if (to !== s.category) { notes.push(`diet ${s.category} → ${to} (${fix.why})`); s.category = to; }
    }
    if (RENAMES[r.id] && s.name !== RENAMES[r.id]) {
      notes.push(`name "${s.name}" → "${RENAMES[r.id]}"`);
      s.name = RENAMES[r.id];
      s.dishKey = [...new Set(`${s.dishKey} ${dishKey(s.name.replace(/[()]/g, ' '))}`.split(' ').filter(Boolean))].join(' ');
    }
    if ((NOT_A_DISH_IDS.includes(r.id) || NOT_A_DISH_NAMES.test(s.name)) && !s.notADish) { s.notADish = true; notes.push('marked not a dish'); }
    if (notes.length) { backup.push({ id: r.id, slim: r.slim }); changes.push({ id: r.id, slim: s, notes }); }
  }
  for (const c of changes) console.log(`${c.id}  ${c.slim.name}\n    ${c.notes.join('\n    ')}`);
  console.log(`\n${changes.length} of ${rows.length} recipes would change.`);
  if (!write) { console.log('Dry run: nothing saved. Add --write to save.'); return; }
  const file = `library-backups/clean-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 1));
  for (const c of changes) await q('update recipes set name = $2, slim = $3::jsonb where id = $1', [c.id, c.slim.name, JSON.stringify(c.slim)]);
  console.log(`Saved. Previous versions in ${file}.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
