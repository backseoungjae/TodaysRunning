const assert = require('node:assert/strict');
const {test} = require('node:test');
const {environment} = require('./helpers/gpsEnvironment.cjs');
const run = (id,distanceMeters,activeDurationSeconds,patch={}) => ({id,source:'free',goalType:'none',targetDistanceMeters:null,targetDurationSeconds:null,
  startedAt:1800000000,endedAt:1800000000+activeDurationSeconds,state:'completed',distanceMeters,activeDurationSeconds,
  pausedDurationSeconds:0,pausedAt:null,createdAt:1800000000,updatedAt:1800000000+activeDurationSeconds,...patch});

test('all-time longest records exclude incomplete/nonfinite/zero metrics, use active time and keep deterministic newest ties', () => {
  const env=environment();
  try {
    const calculate=env.load('src/features/activity/utils/calculatePersonalRecords.ts').calculatePersonalRecords;
    assert.deepEqual(calculate([],null),{longestRun:null,longestDuration:null,fastest5K:null});
    const records=calculate([run('paused',20000,9000,{state:'paused'}),run('running',30000,10000,{state:'running'}),
      run('newest',10000,2000),run('older-tie',10000,2000,{startedAt:1799999000}),
      run('duration',5000,3000,{pausedDurationSeconds:5000}),run('invalid',Infinity,NaN),run('zero',0,0)],null);
    assert.equal(records.longestRun.id,'newest');assert.equal(records.longestDuration.id,'duration');
    assert.equal(records.longestDuration.activeDurationSeconds,3000);
  } finally {env.close();}
});

test('Fastest 5K uses actual first five full splits of >=5km completed runs, excluding short/incomplete/legacy/partial records', async () => {
  const env=environment();
  try {
    const runs=env.load('src/database/repositories/runRepository.ts').runRepository;
    const splits=env.load('src/database/repositories/runSplitRepository.ts').runSplitRepository;
    assert.equal(await runs.findFastest5K(),null);
    const seed=async(entry,durations,distances=[])=>{
      await runs.create(entry);
      for(let i=0;i<durations.length;i++)await splits.create({id:`${entry.id}:${i}`,runId:entry.id,splitNumber:i+1,distanceMeters:distances[i]??1000,durationSeconds:durations[i],paceSecondsPerKm:durations[i]});
    };
    await seed(run('short',4999.999999,100),[20,20,20,20,20]);
    await seed(run('paused',6000,100,{state:'paused'}),[20,20,20,20,20]);
    await seed(run('running',6000,100,{state:'running'}),[20,20,20,20,20]);
    await seed(run('legacy',5000,100),[]);
    await seed(run('four-splits',5000,100),[20,20,20,20]);
    await seed(run('partial-fifth',5000,100),[20,20,20,20,20],[1000,1000,1000,1000,900]);
    await seed(run('zero-time',5000,100),[0,20,20,20,20]);
    assert.equal(await runs.findFastest5K(),null);
    await seed(run('exact5K',5000,1500),[300,300,300,300,300]);
    await seed(run('longer10K',10000,4000),[250,250,250,250,250,550,550,550,550,550]);
    await seed(run('newer-tie',6000,2000,{startedAt:1800000100}),[250,250,250,250,250,750]);
    const sql=[];const original=env.db.getAllAsync;
    env.db.getAllAsync=async(query,...args)=>{sql.push(query);return original(query,...args);};
    const result=await env.load('src/features/activity/services/activityService.ts').loadActivity();
    assert.equal(result.personalRecords.fastest5K.id,'newer-tie');
    assert.equal(result.personalRecords.fastest5K.recordDurationSeconds,1250);
    assert.equal(result.personalRecords.longestRun.id,'longer10K');
    assert.equal(result.personalRecords.longestDuration.id,'longer10K');
    assert.ok(sql.every(query=>!query.includes('run_locations')));
    await runs.delete('newer-tie');assert.equal((await runs.findFastest5K()).id,'longer10K');
    await runs.delete('longer10K');assert.equal((await runs.findFastest5K()).id,'exact5K');
  } finally {env.close();}
});
