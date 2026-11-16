// Small building blocks shared by the Setup sections.
import type { ReactNode } from 'react';
import { TINTS } from '@/lib/data/catalog';
import { CheckIcon } from './icons';
import s from './Setup.module.css';

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** A titled question. Shows the "what is needed" line in words when `missing`. */
export function Group(props: {
  id?: string;
  title: ReactNode;
  /** Accessible name of the group. */
  label: string;
  hint?: ReactNode;
  req: string;
  missing: boolean;
  small?: boolean;
  /** Shown to the right of the title. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const Title = props.small ? 'h4' : 'h3';
  const title = <Title className={cx(s.groupTitle, props.small && s.groupTitleSmall)}>{props.title}</Title>;
  return (
    <div id={props.id} tabIndex={-1} role="group" aria-label={props.label} className={cx(s.group, props.missing && s.groupMissing)}>
      {props.aside ? <div className={s.cardHead}>{title}{props.aside}</div> : title}
      {props.hint ? <p className={s.groupHint}>{props.hint}</p> : null}
      {props.missing ? <span className={s.req}>{props.req}</span> : null}
      {props.children}
    </div>
  );
}

/** A labelled typed input. `children` is the <input>; `before` / `unit` sit inside the box. */
export function Field(props: {
  id?: string;
  inputId: string;
  label: string;
  missing: boolean;
  /** Error wording; shown when `missing`. */
  req?: string;
  before?: ReactNode;
  unit?: string;
  helper?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={props.id} tabIndex={-1} className={cx(s.fld, props.missing && s.fldMissing)}>
      <label className={s.lbl} htmlFor={props.inputId}>{props.label}</label>
      <div className={s.inp}>
        {props.before}
        {props.children}
        {props.unit ? <span className={s.unit} aria-hidden="true">{props.unit}</span> : null}
      </div>
      {props.missing ? <span className={s.req} id={props.inputId + '-err'}>{props.req ?? 'Required'}</span> : null}
      {props.helper ? <span className={s.helper}>{props.helper}</span> : null}
    </div>
  );
}

export interface TileOption { key: string; label: string; grey?: boolean }

/** A grid of tappable tiles: a soft tinted block with an icon, and a text label. */
export function Tiles(props: {
  options: readonly TileOption[];
  isSelected: (key: string) => boolean;
  onPick: (key: string) => void;
  icon: ReactNode;
  cols?: 3 | 4;
  size?: 'l' | 'm' | 's';
  smallLabel?: boolean;
}) {
  const size = props.size ?? 'l';
  return (
    <div className={props.cols === 4 ? s.grid4 : s.grid3}>
      {props.options.map((o, k) => {
        const on = props.isSelected(o.key);
        return (
          <button
            key={o.key} type="button" aria-pressed={on}
            className={cx(s.tile, on && s.tileSelected)} onClick={() => props.onPick(o.key)}
          >
            <span
              className={cx(s.tileImg, size === 'm' && s.tileImgM, size === 's' && s.tileImgS)}
              style={{ background: o.grey ? 'var(--neutral-100)' : TINTS[k % TINTS.length] }}
            >
              {props.icon}
            </span>
            <span className={cx(s.tileLabel, props.smallLabel && s.tileLabelS)}>{o.label}</span>
            {on ? <span className={s.tileCheck} aria-hidden="true"><CheckIcon size={12} strokeWidth={3} /></span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Picked items that are not tiles; tap to remove. */
export function PickedChips(props: { items: string[]; onRemove: (item: string) => void }) {
  if (props.items.length === 0) return null;
  return (
    <div className={s.chips}>
      {props.items.map((item) => (
        <button
          key={item} type="button" className={cx(s.chip, s.chipSelected)}
          aria-label={'Remove ' + item} onClick={() => props.onRemove(item)}
        >
          {item} <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

export function StatusTag({ missing }: { missing: number }) {
  return (
    <span className={cx(s.tag, missing ? s.tagWarning : s.tagSuccess)}>
      {missing === 0 ? 'Complete' : missing + (missing === 1 ? ' thing missing' : ' things missing')}
    </span>
  );
}

/** Whole numbers only; '' → null. */
export function toInt(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Math.floor(Number(text));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
