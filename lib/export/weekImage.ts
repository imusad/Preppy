// Draws one week of the plan as a portrait PNG (1080 wide, 1680 tall or taller if the content needs it).
// Shows meal names, times, short flags and a legend. Deliberately no cost and no fun factor.
import type { Flag, FlagKind, Plan, PlanDay, PlanMeal } from '../types';
import { listNames, mealFlags, mealTotals, pricesLine, type MealKind } from './format';

const W = 1080;
const MIN_H = 1680;
const PAD = 48;
const DAY_COL = 150;
const GAP = 20;
const COL_W = (W - PAD * 2 - DAY_COL - GAP * 2) / 2;

const INK = '#231F20';
const MUTED = '#6D6E71';
const SOFT = '#4A4647';
const PRIMARY = '#5D2CC9';

const PILL: Record<FlagKind, { bg: string; fg: string; border: string | null }> = {
  non_compliant: { bg: '#BF1724', fg: '#FFFFFF', border: null },
  over_time: { bg: '#FFF4E1', fg: '#6B4510', border: '#946119' },
  over_budget: { bg: '#FFF4E1', fg: '#6B4510', border: '#946119' },
  price_unavailable: { bg: '#FFFFFF', fg: '#4A4647', border: '#6D6E71' },
  no_recipe: { bg: '#FFE8E8', fg: '#8E101A', border: '#BF1724' },
};

const LEGEND: { kind: FlagKind; pill: string; text: string }[] = [
  { kind: 'non_compliant', pill: 'Non-compliant', text: "doesn't follow the diet chart" },
  { kind: 'over_time', pill: '+4 min', text: 'over the cooking window' },
  { kind: 'over_budget', pill: 'Over budget', text: 'above the meal budget' },
  { kind: 'price_unavailable', pill: 'Price unavailable', text: 'cost not found' },
  { kind: 'no_recipe', pill: 'No recipe found', text: "nothing fit everyone's diet" },
];

type Ctx = CanvasRenderingContext2D;

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = (word: string) => {
    // Break a single word that is wider than the column.
    let w = word;
    while (ctx.measureText(w).width > maxW && w.length > 1) {
      let n = w.length - 1;
      while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    line = w;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) { push(word); continue; }
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxW) line = next;
    else { lines.push(line); push(word); }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface Painter {
  ctx: Ctx;
  font: (weight: number, size: number) => void;
  /** Draws wrapped text; returns the y below the last line. */
  text: (t: string, x: number, y: number, maxW: number, weight: number, size: number, lineH: number, color: string) => number;
  pill: (label: string, kind: FlagKind, x: number, y: number) => number;
  pillWidth: (label: string) => number;
}

const PILL_H = 30;

function painter(ctx: Ctx, family: string): Painter {
  const font = (weight: number, size: number) => { ctx.font = `${weight} ${size}px ${family}`; };
  const text: Painter['text'] = (t, x, y, maxW, weight, size, lineH, color) => {
    font(weight, size);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const line of wrap(ctx, t, maxW)) {
      ctx.fillText(line, x, y + lineH / 2);
      y += lineH;
    }
    return y;
  };
  const pillWidth = (label: string) => { font(600, 18); return Math.ceil(ctx.measureText(label).width) + 20; };
  const pill: Painter['pill'] = (label, kind, x, y) => {
    const w = pillWidth(label);
    const c = PILL[kind];
    roundRect(ctx, x, y, w, PILL_H, PILL_H / 2);
    ctx.fillStyle = c.bg;
    ctx.fill();
    if (c.border) { ctx.lineWidth = 1.5; ctx.strokeStyle = c.border; ctx.stroke(); }
    font(600, 18);
    ctx.fillStyle = c.fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 10, y + PILL_H / 2 + 1);
    return w;
  };
  return { ctx, font, text, pill, pillWidth };
}

function drawFlags(p: Painter, flags: Flag[], x: number, y: number, maxW: number): number {
  if (!flags.length) return y;
  let cx = x;
  let cy = y + 6;
  for (const f of flags) {
    const w = p.pillWidth(f.short);
    if (cx > x && cx + w > x + maxW) { cx = x; cy += PILL_H + 6; }
    p.pill(f.short, f.kind, cx, cy);
    cx += w + 6;
  }
  return cy + PILL_H;
}

function drawMeal(p: Painter, plan: Plan, meal: PlanMeal, kind: MealKind, x: number, y: number): number {
  const multi = meal.dishes.length > 1;
  let cy = y;
  if (!meal.dishes.length) cy = p.text('No recipe found', x, cy, COL_W, 700, 26, 32, INK);
  meal.dishes.forEach((dish, i) => {
    if (i > 0) cy += 8;
    const prefix = multi ? `${listNames(dish.who)}: ` : '';
    const main = dish.mainId ? plan.recipes[dish.mainId] : undefined;
    if (!main) {
      cy = p.text(`${prefix}No recipe found`, x, cy, COL_W, 700, 26, 32, INK);
      cy = p.text(dish.noRecipeReason || 'Edit setup to widen restrictions', x, cy, COL_W, 400, 22, 28, SOFT);
      return;
    }
    cy = p.text(prefix + main.name, x, cy, COL_W, 700, 26, 32, INK);
    const side = dish.sideId ? plan.recipes[dish.sideId] : undefined;
    if (side) cy = p.text(`+ ${side.name}`, x, cy, COL_W, 400, 22, 28, SOFT);
  });
  const t = mealTotals(meal);
  if (t.hasRecipe) {
    const time = kind === 'dinner' ? `${t.totalMin} min · Evening finish: ${t.eveningMin} min` : `${t.totalMin} min`;
    cy = p.text(time, x, cy + 4, COL_W, 400, 20, 28, INK);
  }
  return drawFlags(p, mealFlags(meal), x, cy, COL_W);
}

/** Paints the whole picture and returns the height the content needs. */
function paint(ctx: Ctx, family: string, plan: Plan, week: 1 | 2, height: number): number {
  const p = painter(ctx, family);
  const days: PlanDay[] = plan.days.filter((d) => d.week === week).sort((a, b) => a.day - b.day);
  const right = W - PAD;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, Math.max(height, 1));

  // Header
  let y = PAD;
  p.text('Preppy', PAD, y, 400, 700, 22, 28, PRIMARY);
  p.text(`Week ${week} plan`, PAD, y + 32, 520, 700, 48, 56, INK);
  const whoLines = [
    `Lunch: ${listNames(plan.lunchWho)}, cooked in the morning`,
    `Dinner: ${listNames(plan.dinnerWho)}`,
  ];
  p.font(400, 20);
  const whoW = 420;
  const wrapped = whoLines.flatMap((l) => wrap(ctx, l, whoW));
  const headBottom = Math.max(y + 32 + 56, y + wrapped.length * 28);
  ctx.fillStyle = SOFT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  wrapped.forEach((l, i) => ctx.fillText(l, right, headBottom - (wrapped.length - i) * 28 + 14));
  ctx.textAlign = 'left';
  y = headBottom + 16;
  ctx.fillStyle = PRIMARY;
  ctx.fillRect(PAD, y, W - PAD * 2, 3);
  y += 3 + 20;

  // Column headings
  const xL = PAD + DAY_COL + GAP;
  const xD = xL + COL_W + GAP;
  p.text('LUNCH', xL, y, COL_W, 700, 18, 24, MUTED);
  p.text('DINNER', xD, y, COL_W, 700, 18, 24, MUTED);
  y += 24 + 6;

  // One row per day
  for (const d of days) {
    const top = y + 14;
    p.text(d.dow, PAD, top, DAY_COL, 700, 30, 36, INK);
    p.text(`Day ${d.day}`, PAD, top + 36, DAY_COL, 400, 20, 26, MUTED);
    const b1 = drawMeal(p, plan, d.lunch, 'lunch', xL, top);
    const b2 = drawMeal(p, plan, d.dinner, 'dinner', xD, top);
    y = Math.max(y + 150, Math.max(b1, b2, top + 62) + 14);
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(PAD, y - 1.5, W - PAD * 2, 1.5);
  }

  // Legend: measure first so it can sit at the bottom of the page.
  const innerW = W - PAD * 2 - 40;
  const items = LEGEND.map((l) => {
    p.font(400, 18);
    const tw = Math.ceil(ctx.measureText(` ${l.text}`).width);
    return { ...l, width: p.pillWidth(l.pill) + 8 + tw };
  });
  const rows: (typeof items)[] = [[]];
  let rowW = 0;
  for (const it of items) {
    if (rowW > 0 && rowW + it.width > innerW) { rows.push([]); rowW = 0; }
    rows[rows.length - 1].push(it);
    rowW += it.width + 24;
  }
  const prices = pricesLine(plan);
  const foot = `Costs, fun factor, ingredients and steps are in the HTML export.${prices ? ` ${prices.charAt(0).toUpperCase()}${prices.slice(1)}.` : ''}`;
  p.font(400, 17);
  const footLines = wrap(ctx, foot, innerW);
  const legendH = 18 + 24 + 10 + rows.length * (PILL_H + 6) + 4 + footLines.length * 24 + 18;

  const needed = y + 20 + legendH + 40;
  const ly = Math.max(y + 20, height - 40 - legendH);
  roundRect(ctx, PAD, ly, W - PAD * 2, legendH, 14);
  ctx.fillStyle = '#F7F8FA';
  ctx.fill();
  let cy = ly + 18;
  p.text('LEGEND', PAD + 20, cy, innerW, 700, 18, 24, SOFT);
  cy += 24 + 10;
  for (const row of rows) {
    let cx = PAD + 20;
    for (const it of row) {
      const pw = p.pill(it.pill, it.kind, cx, cy);
      p.font(400, 18);
      ctx.fillStyle = INK;
      ctx.fillText(it.text, cx + pw + 8, cy + PILL_H / 2 + 1);
      cx += it.width + 24;
    }
    cy += PILL_H + 6;
  }
  p.text(foot, PAD + 20, cy + 4, innerW, 400, 17, 24, MUTED);

  return Math.ceil(needed);
}

async function fontFamily(): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || '"DM Sans", system-ui, sans-serif';
  try {
    if (document.fonts) {
      await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 24px ${family}`, 'Week ₹ plan')));
      await document.fonts.ready;
    }
  } catch { /* fall back to whatever the browser has */ }
  return family;
}

export async function renderWeekImage(plan: Plan, week: 1 | 2): Promise<Blob> {
  const family = await fontFamily();

  // First pass on a scratch canvas to learn how tall the content is.
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = 8;
  const sctx = scratch.getContext('2d');
  if (!sctx) throw new Error('Canvas is not available');
  const height = Math.max(MIN_H, paint(sctx, family, plan, week, 0));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  paint(ctx, family, plan, week, height);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob && blob.size ? resolve(blob) : reject(new Error('Could not create the week image'))), 'image/png');
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not create the week image'));
    }
  });
}
