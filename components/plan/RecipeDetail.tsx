'use client';

import { useState } from 'react';
import type { Plan, PlanDish, PlanRecipe } from '@/lib/types';
import { dishFlags, fmtQty, listNames, money, safeUrl, servingsText, tint } from '@/lib/export/format';
import { BackIcon, BowlIcon, FlagTags, LinkIcon, NoVideoIcon, useLayerFocus, type RecipeFrom } from './parts';
import s from './plan.module.css';

interface Props {
  plan: Plan;
  recipe: PlanRecipe;
  from: RecipeFrom;
  /** The dish group it was opened from; null when opened from the recipe bank. */
  dish: PlanDish | null;
  onClose: () => void;
}

const BACK: Record<RecipeFrom, [label: string, aria: string]> = {
  bank: ['Recipe bank', 'Back to recipe bank'],
  day: ['Day view', 'Back to day view'],
  plan: ['Plan', 'Back to plan'],
};

function Photo({ src, alt, seed, only }: { src: string | null; alt: string; seed: string; only: boolean }) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <div className={`${s.photo}${only ? ` ${s.photoOnly}` : ''}`} style={{ background: tint(seed) }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <>
          <BowlIcon size={40} />
          <span>Photo unavailable</span>
        </>
      )}
    </div>
  );
}

export default function RecipeDetail({ plan, recipe: r, from, dish, onClose }: Props) {
  const titleRef = useLayerFocus<HTMLHeadingElement>();
  const [thumbOk, setThumbOk] = useState(true);

  const servings = dish ? Math.max(1, dish.servings) : Math.max(1, r.who.length);
  const who = dish ? dish.who : r.who;
  const flags = dish ? dishFlags(dish) : [];
  const notes = dish ? dish.notes : [];
  const photos = (r.images.length ? r.images : [r.image]).map(safeUrl).filter((u): u is string => Boolean(u));
  const video = safeUrl(r.videoUrl);
  const source = safeUrl(r.sourceUrl);
  const cost = r.costPerServing === null ? 'Price unavailable' : `≈ ${money(r.costPerServing * servings)}`;
  const priceBits = [plan.priceNote, plan.pricesChecked ? `prices checked ${plan.pricesChecked}` : null].filter(Boolean);
  const [backLabel, backAria] = BACK[from];

  return (
    <section className={s.panel} role="dialog" aria-modal="true" aria-label={`Recipe: ${r.name}`}>
      <header className={s.bar}>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label={backAria}><BackIcon size={22} />{backLabel}</button>
      </header>
      <div className={`${s.scroll} ${s.recipeBody}`}>
        <div className={s.photos} role="group" aria-label="Photos">
          {photos.length
            ? photos.map((src, i) => (
              <Photo key={src + i} src={src} alt={`${r.name}, photo ${i + 1} of ${photos.length}`} seed={r.id} only={photos.length === 1} />
            ))
            : <Photo src={null} alt="" seed={r.id} only />}
        </div>

        <div className={s.section}>
          <div className={s.tagRow}>
            <span className={`${s.tag} ${s.tagPrimary}`}>{r.kind === 'main' ? 'Main' : 'Side'}</span>
            <span className={`${s.tag} ${s.tagNeutral}`}>{r.cuisine}</span>
          </div>
          <h1 className={s.recipeName} tabIndex={-1} ref={titleRef}>{r.name}</h1>
          <p className={s.credit}>
            Recipe from {source ? <a href={source} target="_blank" rel="noopener noreferrer">{r.source}</a> : r.source}
          </p>
          <FlagTags flags={flags} />
          {notes.map((n) => <p key={n} className={s.noteBox} role="note">{n}</p>)}
          <dl className={s.facts}>
            <div className={s.fact}><dt>Cooking time</dt><dd>{r.totalMin} min</dd></div>
            <div className={s.fact}><dt>Fun factor</dt><dd>{r.fun} / 5</dd></div>
            <div className={s.fact}><dt>Cost estimate, {servingsText(servings)}</dt><dd>{cost}</dd></div>
            <div className={s.fact}><dt>For</dt><dd>{listNames(who) || 'Everyone'}</dd></div>
          </dl>
          {priceBits.length > 0 && <span className={s.small}>{priceBits.join(' · ')}</span>}
        </div>

        <div className={s.section}>
          <h2 className={s.h2}>Video and source</h2>
          {video ? (
            <a className={s.video} href={video} target="_blank" rel="noopener noreferrer">
              {r.youtubeId && thumbOk && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://i.ytimg.com/vi/${encodeURIComponent(r.youtubeId)}/hqdefault.jpg`} alt="" loading="lazy"
                  referrerPolicy="no-referrer" onError={() => setThumbOk(false)} />
              )}
              <span className={s.play} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
              <span className={s.videoLabel}>Watch the recipe video<span className="sr-only"> (opens in a new tab)</span></span>
            </a>
          ) : (
            <div className={s.noVideo}><NoVideoIcon size={20} />Video unavailable for this recipe</div>
          )}
          {source ? (
            <a className={s.sourceLink} href={source} target="_blank" rel="noopener noreferrer">
              <LinkIcon />Open recipe source<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className={s.noLink}>Source link unavailable. Ingredients and steps are below.</span>
          )}
        </div>

        <div className={s.section} style={{ gap: 8 }}>
          <h2 className={s.h2}>Ingredients <span>· {servingsText(servings)}</span></h2>
          <ul className={s.ingredients}>
            {r.ingredients.map((ing, i) => (
              <li key={i}><span className={s.qty}>{fmtQty(ing.qty, ing.unit, servings)}</span><span>{ing.name}</span></li>
            ))}
          </ul>
        </div>

        <div className={s.section} style={{ gap: 8 }}>
          <h2 className={s.h2}>Steps</h2>
          <ol className={s.steps}>
            {r.steps.map((st, i) => (
              <li key={i}><span className={s.stepNo} aria-hidden="true">{i + 1}</span><span><span className="sr-only">Step {i + 1}: </span>{st.text}</span></li>
            ))}
          </ol>
          <span className={s.small}>Steps credited to {r.source}.</span>
        </div>
      </div>
    </section>
  );
}
