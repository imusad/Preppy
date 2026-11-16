"use client";
// Design preview of the Setup screen: /preview/setup. Not linked from the app.
import { useState } from 'react';
import Setup from '@/components/setup/Setup';
import { blankSetup } from '@/components/setup/validate';

export default function Preview() {
  const [value, setValue] = useState(() => blankSetup());
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Setup value={value} onChange={setValue} onGenerate={() => alert('Generate')} onBack={() => {}} editing={false} hasPlan={false} />
    </div>
  );
}
