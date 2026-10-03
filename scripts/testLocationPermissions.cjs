const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const permission = (status, canAskAgain = true, extra = {}) => ({status, granted:status === 'granted', canAskAgain, expires:'never', ...extra});

function environment(platform = 'ios') {
  let foreground = permission('undetermined');
  let background = permission('undetermined');
  let foregroundResult = permission('granted');
  let backgroundResult = permission('denied');
  let available = true;
  let backgroundError = false;
  let backgroundReadError = false;
  let foregroundError = false;
  let choice = 1;
  let gpsAccuracy = 5, services = true;
  const calls = [], alerts = [], routes = [];
  const subscribers = new Set();
  const slots = []; let cursor = 0; let pending = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((value,index) => Object.is(value,b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value:typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = {current:initial};
      return slots[index];
    },
    useCallback(callback,deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps,deps)) slots[index] = {deps, callback};
      return slots[index].callback;
    },
    useEffect(effect,deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps,deps)) {
        slots[index]?.cleanup?.();
        slots[index] = {deps};
        pending.push(() => { slots[index].cleanup = effect(); });
      }
    },
  };
  const native = {
    Accuracy: {High: 4},
    async hasServicesEnabledAsync() { return services; },
    async getCurrentPositionAsync() { return { coords: {latitude: 37.5, longitude: 127, accuracy: gpsAccuracy, altitude: null, speed: null}, timestamp: Date.now() }; },
    async getForegroundPermissionsAsync() { if (foregroundError) throw new Error('foreground failure'); return {...foreground}; },
    async getBackgroundPermissionsAsync() { if (backgroundReadError) throw new Error('background read failure'); return {...background}; },
    async requestForegroundPermissionsAsync() { calls.push('foreground'); foreground = {...foregroundResult}; return {...foreground}; },
    async requestBackgroundPermissionsAsync() { calls.push('background'); if (backgroundError) throw new Error('background failure'); background = {...backgroundResult}; return {...background}; },
    async isBackgroundLocationAvailableAsync() { return available; },
  };
  const rn = {
    Platform:{OS:platform},
    Linking:{async openSettings() { calls.push('settings'); }},
    Alert:{alert(title,message,buttons) {
      alerts.push({title,message,buttons});
      if (choice !== null) buttons[choice].onPress();
    }},
    AppState:{addEventListener(type,listener) {
      assert.equal(type,'change'); subscribers.add(listener);
      return {remove() { subscribers.delete(listener); }};
    }},
  };
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(__dirname,'..',filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = {exports:{}}; cache.set(resolved,module);
    const {outputText} = ts.transpileModule(fs.readFileSync(resolved,'utf8'), {
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:resolved,
    });
    const localRequire = name => {
      if (name === 'expo-location') return native;
      if (name === 'react-native') return rn;
      if (name === 'react') return react;
      if (name === 'expo-router') return {
        router:{push:route=>routes.push(route),navigate:route=>routes.push(route)},
        useFocusEffect:effect=>react.useEffect(effect,[effect]),
      };
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved),`${name}.ts`));
      return require(name);
    };
    new Function('require','module','exports',outputText)(localRequire,module,module.exports);
    return module.exports;
  }
  return {
    load, calls, alerts, routes,
    setGpsAccuracy(value) { gpsAccuracy = value; }, setServices(value) { services = value; },
    setForeground(value) {foreground=value;}, setBackground(value) {background=value;},
    setForegroundResult(value) {foregroundResult=value;}, setBackgroundResult(value) {backgroundResult=value;},
    setAvailable(value) {available=value;}, setBackgroundError(value) {backgroundError=value;},
    setBackgroundReadError(value) {backgroundReadError=value;}, setForegroundError(value) {foregroundError=value;},
    setChoice(value) {choice=value;},
    active() {for (const listener of subscribers) listener('active');},
    render(hook) {cursor=0; const value=hook(); const tasks=pending; pending=[]; tasks.forEach(task=>task()); return value;},
    unmount() {slots.forEach(slot=>slot.cleanup?.());},
  };
}
const servicePath = 'src/shared/services/locationService.ts';
const runPath = 'src/features/run/services/runPermissionService.ts';

test('OS permission mapping distinguishes none/denied/blocked and preserves foreground with background denied', async () => {
  const env = environment(); const service = env.load(servicePath);
  for (const [fg,bg,expected] of [
    [permission('undetermined'),permission('undetermined'),'none'],
    [permission('denied'),permission('undetermined'),'denied'],
    [permission('denied',false),permission('undetermined'),'blocked'],
    [permission('granted'),permission('denied',false),'foreground'],
    [permission('granted'),permission('granted'),'background'],
    [permission('denied',false),permission('granted'),'blocked'],
  ]) {
    env.setForeground(fg); env.setBackground(bg);
    assert.equal((await service.getLocationPermissionStatus()).status,expected);
  }
});

test('foreground precedes background; denied or blocked foreground never requests background', async () => {
  for (const os of ['ios','android']) {
    const env = environment(os); const service = env.load(servicePath);
    const result = await service.requestLocationPermissionFlow();
    assert.deepEqual(env.calls,['foreground','background']);
    assert.equal(result.status,'foreground');
  }
  for (const response of [permission('denied'),permission('denied',false)]) {
    const env = environment(); env.setForegroundResult(response);
    assert.equal((await env.load(servicePath).requestLocationPermissionFlow()).foreground.granted,false);
    assert.deepEqual(env.calls,['foreground']);
  }
  const env = environment(); env.setForeground(permission('denied',false));
  await env.load(servicePath).requestLocationPermissionFlow();
  assert.deepEqual(env.calls,[]);
});

test('background denied, unavailable, blocked or native failure does not remove granted foreground', async () => {
  for (const setup of [
    env=>env.setAvailable(false), env=>env.setBackground(permission('denied',false)),
    env=>env.setBackgroundError(true), env=>env.setBackgroundReadError(true),
  ]) {
    const env = environment(); setup(env);
    const result = await env.load(servicePath).requestLocationPermissionFlow();
    assert.equal(result.foreground.granted,true);
    assert.equal(result.status,'foreground');
  }
  const env = environment(); env.setBackgroundResult(permission('granted'));
  assert.equal((await env.load(servicePath).requestLocationPermissionFlow()).status,'background');
  env.setForeground(permission('granted',true,{ios:{scope:'whenInUse',accuracy:'reduced'}}));
  assert.equal((await env.load(servicePath).getLocationPermissionStatus()).foreground.granted,true);
});

test('web permission is never presented as always/background; concurrent flows request once and failures can retry', async () => {
  const web = environment('web'); web.setForeground(permission('granted')); web.setBackground(permission('granted'));
  const webService = web.load(servicePath);
  assert.equal((await webService.requestLocationPermissionFlow()).status,'foreground');
  assert.deepEqual(web.calls,[]);
  await assert.rejects(webService.openAppSettings(),/브라우저/);
  const env = environment(); const service = env.load(servicePath);
  const first = service.requestLocationPermissionFlow();
  assert.equal(service.requestLocationPermissionFlow(),first);
  await first;
  assert.deepEqual(env.calls,['foreground','background']);
  env.setForegroundError(true);
  await assert.rejects(service.requestLocationPermissionFlow(),/foreground failure/);
  env.setForegroundError(false);
  assert.equal((await service.requestLocationPermissionFlow()).foreground.granted,true);
});

test('START cancel and foreground rejection return Home; foreground-only approval and existing approval enter Running', async () => {
  for (const [setup,route,expectedCalls] of [
    [env=>env.setChoice(0),'/(tabs)',[]],
    [env=>env.setForegroundResult(permission('denied')),'/(tabs)',['foreground']],
    [()=>{},'/running',['foreground','background']],
    [env=>env.setForeground(permission('granted')),'/running',[]],
  ]) {
    const env = environment(); setup(env);
    const {useRunPermissionStart} = env.load('src/features/run/hooks/useRunPermissionStart.ts');
    const hook = env.render(useRunPermissionStart);
    await hook.start();
    assert.deepEqual(env.routes,[route]);
    assert.deepEqual(env.calls,expectedCalls);
    if (env.alerts.length) {
      assert.equal(env.alerts.length,1);
      assert.equal(env.alerts[0].title,'위치 권한이 필요합니다');
      assert.deepEqual(env.alerts[0].buttons.map(button=>button.text),['취소','권한 설정']);
    }
    env.unmount();
  }
});

test('blocked START opens app settings without illegal requests; duplicate START does not stack alerts', async () => {
  const blocked = environment(); blocked.setForeground(permission('denied',false));
  assert.equal(await blocked.load(runPath).prepareRunLocationPermission(),null);
  assert.deepEqual(blocked.calls,['settings']);
  const env = environment(); env.setChoice(null);
  const {useRunPermissionStart} = env.load('src/features/run/hooks/useRunPermissionStart.ts');
  const hook = env.render(useRunPermissionStart);
  const first = hook.start(); await flush();
  await hook.start();
  assert.equal(env.alerts.length,1);
  env.alerts[0].buttons[0].onPress(); await first;
  assert.deepEqual(env.routes,['/(tabs)']);
  env.unmount();
});

test('Settings OFF never fakes permission revocation; cancel retains ON and open settings uses native Linking', async () => {
  const env = environment(); env.setForeground(permission('granted')); env.setChoice(0);
  const {useSettingsLocationPermission} = env.load('src/features/settings/hooks/useSettingsLocationPermission.ts');
  env.render(useSettingsLocationPermission); await flush();
  let state = env.render(useSettingsLocationPermission);
  state.toggle(false); await flush();
  state = env.render(useSettingsLocationPermission);
  assert.equal(state.permission.foreground.granted,true);
  assert.deepEqual(env.calls,[]);
  assert.deepEqual(env.alerts[0].buttons.map(button=>button.text),['취소','설정 열기']);
  env.setChoice(1);
  state.toggle(false); await flush();
  assert.deepEqual(env.calls,['settings']);
  assert.equal(env.render(useSettingsLocationPermission).permission.foreground.granted,true);
  env.unmount();
});

test('Settings ON requests permissions; AppState active rereads background upgrades and foreground revocation', async () => {
  const env = environment();
  const {useSettingsLocationPermission} = env.load('src/features/settings/hooks/useSettingsLocationPermission.ts');
  env.render(useSettingsLocationPermission); await flush();
  let state = env.render(useSettingsLocationPermission);
  assert.equal(state.permission.foreground.granted,false);
  state.toggle(true); await flush();
  state = env.render(useSettingsLocationPermission);
  assert.equal(state.permission.status,'foreground');
  assert.deepEqual(env.calls,['foreground','background']);
  env.setBackground(permission('granted')); env.active(); await flush();
  assert.equal(env.render(useSettingsLocationPermission).permission.status,'background');
  env.setForeground(permission('denied',false)); env.setBackground(permission('denied',false)); env.active(); await flush();
  state = env.render(useSettingsLocationPermission);
  assert.equal(state.permission.foreground.granted,false);
  assert.equal(state.permission.status,'blocked');
  env.unmount(); env.active();
});

test('START checks a fresh accurate GPS fix; poor accuracy and disabled services keep Setup available for retry', async () => {
  const env = environment(); env.setForeground(permission('granted'));
  const {useRunPermissionStart} = env.load('src/features/run/hooks/useRunPermissionStart.ts');
  let hook = env.render(useRunPermissionStart); env.setGpsAccuracy(100); await hook.start();
  assert.deepEqual(env.routes, []); assert.match(env.render(useRunPermissionStart).error, /GPS/);
  env.setGpsAccuracy(5); env.setServices(false); hook = env.render(useRunPermissionStart); await hook.start();
  assert.deepEqual(env.routes, []); assert.match(env.render(useRunPermissionStart).error, /위치 서비스/);
  env.setServices(true); await env.render(useRunPermissionStart).start(); assert.deepEqual(env.routes, ['/running']); env.unmount();
});
