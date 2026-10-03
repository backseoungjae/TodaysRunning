const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

function loadConfig(env) {
  const moduleValue={exports:{}};
  const output=ts.transpileModule(fs.readFileSync('app.config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('process','module','exports',output)({env},moduleValue,moduleValue.exports);
  const config=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
  return moduleValue.exports.default({config});
}
test('Android builds reject absent/blank Maps keys with a useful error that never includes a key value', () => {
  for(const key of [undefined,'','  ']) assert.throws(()=>loadConfig({EAS_BUILD_PLATFORM:'android',GOOGLE_MAPS_ANDROID_API_KEY:key}), /Android build requires GOOGLE_MAPS_ANDROID_API_KEY/);
});
test('local/iOS config supports safe missing-key fallback, preserves the EAS project and never forces iOS Google Maps', () => {
  for(const platform of [undefined,'ios']) {
    const config=loadConfig({EAS_BUILD_PLATFORM:platform});
    assert.equal(config.extra.maps.androidConfigured,false);assert.ok(config.extra.eas.projectId);
    assert.deepEqual(config.plugins.find(value=>Array.isArray(value)&&value[0]==='react-native-maps')[1],{});
  }
});
test('a supplied key is passed only to the native plugin; runtime extra exposes only a configured boolean', () => {
  const config=loadConfig({EAS_BUILD_PLATFORM:'android',GOOGLE_MAPS_ANDROID_API_KEY:'test-only-maps-fixture'});
  assert.deepEqual(config.extra.maps,{androidConfigured:true});
  const maps=config.plugins.filter(value=>Array.isArray(value)&&value[0]==='react-native-maps');
  assert.equal(maps.length,1);assert.deepEqual(maps[0][1],{androidGoogleMapsApiKey:'test-only-maps-fixture'});
});
