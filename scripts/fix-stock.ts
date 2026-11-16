import './net';
import { q } from '../lib/db';
(async () => { await q(`update prices set inr_per_kg = 60 where item = 'stock or broth'`); console.log('stock set'); process.exit(0); })();
