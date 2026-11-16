// Write the whole recipe library as one HTML file (no AI): npx tsx --env-file=.env.local scripts/library-html.ts <out.html>
import './net';
import { writeFileSync } from 'node:fs';
import { escapeHtml as e } from '../lib/export/html';
import { loadFull, loadSlim } from '../lib/library/store';

const DIET: Record<string, string> = { vegan: 'Vegan', vegetarian: 'Vegetarian', egg: 'Contains egg', fish: 'Fish or seafood', meat: 'Meat' };

(async () => {
  const out = process.argv[2] ?? 'preppy-recipe-bank.html';
  const slim = (await loadSlim()).sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.name.localeCompare(b.name));
  const full = await loadFull(slim.map((r) => r.id));
  const cuisines = [...new Set(slim.map((r) => r.cuisine))];
  const sources = [...new Set(slim.map((r) => r.source))].sort();
  const anchor = (c: string) => 'c-' + c.toLowerCase().replace(/[^a-z]+/g, '-');

  let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Preppy recipe bank</title>
<style>
:root{--p:#5D2CC9;--ink:#1d1b22;--mute:#5f5a6b;--line:#e6e2ee;--bg:#faf9fc}
body{margin:0;font-family:"DM Sans",system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
h1{margin:0 0 4px;font-size:30px}.muted{color:var(--mute);font-size:14px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 8px}nav a{padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--p);text-decoration:none;font-size:14px}
input{width:100%;box-sizing:border-box;height:44px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font-size:16px;margin:8px 0 16px}
h2{margin:32px 0 12px;font-size:22px;border-bottom:2px solid var(--p);padding-bottom:6px}
details{background:#fff;border:1px solid var(--line);border-radius:14px;margin:0 0 10px;padding:12px 16px}
summary{cursor:pointer;font-weight:600;font-size:17px}summary span{font-weight:400;color:var(--mute);font-size:14px;display:block}
.links a{color:var(--p);margin-right:14px}.tags{font-size:13px;color:var(--mute)}
h3{font-size:15px;margin:14px 0 4px}ol,ul{margin:4px 0;padding-left:22px}
</style></head><body><main>
<h1>Preppy recipe bank</h1>
<p class="muted">${slim.length} recipes from ${sources.length} sources: ${e(sources.join(', '))}. Every recipe links to its original page and video. Steps are credited to the source.</p>
<input type="search" placeholder="Search recipes, ingredients or sources" aria-label="Search recipes" oninput="var q=this.value.toLowerCase();document.querySelectorAll('details').forEach(function(d){d.hidden=q&&d.dataset.t.indexOf(q)<0})">
<nav aria-label="Cuisines">${cuisines.map((c) => `<a href="#${anchor(c)}">${e(c)} (${slim.filter((r) => r.cuisine === c).length})</a>`).join('')}</nav>`;

  for (const c of cuisines) {
    h += `<h2 id="${anchor(c)}">${e(c)}</h2>`;
    for (const r of slim.filter((x) => x.cuisine === c)) {
      const f = full.get(r.id);
      if (!f) continue;
      const text = [r.name, r.source, ...r.ingredientNames].join(' ').toLowerCase();
      h += `<details data-t="${e(text)}"><summary>${e(r.name)}<span>${e(r.source)} · ${r.kind === 'main' ? 'Main' : 'Side'} · ${DIET[r.category] ?? r.category} · ${r.totalMin} min${r.kcal ? ` · about ${r.kcal} kcal a serving` : ''}</span></summary>
<p class="links"><a href="${e(f.url)}" target="_blank" rel="noopener noreferrer">Open recipe at ${e(f.sourceName)}</a>${f.videoUrl ? `<a href="${e(f.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch the video</a>` : ''}</p>
<p class="tags">${r.allergens.length ? `Contains: ${e(r.allergens.join(', '))}. ` : ''}${r.allergenUnsure.length ? `May contain: ${e(r.allergenUnsure.join(', '))}. ` : ''}${r.healthFlags.length ? `Note: ${e(r.healthFlags.join(', '))}.` : ''}</p>
<h3>Ingredients (per serving)</h3><ul>${f.ingredients.map((i) => `<li>${i.qty !== null ? e(+i.qty.toFixed(2)) + ' ' : ''}${e(i.unit)} ${e(i.name)}</li>`).join('')}</ul>
<h3>Steps</h3><ol>${f.steps.map((s) => `<li>${e(s.text)}</li>`).join('')}</ol></details>`;
    }
  }
  h += '</main></body></html>';
  writeFileSync(out, h);
  console.log('written', out, slim.length, 'recipes');
  process.exit(0);
})();
