// Introspection runs config plugins without generating ios/ or android/.
// Config output contains the Maps key, so keep it in memory and print booleans only.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
require('@expo/env').load(process.cwd(), {silent:true});

try {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  assert.ok(key, 'GOOGLE_MAPS_ANDROID_API_KEY is missing; Android Maps QA requires the existing key.');
  const output = execFileSync(process.execPath, ['node_modules/expo/bin/cli','config','--type','introspect','--json'], {
    encoding:'utf8', env:{...process.env, EXPO_NO_DOTENV:'1'}, stdio:['ignore','pipe','pipe'],
  });
  const config = JSON.parse(output);
  const mods = config._internal.modResults;
  const manifest = mods.android.manifest.manifest;
  const permissions = new Set(manifest['uses-permission'].filter(value=>value.$['tools:node']!=='remove').map(value=>value.$['android:name']));
  assert.ok(config.android.package === 'com.bsj.todaysrunning', 'Unexpected Android package.');
  assert.ok(config.ios.bundleIdentifier === 'com.bsj.todaysrunning', 'Unexpected iOS bundle identifier.');
  assert.ok(config.extra.eas.projectId, 'EAS project must be linked before building.');
  assert.ok(config.extra.maps.androidConfigured === true, 'Missing runtime Android Maps configuration.');
  const mapPlugin = config.plugins.find(value=>Array.isArray(value)&&value[0]==='react-native-maps');
  assert.ok(mapPlugin?.[1]?.androidGoogleMapsApiKey === key, 'Maps plugin must use the existing environment key.');
  assert.ok(!mapPlugin[1].iosGoogleMapsApiKey, 'iOS must retain the default Apple Maps provider.');
  assert.ok(manifest.application[0]['meta-data'].some(value=>value.$['android:name']==='com.google.android.geo.API_KEY'
    && value.$['android:value']===key), 'Android native Maps key injection failed.');
  for(const permission of ['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION']) {
    assert.ok(permissions.has(`android.permission.${permission}`), `Missing native permission: ${permission}`);
  }
  for(const permission of ['READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE']) assert.ok(!permissions.has(`android.permission.${permission}`), 'Unused storage permissions must be blocked.');
  assert.ok(mods.ios.infoPlist.UIBackgroundModes.includes('location'), 'iOS background location mode is missing.');
  assert.ok(mods.ios.infoPlist.NSLocationWhenInUseUsageDescription, 'Missing iOS foreground permission explanation.');
  assert.ok(mods.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription, 'Missing iOS background permission explanation.');
  const eas = JSON.parse(fs.readFileSync('eas.json','utf8'));
  for(const name of ['development','preview']) {
    const profile=eas.build[name];
    assert.ok(profile.distribution==='internal' && profile.environment===name, 'Invalid EAS distribution/environment.');
    assert.ok(profile.android.buildType==='apk' && profile.ios.simulator===false, 'Profiles must target installable device builds.');
    assert.ok(profile.developmentClient===(name==='development'), 'Invalid development client mode.');
  }
  console.log('PASS: Expo config, EAS device profiles, identifiers, native location permissions, Apple Maps policy, and Android Maps key injection verified. Secret values were not printed.');
} catch (error) {
  // Never dump captured config/CLI output, even when a config plugin fails.
  console.error(error instanceof assert.AssertionError ? error.message : 'Expo config introspection failed. Check config plugins and installed SDK-compatible dependencies.');
  process.exitCode=1;
}
