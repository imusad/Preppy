import { start } from 'workflow/api';
import { denied, hasAccess } from '@/lib/auth';
import { createRun, stepFail, TooManyRuns } from '@/lib/run';
import type { Setup } from '@/lib/types';
import { generatePlan } from '@/workflows/generate';

function valid(s: Setup | undefined): s is Setup {
  return Boolean(
    s && s.household && Array.isArray(s.people) && s.people.length >= 1 && s.people.length <= 8 &&
    s.household.morningMin > 0 && s.household.eveningMin > 0 && s.household.city &&
    s.people.every((p) => p.id && p.name && p.diet && p.budget && p.utensils?.length && p.chart && p.chartAccepted),
  );
}

export async function POST(req: Request) {
  if (!hasAccess(req)) return denied();
  const body = (await req.json().catch(() => ({}))) as { setup?: Setup };
  if (!valid(body.setup)) return Response.json({ error: 'Setup is incomplete' }, { status: 400 });
  try {
    const { runId, code } = await createRun(body.setup);
    try {
      // Run history is deleted as soon as the run ends (NFR-2).
      await start(generatePlan, [runId], { experimental_retention: 0 });
    } catch (err) {
      await stepFail(runId, 'start').catch(() => {});
      throw err;
    }
    return Response.json({ runId, code });
  } catch (err) {
    if (err instanceof TooManyRuns) return Response.json({ error: 'Daily limit reached' }, { status: 429 });
    throw err;
  }
}
