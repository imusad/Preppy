// The one place every AI call goes through (NFR-8). Returns the parsed JSON answer and
// what the call cost, so each run can keep a running total (TECH-3).
import Anthropic from '@anthropic-ai/sdk';
import { settings } from '@/lib/settings';

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export type AiContent = Anthropic.ContentBlockParam[] | string;

export interface AiRequest {
  /** Short label recorded against the run, e.g. "chart-read". */
  task: string;
  model: string;
  system: string;
  content: AiContent;
  /** JSON Schema of the answer. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export interface AiResult<T> {
  /** null when the model declined or the answer could not be parsed. */
  data: T | null;
  costUsd: number;
  model: string;
  task: string;
}

export function costOf(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined, searches = 0): number {
  const [inPrice, outPrice] = settings.modelPrices[model] ?? [2, 10];
  const input = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) * 1.25 + (usage?.cache_read_input_tokens ?? 0) * 0.1;
  return (input * inPrice + (usage?.output_tokens ?? 0) * outPrice) / 1_000_000 + searches * settings.webSearchUsdPerSearch;
}

/** The request body for one structured call. Shared by live calls and the batch service. */
export function buildParams(req: AiRequest): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: req.model,
    max_tokens: req.maxTokens ?? 4000,
    system: req.system,
    messages: [{ role: 'user', content: req.content }],
    output_config: {
      effort: req.effort ?? 'low',
      format: { type: 'json_schema', schema: req.schema },
    },
  } as Anthropic.MessageCreateParamsNonStreaming;
}

/** Pull the JSON answer out of a finished message. */
export function parseAnswer<T>(message: Anthropic.Message): T | null {
  if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') return null;
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function askJson<T>(req: AiRequest): Promise<AiResult<T>> {
  const message = await anthropic().messages.create(buildParams(req));
  return { data: parseAnswer<T>(message), costUsd: costOf(req.model, message.usage), model: req.model, task: req.task };
}

/** Run many calls with a small number in flight at once. Failed calls come back as null data. */
export async function askMany<T>(reqs: AiRequest[], concurrency = 6): Promise<AiResult<T>[]> {
  const out: AiResult<T>[] = new Array(reqs.length);
  let next = 0;
  async function worker() {
    while (next < reqs.length) {
      const i = next++;
      try {
        out[i] = await askJson<T>(reqs[i]);
      } catch {
        out[i] = { data: null, costUsd: 0, model: reqs[i].model, task: reqs[i].task };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, reqs.length) }, worker));
  return out;
}
