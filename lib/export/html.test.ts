import { describe, expect, it } from 'vitest';
import { samplePlan } from '../fixtures/samplePlan';
import type { Plan } from '../types';
import { fmtQty, weekLabel } from './format';
import { buildPlanHtml, escapeHtml } from './html';

describe('buildPlanHtml', () => {
  const html = buildPlanHtml(samplePlan);

  it('is one self-contained document without scripts', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).toContain('<style>');
  });

  it('holds every bank recipe with its name, ingredients, steps and source link', () => {
    expect(samplePlan.bankIds.length).toBeGreaterThanOrEqual(28);
    for (const id of samplePlan.bankIds) {
      const r = samplePlan.recipes[id];
      expect(html).toContain(escapeHtml(r.name));
      for (const s of r.steps) expect(html).toContain(escapeHtml(s.text));
      for (const i of r.ingredients) expect(html).toContain(escapeHtml(i.name));
      if (r.sourceUrl) expect(html).toContain(`href="${escapeHtml(r.sourceUrl)}"`);
      if (r.videoUrl) expect(html).toContain(`href="${escapeHtml(r.videoUrl)}"`);
      expect(html).toContain(`Recipe from <strong>${escapeHtml(r.source)}</strong>`);
    }
    expect(html).toContain('Source link unavailable');
    expect(html).toContain('Video unavailable for this recipe');
  });

  it('holds both weeks, all 14 days, flags, notes and the prices-checked date', () => {
    expect(html).toContain(escapeHtml(weekLabel(samplePlan, 1)));
    expect(html).toContain(escapeHtml(weekLabel(samplePlan, 2)));
    for (const d of samplePlan.days) {
      expect(html).toContain(`Day ${d.day} · ${d.dow}`);
      for (const dish of [...d.lunch.dishes, ...d.dinner.dishes]) {
        for (const f of dish.flags) expect(html).toContain(escapeHtml(f.label));
        for (const n of dish.notes) expect(html).toContain(escapeHtml(n));
      }
    }
    expect(html).toContain('No recipe found');
    expect(html).toContain('Reheat + garnish, 5 min');
    expect(html).toContain(`prices checked ${samplePlan.pricesChecked}`);
  });

  it('escapes HTML-special characters and drops unsafe links', () => {
    const id = samplePlan.bankIds[0];
    const base = samplePlan.recipes[id];
    const nasty: Plan = {
      ...samplePlan,
      recipes: {
        ...samplePlan.recipes,
        [id]: {
          ...base,
          name: '<script>alert("x")</script> & Sons\' curry',
          source: 'Tom & "Jerry" <b>',
          sourceUrl: 'javascript:alert(1)',
          videoUrl: 'https://example.com/v?a=1&b="2"',
          steps: [{ text: 'Stir <fast> & "well"', when: 'last', min: 2 }],
        },
      },
    };
    const out = buildPlanHtml(nasty);
    expect(out).not.toContain('<script>alert');
    expect(out).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Sons&#39; curry');
    expect(out).toContain('Tom &amp; &quot;Jerry&quot; &lt;b&gt;');
    expect(out).toContain('Stir &lt;fast&gt; &amp; &quot;well&quot;');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://example.com/v?a=1&amp;b=&quot;2&quot;"');
  });
});

describe('fmtQty', () => {
  it('scales and formats without long decimals', () => {
    expect(fmtQty(0.25, 'tsp', 2)).toBe('½ tsp');
    expect(fmtQty(0.5, '', 1)).toBe('½');
    expect(fmtQty(0.75, 'cup', 2)).toBe('1½ cup');
    expect(fmtQty(150, 'g', 2)).toBe('300 g');
    expect(fmtQty(1, '', 2)).toBe('2');
    expect(fmtQty(1 / 3, 'cup', 1)).toBe('⅓ cup');
    expect(fmtQty(0.1, 'tsp', 1)).toBe('0.1 tsp');
    expect(fmtQty(null, '', 2)).toBe('');
  });
});
