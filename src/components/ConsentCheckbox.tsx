'use client';

/**
 * The consent control shown at candidate intake.
 *
 * Shared by open intake and the invited flow so both show the same words. If
 * each page wrote its own, the statement stored against a candidate's record
 * would depend on which door they came through, which is exactly the kind of
 * discrepancy a consent record exists to rule out.
 *
 * Unticked by default and never pre-ticked: a pre-ticked box is not consent in
 * any jurisdiction that cares, and the whole point of storing this is to hold
 * up when someone asks.
 */
export default function ConsentCheckbox({
  statement,
  version,
  checked,
  onChange,
  disabled,
}: {
  statement: string;
  version: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex gap-3 cursor-pointer rounded-xl border border-[#1C2436] bg-[#0E1626] p-3.5 sm:p-4 transition-colors hover:border-[#2A3550]"
      htmlFor="consent"
    >
      {/* 44px of tappable area around a 16px box, so this is usable on a phone
          held in one hand during a live client run. */}
      <span className="flex h-[44px] w-[24px] flex-shrink-0 items-center justify-center">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-[18px] w-[18px] cursor-pointer rounded border-[#2A3550] bg-[#0B1220] text-[#4F7DF9] accent-[#4F7DF9] focus:ring-1 focus:ring-[#4F7DF9]"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-[#C6CEE2]">
          Consent to assessment <span className="text-[#E0654A]">*</span>
        </span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-[#8E99B4]">{statement}</span>
        <span className="mt-1.5 block text-[11px] text-[#5B6580]">
          Consent statement v{version}. Your agreement is recorded with the date and this wording.
        </span>
      </span>
    </label>
  );
}
