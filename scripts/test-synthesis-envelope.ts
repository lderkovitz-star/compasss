/**
 * The synthesis panel renders whatever the model returns, so the envelope
 * around it has to hold. These are the malformed replies that would otherwise
 * blank the screen.
 */
import { validatePayload, SynthesisShapeError } from '../src/lib/ai/synthesis';

let failures = 0;
function check(label: string, pass: boolean, detail = '') {
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
}
function rejects(label: string, raw: unknown) {
  try {
    validatePayload(raw);
    check(label, false, 'it was accepted');
  } catch (err) {
    check(label, err instanceof SynthesisShapeError, err instanceof Error ? err.message : '');
  }
}

const good = {
  archetypes: [
    { name: 'Stonewall Jackson', weightPct: 55, label: 'Tempo', blurb: 'Committed early.' },
    { name: 'Metternich', weightPct: 45, label: 'Diplomacy', blurb: 'Kept options open.' },
  ],
  radar: {
    axes: ['Tempo', 'Ambiguity', 'Risk', 'Systemic'],
    candidate: [82, 61, 44, 70],
    baseline: [60, 55, 50, 58],
    scaleMax: 100,
  },
  signatures: [{ label: 'Decisiveness', percentile: 84, tier: 'Strong', blurb: 'Fast under load.' }],
  matchScore: 73,
  profileBadge: 'Decisive Operator',
};

console.log('\nA well-formed reply');
const ok = validatePayload(good);
check('accepted', ok.archetypes.length === 2 && ok.radar.axes.length === 4);
check('axes are taken as returned, not from a fixed list', ok.radar.axes[0] === 'Tempo' && ok.radar.axes[3] === 'Systemic');

console.log('\nReplies that must be refused rather than half-rendered');
rejects('not an object', 'TOP_TIER');
rejects('no archetypes', { ...good, archetypes: [] });
rejects('archetypes present but unusable', { ...good, archetypes: [{ label: 'x' }] });
rejects('radar with too few axes', { ...good, radar: { ...good.radar, axes: ['One', 'Two'] } });
rejects('radar values that are not numbers', {
  ...good,
  radar: { ...good.radar, candidate: ['high', 'low', 'mid', 'mid'] },
});

console.log('\nReplies that are close enough to repair');
const skewed = validatePayload({
  ...good,
  archetypes: [
    { name: 'A', weightPct: 80, label: '', blurb: '' },
    { name: 'B', weightPct: 80, label: '', blurb: '' },
  ],
});
const total = skewed.archetypes.reduce((s, a) => s + a.weightPct, 0);
check('weights that do not sum to 100 are normalised', Math.abs(total - 100) <= 1, `total ${total}`);

const ragged = validatePayload({
  ...good,
  radar: { axes: ['A', 'B', 'C', 'D', 'E'], candidate: [1, 2, 3, 4], baseline: [5, 6, 7, 8, 9], scaleMax: 100 },
});
check(
  'mismatched array lengths are truncated to line up',
  ragged.radar.axes.length === ragged.radar.candidate.length &&
    ragged.radar.candidate.length === ragged.radar.baseline.length,
  `${ragged.radar.axes.length} axes`
);

const clamped = validatePayload({ ...good, matchScore: 9000, signatures: [{ label: 'X', percentile: -5, tier: '', blurb: '' }] });
check('out-of-range numbers are clamped', clamped.matchScore === 100 && clamped.signatures[0].percentile === 0);

const noBadge = validatePayload({ ...good, profileBadge: '' });
check('a missing badge falls back rather than rendering blank', noBadge.profileBadge === 'Profile');

const noSignatures = validatePayload({ ...good, signatures: 'none' });
check('signatures are optional', noSignatures.signatures.length === 0);

console.log(`\n${failures === 0 ? 'All envelope checks passed.' : `${failures} check(s) failed.`}\n`);
process.exitCode = failures === 0 ? 0 : 1;
