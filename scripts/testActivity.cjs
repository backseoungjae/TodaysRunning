const assert = require('node:assert/strict');
const {test} = require('node:test');
const {environment} = require('./helpers/gpsEnvironment.cjs');
const servicePath='src/features/activity/services/activityService.ts';
const run = (id, startedAt, patch={}) => ({id,source:'free',goalType:'none',targetDistanceMeters:null,targetDurationSeconds:null,
  startedAt,endedAt:startedAt+300,state:'completed',distanceMeters:1000,activeDurationSeconds:300,
  pausedDurationSeconds:50,pausedAt:null,createdAt:startedAt,updatedAt:startedAt+350,...patch});
const instrument = env => {
  const queries=[];
  for(const method of ['getFirstAsync','getAllAsync']) {
    const original=env.db[method];
    env.db[method]=async(sql,...args)=>{queries.push(sql);return original(sql,...args);};
  }
  return queries;
};

test('Activity lists completed runs newest first with deterministic ties, reading no locations and aggregating stored splits only', async () => {
  const env=environment();
  try {
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    const now=new Date(2026,9,3,12); const t=now.getTime()/1000;
    for(const entry of [run('older',t-60),run('b',t),run('a',t),run('running',t+60,{state:'running'}),run('paused',t+120,{state:'paused'})]) await repo.create(entry);
    const queries=instrument(env);
    const result=await env.load(servicePath).loadActivity(0,now);
    assert.deepEqual(result.runs.map(run=>run.id),['b','a','older']);
    assert.equal(result.statistics.runCount,3);
    assert.ok(queries.every(sql=>!sql.includes('run_locations')));
    assert.ok(queries.every(sql=>sql.trim().startsWith('SELECT')));
  } finally {env.close();}
});

test('weekly totals use Monday local boundaries and weighted total duration/distance pace, excluding pauses and other states', async () => {
  const env=environment();
  try {
    const now=new Date(2026,9,3,12);
    const week=env.load('src/features/home/utils/calendarWeek.ts').getCalendarWeek(now);
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    for(const entry of [run('first',week.startSeconds),run('second',week.endSeconds-1,{distanceMeters:3000,activeDurationSeconds:1800}),
      run('before',week.startSeconds-1),run('after',week.endSeconds),run('pending',week.startSeconds+10,{state:'paused',distanceMeters:9000})]) await repo.create(entry);
    const result=await env.load(servicePath).loadActivity(0,now);
    assert.deepEqual(result.statistics,{runCount:2,distanceMeters:4000,activeDurationSeconds:2100,averagePaceSeconds:525});
    const previous=await env.load(servicePath).loadActivity(-1,now);
    assert.equal(previous.statistics.runCount,1); assert.equal(previous.statistics.distanceMeters,1000);
    assert.equal(result.runs.length,4); // The history remains complete when changing only the statistics week.
  } finally {env.close();}
});

test('empty and zero-distance weeks have finite totals and unavailable pace without storing derived statistics', async () => {
  const env=environment();
  try {
    const now=new Date(2026,9,3,12); const service=env.load(servicePath);
    const empty=await service.loadActivity(0,now);
    assert.deepEqual(empty.runs,[]);
    assert.deepEqual(empty.statistics,{runCount:0,distanceMeters:0,activeDurationSeconds:0,averagePaceSeconds:null});
    const queries=instrument(env);
    await env.load('src/database/repositories/runRepository.ts').runRepository.create(run('zero',now.getTime()/1000,{distanceMeters:0,activeDurationSeconds:45}));
    const result=await service.loadActivity(0,now);
    assert.equal(result.statistics.activeDurationSeconds,45); assert.equal(result.statistics.averagePaceSeconds,null);
    assert.ok(queries.every(sql=>sql.trim().startsWith('SELECT')));
  } finally {env.close();}
});

test('detail lazily reads only the chosen Run locations in sequence order and derives pace from its saved summary', async () => {
  const env=environment();
  try {
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    const locations=env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository;
    const t=Date.now()/1000;
    await repo.create(run('selected',t)); await repo.create(run('other',t));
    for(const [runId,sequence,latitude] of [['selected',1,37.6],['other',0,38],['selected',0,37.5]]) {
      await locations.create({id:runId+sequence,runId,sequence,latitude,longitude:127,accuracy:5,altitude:null,speed:null,recordedAt:t+sequence});
    }
    const queries=instrument(env);
    const result=await env.load(servicePath).loadActivityDetail('selected');
    assert.equal(result.run.id,'selected'); assert.equal(result.averagePaceSeconds,300);
    assert.deepEqual(result.coordinates,[{latitude:37.5,longitude:127},{latitude:37.6,longitude:127}]);
    assert.equal(queries.filter(sql=>sql.includes('run_locations')).length,1);
    assert.ok(queries.find(sql=>sql.includes('run_locations')).includes('WHERE run_id = ?'));
    assert.equal(queries.filter(sql=>sql.includes('run_splits')).length,1);
    assert.ok(queries.find(sql=>sql.includes('run_splits')).includes('WHERE run_id = ?'));
    assert.equal((await env.load(servicePath).loadActivityDetail('other')).coordinates.length,1);
  } finally {env.close();}
});

test('missing/incomplete detail fails before loading GPS; a completed run without GPS remains readable', async () => {
  const env=environment();
  try {
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;const t=Date.now()/1000;
    await repo.create(run('paused',t,{state:'paused'}));await repo.create(run('no-route',t));
    const queries=instrument(env); const service=env.load(servicePath);
    for(const id of ['missing','paused',"' OR 1=1 --"]) await assert.rejects(service.loadActivityDetail(id),/완료한 러닝/);
    assert.ok(queries.every(sql=>!sql.includes('run_locations')));
    assert.deepEqual((await service.loadActivityDetail('no-route')).coordinates,[]);
  } finally {env.close();}
});

test('repository failures propagate to the Activity loading boundary for visible retry', async () => {
  const env=environment();
  try {
    await env.load('src/database/database.ts').getDatabase();
    const service=env.load(servicePath);env.db.getAllAsync=async()=>{throw new Error('read failure');};
    await assert.rejects(service.loadActivity(),/read failure/);
  } finally {env.close();}
});
