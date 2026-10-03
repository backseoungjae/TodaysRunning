const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

function environment(options = {}) {
  const sqlite = new DatabaseSync(':memory:');
  let foreground = true, services = true, failWrite = false, delayWatch = false;
  const watches = [];
  const tasks = new Map();
  let backgroundGranted = options.background ?? false;
  let backgroundStarted = false, startFailure = false, stopFailure = false;
  let delayBackground = false, releaseBackground;
  const starts = [], stops = [];
  const constants = {__esModule:true,default:{executionEnvironment:options.expoGo?'storeClient':'bare'},ExecutionEnvironment:{StoreClient:'storeClient'}};
  const db = {
    async execAsync(sql) {sqlite.exec(sql);},
    async runAsync(sql,...params) {
      if (failWrite && sql.startsWith('INSERT INTO run_locations')) throw new Error('storage full');
      return sqlite.prepare(sql).run(...params);
    },
    async getFirstAsync(sql,...params) {return sqlite.prepare(sql).get(...params) ?? null;},
    async getAllAsync(sql,...params) {return sqlite.prepare(sql).all(...params);},
    async closeAsync() {sqlite.close();},
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try {await task();sqlite.exec('COMMIT');} catch(error) {sqlite.exec('ROLLBACK');throw error;}
    },
  };
  db.withExclusiveTransactionAsync = task => db.withTransactionAsync(() => task(db));
  const location = {
    Accuracy:{High:4},
    async getBackgroundPermissionsAsync() {return {granted:backgroundGranted,canAskAgain:true};},
    async isBackgroundLocationAvailableAsync() {return true;},
    async hasStartedLocationUpdatesAsync() {return backgroundStarted;},
    async startLocationUpdatesAsync(taskName, settings) {
      starts.push(settings); backgroundStarted = true;
      if (delayBackground) await new Promise(resolve => {releaseBackground=resolve;});
      if (startFailure) throw new Error('native start failed');
    },
    async stopLocationUpdatesAsync(taskName) {
      stops.push(taskName);
      if (stopFailure) throw new Error('native stop failed');
      backgroundStarted = false;
    },
    async getForegroundPermissionsAsync() {return {granted:foreground};},
    async hasServicesEnabledAsync() {return services;},
    async watchPositionAsync(options, callback, error) {
      const watch = {options,callback,error,removed:0,release:null};
      watches.push(watch);
      if (delayWatch) await new Promise(resolve=>{watch.release=resolve;});
      return {remove() {watch.removed+=1;}};
    },
  };
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(__dirname,'../..',filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = {exports:{}};cache.set(resolved,module);
    const {outputText} = ts.transpileModule(fs.readFileSync(resolved,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:resolved,
    });
    const localRequire = name => {
      if (name === 'expo-location') return location;
      if (name === 'expo-task-manager') return {isTaskDefined:name=>tasks.has(name),defineTask:(name,callback)=>tasks.set(name,callback),isAvailableAsync:async()=>options.available!==false};
      if (name === 'expo-constants') return constants;
      if (name === 'react-native') return {Platform:{OS:options.platform??'ios'},Linking:{},AppState:options.appState};
      if (name === 'react' && options.react) return options.react;
      if (name === 'expo-router' && options.router) return options.router;
      if (name === 'expo-sqlite') return {openDatabaseAsync:async()=>db};
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved),`${name}.ts`));
      return require(name);
    };
    new Function('require','module','exports',outputText)(localRequire,module,module.exports);
    return module.exports;
  }
  return {load,db,watches,tasks,starts,stops,
    setBackground:value=>{backgroundGranted=value;},
    setStartFailure:value=>{startFailure=value;},setStopFailure:value=>{stopFailure=value;},
    setDelayBackground:value=>{delayBackground=value;},releaseBackground:()=>releaseBackground?.(),
    backgroundStarted:()=>backgroundStarted,reload:()=>{cache.clear();tasks.clear();},
    close:()=>sqlite.close(),setForeground:value=>{foreground=value;},setServices:value=>{services=value;},setFailWrite:value=>{failWrite=value;},setDelayWatch:value=>{delayWatch=value;}};
}

module.exports = { environment };
