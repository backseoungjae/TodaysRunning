const assert = require('node:assert/strict');
const {test} = require('node:test');
const {environment} = require('./helpers/gpsEnvironment.cjs');
const root = 'src/features/run/';
const flush = async () => { for (let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve)); };
const raw = (latitude,timestamp) => ({latitude,longitude:127,accuracy:5,altitude:null,speed:2,timestamp});
const goals = [
  {goalType:'none',targetDistanceMeters:null,targetDurationSeconds:null},
  {goalType:'time',targetDistanceMeters:null,targetDurationSeconds:600},
  {goalType:'distance',targetDistanceMeters:1000,targetDurationSeconds:null},
];

for (const goal of goals) test(`${goal.goalType}: real SQLite lifecycle excludes pause time/displacement and completed result survives fresh JS`, async () => {
  const env=environment(); let now=1800000000000;
  const original=Date.now; Date.now=()=>now;
  try {
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    const lifecycle=env.load(root+'services/runLifecycleService.ts');
    const tracker=env.load(root+'services/runLocationTracker.ts').createRunLocationTracker({goal});
    await env.load('src/database/database.ts').getDatabase();
    assert.equal((await repo.list()).length,0); // Constructing a tracker does not create a run.
    await tracker.start(); const id=tracker.getState().runId;
    const record=await repo.get(id);
    assert.equal(record.goalType,goal.goalType); assert.equal(record.targetDurationSeconds,goal.targetDurationSeconds);
    assert.equal(record.targetDistanceMeters,goal.targetDistanceMeters);
    env.watches[0].callback({coords:raw(37.5,0),timestamp:now}); await flush();
    now+=5000; env.watches[0].callback({coords:raw(37.5002,0),timestamp:now}); await flush();
    now+=5000; await tracker.stop();
    let paused=await repo.get(id); assert.equal(paused.state,'paused'); assert.equal(paused.activeDurationSeconds,10);
    assert.ok(paused.distanceMeters>22&&paused.distanceMeters<23);
    now+=30000;
    env.watches[0].callback({coords:raw(38,0),timestamp:now}); await flush();
    assert.equal((await repo.get(id)).distanceMeters,paused.distanceMeters);
    await tracker.start(); assert.equal((await repo.get(id)).pausedDurationSeconds,30);
    env.watches[1].callback({coords:raw(38.0004,0),timestamp:now-5000}); await flush();
    assert.equal(tracker.getState().rejectionReason,'out_of_order');
    env.watches[1].callback({coords:raw(38,0),timestamp:now}); await flush();
    assert.equal((await repo.get(id)).distanceMeters,paused.distanceMeters); // New segment baseline ignores paused travel.
    now+=5000; env.watches[1].callback({coords:raw(38.0002,0),timestamp:now}); await flush();
    await assert.rejects(lifecycle.finishRun(id),/일시정지/);
    now+=5000; await tracker.stop(); now+=7000;
    const completed=await lifecycle.finishRun(id);
    assert.equal(completed.state,'completed'); assert.equal(completed.activeDurationSeconds,20);
    assert.equal(completed.pausedDurationSeconds,37); assert.ok(completed.distanceMeters>44&&completed.distanceMeters<45);
    assert.deepEqual({...await lifecycle.finishRun(id)},completed);
    env.reload();
    const result=await env.load(root+'services/runResultService.ts').loadRunResult(id,new Date(now));
    assert.equal(result.coordinates.length,4); assert.equal(result.run.activeDurationSeconds,20);
    assert.equal(result.weeklyCompletedRuns,1); assert.equal(result.weeklyTarget,3);
    assert.equal((await env.load('src/database/repositories/runRepository.ts').runRepository.list()).length,1);
  } finally {Date.now=original;env.close();}
});

test('location and aggregate distance commit together; failed aggregate update rolls back the GPS row', async () => {
  const env=environment();
  try {
    const service=env.load(root+'services/runLifecycleService.ts');
    const run=await service.createRun(goals[0]);
    const save=env.load(root+'services/runLocationPersistence.ts').persistRunLocation;
    const now=Date.now()/1000; const first=await save({runId:run.id,sequence:0,raw:raw(37.5,now-5),previous:null,receivedAt:now});
    const original=env.db.runAsync;
    env.db.runAsync=async(sql,...args)=>{if(sql.startsWith('UPDATE runs'))throw new Error('storage full');return original(sql,...args);};
    await assert.rejects(save({runId:run.id,sequence:1,raw:raw(37.5002,now),previous:first.location,receivedAt:now}),/storage full/);
    env.db.runAsync=original;
    const rows=await env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository.list(run.id);
    assert.equal(rows.length,1); assert.equal((await env.load('src/database/repositories/runRepository.ts').runRepository.get(run.id)).distanceMeters,0);
    await service.pauseRun(run.id);
    const rejected=await save({runId:run.id,sequence:1,raw:raw(37.5002,now+1),previous:first.location,receivedAt:now+1});
    assert.equal(rejected.accepted,false); assert.equal((await env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository.list(run.id)).length,1);
    env.db.runAsync=async(sql,...args)=>{if(sql.startsWith('UPDATE runs'))throw new Error('storage full');return original(sql,...args);};
    await assert.rejects(service.finishRun(run.id),/storage full/); env.db.runAsync=original;
    assert.equal((await env.load('src/database/repositories/runRepository.ts').runRepository.get(run.id)).state,'paused');
    assert.equal((await service.finishRun(run.id)).state,'completed');
  } finally {env.close();}
});

test('goal routes preserve free/time/distance and training goals and reject malformed values', () => {
  const env=environment();
  try {
    const {readRunGoal,getRunGoalParams}=env.load(root+'utils/runGoalSelection.ts');
    for(const goal of goals) assert.deepEqual(readRunGoal(getRunGoalParams(goal)),goal);
    assert.deepEqual(readRunGoal({}),goals[0]);
    for(const params of [{goalType:'time',targetDurationSeconds:'0'},{goalType:'time',targetDurationSeconds:'Infinity'},
      {goalType:['distance'],targetDistanceMeters:'1000'},{goalType:'none',targetDistanceMeters:'1'},
      {goalType:'time',targetDurationSeconds:'10',targetDistanceMeters:'1000'}, {planId:'bad'}, {goalType:'wrong',targetDistanceMeters:'100'}]) assert.equal(readRunGoal(params),null);
    const training=env.load(root+'utils/trainingSelection.ts');
    const session=env.load('src/features/training/data/beginnerPlan.ts').beginnerPlan.sessions[0];
    assert.equal(readRunGoal(training.getTrainingRunParams(session)).targetDurationSeconds,900);
  } finally {env.close();}
});

test('headless background fixes retain aggregate distance, hydrate only the current runtime, and finish with the same saved metrics', async context => {
  const env=environment({background:true}); let now=1800000000000;
  context.mock.method(Date,'now',()=>now);
  try {
    const tracker=env.load(root+'services/runLocationTracker.ts').createRunLocationTracker({goal:goals[2]});
    await tracker.start(); const id=tracker.getState().runId;
    env.reload(); env.load(root+'services/backgroundLocationTask.ts');
    const task=env.tasks.get('todaysrunning-location-v1');
    const fix=latitude=>({coords:raw(latitude,0),timestamp:now});
    await task({data:{locations:[fix(37.5)]}}); now+=5000;
    await task({data:{locations:[fix(37.5002)]}}); now+=5000;
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    assert.ok((await repo.get(id)).distanceMeters>22);
    const store=env.load(root+'store/runStore.ts').useRunStore;
    store.getState().initializeRun({...goals[2],runId:id});
    await env.load(root+'services/runRuntimeService.ts').refreshRunRuntime(id);
    assert.equal(store.getState().routeCoordinates.length,2); assert.equal(store.getState().elapsedSeconds,10);
    assert.equal(store.getState().distanceMeters,(await repo.get(id)).distanceMeters);
    await env.load(root+'services/backgroundLocationService.ts').stopBackgroundTracking(id);
    const lifecycle=env.load(root+'services/runLifecycleService.ts');
    await lifecycle.pauseRun(id); now+=30000;
    const completed=await lifecycle.finishRun(id);
    assert.equal(completed.activeDurationSeconds,10); assert.equal(completed.pausedDurationSeconds,30);
    assert.equal(completed.distanceMeters,store.getState().distanceMeters);
  } finally {env.close();}
});

test('retrying a failed pause saves the original pause timestamp instead of counting the retry delay as active time', async context => {
  const env=environment(); let now=1800000000000; context.mock.method(Date,'now',()=>now);
  try {
    const tracker=env.load(root+'services/runLocationTracker.ts').createRunLocationTracker({goal:goals[0]});
    await tracker.start(); const id=tracker.getState().runId; const original=env.db.runAsync;
    env.db.runAsync=async(sql,...args)=>{if(sql.startsWith('UPDATE runs'))throw new Error('storage full');return original(sql,...args);};
    now+=10000; await tracker.stop(); await flush(); assert.equal(tracker.getState().status,'error');
    now+=30000; env.db.runAsync=original; await tracker.stop();
    const run=await env.load('src/database/repositories/runRepository.ts').runRepository.get(id);
    assert.equal(run.state,'paused'); assert.equal(run.activeDurationSeconds,10); assert.equal(run.pausedAt,1800000010);
    const completed=await env.load(root+'services/runLifecycleService.ts').finishRun(id);
    assert.equal(completed.pausedDurationSeconds,30);
  } finally {env.close();}
});
