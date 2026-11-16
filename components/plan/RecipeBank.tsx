'use client';

import { useMemo } from 'react';
import type { Plan, PlanRecipe } from '@/lib/types';
import { listNames } from '@/lib/export/format';
import { BackIcon, Thumb, useLayerFocus, type OpenRecipe } from './parts';
import s from './plan.module.css';

export interface BankFilters {
  type: 'All' | 'Main' | 'Side';
  cuisine: string;
  person: string;
  fun: 'Any' | 'Fun 3+' | 'Fun 4+' | 'Fun 5';
}

export const NO_FILTERS: BankFilters = { type: 'All', cuisine: 'All', person: 'All', fun: 'Any' };

const MIN_FUN: Record<BankFilters['fun'], number> = { Any: 0, 'Fun 3+': 3, 'Fun 4+': 4, 'Fun 5': 5 };

interface Props {
  plan: Plan;
  filters: BankFilters;
  onFilters: (f: BankFilters) => void;
  onClose: () => void;
  onOpenRecipe: OpenRecipe;
}

function ChipRow<T extends string>({ name, options, value, onPick }: { name: string; options: T[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className={s.chipRow} role="group" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" className={s.chip} aria-pressed={value === o} onClick={() => onPick(o)}>{o}</button>
      ))}
    </div>
  );
}

export default function RecipeBank({ plan, filters: f, onFilters, onClose, onOpenRecipe }: Props) {
  const titleRef = useLayerFocus<HTMLHeadingElement>();

  const all = useMemo(
    () => plan.bankIds.map((id) => plan.recipes[id]).filter((r): r is PlanRecipe => Boolean(r)),
    [plan],
  );
  const cuisines = useMemo(() => Array.from(new Set(all.map((r) => r.cuisine))).sort(), [all]);
  const list = useMemo(
    () => all
      .filter((r) => (f.type === 'All' || (f.type === 'Main') === (r.kind === 'main'))
        && (f.cuisine === 'All' || r.cuisine === f.cuisine)
        && (f.person === 'All' || r.who.includes(f.person))
        && r.fun >= MIN_FUN[f.fun])
      .sort((a, b) => b.fun - a.fun || a.name.localeCompare(b.name)),
    [all, f],
  );
  const filtered = f.type !== 'All' || f.cuisine !== 'All' || f.person !== 'All' || f.fun !== 'Any';
  const total = `${all.length} ${all.length === 1 ? 'recipe' : 'recipes'}`;

  return (
    <section className={`${s.panel} ${s.panelGrey}`} role="dialog" aria-modal="true" aria-label="Recipe bank">
      <header className={s.bankTop}>
        <div className={s.bankHead}>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Back to plan"><BackIcon size={22} />Plan</button>
          <h1 className={s.bankTitle} tabIndex={-1} ref={titleRef}>Recipe bank</h1>
          <span className={s.bankCount} role="status">{filtered ? `${list.length} of ${total}` : total}</span>
        </div>
        <div className={s.filters}>
          <ChipRow name="Main or side" options={['All', 'Main', 'Side'] as BankFilters['type'][]} value={f.type} onPick={(type) => onFilters({ ...f, type })} />
          <ChipRow name="Cuisine" options={['All', ...cuisines]} value={f.cuisine} onPick={(cuisine) => onFilters({ ...f, cuisine })} />
          <ChipRow name="Person" options={['All', ...plan.people]} value={f.person} onPick={(person) => onFilters({ ...f, person })} />
          <ChipRow name="Fun factor" options={['Any', 'Fun 3+', 'Fun 4+', 'Fun 5'] as BankFilters['fun'][]} value={f.fun} onPick={(fun) => onFilters({ ...f, fun })} />
        </div>
      </header>
      <div className={`${s.scroll} ${s.bankList}`}>
        {list.map((r) => (
          <button key={r.id} type="button" className={s.rowBtn} onClick={() => onOpenRecipe(r.id, 'bank', null)}>
            <Thumb src={r.images[0] ?? r.image} seed={r.id} size={64} />
            <span className={s.rowText}>
              <span className={s.rowName}>{r.name}</span>
              <span className={s.rowLine1}>{r.cuisine} · {r.kind === 'main' ? 'Main' : 'Side'} · {r.totalMin} min · Fun {r.fun}/5</span>
              <span className={s.small}>For {listNames(r.who) || 'everyone'}</span>
            </span>
          </button>
        ))}
        {list.length === 0 && (
          <div className={s.empty}>
            <p className={s.emptyTitle}>No recipes match these filters</p>
            <p className={s.emptyText}>Try fewer filters to see more recipes.</p>
            <button type="button" className={s.outlineBtn} onClick={() => onFilters(NO_FILTERS)}>Clear filters</button>
          </div>
        )}
      </div>
    </section>
  );
}
