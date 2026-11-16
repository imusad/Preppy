'use client';

import { useRef, useState } from 'react';
import type { Plan } from '@/lib/types';
import { HTML_FILE_NAME, ZIP_FILE_NAME, exportHtml, exportZip } from '@/lib/export';
import { CheckIcon, CloseIcon, useLayerFocus } from './parts';
import s from './plan.module.css';

type Format = 'zip' | 'html';
type Step = 'choice' | 'building' | 'success' | 'failure';

interface Props {
  plan: Plan;
  onClose: () => void;
  /** Called once a file has been handed to the browser. */
  onExported: () => void;
}

export default function ExportPanel({ plan, onClose, onExported }: Props) {
  const [format, setFormat] = useState<Format>('zip');
  const [step, setStep] = useState<Step>('choice');
  const titleRef = useLayerFocus<HTMLHeadingElement>();
  const run = useRef(0);

  const go = async (fmt: Format) => {
    const id = ++run.current;
    setFormat(fmt);
    setStep('building');
    try {
      // Let "Creating your file…" paint before the heavier drawing work starts.
      await new Promise((r) => setTimeout(r, 50));
      await (fmt === 'zip' ? exportZip(plan) : exportHtml(plan));
    } catch {
      if (run.current === id) setStep('failure');
      return;
    }
    onExported();
    if (run.current === id) setStep('success');
  };

  const other: Format = format === 'zip' ? 'html' : 'zip';

  return (
    <div className={s.exportOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.sheet} role="dialog" aria-modal="true" aria-labelledby="export-title">
        <span className={s.grabber} aria-hidden="true" />
        <div className={s.sheetHead}>
          <h2 id="export-title" className={s.sheetTitle} tabIndex={-1} ref={titleRef}>Save your plan</h2>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close"><CloseIcon size={20} /></button>
        </div>

        {step === 'choice' && (
          <form className={s.stack} onSubmit={(e) => { e.preventDefault(); void go(format); }}>
            <fieldset className={s.radioGroup}>
              <legend className="sr-only">File type</legend>
              <label className={s.opt}>
                <input type="radio" name="export-format" checked={format === 'zip'} onChange={() => setFormat('zip')} />
                <span className={s.radio} aria-hidden="true" />
                <span className={s.optText}>
                  <span className={s.optName}>Images (2 weeks, ZIP)</span>
                  <span className={s.optDesc}>2 week pictures with meal names, times and flags. Easy to read on a phone or print.</span>
                </span>
              </label>
              <label className={s.opt}>
                <input type="radio" name="export-format" checked={format === 'html'} onChange={() => setFormat('html')} />
                <span className={s.radio} aria-hidden="true" />
                <span className={s.optText}>
                  <span className={s.optName}>Full plan + recipe bank (HTML)</span>
                  <span className={s.optDesc}>Full plan with costs, fun factor, recipes and links. Opens in any browser.</span>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="cta">Export</button>
          </form>
        )}

        {step === 'building' && (
          <div className={`${s.center} ${s.building}`} role="status">
            <span className={s.spin} aria-hidden="true" />
            <span>Creating your file…</span>
          </div>
        )}

        {step === 'success' && (
          <div className={s.center} role="status">
            <span className={s.okIcon} aria-hidden="true"><CheckIcon size={28} /></span>
            <p className={s.okTitle}>Your plan is saved to your device.</p>
            <p className={s.fileName}>{format === 'zip' ? `${ZIP_FILE_NAME} (2 images)` : HTML_FILE_NAME}</p>
            <button type="button" className="cta" onClick={onClose}>Done</button>
          </div>
        )}

        {step === 'failure' && (
          <div className={s.stack} style={{ gap: 12 }}>
            <p className={s.failBox} role="alert">
              We couldn&apos;t create your file. Try again, or try the other format. Your plan is still here until you close this page.
            </p>
            <button type="button" className="cta" onClick={() => void go(format)}>Try again</button>
            <button type="button" className="cta2" onClick={() => void go(other)}>
              {other === 'html' ? 'Try HTML instead' : 'Try images instead'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
