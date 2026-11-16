const FILLER = /\b(recipe|recipes|easy|quick|simple|best|ever|homemade|home made|authentic|restaurant style|style|how to make|video|step by step|instant|classic|perfect|the|a|with|and|in|of)\b/g;

/** Lower-case dish name without filler words, e.g. "Easy Butter Chicken Recipe (Murgh Makhani)" → "butter chicken". */
export function dishKey(name: string): string {
  return name.toLowerCase().split(/[|:–—(\[]/)[0].replace(/[^a-z\s]/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}

/** Tidy a page title into a dish name: drop non-English duplicates, site names and the word "recipe". */
export function cleanName(raw: string): string {
  let n = raw.replace(/[^\x20-\x7E’'éèñ]+/g, ' ').replace(/’/g, "'");
  n = n.replace(/\brecipe by tasty\b/i, ' ').split(/\s[|–—]\s|\s-\s/).map((p) => p.trim()).filter((p) => /[a-z]{3}/i.test(p))[0] ?? n;
  n = n.replace(/\b(recipe|recipes)\b/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s\-:,]+|[\s\-:,]+$/g, '');
  return n || raw.trim();
}
