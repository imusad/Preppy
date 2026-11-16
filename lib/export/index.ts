// Export the plan to the user's device. Everything is built in the browser.
import type { Plan } from '../types';
import { buildPlanHtml } from './html';
import { renderWeekImage } from './weekImage';
import { makeZip } from './zip';

export const ZIP_FILE_NAME = 'preppy-plan-2-weeks.zip';
export const HTML_FILE_NAME = 'preppy-plan-and-recipes.html';

function download(blob: Blob, fileName: string): void {
  if (!blob.size) throw new Error('The export file is empty');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Give the browser time to start the download before the link is released.
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 30_000);
}

/** Downloads preppy-plan-2-weeks.zip holding one picture per week. Rejects on failure. */
export async function exportZip(plan: Plan): Promise<void> {
  const [w1, w2] = await Promise.all([renderWeekImage(plan, 1), renderWeekImage(plan, 2)]);
  const [b1, b2] = await Promise.all([w1.arrayBuffer(), w2.arrayBuffer()]);
  const zip = makeZip([
    { name: 'preppy-week-1.png', data: new Uint8Array(b1) },
    { name: 'preppy-week-2.png', data: new Uint8Array(b2) },
  ]);
  download(zip, ZIP_FILE_NAME);
}

/** Downloads preppy-plan-and-recipes.html (plan + full recipe bank). Rejects on failure. */
export async function exportHtml(plan: Plan): Promise<void> {
  const html = buildPlanHtml(plan);
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), HTML_FILE_NAME);
}
