const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness(platform, androidConfigured = true) {
  const slots = []; let cursor = 0; const pending = []; const cameraMoves = []; const fittedRoutes = [];
  const nativeMap = { animateCamera: (...args) => cameraMoves.push(args), fitToCoordinates: (...args) => fittedRoutes.push(args) };
  const react = {
    useRef() { const index = cursor++; return slots[index] ??= {current:nativeMap}; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {slots[index] = value;}]; },
    useMemo(factory, deps) { const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) slots[index] = {deps,value:factory()};
      return slots[index].value; },
    useEffect(effect, deps) { const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) { slots[index] = deps; pending.push(effect); } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/features/run/components/RunMap.tsx'), 'utf8');
  const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const moduleValue = {exports:{}};
  const localRequire = name => {
    if (name === 'expo-constants') return {__esModule:true,default:{expoConfig:{extra:{maps:{androidConfigured}}}}};
    if (name === 'react') return react;
    if (name === 'react-native') return {Platform:{OS:platform},View:'View',StyleSheet:{create:value=>value}};
    if (name === 'react-native-maps') return {__esModule:true,default:'MapView',Marker:'Marker',Polyline:'Polyline',PROVIDER_GOOGLE:'google'};
    if (name.endsWith('AppButton')) return {AppButton:'AppButton'};
    if (name.endsWith('AppText')) return {AppText:'AppText'};
    return require(name);
  };
  new Function('require','module','exports',output)(localRequire,moduleValue,moduleValue.exports);
  return {cameraMoves,fittedRoutes,render(props) {cursor=0; const tree=moduleValue.exports.RunMap(props); pending.splice(0).forEach(effect=>effect()); return tree;}};
}
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {const result=find(child,type); if (result) return result;}
  return null;
}
const first={latitude:37.5,longitude:127};
const second={latitude:37.5001,longitude:127};

test('iOS uses Apple Maps; Android uses Google; marker and polyline reflect ordered filtered coordinates', () => {
  for (const platform of ['ios','android']) {
    const env=harness(platform); const props={coordinates:[first],currentLocation:first};
    let tree=env.render(props); const map=find(tree,'MapView');
    assert.equal(map.props.provider, platform==='ios'?undefined:'google');
    assert.equal(map.props.showsUserLocation,false); assert.equal(find(tree,'Polyline'),null);
    assert.deepEqual(find(tree,'Marker').props.coordinate,first);
    tree=env.render({...props,coordinates:[first,second],currentLocation:second});
    assert.deepEqual(find(tree,'Polyline').props.coordinates,[first,second]);
    assert.deepEqual(find(tree,'Marker').props.coordinate,second);
  }
});
test('camera waits for map readiness, follows updates, stops on interaction and recenters even when already following', () => {
  const env=harness('ios'); let following=true;
  let props={coordinates:[first],currentLocation:first,followCurrentLocation:following,onFollowChange:value=>{following=value;}};
  let tree=env.render(props); assert.equal(env.cameraMoves.length,0);
  find(tree,'MapView').props.onMapReady(); tree=env.render(props);
  assert.deepEqual(env.cameraMoves.at(-1)[0].center,first);
  find(tree,'MapView').props.onTouchStart(); assert.equal(following,false);
  const count=env.cameraMoves.length;
  props={...props,coordinates:[first,second],currentLocation:second,followCurrentLocation:following}; tree=env.render(props);
  assert.equal(env.cameraMoves.length,count);
  find(tree,'AppButton').props.onPress(); assert.equal(following,true);
  assert.deepEqual(env.cameraMoves.at(-1)[0].center,second);
  props={...props,followCurrentLocation:following}; tree=env.render(props);
  const recenters=env.cameraMoves.length; find(tree,'AppButton').props.onPress(); assert.equal(env.cameraMoves.length,recenters+1);
  find(tree,'MapView').props.onRegionChange({}, {isGesture:false}); assert.equal(following,true);
  find(tree,'MapView').props.onRegionChange({}, {isGesture:true}); assert.equal(following,false);
});
test('no GPS renders a waiting state; read-only maps disable gestures, recenter and marker when requested', () => {
  const env=harness('android');
  assert.equal(find(env.render({coordinates:[]}), 'MapView'),null);
  const tree=env.render({coordinates:[first,second],currentLocation:second,interactive:false,showCurrentLocation:false,followCurrentLocation:false});
  assert.equal(find(tree,'Marker'),null); assert.equal(find(tree,'AppButton'),null);
  assert.equal(find(tree,'MapView').props.scrollEnabled,false); assert.equal(find(tree,'MapView').props.zoomEnabled,false);
});

test('result map fits the entire saved route after readiness without a current marker or recenter button', () => {
  const env=harness('ios'); const props={coordinates:[first,second],showCurrentLocation:false,followCurrentLocation:false,fitRoute:true};
  let tree=env.render(props); assert.equal(env.fittedRoutes.length,0);
  find(tree,'MapView').props.onMapReady(); tree=env.render(props);
  assert.deepEqual(env.fittedRoutes[0][0],[first,second]); assert.equal(env.fittedRoutes[0][1].animated,false);
  assert.equal(find(tree,'Marker'),null); assert.equal(find(tree,'AppButton'),null); assert.equal(env.cameraMoves.length,0);
});

test('Android without a configured Maps key uses a visible fallback without mounting a broken native map; iOS remains available', () => {
  const props={coordinates:[first,second],currentLocation:second};
  assert.equal(find(harness('android',false).render(props),'MapView'),null);
  assert.ok(find(harness('android',false).render(props),'AppText'));
  assert.ok(find(harness('ios',false).render(props),'MapView'));
});
