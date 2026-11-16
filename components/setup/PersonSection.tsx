'use client';

import { useId, useState } from 'react';
import type { Diet, Person } from '@/lib/types';
import { DIETS, RESTRICTIONS, UTENSILS } from '@/lib/data/catalog';
import ChartPanel from './ChartPanel';
import DishPicker from './DishPicker';
import { BanIcon, FaceIcon, LeafIcon, PanIcon } from './icons';
import { Field, Group, PickedChips, StatusTag, Tiles, cx, toInt } from './parts';
import {
  addOtherRestriction, anchorId, bothListsNote, dishesInBoth, missingText, personLabel, personMissing, pickRestriction,
} from './validate';
import s from './Setup.module.css';

const DIET_OPTS = DIETS.map((d) => ({ key: d, label: d }));
const tile = (r: (typeof RESTRICTIONS)[number]) => ({ key: r.id, label: r.label, grey: r.kind === 'none' });
const TASTE_OPTS = RESTRICTIONS.filter((r) => r.kind === 'none' || r.kind === 'dislike').map(tile);
const ALLERGY_OPTS = RESTRICTIONS.filter((r) => r.kind === 'allergen' || r.kind === 'avoid').map(tile);
const UTENSIL_OPTS = UTENSILS.map((u) => ({ key: u.id, label: u.label }));

export function personSectionId(personId: string): string {
  return 'setup-person-' + personId;
}

export default function PersonSection(props: {
  person: Person;
  index: number;
  open: boolean;
  showMissing: boolean;
  /** Name of the person this one was copied from, while that note is relevant. */
  copiedFrom: string | null;
  canRemove: boolean;
  onPatch: (fn: (p: Person) => Person) => void;
  onOpen: () => void;
  onClose: () => void;
  onRemove: () => void;
  onChartAccepted: () => void;
}) {
  const { person, index, onPatch, showMissing } = props;
  const uid = useId();
  const [otherText, setOtherText] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const missing = personMissing(person);
  const n = missing.length;
  const label = personLabel(person, index);
  const isMissing = (f: string) => showMissing && missing.some((m) => m === f);
  const id = (f: string) => anchorId(person.id, f);
  const set = (patch: Partial<Person>) => onPatch((p) => ({ ...p, ...patch }));

  if (!props.open) {
    const title = [label, person.diet, person.chart && person.chartAccepted ? 'Chart accepted' : null].filter(Boolean).join(' · ');
    return (
      <section id={personSectionId(person.id)} className={s.card} aria-label={label}>
        <div className={s.summaryRow}>
          <span className={s.avatar} aria-hidden="true">{(person.name.trim() || String(index + 1)).charAt(0).toUpperCase()}</span>
          <div className={s.summaryText}>
            <span className={s.summaryTitle}>{title}</span>
            <span className={cx(s.summaryLine, n === 0 ? s.summaryDone : s.summaryTodo)}>{missingText(n)}</span>
          </div>
          <button type="button" className={cx(s.btn, s.btnText)} aria-label={'Edit ' + label} onClick={props.onOpen}>Edit</button>
        </div>
      </section>
    );
  }

  const both = dishesInBoth(person);
  const addOther = () => {
    if (!otherText.trim()) return;
    onPatch((p) => ({ ...p, ...addOtherRestriction(p, otherText) }));
    setOtherText('');
  };

  return (
    <section id={personSectionId(person.id)} className={s.card} aria-labelledby={uid + 'title'}>
      <div className={s.personBody}>
        <div className={s.cardHead}>
          <h2 id={uid + 'title'} className={s.cardTitle}>{label}</h2>
          <StatusTag missing={n} />
        </div>

        {props.copiedFrom ? (
          <p className={s.copiedNote}>
            Copied from {props.copiedFrom}. Add a name, dietary choice and diet chart, and change anything that differs.
          </p>
        ) : null}

        <div className={s.grid2}>
          <Field id={id('name')} inputId={uid + 'name'} label="Name" missing={isMissing('name')}>
            <input
              id={uid + 'name'} type="text" placeholder="e.g. Iman" autoComplete="off" required maxLength={40}
              aria-invalid={isMissing('name') || undefined}
              value={person.name} onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field
            id={id('budget')} inputId={uid + 'budget'} label="Budget per meal" missing={isMissing('budget')}
            before={<span className={s.unit} aria-hidden="true">₹</span>}
          >
            <input
              id={uid + 'budget'} type="number" inputMode="numeric" min={1} placeholder="200" required
              aria-label="Budget per meal in rupees" aria-invalid={isMissing('budget') || undefined}
              value={person.budget ?? ''} onChange={(e) => set({ budget: toInt(e.target.value) })}
            />
          </Field>
        </div>

        <Group id={id('diet')} title="Dietary choice" label="Dietary choice" hint="Pick one." req="Pick one to continue" missing={isMissing('diet')}>
          <Tiles options={DIET_OPTS} icon={<LeafIcon size={26} />} isSelected={(k) => person.diet === k} onPick={(k) => set({ diet: k as Diet })} />
        </Group>

        <Group
          id={id('restrictions')} title="Restrictions and dislikes" label="Restrictions and dislikes"
          hint="Allergies, foods they avoid and tastes they dislike, e.g. “doesn’t like mustard” or “doesn’t like coriander leaves”. Pick all that apply, or None."
          req="Pick at least one, or None" missing={isMissing('restrictions')}
        >
          <span className={s.subhead}>Taste dislikes</span>
          <Tiles
            options={TASTE_OPTS} size="m" icon={<FaceIcon size={22} />}
            isSelected={(k) => person.restrictions.includes(k)} onPick={(k) => onPatch((p) => ({ ...p, ...pickRestriction(p, k) }))}
          />
          <span className={s.subhead}>Allergies and avoids</span>
          <Tiles
            options={ALLERGY_OPTS} size="m" icon={<BanIcon size={22} />}
            isSelected={(k) => person.restrictions.includes(k)} onPick={(k) => onPatch((p) => ({ ...p, ...pickRestriction(p, k) }))}
          />
          <div className={s.fld}>
            <label className={s.lbl} htmlFor={uid + 'other'}>Other</label>
            <div className={s.inlineRow}>
              <div className={s.inp}>
                <input
                  id={uid + 'other'} type="text" placeholder="e.g. No raw onion" autoComplete="off" maxLength={60}
                  value={otherText} onChange={(e) => setOtherText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }}
                />
              </div>
              <button type="button" className={cx(s.btn, s.btnOutlined)} onClick={addOther}>Add</button>
            </div>
            <span className={s.helper}>Anything not shown above. Typed allergies are checked strictly: a recipe we&apos;re unsure about is left out.</span>
          </div>
          <PickedChips
            items={person.otherRestrictions}
            onRemove={(item) => onPatch((p) => ({ ...p, otherRestrictions: p.otherRestrictions.filter((x) => x !== item) }))}
          />
        </Group>

        <Group
          id={id('favourites')} title="Favourite meals" label="Favourite meals"
          hint="Pick all they love, or None. Search for anything not shown." req="Pick at least one, or None" missing={isMissing('favourites')}
        >
          <DishPicker
            list={person.favourites} onChange={(next) => set({ favourites: next })}
            searchLabel="Search favourite dishes" placeholder="Search dishes, e.g. Goan fish curry"
          />
        </Group>

        <Group
          id={id('leastFavourites')} title="Least favourite meals" label="Least favourite meals"
          hint="Dishes to keep out of the plan, or None. Search for anything not shown." req="Pick at least one, or None" missing={isMissing('leastFavourites')}
        >
          <div aria-live="polite">
            {both.length ? <div className={s.warnNote}>{bothListsNote(both)}</div> : null}
          </div>
          <DishPicker
            list={person.leastFavourites} onChange={(next) => set({ leastFavourites: next })}
            searchLabel="Search least favourite dishes" placeholder="Search dishes, e.g. Karela sabzi"
          />
        </Group>

        <Group id={id('utensils')} title="Utensils they cook with" label="Utensils" hint="Recipes only use what you pick." req="Pick at least one" missing={isMissing('utensils')}>
          <Tiles
            options={UTENSIL_OPTS} icon={<PanIcon size={26} />} isSelected={(k) => person.utensils.includes(k)}
            onPick={(k) => onPatch((p) => ({ ...p, utensils: p.utensils.includes(k) ? p.utensils.filter((x) => x !== k) : [...p.utensils, k] }))}
          />
        </Group>

        <ChartPanel
          person={person} anchor={id('chart')} missing={isMissing('chart')}
          onPatch={onPatch} onAccepted={props.onChartAccepted}
        />

        <button type="button" className={cx(s.btn, s.btnOutlined, s.btnBlock)} onClick={props.onClose}>Done with {label}</button>

        {props.canRemove ? (
          confirmRemove ? (
            <div className={s.removeRow} role="group" aria-label={'Remove ' + label}>
              <span className={s.removeAsk}>Remove {label} and all their answers?</span>
              <button type="button" className={cx(s.btn, s.btnDanger)} onClick={props.onRemove}>Remove</button>
              <button type="button" className={cx(s.btn, s.btnText)} onClick={() => setConfirmRemove(false)}>Keep</button>
            </div>
          ) : (
            <button type="button" className={cx(s.btn, s.btnDangerText, s.btnStart)} onClick={() => setConfirmRemove(true)}>Remove {label}</button>
          )
        ) : null}
      </div>
    </section>
  );
}
