/**
 * Scores that came from somewhere other than this platform.
 *
 * ASVAB line scores, an academic baseline, a language rating, a certification
 * date. These are held as a list of key/value entries on the candidate rather
 * than as columns, because the set differs per customer: a military training
 * command and a corporate HR team do not measure the same things, and neither
 * should need a migration to record what they already have.
 *
 * "Schemaless" is not the same as unvalidated. A JSON column that anything can
 * write becomes unreadable within a month, so everything goes through
 * parseExternalScores on the way in: keys are normalised, values are bounded,
 * duplicates collapse, and anything unrecognised is dropped rather than
 * stored. What comes out is always the same shape.
 */

export type ExternalScore = {
  /** Stable identifier, UPPER_SNAKE. What a prompt or an integration matches on. */
  key: string;
  /** What a human reads. */
  label: string;
  /** Numeric where it is a number, so it can be compared; text otherwise. */
  value: number | string;
  /** The top of the scale, when there is one. 99 for an ASVAB percentile. */
  scale?: number;
  /** Where it came from: "ASVAB 2026-03", "DLPT", "internal". */
  source?: string;
  /** ISO date. When the score was obtained, not when it was typed in. */
  recordedAt?: string;
};

const KEY_SHAPE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MAX_ENTRIES = 40;
const MAX_LABEL = 80;
const MAX_TEXT_VALUE = 120;
const MAX_SOURCE = 80;

/**
 * Turns free text into a usable key: "ASVAB AFQT" -> "ASVAB_AFQT".
 *
 * A key has to start with a letter. A label that starts with a digit - "2026
 * Baseline", "11th Grade Reading" - would otherwise produce a key that fails
 * validation and the whole score would be dropped without saying why, which
 * is the worst way for this to fail. Those get a SCORE_ prefix instead.
 */
export function toKey(input: string): string {
  const base = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) return '';
  const prefixed = /^[A-Z]/.test(base) ? base : `SCORE_${base}`;
  return prefixed.slice(0, 64);
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanDate(value: unknown): string | undefined {
  const text = cleanText(value, 40);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

/**
 * Normalises whatever is stored or submitted into a clean list.
 *
 * Tolerant of what it reads, strict about what it returns: rows already in
 * the database predate any later tightening of the rules, and a profile that
 * throws on read is worse than one that quietly drops a bad row.
 */
export function parseExternalScores(input: unknown): ExternalScore[] {
  if (!Array.isArray(input)) return [];

  const byKey = new Map<string, ExternalScore>();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;

    const key = toKey(typeof row.key === 'string' && row.key ? row.key : String(row.label ?? ''));
    if (!KEY_SHAPE.test(key)) continue;

    // A score with no value is not a score.
    let value: number | string | undefined;
    if (typeof row.value === 'number' && Number.isFinite(row.value)) {
      value = row.value;
    } else if (typeof row.value === 'string') {
      const text = row.value.trim();
      if (!text) continue;
      // Numeric strings become numbers so "88" and 88 compare the same way.
      const asNumber = Number(text);
      value = Number.isFinite(asNumber) && text !== '' ? asNumber : text.slice(0, MAX_TEXT_VALUE);
    }
    if (value === undefined) continue;

    const scaleRaw = typeof row.scale === 'number' ? row.scale : Number(row.scale);
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : undefined;

    const entry: ExternalScore = {
      key,
      label: cleanText(row.label, MAX_LABEL) ?? key.replace(/_/g, ' '),
      value,
    };
    if (scale !== undefined) entry.scale = scale;
    const source = cleanText(row.source, MAX_SOURCE);
    if (source) entry.source = source;
    const recordedAt = cleanDate(row.recordedAt);
    if (recordedAt) entry.recordedAt = recordedAt;

    // Last write wins on a repeated key, so re-submitting a form updates
    // rather than producing two rows that disagree.
    byKey.set(key, entry);
  }

  return Array.from(byKey.values()).slice(0, MAX_ENTRIES);
}

/** One line per score, for a prompt. */
export function describeExternalScores(scores: ExternalScore[]): string {
  if (scores.length === 0) return 'None on file.';
  return scores
    .map((s) => {
      const value = s.scale !== undefined ? `${s.value}/${s.scale}` : String(s.value);
      // Source and date are both optional, so the bracket is built from
      // whichever are present rather than patched together afterwards.
      const context = [s.source, s.recordedAt].filter(Boolean).join(', ');
      return context ? `- ${s.label}: ${value} (${context})` : `- ${s.label}: ${value}`;
    })
    .join('\n');
}
