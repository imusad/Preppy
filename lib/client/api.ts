// Browser-side calls to the server. Screens use these; nothing else talks to /api.
import type {
  BodyChartResult, BodyDetails, ChartUploadResult, PhotoDetails, PhotoResult, Plan, RunProgress, Setup,
} from '@/lib/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export async function checkAccess(): Promise<boolean> {
  const r = await json<{ ok: boolean }>(await fetch('/api/auth'));
  return r.ok;
}

export async function submitPasscode(passcode: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode }),
  });
  return res.ok;
}

/** Phone photos are often larger than the server accepts (4.5 MB): shrink big images in the browser first. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(png|jpeg)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/** Read an uploaded diet chart (PDF, PNG, JPG, JPEG, HTML). Any failure counts as unreadable. */
export async function readChart(file: File): Promise<ChartUploadResult> {
  try {
    const fd = new FormData();
    fd.append('file', await shrinkImage(file));
    return await json<ChartUploadResult>(await fetch('/api/chart/upload', { method: 'POST', body: fd }));
  } catch {
    return { status: 'unreadable' };
  }
}

export async function chartFromPhoto(photo: File, details: PhotoDetails): Promise<PhotoResult> {
  const fd = new FormData();
  fd.append('photo', await shrinkImage(photo));
  fd.append('details', JSON.stringify(details));
  return json<PhotoResult>(await fetch('/api/chart/photo', { method: 'POST', body: fd }));
}

export async function chartFromBody(details: BodyDetails): Promise<BodyChartResult> {
  return json<BodyChartResult>(await fetch('/api/chart/body', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(details),
  }));
}

/** Dish search for favourites / least favourites. */
export async function searchDishes(q: string): Promise<string[]> {
  try {
    const r = await json<{ results: string[] }>(await fetch('/api/dishes?q=' + encodeURIComponent(q)));
    return r.results;
  } catch {
    return [];
  }
}

/** Removes screen-only fields before the setup leaves the browser. */
export function cleanSetup(setup: Setup): Setup {
  return {
    household: setup.household,
    people: setup.people.map((p) => ({ ...p, chartDraft: undefined })),
  };
}

export async function startRun(setup: Setup): Promise<{ runId: string; code: string }> {
  return json(await fetch('/api/runs', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ setup: cleanSetup(setup) }),
  }));
}

export async function getProgress(runId: string, code: string): Promise<RunProgress> {
  const res = await fetch(`/api/runs/${runId}`, { headers: { 'x-run-code': code }, cache: 'no-store' });
  if (res.status === 404 || res.status === 403) return { status: 'gone', step: 0, secondsLeft: 0 };
  return json<RunProgress>(res);
}

export async function collectPlan(runId: string, code: string): Promise<Plan> {
  return json<Plan>(await fetch(`/api/runs/${runId}/plan`, { headers: { 'x-run-code': code }, cache: 'no-store' }));
}

/** Tell the server the plan was exported, so it deletes its copy. Safe to call more than once. */
export async function markExported(runId: string, code: string): Promise<void> {
  try {
    await fetch(`/api/runs/${runId}/plan`, { method: 'DELETE', headers: { 'x-run-code': code } });
  } catch { /* the hold expires on its own at 24 hours */ }
}
