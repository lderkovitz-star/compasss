/**
 * How a scenario is named in a report.
 *
 * A report is a record of what a candidate answered, so the label on each row
 * has to stay put after the fact. `sequenceOrder` does not: inserting a
 * scenario into a pack renumbers everything after it, and because reports read
 * the live scenario row, that silently re-labels sittings that finished months
 * ago - the same answer shows a different number than it did when the report
 * was issued.
 *
 * `externalRef` is the pack author's own code (CW-030 and the like), the one
 * the trait weights sheet is keyed to, and a renumber leaves it alone.
 *
 * It is not always there. A scenario sent to the trash has its ref cleared so
 * the unique index does not block a re-import, and a pack can be imported with
 * no refs at all, so the position is kept as a fallback - unstable, but better
 * than an empty cell.
 */
export function scenarioLabel(
  scenario: { externalRef?: string | null; sequenceOrder: number } | null | undefined,
  fallbackIndex?: number
): string {
  const ref = scenario?.externalRef?.trim();
  if (ref) return ref;
  if (scenario) return String(scenario.sequenceOrder);
  return typeof fallbackIndex === 'number' ? String(fallbackIndex + 1) : '—';
}
