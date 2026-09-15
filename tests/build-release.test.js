'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {checkRelease}=require('../scripts/check-release');
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sit-build-release-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function write(dir,file,value){const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value);}
function copyProject(dir){
  for(const name of ['scripts','src','content','assets','tools/editor','web','game.js','game.json','project.config.json']){
    fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  }
}
function runBuild(dir){return spawnSync(process.execPath,['scripts/build.js'],{cwd:dir,encoding:'utf8',timeout:30000});}
function runtimeFromBundle(source){
  // Execute the emitted module factories, substituting only the platform bootstrap
  // so the real runtime catalogue can be inspected without a canvas or wx host.
  const bootstrap=/require\("(?:game\.js|web\/entry\.js)"\);\}\)\(\);\s*$/;
  assert.match(source,bootstrap);
  const sandbox={};
  vm.runInNewContext(source.replace(bootstrap,'globalThis.runtime=require("src/content/current.js");})();'),sandbox,{timeout:1000});
  return JSON.parse(JSON.stringify({levels:sandbox.runtime.levels,manifest:sandbox.runtime.manifest}));
}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function request(handler,url,method='GET'){
  return new Promise((resolve,reject)=>{
    const res={writeHead(status,headers={}){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,headers:this.headers,body:body===undefined?'':String(body)});}};
    try{handler({url,method},res);}catch(error){reject(error);}
  });
}
const evidence=Object.fromEntries(['platformEligibility','wechatDevices','adsLive','cloudLive','manualContentQA','rights','privacyReview','releaseRegression'].map(k=>[k,true]));
function configured(dir){
  write(dir,'project.config.json',JSON.stringify({appid:'wx0123456789abcdef'}));
  write(dir,'src/config.js',"module.exports={environment:'production',adUnitId:'test-ad-unit',backendUrl:'https://service.example.test',feedbackContact:'test@example.test'};\n");
  write(dir,'docs/v1/release-evidence.json',JSON.stringify(evidence));
}

test('actual build excludes author references, reserve content, editor and stale files from production',t=>{
  const dir=temporary(t);copyProject(dir);
  write(dir,'dist/wechat/editor/index.html','STALE_EDITOR');write(dir,'dist/wechat/reserve.json','STALE_RESERVE');
  write(dir,'dist/wechat/reference.json','STALE_REFERENCE');write(dir,'dist/neighbor.txt','KEEP_NEIGHBOR');
  write(dir,'assets/marketing/private.json','MARKETING_ONLY');
  const before=fs.readFileSync(path.join(dir,'content/authoring/levels.json'),'utf8');
  const result=runBuild(dir);assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(dir,'dist/build-manifest.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'content/manifest.json'),'utf8'));
  const expected=[...manifest.campaign,...manifest.daily];assert.equal(expected.length,104);
  assert.equal(report.publishedLevels,104);
  assert.ok(report.modules.every(id=>!id.startsWith('tools/editor/')&&!id.startsWith('content/')&&id!=='src/content/levels.js'));
  for(const file of ['dist/wechat/game.js','web/game.bundle.js']){
    const source=fs.readFileSync(path.join(dir,file),'utf8'),runtime=runtimeFromBundle(source);
    assert.deepEqual(runtime.levels.map(l=>l.id),expected);
    assert.ok(runtime.levels.every(l=>!Object.hasOwn(l,'reference')&&l.kind!=='reserve'));
    assert.equal(Object.hasOwn(runtime.manifest,'reserve'),false);
    for(const id of manifest.reserve)assert.ok(!source.includes(JSON.stringify(id)),`reserve identity leaked: ${id}`);
    assert.doesNotMatch(source,/STALE_EDITOR|STALE_REFERENCE|STALE_RESERVE|MARKETING_ONLY|tools\/editor\//);
  }
  assert.ok(fs.existsSync(path.join(dir,'web/editor.bundle.js')),'editor remains available only in preview');
  const artifact=path.join(dir,'dist/wechat'),actualFiles=files(artifact).map(file=>path.relative(artifact,file).split(path.sep).join('/')).sort();
  assert.deepEqual(actualFiles,report.files.map(f=>f.path).sort());
  assert.ok(actualFiles.every(file=>file==='game.js'||file==='game.json'||file==='project.config.json'||file.startsWith('assets/audio/')));
  for(const item of report.files){const data=fs.readFileSync(path.join(artifact,item.path));assert.equal(item.bytes,data.length);assert.equal(item.sha256,crypto.createHash('sha256').update(data).digest('hex'));}
  assert.equal(report.totalBytes,report.files.reduce((sum,f)=>sum+f.bytes,0));
  assert.equal(fs.readFileSync(path.join(dir,'dist/neighbor.txt'),'utf8'),'KEEP_NEIGHBOR');
  assert.equal(fs.readFileSync(path.join(dir,'content/authoring/levels.json'),'utf8'),before);
  assert.equal(runBuild(dir).status,0);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'dist/build-manifest.json'),'utf8')),report);
});

test('production builds reject accidentally reachable editor and authoring dependencies before replacing artifacts',t=>{
  const dir=temporary(t);copyProject(dir);
  const app=fs.readFileSync(path.join(dir,'src/app.js'),'utf8');
  for(const dependency of ['../tools/editor/model','./content/levels','../content/manifest.json']){
    write(dir,'src/app.js',`require(${JSON.stringify(dependency)});\n`+app);
    write(dir,'dist/wechat/game.js','PREVIOUS_CANDIDATE');write(dir,'web/game.bundle.js','PREVIOUS_BROWSER');
    const result=runBuild(dir);assert.notEqual(result.status,0,`unexpectedly bundled ${dependency}`);
    assert.match(result.stderr,/production|author|editor|生产|作者|编辑器/i);
    assert.equal(fs.readFileSync(path.join(dir,'dist/wechat/game.js'),'utf8'),'PREVIOUS_CANDIDATE');
    assert.equal(fs.readFileSync(path.join(dir,'web/game.bundle.js'),'utf8'),'PREVIOUS_BROWSER');
  }
});

test('bundler rejects builtin imports and symlinks escaping the project',t=>{
  const dir=temporary(t);copyProject(dir);
  const {bundle}=require(path.join(dir,'scripts/build.js'));
  write(dir,'web/builtin.js',"require('node:fs');");assert.throws(()=>bundle('web/builtin.js'),/Non-local/);
  const external=temporary(t);write(external,'outside.js','module.exports="OUTSIDE";');
  fs.symlinkSync(path.join(external,'outside.js'),path.join(dir,'web/escape.js'));
  assert.throws(()=>bundle('web/escape.js'),/outside|project|项目|范围/i);
});

test('default release CLI fails with actionable readiness issues',()=>{
  const result=spawnSync(process.execPath,['scripts/check-release.js'],{cwd:root,encoding:'utf8',timeout:5000});
  assert.equal(result.status,1,result.stdout+result.stderr);
  const report=JSON.parse(result.stdout);assert.equal(report.ready,false);
  for(const diagnostic of [/AppID/,/广告位/,/HTTPS/,/联系方式/,/开发环境/,/真机/,/人工体验/])assert.ok(report.issues.some(s=>diagnostic.test(s)));
});

test('preflight rereads configuration and requires literal true for every evidence item',t=>{
  const dir=temporary(t);configured(dir);
  const checked=checkRelease(dir);
  assert.equal(checked.checklistPassed,true);
  assert.equal(checked.ready,false,'human checklist cannot approve unimplemented application integration');
  assert.equal(checked.serviceConnectivityVerified,false);
  assert.match(checked.issues.join(' '),/尚未接入云/);
  write(dir,'src/config.js',"module.exports={environment:'development'};");
  assert.equal(checkRelease(dir).checklistPassed,false,'must not reuse a previously approved cached config');
  configured(dir);
  for(const key of Object.keys(evidence)){
    write(dir,'docs/v1/release-evidence.json',JSON.stringify({...evidence,[key]:'true'}));
    assert.equal(checkRelease(dir).checklistPassed,false,key);
  }
});

test('preflight reports missing/malformed inputs and invalid HTTPS URLs without throwing',t=>{
  const dir=temporary(t);
  assert.equal(checkRelease(dir).ready,false);
  for(const [file,value] of [['project.config.json','{'],['project.config.json','null'],['src/config.js','module.exports=null;'],['src/config.js','not valid JS!'],['docs/v1/release-evidence.json','null'],['docs/v1/release-evidence.json','[]']]){
    configured(dir);write(dir,file,value);const result=checkRelease(dir);assert.equal(result.checklistPassed,false,file);assert.ok(result.issues.length>0);
  }
  for(const backendUrl of ['https://','https:// invalid','https://user:password@example.test','http://example.test']){
    configured(dir);write(dir,'src/config.js',`module.exports=${JSON.stringify({environment:'production',adUnitId:'test',backendUrl,feedbackContact:'test'})};`);
    assert.equal(checkRelease(dir).checklistPassed,false,backendUrl);
  }
});

test('static routes serve editor, bundle and assets with correct headers while rejecting path escapes',async t=>{
  const dir=temporary(t);write(dir,'scripts/serve.js',fs.readFileSync(path.join(root,'scripts/serve.js')));
  write(dir,'web/index.html','HOME');write(dir,'web/editor.bundle.js','EDITOR_BUNDLE');write(dir,'tools/editor/index.html','EDITOR_PAGE');
  write(dir,'assets/audio/test.wav','AUDIO');write(dir,'project.config.json','PRIVATE_SENTINEL');
  const handler=require(path.join(dir,'scripts/serve.js')).createHandler();
  for(const [url,body,type] of [['/','HOME','text/html'],['/editor','EDITOR_PAGE','text/html'],['/editor/','EDITOR_PAGE','text/html'],['/editor.bundle.js?v=1','EDITOR_BUNDLE','text/javascript'],['/assets/audio/test.wav','AUDIO','audio/wav']]){
    const result=await request(handler,url);assert.equal(result.status,200,url);assert.equal(result.body,body);
    assert.ok(result.headers['Content-Type'].startsWith(type));assert.equal(result.headers['X-Content-Type-Options'],'nosniff');assert.equal(result.headers['Cache-Control'],'no-store');
  }
  for(const url of ['/%00','/%zz','/assets/%00'])assert.equal((await request(handler,url)).status,400,url);
  for(const url of ['/..%2fproject.config.json','/assets/..%2fproject.config.json','/assets/%2Fetc/passwd'])assert.equal((await request(handler,url)).status,403,url);
  for(const url of ['/scripts/build.js','/content/authoring/levels.json','/tools/editor/model.js','/missing','/editor/index.html','/%252e%252e%252fproject.config.json'])assert.equal((await request(handler,url)).status,404,url);
});

test('static service rejects symlink escapes and non-read methods; HEAD sends no body',async t=>{
  const dir=temporary(t);write(dir,'scripts/serve.js',fs.readFileSync(path.join(root,'scripts/serve.js')));
  write(dir,'web/index.html','HOME');write(dir,'private.txt','PRIVATE_SENTINEL');write(dir,'assets/audio/test.wav','AUDIO');
  fs.symlinkSync(path.join(dir,'private.txt'),path.join(dir,'web/leak.txt'));
  fs.symlinkSync(path.join(dir,'private.txt'),path.join(dir,'assets/leak.txt'));
  const handler=require(path.join(dir,'scripts/serve.js')).createHandler();
  for(const url of ['/leak.txt','/assets/leak.txt']){const result=await request(handler,url);assert.equal(result.status,403);assert.ok(!result.body.includes('PRIVATE_SENTINEL'));}
  const head=await request(handler,'/','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
  const post=await request(handler,'/','POST');assert.equal(post.status,405);assert.equal(post.headers.Allow,'GET, HEAD');
});
