// Tests the production migrations/repositories against real SQLite, without a native runtime.
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { test, after } = require('node:test');
const ts = require('typescript');

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'todaysrunning-db-'));
after(() => rmSync(tempDirectory, { recursive: true, force: true }));

function connection(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  return {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...params) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync(sql, ...params) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, ...params) { return sqlite.prepare(sql).all(...params); },
    async closeAsync() { sqlite.close(); },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

// Compile the actual TypeScript files; only expo-sqlite's native bridge is substituted.
function productionModules(openDatabaseAsync = async () => connection()) {
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const { outputText } = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: resolved,
    });
    const localRequire = (name) => {
      if (name === 'expo-sqlite') return { openDatabaseAsync };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved), `${name}.ts`));
      return require(name);
    };
    new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  const base = path.resolve(__dirname, '../src/database');
  return {
    ...load(path.join(base, 'database.ts')),
    ...load(path.join(base, 'migrations/migrations.ts')),
    ...Object.assign({}, ...['run', 'runLocation', 'runSplit', 'training', 'weeklyGoal', 'settings']
      .map((name) => load(path.join(base, `repositories/${name}Repository.ts`)))),
  };
}
const modules = productionModules();
const { initializeDatabase, migrateDatabase, runRepository: runs, runLocationRepository: locations,
  runSplitRepository: splits, trainingRepository: training, weeklyGoalRepository: goals,
  settingsRepository: settings } = modules;
const sampleRun = (id = 'run-1') => ({
  id, source: 'free', goalType: 'none', targetDistanceMeters: null, targetDurationSeconds: null,
  startedAt: 1720000000, endedAt: null, state: 'running', distanceMeters: 0,
  activeDurationSeconds: 0, pausedDurationSeconds: 0, pausedAt: null,
  createdAt: 1720000000, updatedAt: 1720000000,
});
const sampleLocation = (sequence = 0) => ({
  id: `location-${sequence}`, runId: 'run-1', sequence, latitude: 37.5, longitude: 127,
  altitude: null, accuracy: 5, speed: null, recordedAt: 1720000000 + sequence,
});
const sampleSplit = (splitNumber = 1) => ({
  id: `split-${splitNumber}`, runId: 'run-1', splitNumber, distanceMeters: 1000,
  durationSeconds: 360, paceSecondsPerKm: 360,
});
async function withDatabase(task) {
  const db = connection();
  try { await initializeDatabase(db); await task(db); }
  finally { await db.closeAsync(); }
}

test('initialization creates core tables and durable tracking session, four indexes, defaults and enables foreign keys', () => withDatabase(async (db) => {
  const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  assert.deepEqual(tables.map((row) => row.name), ['app_settings', 'background_tracking_session', 'run_locations', 'run_splits', 'runs', 'training_progress', 'weekly_goals']);
  const indexes = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'");
  assert.equal(indexes.length, 4);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 4);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  assert.equal(await settings.get('distance_unit', db), 'km');
  assert.equal(await settings.get('default_weekly_target', db), 3);
  assert.equal(await settings.get('onboarding_completed', db), false);
}));

test('all six repositories support create/read/update/delete and preserve raw units', () => withDatabase(async (db) => {
  const run = sampleRun();
  await runs.create(run, db);
  assert.deepEqual({ ...await runs.get(run.id, db) }, run);
  assert.equal((await runs.list(db)).length, 1);
  const finished = { ...run, state: 'completed', distanceMeters: 1500.25, activeDurationSeconds: 450.5, endedAt: 1720000450, updatedAt: 1720000450 };
  assert.equal(await runs.update(finished, db), true);
  assert.deepEqual({ ...await runs.get(run.id, db) }, finished);
  assert.equal(await runs.update({ ...finished, id: 'missing' }, db), false);

  for (const [repository, first, second, update] of [
    [locations, sampleLocation(0), sampleLocation(1), { accuracy: 3 }],
    [splits, sampleSplit(1), sampleSplit(2), { durationSeconds: 400, paceSecondsPerKm: 400 }],
  ]) {
    await repository.create(second, db);
    await repository.create(first, db);
    assert.deepEqual({ ...await repository.get(first.id, db) }, first);
    assert.deepEqual((await repository.list('run-1', db)).map((value) => value.id), [first.id, second.id]);
    const changed = { ...first, ...update };
    assert.equal(await repository.update(changed, db), true);
    assert.deepEqual({ ...await repository.get(first.id, db) }, changed);
    assert.equal(await repository.delete(first.id, db), true);
    assert.equal(await repository.get(first.id, db), null);
  }
  const progress = { planId: 'beginner', sessionId: 'week1_day1', status: 'pending', completedRunId: null, completedAt: null };
  await training.create(progress, db);
  assert.deepEqual({ ...await training.get(progress.planId, progress.sessionId, db) }, progress);
  assert.equal((await training.list(progress.planId, db)).length, 1);
  const completed = { ...progress, status: 'completed', completedRunId: run.id, completedAt: 1720000450 };
  assert.equal(await training.update(completed, db), true);
  assert.deepEqual({ ...await training.get(progress.planId, progress.sessionId, db) }, completed);
  assert.equal(await training.delete(progress.planId, progress.sessionId, db), true);
  assert.equal(await training.get(progress.planId, progress.sessionId, db), null);

  const goal = { weekStartDate: '2026-09-28', targetRuns: 3, createdAt: 1720000000, updatedAt: 1720000000 };
  await goals.create(goal, db);
  assert.deepEqual({ ...await goals.get(goal.weekStartDate, db) }, goal);
  assert.equal((await goals.list(db)).length, 1);
  assert.equal(await goals.update({ ...goal, targetRuns: 4 }, db), true);
  assert.equal((await goals.get(goal.weekStartDate, db)).targetRuns, 4);
  assert.equal(await goals.delete(goal.weekStartDate, db), true);
  assert.equal(await goals.get(goal.weekStartDate, db), null);

  await settings.set('onboarding_completed', true, db);
  assert.equal(await settings.get('onboarding_completed', db), true);
  await settings.set('default_weekly_target', 5, db);
  assert.equal(await settings.get('default_weekly_target', db), 5);
  assert.equal(await settings.delete('distance_unit', db), true);
  assert.equal(await settings.get('distance_unit', db), null);
  await settings.set('distance_unit', 'mi', db);
  assert.equal(await settings.get('distance_unit', db), 'mi');
  assert.equal(await runs.delete(run.id, db), true);
  assert.equal(await runs.get(run.id, db), null);
  assert.equal(await runs.delete(run.id, db), false);
}));

test('foreign keys reject orphan rows; run deletion cascades locations/splits and preserves training completion', () => withDatabase(async (db) => {
  await assert.rejects(locations.create(sampleLocation(), db), /FOREIGN KEY/);
  await assert.rejects(splits.create(sampleSplit(), db), /FOREIGN KEY/);
  await runs.create(sampleRun(), db);
  await locations.create(sampleLocation(), db);
  await splits.create(sampleSplit(), db);
  await training.create({ planId: 'beginner', sessionId: 'one', status: 'completed', completedRunId: 'run-1', completedAt: 1720000500 }, db);
  await runs.delete('run-1', db);
  assert.equal((await locations.list('run-1', db)).length, 0);
  assert.equal((await splits.list('run-1', db)).length, 0);
  const progress = await training.get('beginner', 'one', db);
  assert.equal(progress.completedRunId, null);
  assert.equal(progress.status, 'completed');
}));

test('constraints reject duplicate sequence/split and invalid enum/settings values; parameters escape text', () => withDatabase(async (db) => {
  await runs.create(sampleRun(), db);
  await locations.create(sampleLocation(), db);
  await assert.rejects(locations.create({ ...sampleLocation(), id: 'duplicate' }, db), /UNIQUE/);
  await splits.create(sampleSplit(), db);
  await assert.rejects(splits.create({ ...sampleSplit(), id: 'duplicate' }, db), /UNIQUE/);
  await assert.rejects(runs.create({ ...sampleRun('invalid'), state: 'invalid' }, db), /CHECK/);
  await assert.rejects(settings.set('default_weekly_target', -1, db), /CHECK/);
  await assert.rejects(settings.set('distance_unit', 'invalid', db), /CHECK/);
  const malicious = sampleRun("x'; DROP TABLE runs; --");
  await runs.create(malicious, db);
  assert.deepEqual({ ...await runs.get(malicious.id, db) }, malicious);
}));

test('reopening persisted database and rerunning migration preserve existing runs and settings', async () => {
  const filename = path.join(tempDirectory, 'persistent.db');
  let db = connection(filename);
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync('PRAGMA journal_mode')).journal_mode, 'wal');
  await runs.create(sampleRun(), db);
  await settings.set('distance_unit', 'mi', db);
  await db.closeAsync();
  db = connection(filename);
  try {
    await initializeDatabase(db);
    await migrateDatabase(db);
    assert.equal((await runs.get('run-1', db)).state, 'running');
    assert.equal(await settings.get('distance_unit', db), 'mi');
    assert.equal((await db.getFirstAsync('PRAGMA foreign_key_check')), null);
  } finally { await db.closeAsync(); }
});

test('failed migration rolls back schema/version and can retry; newer schema is rejected', async () => {
  const db = connection();
  const exec = db.execAsync;
  db.execAsync = async (sql) => {
    if (sql.includes('CREATE TABLE run_splits')) {
      await exec('CREATE TABLE partial (id INTEGER)');
      throw new Error('injected failure');
    }
    return exec(sql);
  };
  try {
    await assert.rejects(initializeDatabase(db), /injected failure/);
    assert.equal((await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).length, 0);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 0);
    db.execAsync = exec;
    await initializeDatabase(db);
    await db.execAsync('PRAGMA user_version = 5');
    await assert.rejects(migrateDatabase(db), /newer/);
    assert.equal((await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'")).length, 7);
  } finally { await db.closeAsync(); }
});

test('singleton initializes once for concurrent callers and retries after open failure', async () => {
  let opens = 0;
  const db = connection();
  const { getDatabase } = productionModules(async () => {
    opens += 1;
    if (opens === 1) throw new Error('open failure');
    return db;
  });
  try {
    await assert.rejects(getDatabase(), /open failure/);
    const [first, second] = await Promise.all([getDatabase(), getDatabase()]);
    assert.equal(first, db);
    assert.equal(second, db);
    assert.equal(opens, 2);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 4);
  } finally { await db.closeAsync(); }
});

test('weekly completed count excludes active/paused runs and respects inclusive start/exclusive end', () => withDatabase(async (db) => {
  for (const [id, state, startedAt] of [
    ['before', 'completed', 99], ['start', 'completed', 100], ['middle', 'completed', 150],
    ['end', 'completed', 200], ['running', 'running', 150], ['paused', 'paused', 150],
  ]) await runs.create({ ...sampleRun(id), state, startedAt }, db);
  assert.equal(await runs.countCompletedInPeriod(100, 200, db), 2);
  assert.equal(await runs.countCompletedInPeriod(200, 300, db), 1);
  assert.equal(await runs.countCompletedInPeriod(300, 400, db), 0);
}));

test('migration from version 1 preserves runs/locations/settings and adds a tracking session with cascade cleanup', async () => {
 const db=connection();
 const original=productionModules();
 const {outputText}=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/database/migrations/migration001.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
 const moduleValue={exports:{}};new Function('require','module','exports',outputText)(require,moduleValue,moduleValue.exports);
 try {
  await db.execAsync('PRAGMA foreign_keys = ON;');await moduleValue.exports.migration001(db);await db.execAsync('PRAGMA user_version = 1');
  await original.runRepository.create(sampleRun(),db);
  await db.runAsync('INSERT INTO run_locations (id,run_id,sequence,latitude,longitude,altitude,accuracy,speed,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)', ...Object.values(sampleLocation()));
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version,4);
  assert.equal((await original.runLocationRepository.list('run-1',db)).length,1);
  assert.equal(await original.settingsRepository.get('default_weekly_target',db),3);
  await db.runAsync('INSERT INTO background_tracking_session (singleton,run_id,started_at,first_sequence) VALUES (1,?,?,?)','run-1',1720000000,1);
  await original.runRepository.delete('run-1',db);
  assert.equal(await db.getFirstAsync('SELECT * FROM background_tracking_session'),null);
 } finally {await db.closeAsync();}
});

test('version 2 to latest migration preserves completed runs/settings and rolls back a partial ALTER before retry', async () => {
  const db=connection();
  const readMigration = name => {
    const module={exports:{}};
    const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,`../src/database/migrations/${name}.ts`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','module','exports',source)(require,module,module.exports);
    return module.exports[name];
  };
  try {
    await db.execAsync('PRAGMA foreign_keys = ON');await readMigration('migration001')(db);await readMigration('migration002')(db);await db.execAsync('PRAGMA user_version = 2');
    const run={...sampleRun('preserved'),state:'completed',endedAt:1720000060,distanceMeters:1200,activeDurationSeconds:300};
    await runs.create(run,db);await settings.set('default_weekly_target',5,db);
    const original=db.execAsync;
    db.execAsync=async sql=>{
      if(sql.includes('ALTER TABLE runs ADD COLUMN training_plan_id')) {await original('ALTER TABLE runs ADD COLUMN training_plan_id TEXT');throw new Error('migration interruption');}
      return original(sql);
    };
    await assert.rejects(migrateDatabase(db),/migration interruption/);db.execAsync=original;
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version,2);
    assert.ok(!(await db.getAllAsync('PRAGMA table_info(runs)')).some(column=>column.name==='training_plan_id'));
    await migrateDatabase(db);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version,4);
    assert.deepEqual({...await runs.get(run.id,db)},run);assert.equal(await settings.get('default_weekly_target',db),5);
    assert.equal(await runs.getTrainingSession(run.id,db),null);
    await runs.setTrainingSession(run.id,{planId:'beginner_4week_v1',sessionId:'week1_day1'},db);
    assert.deepEqual({...await runs.getTrainingSession(run.id,db)},{planId:'beginner_4week_v1',sessionId:'week1_day1'});
    await migrateDatabase(db);assert.equal((await db.getAllAsync('PRAGMA table_info(runs)')).filter(column=>column.name==='training_plan_id').length,1);
  } finally {await db.closeAsync();}
});
