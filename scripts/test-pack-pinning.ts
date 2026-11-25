/**
 * Checks scenario pack version pinning against a real database.
 *
 * A sitting that has started keeps the scenario versions it started with -
 * wording, options and weights - while the pack is re-imported and edited;
 * sittings that start later get the new versions; an unchanged re-import
 * writes nothing; and scenarios candidates depend on count as in use, so they
 * can't be deleted for good.
 *
 * Runs against the database in DATABASE_URL, creates its own small pack and
 * sittings, and removes everything it created.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-pack-pinning.ts
 */
import { prisma } from '../src/lib/db';
import { parsePackJson, writePack, type WriteResult } from '../src/lib/pack-import';
import { computeAndStoreScoreSnapshot, computeFinalScores } from '../src/lib/scoring';
import { loadScenariosInOrder, resolveScenarioOrder } from '../src/lib/session-scenarios';
import { isInUse, saveScenarioEdit, scenarioUse } from '../src/lib/scenario-versions';

const CODE = 'TEST_PACK_PINNING';
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
}

type Opt = { label: string; text: string; scores: Record<string, number> };
const scenario = (n: number, narrative: string, options: Opt[]) => ({
  sequenceOrder: n,
  externalRef: `pin-${n}`,
  narrativeText: narrative,
  options,
});
const abc = (x: [number, number, number]): Opt[] => [
  { label: 'A', text: 'Option A', scores: { TEST_PIN_X: x[0], TEST_PIN_Y: 1 } },
  { label: 'B', text: 'Option B', scores: { TEST_PIN_X: x[1], TEST_PIN_Y: 2 } },
  { label: 'C', text: 'Option C', scores: { TEST_PIN_X: x[2], TEST_PIN_Y: 3 } },
];
const text = (n: number, v = 'first') => `Pinning test scenario ${n}, ${v} wording: a short situation used only by this check.`;

function packWith(scenarios: ReturnType<typeof scenario>[]) {
  const parsed = parsePackJson({
    package: { name: 'Pinning test', code: CODE },
    dimensions: [
      { code: 'TEST_PIN_X', name: 'Test pin X', category: 'Test' },
      { code: 'TEST_PIN_Y', name: 'Test pin Y', category: 'Test' },
    ],
    scenarios,
  });
  const errors = parsed.issues.filter((i) => i.severity === 'error');
  if (!parsed.pack || errors.length) throw new Error(`test pack does not parse: ${JSON.stringify(errors)}`);
  return parsed.pack;
}

const v1 = () => packWith([1, 2, 3, 4].map((n) => scenario(n, text(n), abc([n, -n, 0]))));

async function liveRow(seq: number) {
  return prisma.scenario.findFirst({
    where: { package: { code: CODE }, sequenceOrder: seq, deletedAt: null },
    include: { options: { include: { scores: { include: { dimension: true } } }, orderBy: { optionCode: 'asc' } } },
  });
}

async function answer(sessionId: string, scenarioId: string, code: string) {
  const option = await prisma.scenarioOption.findFirstOrThrow({ where: { scenarioId, optionCode: code } });
  await computeAndStoreScoreSnapshot(sessionId, scenarioId, option.id, 4000);
}

const summary = (r: WriteResult) =>
  `rev ${r.revision}: +${r.scenariosCreated} updated ${r.scenariosUpdated} versioned ${r.scenariosVersioned} unchanged ${r.scenariosUnchanged} retired ${r.scenariosRetired} kept-by ${r.sittingsKeepingEarlierVersions}`;

async function cleanup() {
  const pkg = await prisma.scenarioPackage.findUnique({ where: { code: CODE }, select: { id: true } });
  if (pkg) {
    await prisma.assessmentSession.deleteMany({ where: { packageId: pkg.id } });
    await prisma.scenarioPackage.delete({ where: { id: pkg.id } });
  }
  await prisma.dimension.deleteMany({ where: { code: { in: ['TEST_PIN_X', 'TEST_PIN_Y'] } } });
}

async function main() {
  await cleanup();

  // 1. A new pack starts at revision 1; the same file again changes nothing.
  const first = await writePack(prisma, v1(), { replaceExisting: true });
  check('A new pack is written at revision 1', first.revision === 1 && first.scenariosCreated === 4, summary(first));
  const again = await writePack(prisma, v1(), { replaceExisting: true });
  check(
    'Re-importing the same file writes nothing and keeps the revision',
    again.revision === 1 && again.scenariosUnchanged === 4 && again.scenariosUpdated === 0 && again.scenariosVersioned === 0,
    summary(again)
  );

  // 2. A sitting starts and answers scenario 1.
  const pkg = await prisma.scenarioPackage.findUniqueOrThrow({ where: { code: CODE } });
  const s1 = await prisma.assessmentSession.create({ data: { packageId: pkg.id, status: 'IN_PROGRESS' } });
  const order1 = await resolveScenarioOrder({ ...s1, scenarioOrder: null });
  const s1Row = await prisma.assessmentSession.findUniqueOrThrow({ where: { id: s1.id } });
  check('The sitting records the revision it started on', s1Row.packageRevision === 1, `packageRevision ${s1Row.packageRevision}`);
  await answer(s1.id, order1[0], 'A');

  // 3. The pack changes under it: new wording and weights on 2, an option gone
  //    from 3, scenario 4 dropped, scenario 5 added.
  const v2Scenarios = [
    scenario(1, text(1), abc([1, -1, 0])),
    scenario(2, text(2, 'REVISED'), abc([20, -2, 0])),
    scenario(3, text(3), abc([3, -3, 0]).slice(0, 2)),
    scenario(5, text(5), abc([5, -5, 0])),
  ];
  const v2 = packWith(v2Scenarios);
  const second = await writePack(prisma, v2, { replaceExisting: true });
  check(
    'Scenarios the sitting depends on become new versions; the untouched one stays',
    second.revision === 2 &&
      second.scenariosVersioned === 2 &&
      second.scenariosUnchanged === 1 &&
      second.scenariosCreated === 1 &&
      second.scenariosRetired === 1 &&
      second.scenariosUpdated === 0,
    summary(second)
  );
  check('The import says one sitting under way keeps its versions', second.sittingsKeepingEarlierVersions === 1, summary(second));

  // 4. The sitting carries on with what it started.
  const served = await loadScenariosInOrder(order1);
  check('The sitting still has its four scenarios', served.length === 4, served.map((s) => s.sequenceOrder).join(','));
  check('Scenario 2 keeps the wording the sitting started with', served[1]?.narrativeText === text(2), served[1]?.narrativeText.slice(0, 40));
  check('Scenario 3 keeps all three options', served[2]?.options.map((o) => o.optionCode).join('') === 'ABC', served[2]?.options.map((o) => o.optionCode).join(''));
  check('Scenario 4, dropped from the pack, is still in the sitting', served[3]?.sequenceOrder === 4);
  await answer(s1.id, order1[1], 'A');
  await answer(s1.id, order1[2], 'C');
  await answer(s1.id, order1[3], 'B');
  await computeFinalScores(s1.id);
  const fin = await prisma.finalScore.findMany({ where: { sessionId: s1.id }, include: { dimension: true } });
  const rawX = fin.find((f) => f.dimension.code === 'TEST_PIN_X')?.rawScore;
  // v1 weights for A, A, C, B on scenarios 1-4: 1 + 2 + 0 + (-4)
  check("The sitting is scored on its own version's weights", rawX === -1, `raw X ${rawX} (v1 weights give -1; v2 would give 1 + 20 + 0 - 4 = 17)`);
  const maxX = fin.find((f) => f.dimension.code === 'TEST_PIN_X')?.maxScore;
  check('Its scoring range also comes from its own version', maxX === 1 + 2 + 3 + 4, `max X ${maxX}`);

  // 5. A sitting that starts now gets the new versions.
  const s2 = await prisma.assessmentSession.create({ data: { packageId: pkg.id, status: 'IN_PROGRESS' } });
  const order2 = await resolveScenarioOrder({ ...s2, scenarioOrder: null });
  const served2 = await loadScenariosInOrder(order2);
  const s2Row = await prisma.assessmentSession.findUniqueOrThrow({ where: { id: s2.id } });
  check(
    'A later sitting gets the new versions and revision',
    served2.map((s) => s.sequenceOrder).join(',') === '1,2,3,5' &&
      served2[1].narrativeText === text(2, 'REVISED') &&
      served2[2].options.length === 2 &&
      s2Row.packageRevision === 2,
    `${served2.map((s) => s.sequenceOrder).join(',')}, rev ${s2Row.packageRevision}`
  );
  check('The unchanged scenario is the same row for both sittings', order1[0] === order2[0]);

  // 6. The scenario editor follows the same rule.
  const sc1 = await liveRow(1);
  const edited = await saveScenarioEdit(prisma, sc1!.id, { narrativeText: text(1, 'EDITED') });
  check('Editing a scenario candidates have seen makes a new version', edited.kind === 'versioned' && edited.id !== sc1!.id, JSON.stringify(edited));
  const keptOld = await prisma.scenario.findUniqueOrThrow({ where: { id: sc1!.id } });
  check(
    'The earlier version stays as it was, retired and linked to the new one',
    keptOld.narrativeText === text(1) && keptOld.deletedAt !== null && edited.kind === 'versioned' && keptOld.supersededById === edited.id
  );
  const newOne = await liveRow(1);
  check(
    'The new version carries the edit, the options and the weights',
    newOne?.narrativeText === text(1, 'EDITED') &&
      newOne.options.length === 3 &&
      newOne.options.every((o) => o.scores.length === 2) &&
      newOne.externalRef === 'pin-1',
    `${newOne?.options.length} options, ref ${newOne?.externalRef}`
  );
  const again1 = await saveScenarioEdit(prisma, keptOld.id, { narrativeText: 'should not save' });
  check('An earlier version cannot be edited', again1.kind === 'superseded', JSON.stringify(again1));
  const noop = await saveScenarioEdit(prisma, newOne!.id, { narrativeText: text(1, 'EDITED') });
  check('Saving without changes writes nothing', noop.kind === 'unchanged', JSON.stringify(noop));

  // 7. A scenario no sitting has used is still edited where it is.
  const v3 = packWith([...v2Scenarios, scenario(6, text(6), abc([6, -6, 0]))]);
  await writePack(prisma, v3, { replaceExisting: true });
  const sc6 = await liveRow(6);
  const inPlace = await saveScenarioEdit(prisma, sc6!.id, {
    narrativeText: text(6, 'tidied'),
    options: sc6!.options.map((o) => ({ id: o.id, optionText: o.optionText, scores: o.scores.map((s) => ({ dimensionId: s.dimensionId, weightScore: s.weightScore * 2 })) })),
  });
  const sc6After = await liveRow(6);
  check(
    'An unused scenario is edited in place, weights included',
    inPlace.kind === 'updated' && sc6After?.id === sc6!.id && sc6After.narrativeText === text(6, 'tidied') && sc6After.options[0].scores.some((s) => s.weightScore === 12),
    JSON.stringify(inPlace)
  );

  // 8. What depends on what.
  const oldTwo = order1[1];
  const use = await scenarioUse(prisma, oldTwo);
  check('An answered earlier version counts as in use', isInUse(use) && use.answers === 1, JSON.stringify(use));
  const unused = await scenarioUse(prisma, sc6!.id);
  check('A scenario nobody has seen does not', !isInUse(unused), JSON.stringify(unused));
  const pinnedOnly = await scenarioUse(prisma, order2[3]);
  check('A scenario only in a sitting under way counts as in use', isInUse(pinnedOnly) && pinnedOnly.unfinished === 1, JSON.stringify(pinnedOnly));

  await cleanup();
  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exitCode = failures ? 1 : 0;
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
    await cleanup().catch(() => {});
  })
  .finally(() => prisma.$disconnect());
