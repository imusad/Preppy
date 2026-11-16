// Background upkeep (PDD MMP-BE-S3): monthly library refresh and quarterly price refresh.
// Started by the daily schedule. Waiting on the batch service is a pause that uses no compute.
import { sleep } from 'workflow';
import { PRICE_GROUPS } from '@/lib/data/priceItems';
import { kvSet } from '@/lib/db';
import { checkLinks, collectTagBatch, discover, extractPending, submitTagBatch } from '@/lib/library/pipeline';
import { finishPrices, priceGroupStep } from '@/lib/library/prices';

async function links() { 'use step'; return checkLinks(150); }
async function find() { 'use step'; return discover(40); }
async function read() { 'use step'; return extractPending(150); }
async function submit() { 'use step'; return submitTagBatch(400); }
async function collect(batchId: string) { 'use step'; const r = await collectTagBatch(batchId); return r ? { saved: r.saved.length, rejected: r.rejected, costUsd: r.costUsd } : null; }
async function record(summary: Record<string, unknown>) { 'use step'; await kvSet('library-refresh', { ...summary, at: new Date().toISOString() }); }
async function priceStep(i: number) { 'use step'; return priceGroupStep(i); }
async function priceDone() { 'use step'; return finishPrices(); }

export async function refreshLibrary() {
  'use workflow';
  let removed = 0;
  for (let i = 0; i < 6; i++) removed += (await links()).removed;
  await find();
  for (let i = 0; i < 3; i++) await read();
  const batchId = await submit();
  let outcome: { saved: number; rejected: number; costUsd: number } | null = null;
  if (batchId) {
    for (let i = 0; i < 150 && !outcome; i++) {
      await sleep('10m');
      outcome = await collect(batchId);
    }
  }
  await record({ removed, ...(outcome ?? { saved: 0, rejected: 0, costUsd: 0 }) });
}

export async function refreshPriceTable() {
  'use workflow';
  for (let i = 0; i < PRICE_GROUPS.length; i++) await priceStep(i);
  await priceDone();
}
