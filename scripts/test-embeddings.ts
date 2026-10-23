/** Checks the similarity maths and the text an entry is searched on. */
import { cosineSimilarity, searchableText } from '../src/lib/ai/embeddings';

let failures = 0;
const check = (label: string, pass: boolean, detail = '') => {
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

console.log('\nCosine similarity');
check('a vector is identical to itself', Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
check('opposite vectors score -1', Math.abs(cosineSimilarity([1, 0], [-1, 0]) + 1) < 1e-9);
check('perpendicular vectors score 0', Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
check(
  'magnitude does not matter, only direction',
  Math.abs(cosineSimilarity([1, 1], [10, 10]) - 1) < 1e-9
);
check('mismatched lengths score 0 rather than throwing', cosineSimilarity([1, 2], [1, 2, 3]) === 0);
check('empty vectors score 0', cosineSimilarity([], []) === 0);
check('a zero vector scores 0 rather than dividing by zero', cosineSimilarity([0, 0], [1, 1]) === 0);

console.log('\nOrdering is what the search depends on');
const query = [1, 0, 0];
const near = [0.9, 0.1, 0];
const mid = [0.5, 0.5, 0];
const far = [0, 1, 0];
const ranked = [
  ['far', cosineSimilarity(query, far)],
  ['near', cosineSimilarity(query, near)],
  ['mid', cosineSimilarity(query, mid)],
].sort((a, b) => (b[1] as number) - (a[1] as number));
check(
  'the closest vector ranks first',
  ranked[0][0] === 'near' && ranked[2][0] === 'far',
  ranked.map(([n, v]) => `${n}=${(v as number).toFixed(2)}`).join(' ')
);

console.log('\nWhat a candidate is searched on');
const text = searchableText({
  name: 'Dana Reed',
  email: 'dana@example.com',
  jobContextText: 'Head of Fleet Operations',
  resumeText: 'Twenty years running field operations.',
});
check('includes the name, role and resume', text.includes('Dana Reed') && text.includes('Fleet') && text.includes('Twenty years'));
check('leaves the email out', !text.includes('dana@example.com'), 'an address adds no meaning to a similarity match');
check('missing pieces do not produce blank lines', !searchableText({ name: 'A', email: null, jobContextText: null, resumeText: null }).includes('\n\n\n'));

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} failed.`}\n`);
process.exitCode = failures === 0 ? 0 : 1;
