// The plan-generation run as a chain of short, durable steps (PDD MMP-BE-S6, D-013).
// A locked phone or a server restart does not lose progress: a failed step retries
// without repeating finished ones. Steps receive only the run id.
import { sleep } from 'workflow';
import { deleteHold, setStep, stepBuild, stepCheckTyped, stepFail, stepFinish, stepPrepare, stepTopUp } from '@/lib/run';
import { settings } from '@/lib/settings';

async function mark(runId: string, step: number) { 'use step'; await setStep(runId, step); }
async function prepare(runId: string) { 'use step'; await stepPrepare(runId); }
async function checkTyped(runId: string) { 'use step'; await stepCheckTyped(runId); }
async function topUp(runId: string) { 'use step'; return stepTopUp(runId); }
async function build(runId: string) { 'use step'; await stepBuild(runId); }
async function finish(runId: string) { 'use step'; await stepFinish(runId); }
async function fail(runId: string, where: string) { 'use step'; await stepFail(runId, where); }
async function expire(runId: string) { 'use step'; await deleteHold(runId); }

export async function generatePlan(runId: string) {
  'use workflow';
  let where = 'Reading your profiles';
  try {
    await mark(runId, 0);
    await prepare(runId);

    where = 'Finding recipes';
    await mark(runId, 1);
    await checkTyped(runId);
    for (let round = 0; round < 4; round++) {
      if (!(await topUp(runId))) break;
    }

    where = 'Building your 2 weeks';
    await mark(runId, 2);
    await build(runId);

    where = 'Estimating costs';
    await mark(runId, 3);
    await finish(runId);
  } catch {
    await fail(runId, where);
    return;
  }
  // The finished plan waits in the hold. This pause uses no compute.
  await sleep(`${settings.holdHours}h`);
  await expire(runId);
}
