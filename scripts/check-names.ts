// Find English names that mention meat or fish the recipe does not contain, and fix them (no AI).
//   npx tsx --env-file=.env.local scripts/check-names.ts          (list only)
//   npx tsx --env-file=.env.local scripts/check-names.ts --fix    (drop the misleading bracket text)
import './net';
import { q } from '../lib/db';
import { mentions } from '../lib/library/wordlist';

const MEAT = ['beef', 'pork', 'chicken', 'mutton', 'lamb', 'goat', 'bacon', 'ham', 'sausage', 'turkey', 'duck', 'meat', 'steak', 'keema'];
const FISH = ['fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'cod', 'anchovy', 'squid'];
const EGG = ['egg', 'eggs', 'omelette'];

(async () => {
  const fix = process.argv.includes('--fix');
  const rows = await q<{ id: string; slim: { name: string; category: string; ingredientNames: string[]; garnish: string[] } }>('select id, slim from recipes');
  let found = 0;
  for (const r of rows) {
    const s = r.slim;
    const ingredients = [...s.ingredientNames, ...s.garnish];
    const named = (terms: string[]) => mentions([s.name.toLowerCase()], terms) && !mentions(ingredients, terms);
    const wrong = (s.category !== 'meat' && named(MEAT)) || (['vegan', 'vegetarian', 'egg'].includes(s.category) && named(FISH)) || (['vegan', 'vegetarian'].includes(s.category) && named(EGG));
    if (!wrong) continue;
    found++;
    const better = s.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    console.log(`${s.category}: "${s.name}"${fix ? `  ->  "${better}"` : ''}`);
    if (fix && better && better !== s.name) await q('update recipes set name = $2, slim = $3::jsonb where id = $1', [r.id, better, JSON.stringify({ ...s, name: better })]);
  }
  console.log(`${found} misleading name(s)${fix ? ' fixed' : ''}`);
  process.exit(0);
})();
