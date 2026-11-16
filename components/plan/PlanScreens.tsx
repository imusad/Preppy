'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Plan, PlanDish } from '@/lib/types';
import DayView from './DayView';
import ExportPanel from './ExportPanel';
import RecipeBank, { NO_FILTERS, type BankFilters } from './RecipeBank';
import RecipeDetail from './RecipeDetail';
import WeekView from './WeekView';
import type { OpenRecipe, RecipeFrom } from './parts';
import s from './plan.module.css';

interface Props {
  plan: Plan;
  onEditSetup: () => void;
  onExported: () => void;
}

interface OpenedRecipe { id: string; from: RecipeFrom; dish: PlanDish | null }

/**
 * The plan screens: week view, day view, recipe detail, recipe bank and export panel.
 * Everything is drawn from the plan in memory; viewing makes no server calls.
 * The week view and the bank stay mounted under whatever opens on top of them,
 * so Back returns to the same scroll position and filters.
 */
export default function PlanScreens({ plan, onEditSetup, onExported }: Props) {
  const days = useMemo(() => [...plan.days].sort((a, b) => a.day - b.day), [plan]);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [filters, setFilters] = useState<BankFilters>(NO_FILTERS);
  const [recipe, setRecipe] = useState<OpenedRecipe | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const openRecipe = useCallback<OpenRecipe>((id, from, dish) => {
    if (plan.recipes[id]) setRecipe({ id, from, dish });
  }, [plan]);
  const toggle = useCallback((key: string) => setChecks((c) => ({ ...c, [key]: !c[key] })), []);
  const goDay = useCallback((i: number) => {
    if (i >= 0 && i < days.length) setDayIndex(i);
  }, [days.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (exportOpen) setExportOpen(false);
    else if (recipe) setRecipe(null);
    else if (bankOpen) setBankOpen(false);
    else if (dayIndex !== null) setDayIndex(null);
    else return;
    e.stopPropagation();
  };

  const day = dayIndex !== null && days[dayIndex] ? dayIndex : null;
  const opened = recipe ? plan.recipes[recipe.id] : undefined;
  const closeOnScrim = (close: () => void) => (e: React.MouseEvent) => { if (e.target === e.currentTarget) close(); };

  return (
    <div className={s.root} onKeyDown={onKeyDown}>
      <WeekView
        plan={plan}
        days={days}
        inert={day !== null || bankOpen || !!recipe || exportOpen}
        onOpenDay={setDayIndex}
        onOpenRecipe={openRecipe}
        onOpenBank={() => setBankOpen(true)}
        onEditSetup={onEditSetup}
        onExport={() => setExportOpen(true)}
      />

      {day !== null && (
        <DayView
          plan={plan}
          days={days}
          index={day}
          inert={!!recipe || exportOpen}
          checks={checks}
          onToggle={toggle}
          onGo={goDay}
          onBack={() => setDayIndex(null)}
          onOpenRecipe={openRecipe}
        />
      )}

      {bankOpen && (
        <div className={s.overlay} inert={!!recipe} onMouseDown={closeOnScrim(() => setBankOpen(false))}>
          <RecipeBank plan={plan} filters={filters} onFilters={setFilters} onClose={() => setBankOpen(false)} onOpenRecipe={openRecipe} />
        </div>
      )}

      {recipe && opened && (
        <div
          className={`${s.overlay}${recipe.from === 'bank' ? ` ${s.overlayClear}` : ''}`}
          onMouseDown={closeOnScrim(() => setRecipe(null))}
        >
          <RecipeDetail key={recipe.id} plan={plan} recipe={opened} from={recipe.from} dish={recipe.dish} onClose={() => setRecipe(null)} />
        </div>
      )}

      {exportOpen && <ExportPanel plan={plan} onClose={() => setExportOpen(false)} onExported={onExported} />}
    </div>
  );
}
