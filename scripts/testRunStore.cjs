const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(filename) {
  const resolved = path.resolve(__dirname, '..', filename);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const moduleValue = { exports: {} }; cache.set(resolved, moduleValue);
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name + '.ts'))
    : name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : require(name);
  new Function('require', 'module', 'exports', output)(localRequire, moduleValue, moduleValue.exports);
  return moduleValue.exports;
}
const store = load('src/features/run/store/runStore.ts').useRunStore;
const current = () => store.getState();
const initialize = (patch = {}) => current().initializeRun({ runId: 'run-1', goalType: 'none', targetDistanceMeters: null, targetDurationSeconds: null, ...patch });
const location = (timestamp = 1000) => ({ validated: true, latitude: 37.5, longitude: 127, accuracy: 5, altitude: null, speed: null, timestamp });
let nowMs;
beforeEach((context) => {
  nowMs = 10000;
  context.mock.method(Date, 'now', () => nowMs);
  current().resetRun();
});

test('goals are validated, normalized and reset between sessions', () => {
  current().startRun(); assert.equal(current().status, 'idle');
  assert.throws(() => initialize({ runId: '' }));
  for (const targetDurationSeconds of [null, 0, -1, NaN, Infinity]) assert.throws(() => initialize({ goalType: 'time', targetDurationSeconds }));
  initialize({ goalType: 'time', targetDurationSeconds: 1200, targetDistanceMeters: 500 });
  assert.equal(current().targetDurationSeconds, 1200); assert.equal(current().targetDistanceMeters, null);
  current().startRun(); current().updateLocation(location(), 0); current().setMapFollowing(false);
  initialize({ runId: 'run-2', goalType: 'distance', targetDistanceMeters: 2000 });
  assert.equal(current().status, 'idle'); assert.equal(current().targetDistanceMeters, 2000);
  assert.deepEqual(current().routeCoordinates, []); assert.equal(current().currentLocation, null); assert.equal(current().isMapFollowing, true);
});

test('pause/resume preserves route and excludes paused location, elapsed time and pace updates', () => {
  initialize(); current().startRun(); current().updateLocation(location(), 0);
  const previous = current();
  current().updateLocation(location(1002), 5); current().updateElapsedSeconds(2); current().updateCurrentPaceSeconds(360);
  assert.equal(previous.routeCoordinates.length, 1); assert.equal(current().routeCoordinates.length, 2);
  current().pauseRun(); current().updateLocation(location(1003), 500); current().updateElapsedSeconds(100); current().updateCurrentPaceSeconds(200);
  assert.equal(current().distanceMeters, 5); assert.equal(current().elapsedSeconds, 2); assert.equal(current().currentPaceSeconds, null);
  current().startRun(); assert.equal(current().status, 'paused');
  current().resumeRun(); current().updateLocation(location(1100), 0);
  assert.equal(current().distanceMeters, 5); assert.equal(current().routeCoordinates.length, 3);
});

test('invalid, duplicate and out-of-order updates do not notify subscribers or change runtime data', () => {
  initialize(); current().startRun(); current().updateLocation(location(), 0);
  let calls = 0; const unsubscribe = store.subscribe(() => { calls += 1; });
  for (const [fix, distance] of [[location(), 5], [location(999), 5], [{ ...location(1002), validated: false }, 5],
    [{ ...location(1002), latitude: 91 }, 5], [location(1002), NaN], [location(1002), -1]]) current().updateLocation(fix, distance);
  current().updateElapsedSeconds(-1); current().updateCurrentPaceSeconds(Infinity);
  unsubscribe(); assert.equal(calls, 0); assert.equal(current().distanceMeters, 0);
});

test('completion freezes session metrics; reset preserves callable actions', () => {
  initialize(); current().startRun(); current().updateLocation(location(), 5); current().finishRun();
  current().resumeRun(); current().startRun(); current().updateLocation(location(1002), 5); current().updateElapsedSeconds(2);
  assert.equal(current().status, 'completed'); assert.equal(current().distanceMeters, 5); assert.equal(current().elapsedSeconds, 0);
  current().resetRun(); assert.equal(current().runId, null); assert.equal(current().status, 'idle'); assert.deepEqual(current().routeCoordinates, []);
  initialize(); current().startRun(); assert.equal(current().status, 'running');
});

test('timestamp timer catches delayed ticks, preserves fractions, excludes pauses and finishes without a final tick', () => {
  initialize(); current().startRun();
  nowMs = 13750; current().refreshElapsedSeconds(); assert.equal(current().elapsedSeconds, 3.75);
  nowMs = 14500; current().pauseRun(); assert.equal(current().elapsedSeconds, 4.5);
  nowMs = 60000; current().refreshElapsedSeconds(); assert.equal(current().elapsedSeconds, 4.5);
  current().resumeRun(); nowMs = 67250; current().finishRun();
  assert.equal(current().elapsedSeconds, 11.75);
  nowMs = 100000; current().refreshElapsedSeconds(); assert.equal(current().elapsedSeconds, 11.75);
});
test('timer freezes at tracking stop before pending GPS writes finish; clock rollback does not decrease elapsed time', () => {
  initialize(); current().startRun(); nowMs = 15000; current().refreshElapsedSeconds();
  nowMs = 14000; current().refreshElapsedSeconds(); assert.equal(current().elapsedSeconds, 5);
  nowMs = 16000; current().stopTimer();
  current().updateLocation(location(), 5); // A previously received valid fix drains during stopping.
  nowMs = 30000; current().refreshElapsedSeconds(); current().pauseRun();
  assert.equal(current().elapsedSeconds, 6); assert.equal(current().distanceMeters, 5);
  current().resumeRun(); nowMs = 32000; current().refreshElapsedSeconds(); assert.equal(current().elapsedSeconds, 8);
  current().resetRun(); assert.equal(current().activeStartedAtMs, null); assert.equal(current().elapsedSeconds, 0);
});
