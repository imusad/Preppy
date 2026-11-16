const FILLER = /\b(recipe|recipes|easy|quick|simple|best|ever|homemade|home made|authentic|restaurant style|style|how to make|video|step by step|instant|classic|perfect|the|a|with|and|in|of)\b/g;

/** Lower-case dish name without filler words, e.g. "Easy Butter Chicken Recipe (Murgh Makhani)" → "butter chicken". */
export function dishKey(name: string): string {
  return name.toLowerCase().split(/[|:–—(\[]/)[0].replace(/[^a-z\s]/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}
