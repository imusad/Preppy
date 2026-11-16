"use client";
import { useState } from 'react';
import { submitPasscode } from '@/lib/client/api';
import { BowlIcon } from './Start';
import styles from './shell.module.css';

export default function Gate({ onOpen }: { onOpen: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (await submitPasscode(value)) onOpen();
      else setError("That passcode isn't right. Check it and try again.");
    } catch {
      setError("We couldn't check the passcode. Check your connection and try again.");
    }
    setBusy(false);
  }
  return (
    <div className={styles.phone}>
      <form className={styles.gate} onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)' }}>
          <BowlIcon /><span className={styles.brand} style={{ color: 'var(--neutral-900)' }}>Preppy</span>
        </div>
        <h1 className={styles.h1}>Enter the passcode</h1>
        <p className={styles.lead}>Preppy is shared with friends and family. Ask whoever sent you the link for the passcode.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="passcode">Passcode</label>
          <input id="passcode" className={styles.input} type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby={error ? 'passcode-error' : undefined} aria-invalid={Boolean(error)} />
          {error && <p id="passcode-error" role="alert" className={styles.error}>{error}</p>}
        </div>
        <button type="submit" className="cta" disabled={busy || !value.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>
    </div>
  );
}
