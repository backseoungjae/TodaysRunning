const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSource(filename, overrides = {}, cache = new Map()) {
  const resolved = path.resolve(__dirname, '..', filename);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  const { outputText } = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: resolved,
  });
  const localRequire = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return loadSource(`src/${name.slice(2)}.ts`, overrides, cache);
    if (name.startsWith('.')) return loadSource(path.resolve(path.dirname(resolved), `${name}.ts`), overrides, cache);
    return require(name);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}
const { beginnerPlan } = loadSource('src/features/training/data/beginnerPlan.ts');
const { getPlanProgress } = loadSource('src/features/training/utils/planProgress.ts');
const { getTrainingRunParams, readTrainingSelection } = loadSource('src/features/run/utils/trainingSelection.ts');
const { getCalendarWeek } = loadSource('src/features/home/utils/calendarWeek.ts');
const progress = (sessionId, status = 'completed', planId = beginnerPlan.id) => ({
  planId, sessionId, status, completedRunId: null, completedAt: null,
});

test('versioned plan contains the requested twelve goals in four weeks with three sessions each', () => {
  assert.equal(beginnerPlan.id, 'beginner_4week_v1');
  assert.equal(new Set(beginnerPlan.sessions.map((session) => session.id)).size, 12);
  assert.deepEqual(beginnerPlan.sessions.map((session) => session.goalType === 'time'
    ? ['time', session.targetDurationSeconds] : ['distance', session.targetDistanceMeters]), [
    ['time', 900], ['time', 1200], ['time', 1200],
    ['time', 1200], ['distance', 2000], ['time', 1500],
    ['distance', 3000], ['time', 1200], ['time', 1800],
    ['distance', 3000], ['time', 1200], ['distance', 5000],
  ]);
  for (let week = 1; week <= 4; week += 1) {
    const sessions = beginnerPlan.sessions.filter((session) => session.week === week);
    assert.deepEqual(sessions.map((session) => session.day), [1, 2, 3]);
    assert.ok(sessions.every((session) => session.title && session.description));
  }
});

test('recommendation uses first incomplete session, ignores other plans/unknown ids and deduplicates completions', () => {
  assert.equal(getPlanProgress(beginnerPlan, []).nextSession.id, 'week1_day1');
  const result = getPlanProgress(beginnerPlan, [
    progress('week1_day1'), progress('week1_day1'), progress('week1_day2', 'pending'),
    progress('week1_day2', 'completed', 'old_plan'), progress('unknown'), progress('week1_day3'),
  ]);
  assert.equal(result.completedCount, 2);
  assert.equal(result.totalCount, 12);
  assert.equal(result.nextSession.id, 'week1_day2');
  const all = getPlanProgress(beginnerPlan, beginnerPlan.sessions.map((session) => progress(session.id)));
  assert.equal(all.completedCount, 12);
  assert.equal(all.nextSession, null);
});

test('all session goals round-trip through route params and survive URL serialization', () => {
  for (const session of beginnerPlan.sessions) {
    const params = getTrainingRunParams(session);
    const urlParams = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined));
    const result = readTrainingSelection(Object.fromEntries(urlParams));
    assert.equal(result.status, 'selected');
    assert.deepEqual(result.session, session);
    assert.equal(result.planId, beginnerPlan.id);
  }
  assert.equal(readTrainingSelection({}).status, 'none');
});

test('invalid/old plan, unknown session, changed target and repeated query params cannot become a selected goal', () => {
  const valid = getTrainingRunParams(beginnerPlan.sessions[0]);
  for (const params of [
    { planId: valid.planId }, { ...valid, planId: 'beginner_4week_v0' },
    { ...valid, sessionId: 'missing' }, { ...valid, goalType: 'distance' },
    { ...valid, targetDurationSeconds: 'NaN' }, { ...valid, targetDurationSeconds: '-1' },
    { ...valid, targetDistanceMeters: '5000' }, { ...valid, sessionId: [valid.sessionId, valid.sessionId] },
  ]) assert.equal(readTrainingSelection(params).status, 'invalid');
});

test('local Monday week handles Sunday, year boundary and DST without fixed 168-hour arithmetic', () => {
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Seoul';
    const sunday = getCalendarWeek(new Date(2026, 9, 4, 23, 59));
    assert.equal(sunday.dateKey, '2026-09-28');
    assert.equal(new Date(sunday.startSeconds * 1000).getHours(), 0);
    assert.equal(getCalendarWeek(new Date(2026, 9, 5)).dateKey, '2026-10-05');
    assert.equal(getCalendarWeek(new Date(2026, 0, 1)).dateKey, '2025-12-29');
    process.env.TZ = 'America/New_York';
    const dstWeek = getCalendarWeek(new Date(2026, 2, 8, 12));
    assert.equal(dstWeek.dateKey, '2026-03-02');
    assert.equal(dstWeek.endSeconds - dstWeek.startSeconds, 167 * 3600);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('Home loads current-plan progress and weekly repository data, applies target fallback and propagates errors', async () => {
  let weeklyGoal = { targetRuns: 5 };
  let defaultTarget = 3;
  let fail = false;
  const calls = [];
  const { loadHomeData } = loadSource('src/features/home/services/homeService.ts', {
    '@/database/repositories/trainingRepository': { trainingRepository: { async list(planId) {
      assert.equal(planId, beginnerPlan.id);
      if (fail) throw new Error('read failure');
      return [progress('week1_day1')];
    } } },
    '@/features/training/services/weeklyGoalService': { async ensureCurrentWeeklyGoal(now) {
      assert.equal(getCalendarWeek(now).dateKey, '2026-09-28');
      return weeklyGoal ?? {targetRuns: defaultTarget ?? 3};
    } },
    '@/database/repositories/runRepository': { runRepository: { async countCompletedInPeriod(start, end) {
      calls.push([start, end]); return 2;
    } } },
  });
  const now = new Date(2026, 9, 2, 12);
  let result = await loadHomeData(now);
  assert.equal(result.weeklyTarget, 5);
  assert.equal(result.weeklyCompletedRuns, 2);
  assert.equal(result.planProgress.completedCount, 1);
  assert.equal(result.planProgress.nextSession.id, 'week1_day2');
  const week = getCalendarWeek(now);
  assert.deepEqual(calls[0], [week.startSeconds, week.endSeconds]);
  weeklyGoal = null;
  assert.equal((await loadHomeData(now)).weeklyTarget, 3);
  defaultTarget = 0;
  assert.equal((await loadHomeData(now)).weeklyTarget, 0);
  defaultTarget = null;
  assert.equal((await loadHomeData(now)).weeklyTarget, 3);
  fail = true;
  await assert.rejects(loadHomeData(now), /read failure/);
});
