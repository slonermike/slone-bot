/** prototype.json schema, shared by the build scripts, launcher, and smoke test. */
export interface AssetEntry {
  file: string;
  source: string;
  author?: string;
  license: string;
  date: string;
}

export interface PrototypeManifest {
  slug: string;
  title: string;
  date: string;
  question: string;
  targetFeeling: string;
  mode: 'content' | 'systemic';
  tags: string[];
  theme: string;
  wildcard: string | null;
  juiceLayers: string[];
  metrics: string[];
  assets: AssetEntry[];
  buildStatus: 'ok' | 'broken';
  feedbackStatus: 'needs-feedback' | 'assessed' | 'favorite';
  sizeKB: number;
  thumbnail: string;
}

export const SLUG_RE = /^[a-z0-9_][a-z0-9_-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ASSET_LICENSES = /^(original|cc0|public domain|mit|bsd|apache|isc|cc-by(?!-)[\w.-]*|ofl|sil ofl)/i;

/** Returns a list of human-readable problems; empty means valid. */
export function validateManifest(m: unknown): string[] {
  const errs: string[] = [];
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return ['manifest must be an object'];
  const o = m as Record<string, unknown>;
  const str = (k: string, optional = false) => {
    if (typeof o[k] !== 'string' || (!optional && (o[k] as string).trim() === '')) errs.push(`${k}: required non-empty string`);
  };
  for (const k of ['slug', 'title', 'date', 'question', 'targetFeeling', 'theme']) str(k);
  str('thumbnail', true); // empty when the build has no thumb.png yet
  if (typeof o.slug === 'string' && !SLUG_RE.test(o.slug)) errs.push('slug: lowercase letters, digits, - and _ only');
  if (typeof o.date === 'string' && !DATE_RE.test(o.date)) errs.push('date: must be YYYY-MM-DD');
  if (o.mode !== 'content' && o.mode !== 'systemic') errs.push('mode: must be "content" or "systemic"');
  if (o.wildcard !== null && typeof o.wildcard !== 'string') errs.push('wildcard: string or null');
  for (const k of ['tags', 'juiceLayers', 'metrics']) {
    if (!Array.isArray(o[k]) || !(o[k] as unknown[]).every((v) => typeof v === 'string')) errs.push(`${k}: array of strings`);
  }
  if (!Array.isArray(o.assets)) errs.push('assets: array');
  else {
    (o.assets as unknown[]).forEach((a, i) => {
      const e = a as Record<string, unknown>;
      for (const k of ['file', 'source', 'license', 'date']) {
        if (typeof e?.[k] !== 'string' || e[k] === '') errs.push(`assets[${i}].${k}: required`);
      }
      if (typeof e?.license === 'string' && !ALLOWED_ASSET_LICENSES.test(e.license)) {
        errs.push(`assets[${i}].license: "${e.license}" is not on the allowlist (docs/tech/08)`);
      }
    });
  }
  if (o.buildStatus !== 'ok' && o.buildStatus !== 'broken') errs.push('buildStatus: "ok" or "broken"');
  if (!['needs-feedback', 'assessed', 'favorite'].includes(o.feedbackStatus as string)) {
    errs.push('feedbackStatus: needs-feedback | assessed | favorite');
  }
  if (typeof o.sizeKB !== 'number' || o.sizeKB < 0) errs.push('sizeKB: non-negative number');
  return errs;
}
