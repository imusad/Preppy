import styles from './shell.module.css';

const COLS: [string, string, string][] = [
  ['M', '#FCE3CF', '#DCEBD4'], ['T', '#DCE6F8', '#FCE3CF'], ['W', '#E9DFFB', '#DCE6F8'], ['T', '#DCEBD4', '#FBE0E6'],
  ['F', '#FBE0E6', '#E9DFFB'], ['S', '#FCE3CF', '#DCEBD4'], ['S', '#DCE6F8', '#E9DFFB'],
];

export function BowlIcon({ size = 28, stroke = 1.7 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" />
    </svg>
  );
}

function Icon({ d }: { d: string[] }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

export default function Start({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.phone}>
      <header className={styles.header}>
        <span style={{ color: 'var(--primary)', display: 'flex' }}><BowlIcon /></span>
        <span className={styles.brand}>Preppy</span>
      </header>
      <main className={styles.main}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 className={styles.h1}>Stop deciding what to cook.</h1>
          <p className={styles.lead}>In one run, we find real, fast and exciting recipes and build a 2-week lunch and dinner plan for everyone who eats together.</p>
        </div>
        <div className={styles.grid} aria-hidden="true">
          {COLS.map(([d, a, b], i) => (
            <div key={i} className={styles.gridCol}>
              <span>{d}</span><span className={styles.cell} style={{ background: a }} /><span className={styles.cell} style={{ background: b }} />
            </div>
          ))}
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className={styles.h2}>What you&apos;ll need</h2>
          <ul className={styles.needs}>
            <li>
              <span className={styles.needIcon}><Icon d={['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2']} /></span>
              <span><span className={styles.needTitle}>How long you can cook</span><span className={styles.needSub}>Your morning and evening cooking time</span></span>
            </li>
            <li>
              <span className={styles.needIcon}><Icon d={['M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5']} /></span>
              <span><span className={styles.needTitle}>A short profile for each person</span><span className={styles.needSub}>Mostly tapping pictures, a few numbers</span></span>
            </li>
            <li>
              <span className={styles.needIcon}><Icon d={['M7 3h7l5 5v13H7z', 'M14 3v5h5M10 13h6M10 17h6']} /></span>
              <span><span className={styles.needTitle}>A diet chart, if you have one</span><span className={styles.needSub}>No chart? We can make one from body details or a photo</span></span>
            </li>
          </ul>
        </section>
      </main>
      <footer className={styles.footer}>
        <div role="note" className={styles.note}>
          <span style={{ flex: 'none', marginTop: 1 }}><Icon d={['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v5M12 16.5v.01']} /></span>
          <span><strong>Nothing is saved.</strong> Export your plan before closing this page.</span>
        </div>
        <button type="button" className="cta" onClick={onStart}>Create my 2-week plan</button>
      </footer>
    </div>
  );
}
