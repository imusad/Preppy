import { denied, hasAccess } from '@/lib/auth';
import { hasAiKey } from '@/lib/ai';
import { readPhoto } from '@/lib/chartRead';
import type { PhotoDetails } from '@/lib/types';

export const maxDuration = 120;

// The photo is read from memory and never stored: nothing remains once this request ends.
export async function POST(req: Request) {
  if (!hasAccess(req)) return denied();
  try {
    const form = await req.formData();
    const photo = form.get('photo');
    const d = JSON.parse(String(form.get('details') ?? '{}')) as Partial<PhotoDetails>;
    if (!(photo instanceof File) || typeof d.age !== 'number' || !d.sex || !d.region || !d.goal || !Array.isArray(d.conditions)) {
      return Response.json({ error: 'Missing details' }, { status: 400 });
    }
    if (!hasAiKey()) return Response.json({ status: 'unusable', reason: 'photo reading is not switched on yet' });
    const { result } = await readPhoto(photo.name, photo.type, Buffer.from(await photo.arrayBuffer()), d as PhotoDetails);
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Could not read the photo' }, { status: 500 });
  }
}
