const assert = require('node:assert/strict');
const { test } = require('node:test');
const { environment } = require('./helpers/gpsEnvironment.cjs');
const flush = () => new Promise(resolve=>setImmediate(resolve));
const sample = (patch={}) => ({latitude:0,longitude:0,accuracy:5,altitude:null,speed:null,timestamp:1000,...patch});

const filterPath='src/features/run/services/gpsFilterService.ts';
const trackerPath='src/features/run/services/runLocationTracker.ts';
const nativeSample = (patch={}) => ({coords:{latitude:0,longitude:0,accuracy:5,altitude:null,speed:null,...patch},timestamp:Date.now()});

test('GPS rejects invalid coordinates, unknown/poor accuracy, invalid speed and malformed/stale/future timestamps',()=>{
  const env=environment();const {filterGpsLocation}=env.load(filterPath);
  try {
    for (const [patch,reason] of [
      [{latitude:91},'invalid_coordinate'],[{longitude:-181},'invalid_coordinate'],[{latitude:NaN},'invalid_coordinate'],
      [{accuracy:null},'poor_accuracy'],[{accuracy:26},'poor_accuracy'],[{accuracy:-1},'poor_accuracy'],
      [{speed:Infinity},'invalid_speed'],[{speed:9},'excessive_speed'],
      [{timestamp:NaN},'invalid_timestamp'],[{timestamp:0},'invalid_timestamp'],[{timestamp:1006},'invalid_timestamp'],[{timestamp:984},'stale'],
    ]) assert.deepEqual(filterGpsLocation(sample(patch),null,1000),{accepted:false,reason});
    const normalized=filterGpsLocation(sample({speed:-1,altitude:Infinity}),null,1000);
    assert.equal(normalized.accepted,true);
    assert.equal(normalized.location.speed,null);
    assert.equal(normalized.location.altitude,null);
  } finally {env.close();}
});

test('GPS rejects noise, jumps, derived excessive speed and out-of-order fixes; only accepted results expose distance',()=>{
  const env=environment();const {filterGpsLocation}=env.load(filterPath);
  try {
    const baseline=filterGpsLocation(sample({timestamp:998}),null,998).location;
    for (const [patch,reason] of [
      [{latitude:0.000001},'noise'],[{latitude:0.01},'location_jump'],[{latitude:0.0002},'excessive_speed'],
      [{timestamp:998},'out_of_order'],[{timestamp:997},'out_of_order'],
    ]) {
      const result=filterGpsLocation(sample(patch),baseline,1000);
      assert.equal(result.accepted,false);assert.equal(result.reason,reason);
      assert.equal(Object.hasOwn(result,'distanceFromPreviousMeters'),false);
    }
    const accepted=filterGpsLocation(sample({latitude:0.00005}),baseline,1000);
    assert.equal(accepted.accepted,true);
    assert.ok(accepted.distanceFromPreviousMeters>5 && accepted.distanceFromPreviousMeters<6);
    const gap=filterGpsLocation(sample({latitude:10,timestamp:1040}),baseline,1040);
    assert.equal(gap.accepted,true);assert.equal(gap.distanceFromPreviousMeters,0);
  } finally {env.close();}
});

test('haversine handles zero, equator and international date line',()=>{
  const env=environment();const {calculateDistanceMeters}=env.load('src/features/run/utils/calculateDistance.ts');
  try {
    assert.equal(calculateDistanceMeters({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
    assert.ok(Math.abs(calculateDistanceMeters({latitude:0,longitude:0},{latitude:0,longitude:1})-111195)<1);
    assert.ok(calculateDistanceMeters({latitude:0,longitude:179.999},{latitude:0,longitude:-179.999})<223);
  } finally {env.close();}
});

test('location service requires foreground/services, preserves raw fields, converts ms to seconds and stops idempotently',async()=>{
  const env=environment();const service=env.load('src/shared/services/locationService.ts');
  try {
    env.setForeground(false);
    await assert.rejects(service.startLocationTracking(()=>{},()=>{}),/위치 권한/);
    env.setForeground(true);env.setServices(false);
    await assert.rejects(service.startLocationTracking(()=>{},()=>{}),/위치 서비스/);
    env.setServices(true);
    const raws=[],errors=[];
    const handle=await service.startLocationTracking(raw=>raws.push(raw),error=>errors.push(error));
    const native=nativeSample({accuracy:8,altitude:12,speed:2});
    env.watches[0].callback(native);
    assert.deepEqual(raws[0],sample({accuracy:8,altitude:12,speed:2,timestamp:native.timestamp/1000}));
    env.watches[0].error('signal');assert.deepEqual(errors,['signal']);
    service.stopLocationTracking(handle);service.stopLocationTracking(handle);
    env.watches[0].callback(native);env.watches[0].error('late');
    assert.equal(env.watches[0].removed,1);assert.equal(raws.length,1);assert.equal(errors.length,1);
  } finally {env.close();}
});

test('tracker persists only valid fixes in order through real repositories/SQLite and drains pending writes on stop',async()=>{
  const env=environment();const {createRunLocationTracker}=env.load(trackerPath);
  const changes=[];const tracker=createRunLocationTracker({onChange:state=>changes.push(state)});
  try {
    const start=tracker.start();assert.equal(tracker.start(),start);await start;
    const watch=env.watches[0];const t=Date.now()-5000;
    for (const [latitude,timestamp,accuracy] of [[0,t,5],[90.1,t+1000,5],[0.000001,t+1000,5],[0.00005,t+2000,5],[0.1,t+3000,5],[0.0001,t+4000,5],[0.00015,t+5000,80]]) {
      watch.callback({coords:{latitude,longitude:0,accuracy,altitude:null,speed:null},timestamp});
    }
    await tracker.stop();
    const rows=await env.db.getAllAsync('SELECT * FROM run_locations ORDER BY sequence');
    assert.equal(rows.length,3);
    assert.deepEqual(rows.map(row=>row.sequence),[0,1,2]);
    assert.deepEqual(rows.map(row=>row.latitude),[0,0.00005,0.0001]);
    assert.equal(rows[0].recorded_at,t/1000);
    assert.equal(tracker.getState().status,'stopped');
    assert.equal(watch.removed,1);
    watch.callback(nativeSample({latitude:0.0002}));await flush();
    assert.equal((await env.db.getAllAsync('SELECT * FROM run_locations')).length,3);
    assert.equal((await env.db.getFirstAsync('PRAGMA foreign_key_check')),null);
    assert.ok(changes.some(state=>state.rawLocation?.accuracy===80));
  } finally {await tracker.stop();env.close();}
});

test('restart reuses run/sequence and resets baseline so a stopped segment cannot add distance',async()=>{
  const env=environment();const {createRunLocationTracker}=env.load(trackerPath);
  const tracker=createRunLocationTracker({onChange:()=>{}});
  try {
    await tracker.start();env.watches[0].callback(nativeSample());await tracker.stop();
    const runId=tracker.getState().runId;
    await tracker.start();env.watches[1].callback(nativeSample({latitude:1}));await tracker.stop();
    const rows=await env.db.getAllAsync('SELECT * FROM run_locations ORDER BY sequence');
    assert.deepEqual(rows.map(row=>row.sequence),[0,1]);
    assert.equal(tracker.getState().runId,runId);
    assert.equal(tracker.getState().distanceFromPreviousMeters,0);
    assert.equal((await env.db.getAllAsync('SELECT * FROM runs')).length,1);
    const recovered=createRunLocationTracker({runId,onChange:()=>{}});
    await recovered.start();env.watches[2].callback(nativeSample({latitude:2}));await recovered.stop();
    assert.equal((await env.db.getFirstAsync('SELECT MAX(sequence) AS value FROM run_locations')).value,2);
  } finally {await tracker.stop();env.close();}
});

test('stop during delayed subscription acquisition removes the late subscription without recording callbacks',async()=>{
  const env=environment();env.setDelayWatch(true);
  const {createRunLocationTracker}=env.load(trackerPath);const tracker=createRunLocationTracker({onChange:()=>{}});
  try {
    const start=tracker.start();await flush();
    const stop=tracker.stop();env.watches[0].callback(nativeSample());env.watches[0].release();
    await Promise.all([start,stop]);
    assert.equal(env.watches[0].removed,1);
    assert.equal(tracker.getState().status,'stopped');
    assert.equal((await env.db.getAllAsync('SELECT * FROM run_locations')).length,0);
  } finally {await tracker.stop();env.close();}
});

test('SQLite write failure stops tracking and does not publish the failed fix as valid; retry can save again',async()=>{
  const env=environment();const {createRunLocationTracker}=env.load(trackerPath);const tracker=createRunLocationTracker({onChange:()=>{}});
  try {
    await tracker.start();env.setFailWrite(true);env.watches[0].callback(nativeSample());await flush();
    assert.equal(tracker.getState().status,'error');assert.equal(tracker.getState().validLocation,null);
    assert.equal(env.watches[0].removed,1);
    assert.equal((await env.db.getAllAsync('SELECT * FROM run_locations')).length,0);
    env.setFailWrite(false);await tracker.start();env.watches[1].callback(nativeSample());await tracker.stop();
    assert.equal((await env.db.getAllAsync('SELECT * FROM run_locations')).length,1);
  } finally {await tracker.stop();env.close();}
});

test('training goal is preserved in the minimum parent Run; missing run cannot start a watch',async()=>{
  const env=environment();const {createRunLocationTracker}=env.load(trackerPath);
  const session=env.load('src/features/training/data/beginnerPlan.ts').beginnerPlan.sessions[4];
  const tracker=createRunLocationTracker({session,onChange:()=>{}});
  try {
    await tracker.start();await tracker.stop();
    const row=await env.db.getFirstAsync('SELECT * FROM runs');
    assert.equal(row.source,'training');assert.equal(row.goal_type,'distance');assert.equal(row.target_distance_meters,2000);
    const missing=createRunLocationTracker({runId:'missing',onChange:()=>{}});
    await missing.start();assert.equal(missing.getState().status,'error');assert.equal(env.watches.length,1);
  } finally {await tracker.stop();env.close();}
});

test('validated GPS reaches SQLite and runtime once per fix, including buffered writes before pause', async () => {
  const env = environment();
  const { useRunStore } = env.load('src/features/run/store/runStore.ts');
  const { createRunLocationTracker } = env.load(trackerPath);
  const tracker = createRunLocationTracker({
    onRunReady(run) {
      const store = useRunStore.getState();
      if (store.runId !== run.id) store.initializeRun({ runId: run.id, goalType: run.goalType,
        targetDistanceMeters: run.targetDistanceMeters, targetDurationSeconds: run.targetDurationSeconds });
      if (useRunStore.getState().status === 'paused') store.resumeRun(); else store.startRun();
    },
    onValidLocation(id, fix, distance) {
      if (useRunStore.getState().runId === id) useRunStore.getState().updateLocation(fix, distance);
    },
    onStopped(id) {
      if (useRunStore.getState().runId === id) useRunStore.getState().pauseRun();
    },
  });
  try {
    await tracker.start();
    const timestamp = Date.now() - 6000;
    for (const [latitude, time] of [[0, timestamp], [91, timestamp + 1000], [0.00005, timestamp + 2000], [0.0001, timestamp + 4000]]) {
      env.watches[0].callback({ ...nativeSample({latitude}), timestamp: time });
    }
    await tracker.stop();
    const state = useRunStore.getState();
    assert.equal(state.status, 'paused'); assert.equal(state.routeCoordinates.length, 3);
    assert.ok(state.distanceMeters > 10 && state.distanceMeters < 12);
    assert.equal((await env.db.getFirstAsync('SELECT COUNT(*) AS count FROM run_locations')).count, 3);
    await tracker.start();
    env.watches[1].callback(nativeSample({latitude: 1}));
    await tracker.stop();
    assert.equal(useRunStore.getState().distanceMeters, state.distanceMeters);
    assert.equal(useRunStore.getState().routeCoordinates.length, 4);
    assert.equal(useRunStore.getState().runId, state.runId);
  } finally { await tracker.stop(); env.close(); }
});
