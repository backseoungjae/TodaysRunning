const assert = require('node:assert/strict');
const {test} = require('node:test');
const {environment} = require('./helpers/gpsEnvironment.cjs');
const lifecyclePath='src/features/run/services/runLifecycleService.ts';
const goalPath='src/features/training/services/weeklyGoalService.ts';
const planPath='src/features/training/data/beginnerPlan.ts';
const selection=env=>{const plan=env.load(planPath).beginnerPlan;const session=plan.sessions.find(session=>session.id==='week2_day2');return {plan,session,goal:{goalType:session.goalType,targetDistanceMeters:session.targetDistanceMeters??null,targetDurationSeconds:session.targetDurationSeconds??null},ids:{planId:plan.id,sessionId:session.id}};};

test('training Run retains exact goal and association across fresh JS and atomically completes progress on Finish', async () => {
  const env=environment();
  try {
    const {goal,ids}=selection(env); const lifecycle=env.load(lifecyclePath); const training=env.load('src/database/repositories/trainingRepository.ts').trainingRepository;
    const run=await lifecycle.createRun(goal,'training',Date.now()/1000,ids);
    assert.equal(run.goalType,'distance'); assert.equal(run.targetDistanceMeters,2000);
    assert.equal(await training.get(ids.planId,ids.sessionId),null);
    await lifecycle.pauseRun(run.id); assert.equal(await training.get(ids.planId,ids.sessionId),null);
    env.reload();
    const completed=await env.load(lifecyclePath).finishRun(run.id);
    const progress=await env.load('src/database/repositories/trainingRepository.ts').trainingRepository.get(ids.planId,ids.sessionId);
    assert.equal(progress.status,'completed'); assert.equal(progress.completedRunId,run.id); assert.equal(progress.completedAt,completed.endedAt);
    assert.deepEqual({...await env.load('src/database/repositories/runRepository.ts').runRepository.getTrainingSession(run.id)},ids);
    const home=await env.load('src/features/home/services/homeService.ts').loadHomeData();
    assert.equal(home.planProgress.completedCount,1); assert.equal(home.weeklyCompletedRuns,1);
  } finally {env.close();}
});

test('progress storage failure rolls Run completion and splits back; retry commits all records', async () => {
  const env=environment();
  try {
    const {goal,ids}=selection(env);const lifecycle=env.load(lifecyclePath);
    const run=await lifecycle.createRun(goal,'training',1800000000,ids);
    const locations=env.load('src/database/repositories/runLocationRepository.ts').runLocationRepository;
    for(const [sequence,distance,time] of [[0,0,0],[1,1000,300]]) await locations.create({
      id:`${run.id}:${sequence}`,runId:run.id,sequence,latitude:37.5+sequence*0.009,longitude:127,accuracy:5,
      altitude:null,speed:null,recordedAt:run.startedAt+time,cumulativeDistanceMeters:distance,activeDurationSeconds:time,
    });
    await lifecycle.pauseRun(run.id,1800000300);
    const splits=env.load('src/database/repositories/runSplitRepository.ts').runSplitRepository;
    const original=env.db.runAsync;
    env.db.runAsync=async(sql,...args)=>{if(sql.includes('INSERT INTO training_progress'))throw new Error('storage full');return original(sql,...args);};
    await assert.rejects(lifecycle.finishRun(run.id),/storage full/); env.db.runAsync=original;
    const repo=env.load('src/database/repositories/runRepository.ts').runRepository;
    assert.equal((await repo.get(run.id)).state,'paused'); assert.equal((await repo.get(run.id)).endedAt,null);
    assert.equal((await splits.list(run.id)).length,0);
    assert.equal(await env.load('src/database/repositories/trainingRepository.ts').trainingRepository.get(ids.planId,ids.sessionId),null);
    await lifecycle.finishRun(run.id);assert.equal((await repo.get(run.id)).state,'completed');
    assert.equal((await splits.list(run.id)).length,1);
    assert.equal((await env.load('src/database/repositories/trainingRepository.ts').trainingRepository.get(ids.planId,ids.sessionId)).status,'completed');
  } finally {env.close();}
});

test('free runs, unfinished/deleted runs and invalid training selections never complete a session', async () => {
  const env=environment();
  try {
    const {goal,ids}=selection(env);const lifecycle=env.load(lifecyclePath);const training=env.load('src/database/repositories/trainingRepository.ts').trainingRepository;
    const run=await lifecycle.createRun(goal,'training',Date.now()/1000,ids);
    await assert.rejects(lifecycle.finishRun(run.id),/일시정지/);await lifecycle.pauseRun(run.id);
    await env.load('src/database/repositories/runRepository.ts').runRepository.delete(run.id);
    assert.equal(await training.get(ids.planId,ids.sessionId),null);
    await assert.rejects(lifecycle.createRun({...goal,targetDistanceMeters:3000},'training',Date.now()/1000,ids),/플랜 목표/);
    await assert.rejects(lifecycle.createRun(goal,'training',Date.now()/1000,{...ids,planId:'unknown_v2'}),/플랜 목표/);
    const free=await lifecycle.createRun({goalType:'none',targetDurationSeconds:null,targetDistanceMeters:null});
    await lifecycle.pauseRun(free.id);await lifecycle.finishRun(free.id);
    assert.deepEqual(await training.list(ids.planId),[]);
  } finally {env.close();}
});

test('repeat Finish/session runs do not duplicate progress or replace the original completion', async () => {
  const env=environment();
  try {
    const {goal,ids}=selection(env);const lifecycle=env.load(lifecyclePath);
    const first=await lifecycle.createRun(goal,'training',Date.now()/1000,ids);await lifecycle.pauseRun(first.id);await lifecycle.finishRun(first.id);await lifecycle.finishRun(first.id);
    const second=await lifecycle.createRun(goal,'training',Date.now()/1000,ids);await lifecycle.pauseRun(second.id);await lifecycle.finishRun(second.id);
    const rows=await env.load('src/database/repositories/trainingRepository.ts').trainingRepository.list(ids.planId);
    assert.equal(rows.length,1);assert.equal(rows[0].completedRunId,first.id);
    const home=await env.load('src/features/home/services/homeService.ts').loadHomeData();assert.equal(home.planProgress.completedCount,1);assert.equal(home.weeklyCompletedRuns,2);
  } finally {env.close();}
});

test('new weeks snapshot the default; changing the current goal preserves all past goals and createdAt', async () => {
  const env=environment();
  try {
    const service=env.load(goalPath);const earlier=new Date(2026,8,28,12);const current=new Date(2026,9,5,12);const next=new Date(2026,9,12,12);
    const past=await service.ensureCurrentWeeklyGoal(earlier);assert.equal(past.targetRuns,3);
    const initial=await service.ensureCurrentWeeklyGoal(current);assert.equal(initial.targetRuns,3);
    const updated=await service.updateWeeklyTarget(5,new Date(2026,9,6,12));assert.equal(updated.targetRuns,5);assert.equal(updated.createdAt,initial.createdAt);
    assert.deepEqual({...await env.load('src/database/repositories/weeklyGoalRepository.ts').weeklyGoalRepository.get(past.weekStartDate)},{...past});
    assert.equal((await service.ensureCurrentWeeklyGoal(next)).targetRuns,5);
    env.reload();assert.equal((await env.load(goalPath).ensureCurrentWeeklyGoal(current)).targetRuns,5);
    assert.equal(await env.load('src/database/repositories/settingsRepository.ts').settingsRepository.get('default_weekly_target'),5);
  } finally {env.close();}
});

test('weekly target zero is valid; invalid targets and failed saves preserve both default and current snapshot', async () => {
  const env=environment();
  try {
    const service=env.load(goalPath);const now=new Date(2026,9,3,12);
    await service.ensureCurrentWeeklyGoal(now);
    for(const value of [-1,8,1.5,NaN,Infinity])await assert.rejects(service.updateWeeklyTarget(value,now),/주간 목표/);
    const original=env.db.runAsync;
    env.db.runAsync=async(sql,...args)=>{if(sql.startsWith('UPDATE weekly_goals'))throw new Error('storage full');return original(sql,...args);};
    await assert.rejects(service.updateWeeklyTarget(5,now),/storage full/);env.db.runAsync=original;
    assert.equal((await service.ensureCurrentWeeklyGoal(now)).targetRuns,3);
    assert.equal(await env.load('src/database/repositories/settingsRepository.ts').settingsRepository.get('default_weekly_target'),3);
    assert.equal((await service.updateWeeklyTarget(0,now)).targetRuns,0);
    assert.equal((await env.load('src/features/home/services/homeService.ts').loadHomeData(now)).weeklyTarget,0);
  } finally {env.close();}
});

test('concurrent weekly reads/settings changes create one goal and use the committed default for later weeks', async () => {
  const env=environment({platform:'web'});
  try {
    const service=env.load(goalPath);const now=new Date(2026,9,3,12);
    await Promise.all([service.ensureCurrentWeeklyGoal(now),service.updateWeeklyTarget(4,now),service.ensureCurrentWeeklyGoal(now)]);
    const rows=await env.load('src/database/repositories/weeklyGoalRepository.ts').weeklyGoalRepository.list();assert.equal(rows.length,1);assert.equal(rows[0].targetRuns,4);
    assert.equal((await service.ensureCurrentWeeklyGoal(new Date(2026,9,5,12))).targetRuns,4);
  } finally {env.close();}
});
