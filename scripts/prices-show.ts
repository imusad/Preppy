import './net';
import { loadPrices } from '../lib/library/store';
(async () => { const t = await loadPrices(); console.log(t.checked, Object.entries(t.prices).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}:${v}`).join(' | ')); process.exit(0); })();
