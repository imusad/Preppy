"use client";
import { useEffect, useRef, useState } from 'react';
import { collectPlan, getProgress } from '@/lib/client/api';
import { PROGRESS_STEPS, type Plan } from '@/lib/types';
import { BowlIcon } from './Start';
import styles from './shell.module.css';

const DISHES = [
  { name: 'Grilled lemon fish', bg: '#DCE6F8' }, { name: 'Moong dal khichdi', bg: '#FFF0C2' }, { name: 'Quinoa vegetable bowl', bg: '#DCEBD4' },
  { name: 'Palak paneer', bg: '#E2F0DA' }, { name: 'Thai basil stir-fry', bg: '#FCE3CF' }, { name: 'Ragi dosa with chutney', bg: '#E9DFFB' },
  { name: 'Chickpea salad', bg: '#FBE0E6' },
];

type Mode = 'running' | 'ready' | 'stopped' | 'failed';

interface Props {
  /** null while the run is being started. */
  run: { runId: string; code: string } | null;
  /** Set when the run could not be started at all. */
  startError: string | null;
  onDone: (plan: Plan) => void;
  onRetry: () => void;
  onEdit: () => void;
}

export default function Waiting({ run, startError, onDone, onRetry, onEdit }: Props) {
  const [mode, setMode] = useState<Mode>('running');
  const [step, setStep] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [dish, setDish] = useState(0);
  const [returned, setReturned] = useState(false);
  const wasHidden = useRef(false);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const t = setInterval(() => setDish((d) => (d + 1) % DISHES.length), 2600);
    const vis = () => { if (document.hidden) wasHidden.current = true; };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    if (!run) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let misses = 0;
    async function poll() {
      if (stop || !run) return;
      try {
        const p = await getProgress(run.runId, run.code);
        if (stop) return;
        misses = 0;
        if (p.status === 'running') { setStep(p.step); setSecondsLeft(p.secondsLeft); }
        else if (p.status === 'done') {
          const plan = await collectPlan(run.runId, run.code);
          if (stop) return;
          setStep(PROGRESS_STEPS.length);
          setMode('ready');
          setReturned(wasHidden.current);
          setTimeout(() => { if (!stop) doneRef.current(plan); }, wasHidden.current ? 1800 : 900);
          return;
        } else { setMode(p.status === 'failed' ? 'failed' : 'stopped'); return; }
      } catch {
        // A dropped connection is not a failed run: keep asking for a while.
        if (++misses > 20) { setMode('stopped'); return; }
      }
      timer = setTimeout(poll, 3000);
    }
    poll();
    // Ask again straight away when the phone is unlocked.
    const wake = () => { if (!document.hidden) { clearTimeout(timer); poll(); } };
    document.addEventListener('visibilitychange', wake);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
  }, [run]);

  const shown: Mode = startError ? 'failed' : mode;

  if (shown === 'stopped' || shown === 'failed') {
    const failed = shown === 'failed';
    return (
      <div className={styles.phone}>
        <div className={styles.problem}>
          <div className={styles.problemIcon} style={failed ? { background: 'var(--error-light-background)', color: 'var(--error-foreground)' } : { background: 'var(--warning-light-background)', color: 'var(--warning-foreground)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {failed ? <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></> : <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>}
            </svg>
          </div>
          <div role="alert" className={styles.problemText}>
            <h1>{failed ? "We couldn't build your plan" : 'Your plan stopped building'}</h1>
            <p>{startError ?? (failed
              ? 'Something went wrong while building your plan. Your setup answers are kept. Generate again, or edit setup.'
              : 'Your plan stopped building. Generate again to continue. Your setup answers are kept.')}</p>
          </div>
          <div className={styles.waitFoot}>
            <button type="button" className="cta" onClick={() => { setMode('running'); setStep(0); onRetry(); }}>Generate again</button>
            <button type="button" className="cta2" onClick={onEdit}>Edit setup</button>
          </div>
        </div>
      </div>
    );
  }

  const ready = shown === 'ready';
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  const d = DISHES[dish];
  return (
    <div className={styles.phone}>
      <div className={styles.wait}>
        <div className={styles.waitTop}>
          <div className={styles.dish} style={{ background: d.bg }} aria-hidden="true">
            <BowlIcon size={72} stroke={1.2} />
            <span className={styles.dishName}>{d.name}</span>
          </div>
          <div className={styles.waitHead}>
            <h1>{ready ? 'Your plan is ready' : 'Building your 2-week plan'}</h1>
            <p role="status">{ready ? 'Opening your plan…' : `About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left`}</p>
          </div>
        </div>
        {returned && <div role="note" className={styles.returned}>Your plan kept building while your screen was locked. It&apos;s ready.</div>}
        <ol aria-label="Progress" className={styles.steps}>
          {PROGRESS_STEPS.map((label, i) => {
            const state = i < step ? 'done' : i === step && !ready ? 'active' : 'todo';
            return (
              <li key={label} data-state={state}>
                <span className={styles.mark}>
                  {state === 'done' && <span className={styles.doneMark}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></span>}
                  {state === 'active' && <span className={styles.spin} aria-hidden="true" />}
                  {state === 'todo' && <span className={styles.todoMark} />}
                </span>
                <span>{label}</span>
                <span className={styles.status}>{state === 'done' ? 'Done' : state === 'active' ? 'Working' : ''}</span>
              </li>
            );
          })}
        </ol>
        <div className={styles.waitFoot}>
          <p className={styles.reassure}>You can lock your phone. Your plan keeps building and waits here for 24 hours.</p>
        </div>
      </div>
    </div>
  );
}
