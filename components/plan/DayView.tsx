'use client';

import { useEffect, useRef } from 'react';
import type { Flag, Plan, PlanDay, PlanDish, PlanMeal } from '@/lib/types';
import { dayLabel, dishFlags, listNames, mealTotals, mealWho, money, type MealKind } from '@/lib/export/format';
import { BackIcon, CheckIcon, MoonIcon, NextIcon, SunIcon, Thumb, useLayerFocus, type OpenRecipe } from './parts';
import s from './plan.module.css';

interface Props {
  plan: Plan;
  days: PlanDay[];
  index: number;
  inert: boolean;
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
  onGo: (index: number) => void;
  onBack: () => void;
  onOpenRecipe: OpenRecipe;
}

function Tick({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" className={s.check} role="checkbox" aria-checked={checked} aria-label={`${label} done`} onClick={onClick}>
      <CheckIcon size={14} />
    </button>
  );
}

function DishRows({ plan, meal, onOpenRecipe }: { plan: Plan; meal: PlanMeal; onOpenRecipe: OpenRecipe }) {
  return (
    <>
      {meal.dishes.length === 0 && <div className={s.noRecipe}><strong>No recipe found</strong></div>}
      {meal.dishes.map((dish, i) => {
        if (dish.mainId === null || !plan.recipes[dish.mainId]) {
          return (
            <div key={i} className={s.noRecipe}>
              <strong>No recipe found</strong>
              {dish.noRecipeReason || "Nothing fits everyone's diet."}
            </div>
          );
        }
        return [dish.mainId, dish.sideId].map((id) => {
          const r = id ? plan.recipes[id] : undefined;
          if (!r) return null;
          const cost = r.costPerServing === null
            ? 'Price unavailable'
            : `${money(r.costPerServing * dish.servings)}${plan.pricesChecked ? `, prices checked ${plan.pricesChecked}` : ''}`;
          return (
            <button key={`${i}-${r.id}`} type="button" className={s.rowBtn} onClick={() => onOpenRecipe(r.id, 'day', dish)}>
              <Thumb src={r.images[0] ?? r.image} seed={r.id} size={52} />
              <span className={s.rowText}>
                <span className={s.rowName}>{r.name}</span>
                <span className={s.rowMeta}>
                  {r.kind === 'main' ? 'Main' : 'Side'} · {r.totalMin} min · Fun {r.fun}/5 · {cost} · For {listNames(dish.who)}
                </span>
              </span>
              <NextIcon className={s.chev} size={18} />
            </button>
          );
        });
      })}
    </>
  );
}

/** The steps of each dish group for one half of the day. */
function Steps({ dishes, part }: { dishes: PlanDish[]; part: 'morning' | 'evening' }) {
  const groups = dishes
    .filter((d) => d.mainId !== null)
    .map((d) => ({
      who: listNames(d.who),
      label: part === 'morning' ? null : d.eveningLabel,
      steps: part === 'morning' ? (d.morningSteps.length ? d.morningSteps : d.morningLabel ? [d.morningLabel] : []) : d.eveningSteps,
    }))
    .filter((g) => g.label || g.steps.length);
  const multi = dishes.length > 1;
  return (
    <>
      {groups.map((g, i) => (
        <div key={i} className={s.stack} style={{ gap: 4 }}>
          {multi && <span className={s.forWho}>For {g.who}</span>}
          {g.label && <span className={s.labelLine}>{g.label}</span>}
          {g.steps.length > 0 && <ol className={s.stepList}>{g.steps.map((t, j) => <li key={j}>{t}</li>)}</ol>}
        </div>
      ))}
    </>
  );
}

function Meter({ used, window: win, label }: { used: number; window: number; label: string }) {
  const over = used - win;
  const pct = win > 0 ? Math.min(100, Math.round((used / win) * 100)) : 0;
  return (
    <>
      <div className={s.track} role="img" aria-label={`${label}: ${used} of ${win} minutes used`}>
        <div className={`${s.fill}${over > 0 ? ` ${s.fillOver}` : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {over > 0 && <span className={`${s.tag} ${s.tagWarning} ${s.selfStart}`}>Over time window (+{over} min)</span>}
    </>
  );
}

export default function DayView({ plan, days, index, inert, checks, onToggle, onGo, onBack, onOpenRecipe }: Props) {
  const d = days[index];
  const titleRef = useLayerFocus<HTMLHeadingElement>();
  const scrollEl = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollEl.current) scrollEl.current.scrollTop = 0; }, [index]);

  const lunch = mealTotals(d.lunch);
  const dinner = mealTotals(d.dinner);
  const hasPrep = d.dinner.dishes.some((x) => x.mainId !== null && (x.morningMin > 0 || x.morningSteps.length > 0 || x.morningLabel));
  const key = (n: number) => `${d.day}-${n}`;
  const who = (kind: MealKind) => listNames(mealWho(d[kind], kind === 'lunch' ? plan.lunchWho : plan.dinnerWho));

  // Notes: garnish swaps and other dish notes, then flags, then the prices-checked date.
  const all = [...d.lunch.dishes, ...d.dinner.dishes];
  const notes = Array.from(new Set(all.flatMap((x) => x.notes)));
  const flags: Flag[] = [];
  for (const x of all) for (const f of dishFlags(x)) if (!flags.some((o) => o.label === f.label)) flags.push(f);
  const flagClass = (f: Flag) => (f.kind === 'non_compliant' || f.kind === 'no_recipe' ? s.noteError : f.kind === 'price_unavailable' ? s.noteMuted : s.noteWarn);

  return (
    <div className={s.layer} inert={inert}>
      <header className={s.bar}>
        <button type="button" className={s.iconBtn} onClick={onBack} aria-label="Back to week"><BackIcon size={22} />Week</button>
        <div className={s.dayNav}>
          <button type="button" className={`${s.iconBtn} ${s.sq}`} onClick={() => onGo(index - 1)} disabled={index <= 0} aria-label="Previous day"><BackIcon size={20} /></button>
          <h1 className={s.dayTitle} tabIndex={-1} ref={titleRef} aria-live="polite">
            <span>{dayLabel(d)}</span>
            <span><span className="sr-only"> · </span>Week {d.week}</span>
          </h1>
          <button type="button" className={`${s.iconBtn} ${s.sq}`} onClick={() => onGo(index + 1)} disabled={index >= days.length - 1} aria-label="Next day"><NextIcon size={20} /></button>
        </div>
        <span className={s.barSpacer} aria-hidden="true" />
      </header>

      <main className={`${s.scroll} ${s.dayBody}`} ref={scrollEl}>
        <div className={s.dayInner}>
          <section className={s.card} aria-labelledby="day-morning">
            <div className={s.cardHead}>
              <h2 id="day-morning" className={`${s.cardTitle} ${s.morning}`}><SunIcon />Morning</h2>
              <span className={`${s.used}${d.morningUsed > d.morningWindow ? ` ${s.usedOver}` : ''}`}>{d.morningUsed} of {d.morningWindow} min</span>
            </div>
            <Meter used={d.morningUsed} window={d.morningWindow} label="Morning" />

            <div className={s.task}>
              <Tick label="Cook lunch" checked={!!checks[key(1)]} onClick={() => onToggle(key(1))} />
              <div className={s.taskBody}>
                <div className={s.taskHead}>
                  <h3 className={s.taskName}>Cook lunch</h3>
                  {lunch.hasRecipe && <span className={s.taskMin}>{lunch.morningMin || lunch.totalMin} min</span>}
                </div>
                <span className={s.small}>For {who('lunch')}</span>
                <Steps dishes={d.lunch.dishes} part="morning" />
                <DishRows plan={plan} meal={d.lunch} onOpenRecipe={onOpenRecipe} />
              </div>
            </div>

            {hasPrep && (
              <div className={s.task}>
                <Tick label="Prep dinner" checked={!!checks[key(2)]} onClick={() => onToggle(key(2))} />
                <div className={s.taskBody}>
                  <div className={s.taskHead}>
                    <h3 className={s.taskName}>Prep dinner</h3>
                    <span className={s.taskMin}>{dinner.morningMin} min</span>
                  </div>
                  <Steps dishes={d.dinner.dishes} part="morning" />
                </div>
              </div>
            )}
          </section>

          <section className={s.card} aria-labelledby="day-evening">
            <div className={s.cardHead}>
              <h2 id="day-evening" className={`${s.cardTitle} ${s.evening}`}><MoonIcon />Evening</h2>
              <span className={`${s.used}${d.eveningUsed > d.eveningWindow ? ` ${s.usedOver}` : ''}`}>{d.eveningUsed} of {d.eveningWindow} min</span>
            </div>
            <Meter used={d.eveningUsed} window={d.eveningWindow} label="Evening" />

            {dinner.hasRecipe ? (
              <div className={s.task}>
                <Tick label="Finish dinner" checked={!!checks[key(3)]} onClick={() => onToggle(key(3))} />
                <div className={s.taskBody}>
                  <div className={s.taskHead}>
                    <h3 className={s.taskName}>Finish dinner</h3>
                    <span className={s.taskMin}>{dinner.eveningMin} min</span>
                  </div>
                  <span className={s.small}>For {who('dinner')}</span>
                  <Steps dishes={d.dinner.dishes} part="evening" />
                  <DishRows plan={plan} meal={d.dinner} onOpenRecipe={onOpenRecipe} />
                </div>
              </div>
            ) : (
              <div className={s.taskBody}>
                <h3 className={s.taskName}>Finish dinner</h3>
                <DishRows plan={plan} meal={d.dinner} onOpenRecipe={onOpenRecipe} />
              </div>
            )}
          </section>

          <section className={s.card} style={{ gap: 8 }} aria-labelledby="day-notes">
            <h2 id="day-notes" className={`${s.cardTitle} ${s.notesTitle}`}>Notes</h2>
            <ul className={s.notes}>
              {notes.map((n) => <li key={n}>{n}</li>)}
              {flags.map((f) => <li key={f.label} className={flagClass(f)}>{f.label}</li>)}
              {plan.pricesChecked
                ? <li className={s.noteMuted}>{plan.priceNote ? `${plan.priceNote}, ` : 'Prices '}checked {plan.pricesChecked}</li>
                : <li className={s.noteMuted}>{plan.priceNote ?? 'Prices are not available yet'}</li>}
            </ul>
            <span className={s.small}>Ticks are for today only and aren&apos;t saved.</span>
          </section>
        </div>
      </main>
    </div>
  );
}
