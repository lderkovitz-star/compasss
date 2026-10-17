/**
 * Reports produced before the scoring rewrite divided every dimension by a
 * fixed 500 - five scenarios at a maximum weight of 100. Scores since are
 * normalised against the range each dimension could actually reach in that
 * session, so the two sets of numbers are not comparable. Old reports are left
 * exactly as they were rather than silently restated; this says which model
 * produced the figures on screen.
 */
export default function ScoringVersionNotice({ version }: { version: number | null }) {
  if ((version ?? 1) >= 2) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
      title="Scored before the normalisation rewrite. These figures use the old fixed divisor and cannot be compared with newer reports."
    >
      Scoring model v1 (legacy)
    </span>
  );
}
