"use client";
import { useCallback, useEffect, useState } from 'react';
import PlanScreens from '@/components/plan/PlanScreens';
import Setup from '@/components/setup/Setup';
import { blankSetup } from '@/components/setup/validate';
import { checkAccess, markExported, startRun } from '@/lib/client/api';
import type { Plan, Setup as SetupData } from '@/lib/types';
import Gate from './Gate';
import Start from './Start';
import Waiting from './Waiting';
import styles from './shell.module.css';

type Screen = 'start' | 'setup' | 'waiting' | 'plan';
interface Run { runId: string; code: string }
interface Saved { screen: Screen; setup: SetupData; run: Run | null; planRun: Run | null }

// Everything lives in this browser tab only (sessionStorage is cleared when the tab closes).
const KEY = 'preppy.tab';
const PLAN_KEY = 'preppy.plan';

function read<T>(key: string): T | null {
  try { const v = sessionStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the open page still has it */ }
}

export default function App() {
  const [access, setAccess] = useState<'checking' | 'locked' | 'open'>('checking');
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('start');
  const [setup, setSetup] = useState<SetupData>(() => blankSetup());
  const [run, setRun] = useState<Run | null>(null);
  const [planRun, setPlanRun] = useState<Run | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Restore this tab's answers once, after the first render (sessionStorage is not available on the server).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = read<Saved>(KEY);
    const savedPlan = read<Plan>(PLAN_KEY);
    if (saved) {
      setSetup(saved.setup);
      setRun(saved.run);
      setPlanRun(saved.planRun);
      setPlan(savedPlan);
      // A tab reopened mid-run goes back to Waiting, which collects the plan if it is ready.
      setScreen(saved.screen === 'plan' && !savedPlan ? (saved.run ? 'waiting' : 'setup') : saved.screen === 'waiting' && !saved.run ? 'setup' : saved.screen);
    }
    setLoaded(true);
    checkAccess().then((ok) => setAccess(ok ? 'open' : 'locked')).catch(() => setAccess('locked'));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { if (loaded) write(KEY, { screen, setup, run, planRun } satisfies Saved); }, [loaded, screen, setup, run, planRun]);

  const generate = useCallback(async (value: SetupData) => {
    setSetup(value);
    setRun(null);
    setStartError(null);
    setScreen('waiting');
    try {
      setRun(await startRun(value));
    } catch (err) {
      const limit = err instanceof Error && err.message.includes('429');
      setStartError(limit
        ? "Today's limit of new plans has been reached. Try again tomorrow. Your setup answers are kept."
        : "We couldn't start building your plan. Check your connection, then generate again. Your setup answers are kept.");
    }
  }, []);

  if (access === 'checking' || !loaded) return <div className={styles.phone} aria-busy="true" />;
  if (access === 'locked') return <div className={styles.backdrop}><Gate onOpen={() => setAccess('open')} /></div>;

  return (
    <>
      {screen === 'start' && <div className={styles.backdrop}><Start onStart={() => setScreen('setup')} /></div>}
      {screen === 'setup' && (
        <div className={styles.backdrop}><div className={styles.phone}>
          <Setup value={setup} onChange={setSetup} onGenerate={generate} onBack={() => setScreen(plan ? 'plan' : 'start')} editing={Boolean(plan)} hasPlan={Boolean(plan)} />
        </div></div>
      )}
      {screen === 'waiting' && (
        <div className={styles.backdrop}>
          <Waiting
            key={run?.runId ?? 'starting'} run={run} startError={startError}
            onDone={(p) => { setPlan(p); write(PLAN_KEY, p); setPlanRun(run); setRun(null); setScreen('plan'); }}
            onRetry={() => generate(setup)} onEdit={() => setScreen('setup')}
          />
        </div>
      )}
      {screen === 'plan' && plan && (
        <div className={styles.full}>
          <PlanScreens plan={plan} onEditSetup={() => setScreen('setup')} onExported={() => { if (planRun) markExported(planRun.runId, planRun.code); }} />
        </div>
      )}
    </>
  );
}
