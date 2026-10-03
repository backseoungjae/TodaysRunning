const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(filename) {
  const resolved = path.resolve(__dirname, '..', filename);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const moduleValue = { exports: {} }; cache.set(resolved, moduleValue);
  const output = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : require(name);
  new Function('require', 'module', 'exports', output)(localRequire, moduleValue, moduleValue.exports);
  return moduleValue.exports;
}
const utils = name => load('src/features/run/utils/' + name + '.ts');
const { calculateDistanceMeters } = utils('calculateDistance');
const { calculatePaceSecondsPerKm } = utils('calculatePace');
const { calculateActiveDurationSeconds } = utils('calculateActiveDuration');
const { formatDistance } = utils('formatDistance');
const { formatDuration } = utils('formatDuration');
const { formatPace } = utils('formatPace');

test('haversine uses decimal degrees and meters with symmetry, poles and antipodal boundaries', () => {
  const a = { latitude: 37.5, longitude: 127 }, b = { latitude: 37.5001, longitude: 127 };
  assert.ok(Math.abs(calculateDistanceMeters(a,b) - 11.1195) < 0.001);
  assert.equal(calculateDistanceMeters(a,b), calculateDistanceMeters(b,a));
  assert.equal(calculateDistanceMeters(a,a), 0);
  assert.ok(calculateDistanceMeters({latitude:90,longitude:0},{latitude:90,longitude:180}) < 0.001);
  assert.ok(Math.abs(calculateDistanceMeters({latitude:0,longitude:0},{latitude:0,longitude:180}) - 20015086.8) < 1);
});
test('average pace is seconds/km and stays unavailable for invalid values or early distance', () => {
  assert.equal(calculatePaceSecondsPerKm(5000,1800), 360);
  assert.equal(calculatePaceSecondsPerKm(20,10), 500);
  for (const distance of [0,-1,19.99,NaN,Infinity]) assert.equal(calculatePaceSecondsPerKm(distance,60), null);
  for (const seconds of [0,-1,NaN,Infinity]) assert.equal(calculatePaceSecondsPerKm(1000,seconds), null);
});
test('duration derives from timestamp differences, including subsecond boundaries and invalid timestamps', () => {
  assert.equal(calculateActiveDurationSeconds(5,1000,12500), 16.5);
  assert.equal(calculateActiveDurationSeconds(5,null,12500), 5);
  assert.equal(calculateActiveDurationSeconds(5,1000,500), 5);
  assert.equal(calculateActiveDurationSeconds(5,NaN,12500), 5);
  assert.equal(calculateActiveDurationSeconds(NaN,null,12500), 0);
});
test('formatters handle zero, hour rollover, pace rounding and invalid values without NaN or Infinity', () => {
  assert.equal(formatDistance(1234), '1.23'); assert.equal(formatDistance(5), '0.01');
  assert.equal(formatDuration(0), '00:00'); assert.equal(formatDuration(59.99), '00:59');
  assert.equal(formatDuration(60), '01:00'); assert.equal(formatDuration(3599), '59:59');
  assert.equal(formatDuration(3600), '1:00:00'); assert.equal(formatDuration(3661), '1:01:01');
  assert.equal(formatPace(360), '6:00'); assert.equal(formatPace(359.6), '6:00'); assert.equal(formatPace(null), '--:--');
  for (const value of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(formatDistance(value), '0.00'); assert.equal(formatDuration(value), '00:00'); assert.equal(formatPace(value), '--:--');
  }
});
