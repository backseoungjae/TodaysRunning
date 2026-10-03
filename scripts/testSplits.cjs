const assert = require('node:assert/strict');
const {test} = require('node:test');
const {environment} = require('./helpers/gpsEnvironment.cjs');
const point = (cumulativeDistanceMeters, activeDurationSeconds) => ({cumulativeDistanceMeters,activeDurationSeconds});
const goal = {goalType:'none',targetDistanceMeters:null,targetDurationSeconds:null};

test('split interpolation handles exact boundaries, multiple crossings, floating point and omits partial kilometers', () => {
  const env=environment();
  try {
    const calculate=env.load('src/features/run/utils/calculateSplits.ts').calculateSplits;
    assert.deepEqual(calculate([]),[]);
    assert.deepEqual(calculate([point(0,0),point(999,390)]),[]);
    const splits=calculate([point(0,0),point(900,351),point(1100,429),point(2000,771),point(2500,951)]);
    assert.deepEqual(splits.map(s=>s.durationSeconds),[390,381]);
    assert.deepEqual(splits.map(s=>s.paceSecondsPerKm),[390,381]);
    assert.deepEqual(splits.map(s=>s.distanceMeters),[1000,1000]);
    assert.deepEqual(calculate([point(0,0),point(3000,1080)]).map(s=>s.durationSeconds),[360,360,360]);
    assert.equal(calculate([point(0,0),point(1000-1e-8,360)]).length,1);
    assert.equal(calculate([point(0,0),point(999.99,360)]).length,0);
  } finally {env.close();}
});

test('standing time counts; resumed/gap baselines add no distance; malformed/legacy metrics produce no fabricated splits', () => {
  const env=environment();
  try {
    const calculate=env.load('src/features/run/utils/calculateSplits.ts').calculateSplits;
    assert.deepEqual(calculate([point(0,10),point(500,200),point(500,230),point(1000,420)]).map(s=>s.durationSeconds),[420]);
    for(const values of [[point(0,0),point(null,300)], [point(0,null)], [point(5,1)],
      [point(0,0),point(Infinity,1)], [point(0,0),point(1000,NaN)], [point(0,-1)],
      [point(0,0),point(1000,0)], [point(0,0),point(1000,300),point(900,301)],
      [point(0,0),point(1000,300),point(1100,299)]]) assert.deepEqual(calculate(values),[]);
  } finally {env.close();}
});

test('real filtered GPS excludes pause travel/time, stores splits atomically, survives reload and cascades deletion', async () => {
  const env=environment();
  try {
    const lifecycle=env.load('src/features/run/services/runLifecycleService.ts');
    const save=env.load('src/features/run/services/runLocationPersistence.ts').persistRunLocation;
    const locations=env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository;
    const runs=env.load('src/database/repositories/runRepository.ts').runRepository;
    const splits=env.load('src/database/repositories/runSplitRepository.ts').runSplitRepository;
    let now=1800000000, sequence=0, previous=null;
    const run=await lifecycle.createRun(goal,'free',now);
    const emit=async(latitude, extra={})=>{
      const result=await save({runId:run.id,sequence,raw:{latitude,longitude:127,accuracy:5,altitude:null,speed:2,timestamp:now,...extra},previous,receivedAt:now});
      if(result.accepted){previous=result.location;sequence++;}
      return result;
    };
    await emit(37.5);
    for(let i=1;i<=20;i++){now+=10;assert.equal((await emit(37.5+i*0.0005)).accepted,true);}
    const beforePause=await runs.get(run.id);assert.ok(beforePause.distanceMeters>1111&&beforePause.distanceMeters<1113);
    now+=1;assert.equal((await emit(38)).accepted,false); // Rejected jump contributes neither metrics nor splits.
    await lifecycle.pauseRun(run.id,now); now+=300;
    assert.equal((await emit(38)).accepted,false);
    await lifecycle.resumeRun(run.id,now); previous=null; await emit(38);
    assert.equal((await runs.get(run.id)).distanceMeters,beforePause.distanceMeters);
    for(let i=1;i<=20;i++){now+=10;await emit(38+i*0.0005);}
    await lifecycle.pauseRun(run.id,now);
    const original=env.db.runAsync;
    env.db.runAsync=async(sql,...args)=>{if(sql.includes('INSERT INTO run_splits'))throw new Error('split write failed');return original(sql,...args);};
    await assert.rejects(lifecycle.finishRun(run.id,now+10),/split write failed/);
    assert.equal((await runs.get(run.id)).state,'paused');assert.equal((await splits.list(run.id)).length,0);
    env.db.runAsync=original;
    const completed=await lifecycle.finishRun(run.id,now+10);
    assert.equal(completed.activeDurationSeconds,401);assert.equal(completed.pausedDurationSeconds,310);
    const rows=await splits.list(run.id);assert.equal(rows.length,2);
    assert.ok(rows.every(row=>row.durationSeconds>179&&row.durationSeconds<182));
    assert.equal((await locations.listMetrics(run.id)).at(-1).activeDurationSeconds,401);
    await lifecycle.finishRun(run.id,now+30);assert.equal((await splits.list(run.id)).length,2);
    env.reload();
    const detail=await env.load('src/features/activity/services/activityService.ts').loadActivityDetail(run.id);
    assert.deepEqual(detail.splits.map(s=>({...s})),rows.map(s=>({...s})));
    assert.equal(detail.coordinates.length,42);
    await env.load('src/database/repositories/runRepository.ts').runRepository.delete(run.id);
    assert.equal((await env.load('src/database/repositories/runSplitRepository.ts').runSplitRepository.list(run.id)).length,0);
  } finally {env.close();}
});

test('delayed headless background batches preserve capture-time metrics rather than batch delivery time', async context => {
  const env=environment({background:true});let now=1800000000000;context.mock.method(Date,'now',()=>now);
  try {
    const run=await env.load('src/features/run/services/runLifecycleService.ts').createRun(goal);
    const service=env.load('src/features/run/services/backgroundLocationService.ts');
    await service.startBackgroundTracking(run.id);env.reload();
    const receiver=env.load('src/features/run/services/backgroundLocationService.ts');
    const started=now;now+=200000;
    const fixes=Array.from({length:21},(_,i)=>({coords:{latitude:37.5+i*0.0005,longitude:127,accuracy:5,altitude:null,speed:2},timestamp:started+i*10000}));
    await receiver.processBackgroundLocations(fixes.reverse());
    const metrics=await env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository.listMetrics(run.id);
    assert.equal(metrics.length,21);assert.equal(metrics[0].activeDurationSeconds,0);assert.equal(metrics[1].activeDurationSeconds,10);assert.equal(metrics.at(-1).activeDurationSeconds,200);
    const lifecycle=env.load('src/features/run/services/runLifecycleService.ts');await lifecycle.pauseRun(run.id);await lifecycle.finishRun(run.id);
    const splits=await env.load('src/database/repositories/runSplitRepository.ts').runSplitRepository.list(run.id);
    assert.equal(splits.length,1);assert.ok(splits[0].durationSeconds>179&&splits[0].durationSeconds<181);
  } finally {env.close();}
});

test('migration 3→4 preserves legacy rows/settings and rolls back both ALTERs on failure before retry', async () => {
  const env=environment();
  try {
    for(const name of ['001','002','003']) await env.load(`src/database/migrations/migration${name}.ts`)[`migration${name}`](env.db);
    await env.db.execAsync('PRAGMA foreign_keys = ON; PRAGMA user_version = 3');
    await env.db.runAsync("INSERT INTO runs (id,source,goal_type,started_at,state,created_at,updated_at) VALUES ('legacy','free','none',100,'completed',100,100)");
    await env.db.runAsync("INSERT INTO run_locations (id,run_id,sequence,latitude,longitude,recorded_at) VALUES ('fix','legacy',0,37.5,127,100)");
    const original=env.db.execAsync;
    env.db.execAsync=async(sql)=>{if(sql.includes('ALTER TABLE run_locations')){await original('ALTER TABLE run_locations ADD COLUMN cumulative_distance_meters REAL');throw new Error('migration interrupted');}return original(sql);};
    const migrate=env.load('src/database/migrations/migrations.ts').migrateDatabase;
    await assert.rejects(migrate(env.db),/migration interrupted/);
    assert.equal((await env.db.getFirstAsync('PRAGMA user_version')).user_version,3);
    assert.ok(!(await env.db.getAllAsync('PRAGMA table_info(run_locations)')).some(column=>column.name==='cumulative_distance_meters'));
    env.db.execAsync=original;await migrate(env.db);await migrate(env.db);
    assert.equal((await env.db.getFirstAsync('PRAGMA user_version')).user_version,4);
    assert.deepEqual({...await env.db.getFirstAsync('SELECT cumulative_distance_meters,active_duration_seconds FROM run_locations')},{cumulative_distance_meters:null,active_duration_seconds:null});
    assert.equal((await env.db.getFirstAsync('SELECT COUNT(*) AS count FROM runs')).count,1);
    assert.equal((await env.db.getFirstAsync("SELECT value FROM app_settings WHERE key='default_weekly_target'")).value,'3');
  } finally {env.close();}
});
