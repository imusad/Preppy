'use client';

import { useId } from 'react';
import type { Household, Setup } from '@/lib/types';
import { CITIES } from '@/lib/data/catalog';
import { CityIcon } from './icons';
import { Field, Group, StatusTag, Tiles, toInt } from './parts';
import { anchorId, householdMissing, mealForLine } from './validate';
import s from './Setup.module.css';

const CITY_OPTIONS = CITIES.map((c) => ({ key: c, label: c, grey: c === 'Other' }));

export default function HouseholdSection(props: {
  setup: Setup;
  showMissing: boolean;
  onChange: (patch: Partial<Household>) => void;
}) {
  const { setup, showMissing, onChange } = props;
  const h = setup.household;
  const uid = useId();
  const missing = householdMissing(setup).filter((f) => f !== 'people');
  const isMissing = (f: string) => showMissing && missing.some((m) => m === f);
  const n = setup.people.length;
  const range = n <= 1 ? 'Enter 1' : 'Enter a number from 1 to ' + n;

  const minutes = (field: 'morningMin' | 'eveningMin', label: string) => (
    <Field
      id={anchorId(null, field)} inputId={uid + field} label={label} unit="min"
      missing={isMissing(field)} req="Required"
    >
      <input
        id={uid + field} type="number" inputMode="numeric" min={1} required
        aria-invalid={isMissing(field) || undefined}
        value={h[field] > 0 ? h[field] : ''}
        onChange={(e) => onChange({ [field]: toInt(e.target.value) ?? 0 })}
      />
    </Field>
  );

  const count = (field: 'lunchCount' | 'dinnerCount', label: string, meal: 'Lunch' | 'Dinner') => {
    const v = h[field];
    // A number outside 1..people is said in words straight away, not only after Generate.
    const outOfRange = v !== null && missing.some((m) => m === field);
    return (
      <Field
        id={anchorId(null, field)} inputId={uid + field} label={label}
        missing={isMissing(field) || outOfRange} req={v === null ? 'Required' : range}
        helper={mealForLine(meal, v, setup.people) || undefined}
      >
        <input
          id={uid + field} type="number" inputMode="numeric" min={1} max={Math.max(1, n)} required
          aria-invalid={isMissing(field) || outOfRange || undefined}
          value={v ?? ''}
          onChange={(e) => onChange({ [field]: toInt(e.target.value) })}
        />
      </Field>
    );
  };

  return (
    <section aria-labelledby={uid + 'title'} className={s.card}>
      <div className={s.cardBody}>
        <div className={s.cardHead}>
          <h2 id={uid + 'title'} className={s.cardTitle}>Household</h2>
          <StatusTag missing={missing.length} />
        </div>
        <Group
          id={anchorId(null, 'city')} title="Your city" label="City" hint="Costs use prices from this city."
          req="Pick one" missing={isMissing('city')}
        >
          <Tiles
            options={CITY_OPTIONS} cols={4} size="s" smallLabel icon={<CityIcon size={20} />}
            isSelected={(k) => h.city === k} onPick={(k) => onChange({ city: k })}
          />
        </Group>
        <p className={s.plainHint}>The morning covers lunch and dinner prep. The evening is only for finishing dinner.</p>
        <div className={s.grid2}>
          {minutes('morningMin', 'Morning cooking time')}
          {minutes('eveningMin', 'Evening cooking time')}
          {count('lunchCount', 'People at lunch', 'Lunch')}
          {count('dinnerCount', 'People at dinner', 'Dinner')}
        </div>
      </div>
    </section>
  );
}
