// A small JSON-schema check (the subset our AI answer formats use), so answers written outside the API
// (for example tags written in a Claude Code chat) are held to exactly the same format.
export type Schema = { type?: string | string[]; enum?: unknown[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema; additionalProperties?: boolean };

/** Checks an answer against the same JSON schema the API is held to (the subset it uses). */
export function schemaErrors(s: Schema, v: unknown, path = 'tag'): string[] {
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const kind = v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) return [`${path}: expected ${types.join('|')}, got ${kind}`];
  if (s.enum && !s.enum.includes(v)) return [`${path}: ${JSON.stringify(v)} is not one of ${s.enum.join(', ')}`];
  const errs: string[] = [];
  if (kind === 'object' && s.properties) {
    const o = v as Record<string, unknown>;
    for (const k of s.required ?? []) if (!(k in o)) errs.push(`${path}.${k}: missing`);
    for (const [k, val] of Object.entries(o)) {
      if (s.properties[k]) errs.push(...schemaErrors(s.properties[k], val, `${path}.${k}`));
      else if (s.additionalProperties === false) errs.push(`${path}.${k}: not allowed`);
    }
  }
  if (kind === 'array' && s.items) (v as unknown[]).forEach((x, i) => errs.push(...schemaErrors(s.items as Schema, x, `${path}[${i}]`)));
  return errs;
}

