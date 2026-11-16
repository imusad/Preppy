'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FlagKind, Plan, PlanDay, PlanDish, PlanMeal } from '@/lib/types';
import {
  FLAG_KINDS, FLAG_SUMMARY_LABEL, costText, dayLabel, dishFlags, listNames, mealTotals, mealWho, pricesLine, weekLabel,
  type MealKind,
} from '@/lib/export/format';
import { BankIcon, BowlIcon, DownloadIcon, EditIcon, FLAG_CLASS, FlagTags, NextIcon, type OpenRecipe } from './parts';
import s from './plan.module.css';

interface Props {
  plan: Plan;
  days: PlanDay[];
  inert: boolean;
  onOpenDay: (index: number) => void;
  onOpenRecipe: OpenRecipe;
  onOpenBank: () => void;
  onEditSetup: () => void;
  onExport: () => void;
}

interface Target { week: 1 | 2; key: string }

const mealKey = (d: PlanDay, kind: MealKind) => `${d.day}-${kind}`;

function DishBlock({ plan, dish, kind, showWho, onOpenRecipe }: {
  plan: Plan; dish: PlanDish; kind: MealKind; showWho: boolean; onOpenRecipe: OpenRecipe;
}) {
  const main = dish.mainId ? plan.recipes[dish.mainId] : undefined;
  const side = dish.sideId ? plan.recipes[dish.sideId] : undefined;
  return (
    <div className={s.dish}>
      {showWho && <span className={s.forWho}>For {listNames(dish.who)}</span>}
      {main ? (
        <>
          <div className={s.dishLinks}>
            <button type="button" className={s.dishLink} onClick={() => onOpenRecipe(main.id, 'plan', dish)}>{main.name}</button>
            {side && (
              <button type="button" className={`${s.dishLink} ${s.dishSide}`} onClick={() => onOpenRecipe(side.id, 'plan', dish)}>+ {side.name}</button>
            )}
          </div>
          <span className={s.meta}>{dish.totalMin} min · Fun {dish.fun}/5 · {costText(dish.cost)}</span>
          {kind === 'dinner' && (dish.morningLabel || dish.eveningLabel) && (
            <div className={s.stepsBox}>
              {dish.morningLabel && <span><strong>Morning:</strong> {dish.morningLabel} ({dish.morningMin} min)</span>}
              {dish.eveningLabel && <span>{dish.eveningLabel}</span>}
            </div>
          )}
        </>
      ) : (
        <div className={s.noRecipe}>
          <strong>No recipe found</strong>
          {dish.noRecipeReason || "Nothing fits everyone's diet."}
        </div>
      )}
      <FlagTags flags={dishFlags(dish).filter((f) => main || f.kind !== 'no_recipe')} />
    </div>
  );
}

function MealBlock({ plan, day, kind, flash, onOpenRecipe }: {
  plan: Plan; day: PlanDay; kind: MealKind; flash: boolean; onOpenRecipe: OpenRecipe;
}) {
  const meal: PlanMeal = day[kind];
  const who = mealWho(meal, kind === 'lunch' ? plan.lunchWho : plan.dinnerWho);
  const multi = meal.dishes.length > 1;
  const totals = mealTotals(meal);
  return (
    <div className={`${s.meal}${flash ? ` ${s.flash}` : ''}`} data-meal={mealKey(day, kind)}>
      <div className={s.mealLabel}>
        <strong>{kind === 'lunch' ? 'Lunch' : 'Dinner'}</strong> · {listNames(who)}{kind === 'lunch' ? ', cooked in the morning' : ''}
      </div>
      {meal.dishes.length === 0 && <div className={s.noRecipe}><strong>No recipe found</strong></div>}
      {meal.dishes.map((dish, i) => (
        <DishBlock key={i} plan={plan} dish={dish} kind={kind} showWho={multi} onOpenRecipe={onOpenRecipe} />
      ))}
      {multi && totals.hasRecipe && (
        <span className={s.meta}>Whole meal: {totals.totalMin} min · {costText(totals.cost)}</span>
      )}
    </div>
  );
}

export default function WeekView({ plan, days, inert, onOpenDay, onOpenRecipe, onOpenBank, onEditSetup, onExport }: Props) {
  const [week, setWeek] = useState<1 | 2>(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [jumpTick, setJumpTick] = useState(0);
  const scrollEl = useRef<HTMLDivElement>(null);
  const pos = useRef<Record<1 | 2, number>>({ 1: 0, 2: 0 });
  const restore = useRef<number | null>(null);
  const jumpTo = useRef<string | null>(null);

  // First meal carrying each flag, in day order (lunch before dinner).
  const firstFlag = useMemo(() => {
    const out: Partial<Record<FlagKind, Target>> = {};
    for (const d of days) {
      for (const kind of ['lunch', 'dinner'] as const) {
        for (const dish of d[kind].dishes) {
          for (const f of dishFlags(dish)) out[f.kind] ??= { week: d.week, key: mealKey(d, kind) };
        }
      }
    }
    return out;
  }, [days]);

  const switchWeek = (w: 1 | 2) => {
    if (w === week) return;
    if (scrollEl.current) pos.current[week] = scrollEl.current.scrollTop;
    restore.current = pos.current[w];
    setWeek(w);
  };

  const jump = (kind: FlagKind) => {
    const t = firstFlag[kind];
    if (!t) return;
    if (scrollEl.current) pos.current[week] = scrollEl.current.scrollTop;
    restore.current = null;
    jumpTo.current = t.key;
    setFlash(t.key);
    setWeek(t.week);
    setJumpTick((n) => n + 1);
  };

  // After the week's cards are on screen: go to the flagged meal, or back to where this week was left.
  useLayoutEffect(() => {
    const sc = scrollEl.current;
    if (!sc) return;
    if (jumpTo.current) {
      const el = sc.querySelector<HTMLElement>(`[data-meal="${jumpTo.current}"]`);
      jumpTo.current = null;
      if (el) {
        const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 56;
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        sc.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' });
      }
    } else if (restore.current !== null) {
      sc.scrollTop = restore.current;
      restore.current = null;
    }
  }, [week, jumpTick]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1900);
    return () => clearTimeout(t);
  }, [flash, jumpTick]);

  const onScroll = useCallback(() => {
    if (scrollEl.current && restore.current === null) pos.current[week] = scrollEl.current.scrollTop;
  }, [week]);

  const n = plan.counts.no_recipe ?? 0;
  const prices = pricesLine(plan);
  const reminder = 'Nothing is saved. Export your plan before closing this page.';
  const weekDays = days.map((d, index) => ({ d, index })).filter((x) => x.d.week === week);

  return (
    <div className={s.layer} inert={inert}>
      <header className={s.top}>
        <div className={s.brand} aria-hidden="true"><BowlIcon size={24} /><span>Preppy</span></div>
        <div className={s.titleBlock}>
          <h1 className={s.title}>Your 2-week plan</h1>
          <span className={s.subtitle}>
            Lunch for {listNames(plan.lunchWho)}, cooked in the morning · Dinner for {listNames(plan.dinnerWho)}
          </span>
        </div>
        <div className={s.links}>
          <button type="button" className={s.topLink} onClick={onOpenBank}><BankIcon size={16} />Recipe bank</button>
          <span className={s.linkDot} aria-hidden="true">·</span>
          <button type="button" className={s.topLink} onClick={onEditSetup}><EditIcon size={16} />Edit setup</button>
        </div>
        <button type="button" className={s.exportBtn} onClick={onExport}><DownloadIcon size={16} />Export plan</button>
        <div className={s.seg} role="group" aria-label="Week">
          {([1, 2] as const).map((w) => (
            <button key={w} type="button" aria-pressed={week === w} onClick={() => switchWeek(w)}>{weekLabel(plan, w)}</button>
          ))}
        </div>
        <div className={s.subrow}>
          <div className={s.summary} role="group" aria-label="Flags across both weeks">
            {FLAG_KINDS.map((kind, i) => {
              const count = plan.counts[kind] ?? 0;
              const label = `${count} ${FLAG_SUMMARY_LABEL[kind]}`;
              const active = count > 0 && Boolean(firstFlag[kind]);
              return (
                <span key={kind} style={{ display: 'contents' }}>
                  {i > 0 && <span className="sr-only"> · </span>}
                  <button
                    type="button"
                    className={`${s.sumBtn} ${active ? FLAG_CLASS[kind] : ''}`}
                    disabled={!active}
                    onClick={() => jump(kind)}
                    aria-label={active ? `${label}. Show the first one` : label}
                  >
                    {label}
                  </button>
                </span>
              );
            })}
          </div>
          {prices && <p className={s.priceLine}>{prices}</p>}
          <p className={s.reminderTop}>{reminder}</p>
        </div>
      </header>

      <main className={`${s.scroll} ${s.weekBody}`} ref={scrollEl} onScroll={onScroll}>
        <div className={s.weekInner}>
          {n > 0 && (
            <div className={s.alert} role="alert">
              <span>
                We couldn&apos;t find a recipe for {n} {n === 1 ? 'meal' : 'meals'} that fits everyone&apos;s diet. Edit setup to widen restrictions or utensils, then generate again.
              </span>
              <button type="button" className={s.alertLink} onClick={onEditSetup}>Edit setup</button>
            </div>
          )}
          <div className={s.days}>
            {weekDays.map(({ d, index }) => (
              <article key={d.day} className={s.day} aria-label={`${dayLabel(d)}, Week ${d.week}`}>
                <h2 className={s.dayHeadWrap}>
                  <button type="button" className={s.dayHead} onClick={() => onOpenDay(index)} aria-label={`${dayLabel(d)}. Open day view`}>
                    <span className={s.dayName}>{dayLabel(d)}</span>
                    <span className={s.dayGo}>Day view<NextIcon size={18} /></span>
                  </button>
                </h2>
                <MealBlock plan={plan} day={d} kind="lunch" flash={flash === mealKey(d, 'lunch')} onOpenRecipe={onOpenRecipe} />
                <MealBlock plan={plan} day={d} kind="dinner" flash={flash === mealKey(d, 'dinner')} onOpenRecipe={onOpenRecipe} />
              </article>
            ))}
          </div>
          <p className={s.hint}>Tap a dish for photos, video, ingredients and steps. Costs are estimates from local prices found online.</p>
          <p className={s.reminder}>{reminder}</p>
        </div>
      </main>
    </div>
  );
}
