'use client';

import { useEffect, useRef, useState } from 'react';
import type { Flag, FlagKind, PlanDish } from '@/lib/types';
import { safeUrl, tint } from '@/lib/export/format';
import s from './plan.module.css';

/** Where a recipe was opened from; decides the Back label and the servings. */
export type RecipeFrom = 'plan' | 'day' | 'bank';
export type OpenRecipe = (id: string, from: RecipeFrom, dish: PlanDish | null) => void;

export const FLAG_CLASS: Record<FlagKind, string> = {
  non_compliant: s.tagErrorSolid,
  over_time: s.tagWarning,
  over_budget: s.tagWarning,
  no_recipe: s.tagError,
  price_unavailable: s.tagOutlined,
};

export function FlagTags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <ul className={s.flags} aria-label="Flags">
      {flags.map((f) => (
        <li key={f.label} className={`${s.tag} ${FLAG_CLASS[f.kind]}`}>{f.label}</li>
      ))}
    </ul>
  );
}

type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className, sw = 1.8, children }: IconProps & { sw?: number; children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const BowlIcon = (p: IconProps) => (
  <Svg {...p} sw={1.5}><path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></Svg>
);
export const BackIcon = (p: IconProps) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const NextIcon = (p: IconProps) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p} sw={3}><path d="M5 12l5 5 9-10" /></Svg>;
export const DownloadIcon = (p: IconProps) => <Svg {...p}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></Svg>;
export const BankIcon = (p: IconProps) => <Svg {...p}><path d="M4 5h6v14H4zM14 5h6v14h-6z" /></Svg>;
export const EditIcon = (p: IconProps) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>;
export const SunIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);
export const MoonIcon = (p: IconProps) => <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>;
export const LinkIcon = (p: IconProps) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const NoVideoIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3M3 3l18 18" /></Svg>;

/** Square recipe picture with a tinted placeholder when there is no image or it fails to load. */
export function Thumb({ src, seed, size }: { src: string | null | undefined; seed: string; size: number }) {
  const url = safeUrl(src);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={s.thumb} style={{ width: size, height: size, background: tint(seed) }} aria-hidden="true">
      {url && failed !== url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
      ) : (
        <BowlIcon size={Math.round(size * 0.42)} />
      )}
    </span>
  );
}

/**
 * Moves focus into a panel when it opens and back to whatever opened it when it closes.
 * Attach the returned ref to a focusable element (a heading with tabIndex -1 or a button).
 */
export function useLayerFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
