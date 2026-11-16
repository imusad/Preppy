'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Household, Person, Setup as SetupData } from '@/lib/types';
import HouseholdSection from './HouseholdSection';
import PersonSection, { personSectionId } from './PersonSection';
import { BackIcon, CopyIcon, InfoIcon } from './icons';
import { cx } from './parts';
import { anchorId, blankPerson, MAX_PEOPLE, copyPerson, missingItems, personLabel, personMissing } from './validate';
import type { MissingItem } from './validate';
import s from './Setup.module.css';

export type { ChartDraft } from './chart';

export interface SetupProps {
  value: SetupData;
  onChange: (next: SetupData) => void;
  onGenerate: (setup: SetupData) => void;
  onBack: () => void;
  /** Opened from an existing plan. */
  editing: boolean;
  hasPlan: boolean;
}

interface ScrollTarget { id: string; block: 'start' | 'center'; focus: boolean }

export default function Setup({ value, onChange, onGenerate, onBack, editing, hasPlan }: SetupProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<ScrollTarget | null>(null);

  // Latest value, so results that arrive later (a chart being read) never overwrite newer edits.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => { valueRef.current = value; onChangeRef.current = onChange; });

  const [openId, setOpenId] = useState<string | null>(() => {
    if (editing) return null;
    return value.people.find((p) => personMissing(p).length > 0)?.id ?? null;
  });
  const [showMissing, setShowMissing] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [copiedFrom, setCopiedFrom] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

  const change = useCallback((fn: (prev: SetupData) => SetupData) => {
    const next = fn(valueRef.current);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChangeRef.current(next);
  }, []);

  const patchHousehold = useCallback((patch: Partial<Household>) => {
    change((v) => ({ ...v, household: { ...v.household, ...patch } }));
  }, [change]);

  const patchPerson = useCallback((id: string, fn: (p: Person) => Person) => {
    change((v) => {
      let touched = false;
      const people = v.people.map((p) => {
        if (p.id !== id) return p;
        const next = fn(p);
        if (next !== p) touched = true;
        return next;
      });
      return touched ? { ...v, people } : v;
    });
  }, [change]);

  // Scrolling waits for the render that opens the target section.
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    pendingScroll.current = null;
    const box = scrollRef.current;
    const el = document.getElementById(target.id);
    if (!box || !el || !box.contains(el)) return;
    const br = box.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    let top = box.scrollTop + (er.top - br.top) - 12;
    if (target.block === 'center') top -= Math.max(0, (box.clientHeight - el.offsetHeight) / 2 - 12);
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' });
    if (target.focus) el.focus({ preventScroll: true });
  });

  const scrollTo = (id: string, block: 'start' | 'center', focus = false) => {
    pendingScroll.current = { id, block, focus };
    setTick((t) => t + 1);
  };

  const missing = missingItems(value);
  const n = missing.length;
  const people = value.people;

  const jump = (item: MissingItem, position: number, total: number) => {
    if (item.personId) setOpenId(item.personId);
    setAnnounce(`Missing item ${position} of ${total}. ${item.label}.`);
    scrollTo(anchorId(item.personId, item.field), 'center', true);
  };

  const generate = () => {
    const now = missingItems(valueRef.current);
    if (now.length === 0) { onGenerate(valueRef.current); return; }
    setShowMissing(true);
    setCursor(1);
    jump(now[0], 1, now.length);
  };

  const nextMissing = () => {
    if (n === 0) return;
    const i = cursor % n;
    setCursor(i + 1);
    jump(missing[i], i + 1, n);
  };

  const addPerson = (source?: Person, sourceLabel?: string) => {
    const np = source ? copyPerson(source) : blankPerson();
    change((v) => ({ ...v, people: [...v.people, np] }));
    if (sourceLabel) setCopiedFrom((m) => ({ ...m, [np.id]: sourceLabel }));
    setOpenId(np.id);
    scrollTo(personSectionId(np.id), 'start');
  };

  const removePerson = (id: string) => {
    change((v) => ({ ...v, people: v.people.filter((p) => p.id !== id) }));
    setOpenId(null);
  };

  const onChartAccepted = (id: string) => {
    const p = valueRef.current.people.find((x) => x.id === id);
    if (p && personMissing(p).length === 0) setOpenId(null);
    scrollTo(personSectionId(id), 'start');
  };

  const toGo = showMissing ? ((cursor - 1 + n) % Math.max(n, 1)) + 1 : 0;

  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.headerRow}>
          <button type="button" className={s.backBtn} onClick={onBack} aria-label={editing || hasPlan ? 'Back to plan' : 'Back to start'}>
            <BackIcon size={22} />
          </button>
          <div className={s.headerText}>
            <h1 className={s.title}>{editing ? 'Edit setup' : 'Set up your plan'}</h1>
            <span className={s.headerSub}>
              Household · {people.length} {people.length === 1 ? 'person' : 'people'} · {n ? n + ' to fill' : 'All set'}
            </span>
          </div>
        </div>
        {showMissing && n > 0 ? (
          <div role="alert" className={s.missingBar}>
            <span className={s.missingBarText}>
              <strong>{n} {n === 1 ? 'thing' : 'things'} missing.</strong> Fill {n === 1 ? 'it' : 'them'} in to generate your plan.
              <span className={s.missingBarCount} aria-hidden="true">Showing {Math.min(toGo, n)} of {n}</span>
            </span>
            <button type="button" className={cx(s.btn, s.btnDanger)} onClick={nextMissing} aria-label="Next missing item">Next</button>
          </div>
        ) : null}
        <div className="sr-only" aria-live="polite">{announce}</div>
      </header>

      <div className={s.scroll} ref={scrollRef}>
        {editing ? (
          <div role="note" className={s.infoNote}>
            <InfoIcon size={20} />
            <span>Your answers are kept. Your current plan stays until the new one is ready.</span>
          </div>
        ) : null}

        <HouseholdSection setup={value} showMissing={showMissing} onChange={patchHousehold} />

        {people.map((p, i) => (
          <PersonSection
            key={p.id} person={p} index={i} open={openId === p.id} showMissing={showMissing}
            copiedFrom={copiedFrom[p.id] ?? null} canRemove={people.length > 1}
            onPatch={(fn) => patchPerson(p.id, fn)}
            onOpen={() => { setOpenId(p.id); scrollTo(personSectionId(p.id), 'start'); }}
            onClose={() => { setOpenId(null); scrollTo(personSectionId(p.id), 'start'); }}
            onRemove={() => removePerson(p.id)}
            onChartAccepted={() => onChartAccepted(p.id)}
          />
        ))}

        <div id={anchorId(null, 'people')} tabIndex={-1} className={s.addArea}>
          {people.length >= MAX_PEOPLE ? <p className={s.plainHint}>Up to {MAX_PEOPLE} people per plan.</p> : null}
          {people.length < MAX_PEOPLE ? <button type="button" className={cx(s.choice, s.choiceCentre, s.choiceAdd)} onClick={() => addPerson()}>+ Add person</button> : null}
          {people.length < MAX_PEOPLE && people.map((p, i) => {
            const label = personLabel(p, i);
            return (
              <button key={p.id} type="button" className={cx(s.choice, s.choiceCentre)} onClick={() => addPerson(p, label)}>
                <CopyIcon size={18} />Copy from {label}
              </button>
            );
          })}
          {people.length > 0 ? (
            <span className={s.addNote}>Copying keeps everything except dietary choice and diet chart.</span>
          ) : null}
        </div>
        <div className={s.spacer} />
      </div>

      <footer className={s.footer}>
        <button type="button" className="cta" onClick={generate}>Generate plan</button>
      </footer>
    </div>
  );
}
