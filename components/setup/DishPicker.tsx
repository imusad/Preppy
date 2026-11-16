'use client';

import { useEffect, useMemo, useState } from 'react';
import { DISH_GRID, MORE_DISHES } from '@/lib/data/catalog';
import { searchDishes } from '@/lib/client/api';
import { BowlIcon, SearchIcon } from './icons';
import { PickedChips, Tiles, cx } from './parts';
import { NONE_DISH, toggleWithNone } from './validate';
import s from './Setup.module.css';

const GRID_NAMES = DISH_GRID.flatMap((g) => g.items.map((d) => d.name));
const GRID_SET = new Set(GRID_NAMES);
const LOCAL_DISHES = [...MORE_DISHES, ...GRID_NAMES];
const GROUPS = DISH_GRID.map((g) => ({ cuisine: g.cuisine, options: g.items.map((d) => ({ key: d.name, label: d.name })) }));
const NONE_OPTION = [{ key: NONE_DISH, label: 'None', grey: true }];
const MAX_RESULTS = 8;

/** Search box, picked extras, a None tile and the 54-tile grid grouped by cuisine. */
export default function DishPicker(props: {
  list: string[];
  onChange: (next: string[]) => void;
  searchLabel: string;
  placeholder: string;
}) {
  const { list, onChange } = props;
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ q: string; results: string[] }>({ q: '', results: [] });
  const q = query.trim();
  const useRemote = q.length >= 2;

  useEffect(() => {
    if (!useRemote) return;
    let live = true;
    const timer = setTimeout(async () => {
      const results = await searchDishes(q);
      if (live) setRemote({ q, results });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [q, useRemote]);

  const results = useMemo(() => {
    if (!q) return [];
    const needle = q.toLowerCase();
    const seen = new Set(list.map((d) => d.toLowerCase()));
    const out: string[] = [];
    const add = (d: string) => {
      const k = d.trim().toLowerCase();
      if (!k || k === 'none' || seen.has(k)) return;
      seen.add(k);
      out.push(d.trim());
    };
    LOCAL_DISHES.filter((d) => d.toLowerCase().includes(needle)).forEach(add);
    if (useRemote && remote.q === q) remote.results.forEach(add);
    return out.slice(0, MAX_RESULTS);
  }, [q, list, remote, useRemote]);

  const searching = useRemote && remote.q !== q;
  const extras = list.filter((d) => d !== NONE_DISH && !GRID_SET.has(d));
  const toggle = (name: string) => onChange(toggleWithNone(list, name, NONE_DISH));
  const isSelected = (name: string) => list.includes(name);

  return (
    <>
      <div className={s.inp}>
        <SearchIcon size={18} />
        <input
          type="search" aria-label={props.searchLabel} placeholder={props.placeholder} autoComplete="off"
          enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div aria-live="polite">
        {results.length > 0 ? (
          <div className={s.chips}>
            {results.map((d) => (
              <button
                key={d} type="button" className={s.chip} aria-label={'Add ' + d}
                onClick={() => { onChange([...list.filter((x) => x !== NONE_DISH), d]); setQuery(''); }}
              >
                + {d}
              </button>
            ))}
          </div>
        ) : null}
        {q && results.length === 0 && !searching ? <span className={s.muted}>No dishes match. Try another name.</span> : null}
      </div>
      <PickedChips items={extras} onRemove={(d) => onChange(list.filter((x) => x !== d))} />
      <Tiles options={NONE_OPTION} size="s" smallLabel icon={<BowlIcon size={20} />} isSelected={isSelected} onPick={toggle} />
      {GROUPS.map((g) => (
        <div key={g.cuisine} className={s.subgroup} role="group" aria-label={g.cuisine}>
          <span className={cx(s.subhead)}>{g.cuisine}</span>
          <Tiles options={g.options} icon={<BowlIcon size={26} />} isSelected={isSelected} onPick={toggle} />
        </div>
      ))}
    </>
  );
}
