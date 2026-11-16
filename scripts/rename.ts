// Give every library recipe a plain English name (one-off; about $0.01). npx tsx --env-file=.env.local scripts/rename.ts
import './net';
import { askMany } from '../lib/ai';
import { q } from '../lib/db';
import { cleanName } from '../lib/library/dishKey';
import { bothKeys } from '../lib/library/tag';
import { settings } from '../lib/settings';

interface Row { id: string; slim: { name: string; dishKey: string; cuisine: string }; full_data: { url: string } }

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['names'],
  properties: {
    names: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['i', 'englishName'], properties: { i: { type: 'integer' }, englishName: { type: 'string' } } },
    },
  },
};

const SYSTEM = 'You rename recipes for an English-speaking reader. For each numbered recipe give its dish name in plain English, title case. Keep a well-known dish name and add a short English description in brackets when the name alone would not be understood, for example "Palak Paneer (Spinach and Cottage Cheese Curry)", "Cluster Beans Stir-Fry (Gavar Phali Sabzi)". Names that are already clear English stay as they are. No Hindi or other non-Latin script, no site or author names, no words like "recipe", "easy", "best", "restaurant style".';

(async () => {
  const rows = await q<Row>('select id, slim, full_data from recipes order by id');
  const chunks: Row[][] = [];
  for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50));
  const answers = await askMany<{ names: { i: number; englishName: string }[] }>(chunks.map((c) => ({
    task: 'rename', model: settings.models.tagging, maxTokens: 8000, schema: SCHEMA, system: SYSTEM,
    content: c.map((r, i) => `${i}. ${r.slim.name} (${r.slim.cuisine}; ${r.full_data.url.split('/').filter(Boolean).pop()})`).join('\n'),
  })), 4);
  let changed = 0, cost = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    cost += answers[ci].costUsd;
    for (const a of answers[ci].data?.names ?? []) {
      const r = chunks[ci][a.i];
      const name = cleanName(a.englishName ?? '');
      if (!r || !name || name === r.slim.name || /[^\x20-\x7E]/.test(name)) continue;
      await q('update recipes set name = $2, slim = $3::jsonb where id = $1', [r.id, name, JSON.stringify({ ...r.slim, name, dishKey: bothKeys(name, `${r.slim.name} ${r.slim.dishKey}`) })]);
      changed++;
      if (changed <= 12) console.log(`${r.slim.name}  ->  ${name}`);
    }
  }
  console.log(`Renamed ${changed} of ${rows.length}, AI cost $${cost.toFixed(4)}`);
  process.exit(0);
})();
