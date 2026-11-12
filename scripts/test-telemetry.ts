/**
 * Checks the decision-timing rules in src/lib/telemetry.ts: the server clock
 * decides, a page cannot report a decision as faster than it was, and tab
 * changes are counted from what the server received as they happened.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-telemetry.ts
 */
import { cleanClientTiming, measureDecision } from '../src/lib/telemetry';

let failures = 0;
const check = (label: string, pass: boolean, detail = '') => {
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

const T = new Date('2026-11-12T10:00:00.000Z');
const at = (ms: number) => new Date(T.getTime() + ms);
const ev = (type: string, ms: number) => ({ type, receivedAt: at(ms) });

console.log('\nThe server clock decides');
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(12_000),
    events: [],
    client: { activeMs: 11_600, hiddenMs: 0, tabSwitches: 0, focusLosses: 0 },
  });
  check('a clean answer takes the server time', r.timeSpentMs === 12_000, `${r.timeSpentMs}ms`);
  check('a clean answer raises no flags', r.flags.length === 0, r.flags.join(',') || 'none');
  check('start is the first serve', r.startedAt.getTime() === T.getTime());
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(30_000),
    events: [],
    client: { activeMs: 300, hiddenMs: 0, tabSwitches: 0 },
  });
  check('a page claiming 0.3s still gets the 30s it took', r.timeSpentMs === 30_000, `${r.timeSpentMs}ms`);
  check('and the mismatch is flagged', r.flags.includes('timing_mismatch'), r.flags.join(','));
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(8_000),
    events: [],
    client: { activeMs: 120_000, hiddenMs: 0 },
  });
  check('a page claiming more time than passed is flagged', r.flags.includes('timing_mismatch'), r.flags.join(','));
  check('and the server time is kept', r.timeSpentMs === 8_000);
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(10_000),
    events: [],
    client: { activeMs: 9_000, hiddenMs: 0 },
  });
  check('a second of render and network time is not a mismatch', !r.flags.includes('timing_mismatch'));
}

console.log('\nTab switches, logged as they happened');
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(25_000),
    events: [ev('hidden', 5_000), ev('visible', 20_000)],
    client: { activeMs: 10_000, hiddenMs: 15_000, tabSwitches: 1 },
  });
  check('one switch is counted', r.tabSwitches === 1);
  check('15s away is measured on the server clock', r.hiddenMs === 15_000, `${r.hiddenMs}ms`);
  check('time away does not shorten the decision', r.timeSpentMs === 25_000);
  check('flagged as left_tab, nothing else', r.flags.join(',') === 'left_tab', r.flags.join(','));
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(30_000),
    events: [ev('hidden', 2_000), ev('hidden', 2_100), ev('visible', 6_000), ev('hidden', 10_000), ev('visible', 12_000)],
    client: { activeMs: 24_000, hiddenMs: 6_000, tabSwitches: 2 },
  });
  check('a repeated hidden event is one switch', r.tabSwitches === 2, String(r.tabSwitches));
  check('hidden time adds up across switches', r.hiddenMs === 6_000, `${r.hiddenMs}ms`);
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(20_000),
    events: [],
    client: { activeMs: 12_000, hiddenMs: 8_000, tabSwitches: 1 },
  });
  check('a switch the server never received is still reported', r.tabSwitches === 1);
  check('and flagged tab_events_missing', r.flags.includes('tab_events_missing'), r.flags.join(','));
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(20_000),
    events: [ev('hidden', 4_000), ev('visible', 14_000)],
    client: { activeMs: 20_000, hiddenMs: 0, tabSwitches: 0 },
  });
  check('a page that hides its switches is still caught', r.tabSwitches === 1 && r.hiddenMs === 10_000);
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(9_000),
    events: [ev('hidden', 5_000)],
    client: null,
  });
  check('hidden with no return event counts to the answer', r.hiddenMs === 4_000, `${r.hiddenMs}ms`);
  check('and is flagged', r.flags.includes('tab_events_missing') && r.flags.includes('no_client_timing'), r.flags.join(','));
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(15_000),
    events: [ev('blur', 3_000), ev('focus', 6_000)],
    client: { activeMs: 15_000, hiddenMs: 0, tabSwitches: 0, focusLosses: 1 },
  });
  check('focus moving to another window is counted', r.focusLosses === 1 && r.flags.includes('lost_focus'));
  check('but is not a tab switch', r.tabSwitches === 0 && !r.flags.includes('left_tab'));
}

console.log('\nLeaving the page is not a tab switch');
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 2,
    receivedAt: at(20_000),
    events: [ev('serve', 0), ev('unload', 4_000), ev('serve', 5_500)],
    client: { activeMs: 14_000, hiddenMs: 0, tabSwitches: 0 },
  });
  check('a reload is not counted as a tab switch', r.tabSwitches === 0 && !r.flags.includes('left_tab'), r.flags.join(','));
  check('the 1.5s the page was gone is measured', r.leftPageMs === 1_500, `${r.leftPageMs}ms`);
  check('nothing is reported missing', !r.flags.includes('tab_events_missing'));
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 2,
    receivedAt: at(20_000),
    events: [ev('serve', 0), ev('hidden', 4_000), ev('serve', 5_000)],
    client: { activeMs: 15_000, hiddenMs: 0, tabSwitches: 0 },
  });
  check('a browser that reports hidden on reload is handled too', r.tabSwitches === 0 && r.leftPageMs === 1_000, `${r.tabSwitches} / ${r.leftPageMs}ms`);
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 2,
    receivedAt: at(30_000),
    events: [ev('serve', 0), ev('hidden', 3_000), ev('unload', 3_010), ev('serve', 4_000), ev('hidden', 10_000), ev('visible', 16_000)],
    client: { activeMs: 20_000, hiddenMs: 6_000, tabSwitches: 1 },
  });
  check('hidden then unload is one reload', r.leftPageMs === 1_000, `${r.leftPageMs}ms`);
  check('and a real switch after it still counts', r.tabSwitches === 1 && r.hiddenMs === 6_000, `${r.tabSwitches} / ${r.hiddenMs}ms`);
}
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 1,
    receivedAt: at(20_000),
    events: [ev('serve', 0), ev('unload', 5_000), ev('visible', 9_000)],
    client: { activeMs: 16_000, hiddenMs: 4_000, tabSwitches: 0 },
  });
  check('back/forward-cache return closes the absence', r.leftPageMs === 4_000 && r.tabSwitches === 0, `${r.leftPageMs}ms`);
}

console.log('\nReloads and older pages');
{
  const r = measureDecision({
    firstServedAt: T,
    serveCount: 2,
    receivedAt: at(40_000),
    events: [],
    client: { activeMs: 2_000, hiddenMs: 0 },
  });
  check('a reload does not restart the clock', r.timeSpentMs === 40_000);
  check('it is flagged reloaded, not as a mismatch', r.flags.includes('reloaded') && !r.flags.includes('timing_mismatch'), r.flags.join(','));
}
{
  const r = measureDecision({
    firstServedAt: null,
    serveCount: null,
    receivedAt: at(8_000),
    events: [],
    client: null,
    legacyTimeSpentMs: 7_500,
  });
  check('a scenario served before server timing falls back to the page', r.timeSpentMs === 7_500);
  check('and says so', r.flags.includes('no_server_start') && r.serverElapsedMs === null, r.flags.join(','));
}

console.log('\nWhat a page may send');
check('negative, NaN and text are dropped', cleanClientTiming({ activeMs: -5, hiddenMs: NaN, tabSwitches: '3' }) === null);
check('numbers are rounded', cleanClientTiming({ activeMs: 1234.6 })?.activeMs === 1235);
check('an array is not timing', cleanClientTiming([1, 2]) === null);

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
