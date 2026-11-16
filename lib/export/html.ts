// Builds the one-file HTML export: the 2-week plan plus the full recipe bank.
// No scripts, inline CSS, readable on a phone and printable.
import type { Flag, Plan, PlanDay, PlanDish, PlanMeal, PlanRecipe } from '../types';
import {
  costText, dayLabel, dishFlags, fmtQty, listNames, mealTotals, mealWho, money, pricesLine, safeUrl, weekLabel,
  type MealKind,
} from './format';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

const CSS = `
*{box-sizing:border-box}
body{margin:0 auto;max-width:920px;padding:20px 16px 48px;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5;color:#231F20;background:#fff}
h1{margin:0;font-size:28px;line-height:1.2}
h2{margin:36px 0 12px;padding-bottom:6px;border-bottom:3px solid #5D2CC9;font-size:22px}
h3{margin:0 0 4px;font-size:18px;line-height:1.3}
h4{margin:14px 0 4px;font-size:14px;letter-spacing:.4px;text-transform:uppercase;color:#4A4647}
p{margin:6px 0}
a{color:#5D2CC9}
.brand{font-weight:700;color:#5D2CC9}
.muted{color:#4A4647;font-size:14px}
.day{border:1px solid #D1D5DB;border-radius:12px;margin:0 0 12px;overflow:hidden;break-inside:avoid}
.day>h3{margin:0;padding:10px 14px;background:#F4F1FB}
.meals{display:grid;grid-template-columns:1fr 1fr}
.meal{padding:12px 14px;min-width:0}
.meal+.meal{border-left:1px solid #E5E5E5}
.label{font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#4A4647}
.dish{margin-top:6px}
.dish .main{font-weight:600;font-size:16px}
.who{font-size:13px;font-weight:600;color:#5D2CC9}
.flags{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.flag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid #6D6E71;color:#231F20}
.flag.non_compliant{background:#BF1724;border-color:#BF1724;color:#fff}
.flag.over_time,.flag.over_budget{background:#FFF4E1;border-color:#946119;color:#6B4510}
.flag.no_recipe{background:#FFE8E8;border-color:#BF1724;color:#8E101A}
.note{margin-top:6px;padding:6px 10px;border-radius:8px;background:#FFF4E1;color:#6B4510;font-size:13px}
.steps-mini{margin:6px 0 0;font-size:13px;color:#231F20}
.recipe{border-top:1px solid #D1D5DB;padding:20px 0;break-inside:avoid}
.recipe img{display:block;width:100%;max-width:420px;height:auto;max-height:280px;object-fit:cover;border-radius:12px;margin:8px 0;background:#F2F2F2}
.recipe ul,.recipe ol{margin:4px 0;padding-left:22px}
.recipe li{margin:3px 0}
.toc{columns:2;column-gap:24px;padding-left:20px;font-size:14px}
@media (max-width:600px){.meals{grid-template-columns:1fr}.meal+.meal{border-left:0;border-top:1px solid #E5E5E5}.toc{columns:1}}
@media print{body{max-width:none;padding:0;font-size:12px}a{color:inherit}.recipe img{max-width:240px;max-height:160px}}
`;

function anchor(id: string): string {
  return `recipe-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function flagsHtml(flags: Flag[]): string {
  if (!flags.length) return '';
  return `<ul class="flags" aria-label="Flags">${flags.map((f) => `<li class="flag ${e(f.kind)}">${e(f.label)}</li>`).join('')}</ul>`;
}

function recipeLink(plan: Plan, id: string | null): string {
  if (!id) return '';
  const r = plan.recipes[id];
  if (!r) return '';
  return `<a href="#${e(anchor(r.id))}">${e(r.name)}</a>`;
}

function dishHtml(plan: Plan, dish: PlanDish, kind: MealKind, showWho: boolean): string {
  let h = '<div class="dish">';
  if (showWho) h += `<div class="who">For ${e(listNames(dish.who))}</div>`;
  if (dish.mainId === null || !plan.recipes[dish.mainId]) {
    h += `<div class="main">No recipe found</div>`;
    if (dish.noRecipeReason) h += `<div class="muted">${e(dish.noRecipeReason)}</div>`;
  } else {
    h += `<div class="main">${recipeLink(plan, dish.mainId)}</div>`;
    const side = recipeLink(plan, dish.sideId);
    if (side) h += `<div>+ ${side}</div>`;
    h += `<div class="muted">${e(dish.totalMin)} min · Fun ${e(dish.fun)}/5 · ${e(costText(dish.cost))} · ${e(dish.servings)} ${dish.servings === 1 ? 'serving' : 'servings'}</div>`;
    if (kind === 'dinner') {
      const morning = dish.morningSteps.length ? dish.morningSteps.join('; ') : dish.morningLabel;
      if (morning) h += `<div class="steps-mini"><strong>Morning (${e(dish.morningMin)} min):</strong> ${e(morning)}</div>`;
      const evening = [dish.eveningLabel, dish.eveningSteps.join('; ')].filter(Boolean).join(' — ');
      if (evening) h += `<div class="steps-mini"><strong>Evening:</strong> ${e(evening)}</div>`;
    } else if (dish.morningSteps.length) {
      h += `<div class="steps-mini"><strong>Morning:</strong> ${e(dish.morningSteps.join('; '))}</div>`;
    }
  }
  h += flagsHtml(dishFlags(dish));
  for (const n of dish.notes) h += `<div class="note">${e(n)}</div>`;
  return `${h}</div>`;
}

function mealHtml(plan: Plan, meal: PlanMeal, kind: MealKind): string {
  const who = mealWho(meal, kind === 'lunch' ? plan.lunchWho : plan.dinnerWho);
  const multi = meal.dishes.length > 1;
  let h = `<div class="meal"><div class="label">${kind === 'lunch' ? 'Lunch' : 'Dinner'} · ${e(listNames(who))}</div>`;
  if (!meal.dishes.length) h += '<div class="dish"><div class="main">No recipe found</div></div>';
  h += meal.dishes.map((d) => dishHtml(plan, d, kind, multi)).join('');
  if (multi) {
    const t = mealTotals(meal);
    if (t.hasRecipe) h += `<p class="muted">Whole meal: ${e(t.totalMin)} min · ${e(costText(t.cost))}</p>`;
  }
  return `${h}</div>`;
}

function dayHtml(plan: Plan, d: PlanDay): string {
  return `<section class="day"><h3>${e(dayLabel(d))} <span class="muted">· morning ${e(d.morningUsed)} of ${e(d.morningWindow)} min · evening ${e(d.eveningUsed)} of ${e(d.eveningWindow)} min</span></h3><div class="meals">${mealHtml(plan, d.lunch, 'lunch')}${mealHtml(plan, d.dinner, 'dinner')}</div></section>`;
}

function recipeHtml(plan: Plan, r: PlanRecipe): string {
  const source = safeUrl(r.sourceUrl);
  const video = safeUrl(r.videoUrl);
  const img = safeUrl(r.images[0] ?? r.image);
  const cost = r.costPerServing === null
    ? 'Price unavailable'
    : `${money(r.costPerServing)} per serving${plan.pricesChecked ? ` (prices checked ${plan.pricesChecked})` : ''}`;
  let h = `<article class="recipe" id="${e(anchor(r.id))}"><h3>${e(r.name)}</h3>`;
  h += `<p class="muted">${e(r.cuisine)} · ${r.kind === 'main' ? 'Main' : 'Side'} · ${e(r.totalMin)} min · Fun ${e(r.fun)}/5 · ${e(cost)}${r.who.length ? ` · For ${e(listNames(r.who))}` : ''}</p>`;
  if (img) h += `<img src="${e(img)}" alt="${e(r.name)}" loading="lazy" referrerpolicy="no-referrer">`;
  h += `<p>Recipe from <strong>${e(r.source)}</strong> · ${source ? `<a href="${e(source)}" target="_blank" rel="noopener noreferrer">Open recipe source</a>` : 'Source link unavailable'} · ${video ? `<a href="${e(video)}" target="_blank" rel="noopener noreferrer">Watch the recipe video</a>` : 'Video unavailable for this recipe'}</p>`;
  h += '<h4>Ingredients (for 1 serving)</h4><ul>';
  h += r.ingredients.map((i) => `<li>${e([fmtQty(i.qty, i.unit, 1), i.name].filter(Boolean).join(' '))}</li>`).join('');
  h += '</ul><h4>Steps</h4><ol>';
  h += r.steps.map((s) => `<li>${e(s.text)}</li>`).join('');
  h += `</ol><p class="muted">Steps credited to ${e(r.source)}.</p></article>`;
  return h;
}

export function buildPlanHtml(plan: Plan): string {
  const days = [...plan.days].sort((a, b) => a.day - b.day);
  const bank = plan.bankIds.map((id) => plan.recipes[id]).filter((r): r is PlanRecipe => Boolean(r));
  // Recipes used by the plan but missing from the bank list are still included, so every link works.
  const seen = new Set(bank.map((r) => r.id));
  for (const d of days) {
    for (const dish of [...d.lunch.dishes, ...d.dinner.dishes]) {
      for (const id of [dish.mainId, dish.sideId]) {
        const r = id ? plan.recipes[id] : undefined;
        if (r && !seen.has(r.id)) { seen.add(r.id); bank.push(r); }
      }
    }
  }
  const prices = pricesLine(plan);

  let h = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">';
  h += '<meta name="viewport" content="width=device-width,initial-scale=1">';
  h += `<title>Your 2-week plan · Preppy</title><style>${CSS}</style></head><body>`;
  h += '<header><div class="brand">Preppy</div><h1>Your 2-week plan</h1>';
  h += `<p class="muted">Lunch for ${e(listNames(plan.lunchWho))}, cooked in the morning · Dinner for ${e(listNames(plan.dinnerWho))}</p>`;
  h += `<p class="muted">Costs are estimates${prices ? ` · ${e(prices)}` : ''}</p></header>`;

  for (const w of [1, 2] as const) {
    h += `<h2>${e(weekLabel(plan, w))}</h2>`;
    h += days.filter((d) => d.week === w).map((d) => dayHtml(plan, d)).join('');
  }

  h += `<h2>Recipe bank · ${bank.length} ${bank.length === 1 ? 'recipe' : 'recipes'}</h2>`;
  h += `<ol class="toc">${bank.map((r) => `<li><a href="#${e(anchor(r.id))}">${e(r.name)}</a></li>`).join('')}</ol>`;
  h += bank.map((r) => recipeHtml(plan, r)).join('');
  h += '</body></html>\n';
  return h;
}
