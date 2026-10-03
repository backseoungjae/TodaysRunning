const assert = require('node:assert/strict');
const { test } = require('node:test');
const { environment } = require('./helpers/gpsEnvironment.cjs');
const taskPath = 'src/features/run/services/backgroundLocationTask.ts';
const servicePath = 'src/features/run/services/backgroundLocationService.ts';
const trackerPath = 'src/features/run/services/runLocationTracker.ts';
const taskName = 'todaysrunning-location-v1';
const fix = (latitude, timestamp, accuracy=5) => ({coords:{latitude,longitude:127,accuracy,altitude:null,speed:null},timestamp:timestamp*1000});
const rows = env => env.db.getAllAsync('SELECT * FROM run_locations ORDER BY sequence');
async function emit(env, locations) {await env.tasks.get(taskName)({data:{locations}});}

test('background permission uses a single task for foreground/background, filters, sorts and deduplicates batched fixes', async () => {
 const env=environment({background:true,platform:'android'});
 const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start(); assert.equal(tracker.getState().backgroundEnabled,true); assert.equal(env.watches.length,0);
  assert.ok(env.starts[0].foregroundService); assert.equal(env.starts[0].foregroundService.killServiceOnDestroy,true);
  const t=Date.now()/1000+0.001;
  await emit(env,[fix(37.50005,t+2),fix(95,t+1),fix(37.5,t),fix(37.50005001,t+3),fix(37.5001,t+4,80)]);
  assert.equal((await rows(env)).length,2); assert.equal(tracker.getState().validLocation.latitude,37.50005);
  await Promise.all([emit(env,[fix(37.50005,t+2)]),emit(env,[fix(37.50005,t+2)])]);
  assert.equal((await rows(env)).length,2);
  await tracker.stop(); assert.equal(env.backgroundStarted(),false);
  await emit(env,[fix(37.5001,t+4)]); assert.equal((await rows(env)).length,2);
 } finally {await tracker.stop();env.close();}
});
test('foreground-only, Expo Go, unavailable TaskManager and web do not request background permission or start tasks', async () => {
 for (const options of [{background:false},{background:true,expoGo:true},{background:true,available:false},{background:true,platform:'web'}]) {
  const env=environment(options);const tracker=env.load(trackerPath).createRunLocationTracker({});
  try {await tracker.start();assert.equal(tracker.getState().status,'tracking');assert.equal(tracker.getState().backgroundEnabled,false);
   assert.equal(env.watches.length,1);assert.equal(env.starts.length,0);
  } finally {await tracker.stop();env.close();}
 }
});
test('module-scope task persists without a screen or listener after a fresh JS module context', async () => {
 const env=environment({background:true}); const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();const t=Date.now()/1000+0.001;await emit(env,[fix(37.5,t)]);
  env.reload();env.load(taskPath); // No tracker/component or Zustand is loaded by this task path.
  await emit(env,[fix(37.50005,t+2),fix(37.5,t)]);
  assert.equal((await rows(env)).length,2);
  const service=env.load(servicePath);await service.stopBackgroundTracking(tracker.getState().runId);
 } finally {await tracker.stop();env.close();}
});
test('resume starts a new baseline, ignores old-segment samples, and foreground fallback continues the SQLite sequence', async context => {
 const env=environment({background:true});let now=1000000;context.mock.method(Date,'now',()=>now);
 const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();await emit(env,[fix(37.5,1000),fix(37.50005,1002)]);await tracker.stop();
  now=1100000;await tracker.start();await emit(env,[fix(37.5001,1050),fix(37.6,1100)]);
  assert.equal((await rows(env)).length,3);assert.equal(tracker.getState().distanceFromPreviousMeters,0);
  await tracker.stop();env.setBackground(false);await tracker.start();
  env.watches[0].callback(fix(37.7,1101));await tracker.stop();
  assert.deepEqual((await rows(env)).map(row=>row.sequence),[0,1,2,3]);
 } finally {await tracker.stop();env.close();}
});
test('bounded delayed background batches are accepted, while too-old and invalid samples are rejected', async context => {
 const env=environment({background:true});let now=1000000;context.mock.method(Date,'now',()=>now);
 const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();now=1120000;await emit(env,[fix(37.5,1000),fix(37.50005,1002)]);
  assert.equal((await rows(env)).length,2);
  now=1400000;await emit(env,[fix(37.5001,1004),fix(95,1399)]);assert.equal((await rows(env)).length,2);
 } finally {await tracker.stop();env.close();}
});
test('native start failure cleans task/context before falling back to foreground tracking', async () => {
 const env=environment({background:true});env.setStartFailure(true);
 const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {await tracker.start();assert.equal(env.backgroundStarted(),false);assert.equal(env.watches.length,1);
  assert.equal(tracker.getState().backgroundEnabled,false);assert.ok(tracker.getState().backgroundNotice);
  assert.equal(await env.load('src/database/repositories/backgroundTrackingRepository.ts').backgroundTrackingRepository.get(),null);
 } finally {await tracker.stop();env.close();}
});
test('stop during asynchronous task registration removes the late task and never starts a foreground watcher', async () => {
 const env=environment({background:true});env.setDelayBackground(true);
 const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  const start=tracker.start();while(env.starts.length===0) await new Promise(resolve=>setImmediate(resolve));
  const stop=tracker.stop();env.releaseBackground();await Promise.all([start,stop]);
  assert.equal(env.backgroundStarted(),false);assert.equal(env.watches.length,0);assert.equal(tracker.getState().status,'stopped');
 } finally {await tracker.stop();env.close();}
});
test('storage failure and native task errors stop recording and surface an error instead of publishing unsaved fixes', async () => {
 for(const storageFailure of [true,false]) {
  const env=environment({background:true}); const tracker=env.load(trackerPath).createRunLocationTracker({});
  try {
   await tracker.start();env.setFailWrite(storageFailure);
   if(storageFailure) await emit(env,[fix(37.5,Date.now()/1000+0.001)]);
   else await env.tasks.get(taskName)({error:{message:'native denied'}});
   assert.equal(tracker.getState().status,'error');assert.ok(tracker.getState().error);
   assert.equal(tracker.getState().validLocation,null);assert.equal((await rows(env)).length,0);
   await emit(env,[fix(37.50005,Date.now()/1000+0.001)]);assert.equal((await rows(env)).length,0);
  } finally {await tracker.stop();env.close();}
 }
});
test('native stop failure can retry cleanup without starting a second watcher', async () => {
 const env=environment({background:true});const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();env.setStopFailure(true);await tracker.stop();
  assert.equal(tracker.getState().status,'error');assert.equal(env.watches.length,0);
  env.setStopFailure(false);await tracker.stop();assert.equal(env.backgroundStarted(),false);
  assert.equal(tracker.getState().backgroundEnabled,false);
 } finally {env.setStopFailure(false);await tracker.stop();env.close();}
});

test('AppState keeps the background task/timer active; foreground-only tracking pauses and resumes safely', async context => {
 let now=1000000;context.mock.method(Date,'now',()=>now);
 for(const background of [true,false]) {
  let focus, onAppState;
  const appState={currentState:'active',addEventListener:(event,callback)=>{onAppState=callback;return {remove(){}};}};
  const slots=[];let cursor=0;
  const react={useState:initial=>[initial,()=>{}],useRef:value=>{const index=cursor++;return slots[index]??={current:value};},useMemo:factory=>factory(),useCallback:callback=>callback};
  const env=environment({background,appState,react,router:{useFocusEffect:callback=>{focus=callback;}}});
  const flush=async()=>{for(let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve));};
  const hook=env.load('src/features/run/hooks/useRunLocation.ts').useRunLocation();
  const store=env.load('src/features/run/store/runStore.ts').useRunStore;
  const cleanup=focus();
  try {
   await flush();assert.equal(store.getState().status,'running');
   appState.currentState='background';onAppState('background');await flush();
   assert.equal(store.getState().status,background?'running':'paused');
   if(background) {assert.equal(env.backgroundStarted(),true);assert.equal(env.stops.length,0);
    now+=100000;await emit(env,[fix(37.5,now/1000)]);assert.equal(store.getState().routeCoordinates.length,1);
   }
   appState.currentState='active';onAppState('active');await flush();
   assert.equal(store.getState().status,'running');
   if(background) {assert.equal(env.starts.length,1);assert.equal(store.getState().elapsedSeconds,100);}
   else assert.equal(env.watches.length,2);
  } finally {await hook.stop();cleanup();await flush();env.close();}
 }
});
test('fresh foreground tracker binds the durable run instead of creating another parent run', async () => {
 const env=environment({background:true});const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();const id=tracker.getState().runId;
  env.reload();const recovered=env.load(trackerPath).createRunLocationTracker({});
  await recovered.start();assert.equal(recovered.getState().runId,id);
  assert.equal((await env.db.getFirstAsync('SELECT COUNT(*) AS count FROM runs')).count,1);
  await recovered.stop();
 } finally {await tracker.stop();env.close();}
});

test('permission downgrade in a fresh runtime stops the registered task before foreground fallback', async () => {
 const env=environment({background:true});const tracker=env.load(trackerPath).createRunLocationTracker({});
 try {
  await tracker.start();env.setBackground(false);env.reload();
  const recovered=env.load(trackerPath).createRunLocationTracker({});await recovered.start();
  assert.equal(env.backgroundStarted(),false);assert.equal(env.watches.length,1);
  assert.equal(recovered.getState().backgroundEnabled,false);
  assert.equal(await env.load('src/database/repositories/backgroundTrackingRepository.ts').backgroundTrackingRepository.get(),null);
  await recovered.stop();
 } finally {await tracker.stop();env.close();}
});
