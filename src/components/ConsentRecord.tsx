/**
 * The consent record on a candidate report.
 *
 * Sittings that predate the consent framework have no record, and that is
 * shown plainly rather than left blank. A blank space reads as "fine"; the
 * point of surfacing this is that somebody reviewing a report for an
 * enterprise buyer can tell the difference between consent given and consent
 * never asked for.
 */
export default function ConsentRecord({
  consent,
  tone = 'light',
}: {
  consent: {
    policyVersion: string;
    statementText: string;
    acceptedAt: Date | string;
  } | null;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  const label = dark ? 'text-[#5B6580]' : 'text-slate-400';
  const body = dark ? 'text-[#97A2BE]' : 'text-slate-600';
  const divider = dark ? 'border-[#1C2436]' : 'border-slate-100';

  if (!consent) {
    return (
      <div className={`mt-4 pt-4 border-t ${divider}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${label}`}>Consent</p>
        <p className={`text-sm ${dark ? 'text-[#E0A24A]' : 'text-amber-700'}`}>
          No consent record — this assessment was taken before consent was collected.
        </p>
      </div>
    );
  }

  const accepted =
    typeof consent.acceptedAt === 'string' ? new Date(consent.acceptedAt) : consent.acceptedAt;

  return (
    <div className={`mt-4 pt-4 border-t ${divider}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${label}`}>Consent</p>
      <p className={`text-sm ${dark ? 'text-[#C6CEE2]' : 'text-slate-900'}`}>
        Given {accepted.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} ·
        statement v{consent.policyVersion}
      </p>
      {/* The wording is shown, not just referenced. A version number is only
          useful if the text behind it is reachable from the same screen. */}
      <p className={`text-xs leading-relaxed mt-1.5 ${body}`}>{consent.statementText}</p>
    </div>
  );
}
