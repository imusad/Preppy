import { denied, hasAccess } from '@/lib/auth';
import { hasAiKey } from '@/lib/ai';
import { readChartFile } from '@/lib/chartRead';

export const maxDuration = 120;

// The file is read from memory and never stored (PDD MMP-BE-S1).
export async function POST(req: Request) {
  if (!hasAccess(req)) return denied();
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !hasAiKey()) return Response.json({ status: 'unreadable' });
    const { result } = await readChartFile(file.name, file.type, Buffer.from(await file.arrayBuffer()));
    return Response.json(result);
  } catch {
    return Response.json({ status: 'unreadable' });
  }
}
