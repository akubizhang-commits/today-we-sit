'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const daily = require('../src/features/daily');
const album = require('../src/features/album');
const tutorial = require('../src/features/tutorial');
const settings = require('../src/features/settings');
const hints = require('../src/features/hint-access');
const config = require('../src/services/config');
const ids = Array.from({length:14}, (_, i) => `daily-${i + 1}`);
const base = {anchorDay:'2026-09-15', ids};
const completed = Array.from({length:10}, (_, i) => `bus-${String(i+1).padStart(3,'0')}`);
const clone = x => JSON.parse(JSON.stringify(x));
test('Shanghai midnight, cycle boundary and server correction', () => {
  assert.deepEqual(daily.resolve({...base,deviceNow:Date.parse('2026-09-15T15:59:00Z')}), {dayKey:'2026-09-15',levelId:'daily-1',isReplay:false,timeSource:'device'});
  assert.equal(daily.resolve({...base,deviceNow:Date.parse('2026-09-15T16:01:00Z')}).levelId,'daily-2');
  assert.equal(daily.resolve({...base,serverDay:'2026-09-28'}).levelId,'daily-14');
  assert.deepEqual(daily.resolve({...base,serverDay:'2026-09-29',lastSeenDay:'2026-10-01'}), {dayKey:'2026-09-29',levelId:'daily-1',isReplay:true,timeSource:'server'});
});
test('offline rollback and invalid time fail safely without changing inputs', () => {
  assert.equal(daily.resolve({...base,deviceNow:0,lastSeenDay:'2026-09-17'}).dayKey,'2026-09-17');
  assert.equal(daily.resolve({...base,serverDay:'2026-02-30',deviceNow:NaN}).timeSource,'anchor');
  assert.throws(() => daily.resolve({...base,anchorDay:'bad'}));
  assert.throws(() => daily.resolve({...base,ids:['one']}));
});
test('album filters unknown, reserve, daily and duplicate completions; claims are immutable', () => {
  const cards = album.getCards([...completed,...completed,'daily-001','reserve-001','bus-031','bogus'], []);
  assert.equal(cards.length,12); assert.equal(cards.filter(c=>c.unlocked).length,2);
  assert.deepEqual(cards.map(c=>c.threshold),[5,10,15,20,30,40,50,60,70,80,85,90]);
  assert.ok(cards.every(c=>c.id && c.title && c.scene));
  const p = {completed,album:{claimedIds:[]}}; const original=clone(p);
  const next=album.claim(p,cards[0].id); assert.deepEqual(next.album.claimedIds,[cards[0].id]);
  assert.deepEqual(p,original); assert.notEqual(next,p);
  assert.deepEqual(album.claim(next,cards[0].id),next);
  assert.deepEqual(album.claim(p,cards[2].id),p); assert.deepEqual(album.claim(p,'unknown'),p);
  assert.equal(album.getCards(['custom','custom','unknown'],[],['custom']).filter(c=>c.unlocked).length,0);
});
test('tutorial only advances verified actions for the current step and survives restoration', () => {
  const p={tutorial:{completedSteps:[]}};
  assert.ok(tutorial.getText(1,{},null,p));
  assert.deepEqual(tutorial.advance(p,'place',1),p);
  const next=tutorial.advance(p,'select',1);
  assert.equal(tutorial.getText(1,{},null,clone(next)),''); assert.deepEqual(p.tutorial.completedSteps,[]);
  assert.deepEqual(tutorial.advance(next,'select',1),next);
  for(const [n,action] of [[2,'place'],[3,'conflict'],[4,'undo']]) assert.equal(tutorial.getText(n,{},null,tutorial.advance(p,action,n)),'');
  const relation=tutorial.advance(p,'relation',5); assert.ok(tutorial.getText(5,{},null,relation));
  assert.equal(tutorial.getText(5,{},null,tutorial.advance(relation,'emptyNeighbor',5)),'');
  assert.equal(tutorial.getText(6,{},null,p),'');
  for(const rule of ['tag','notTag','zone','adjacent','apart','emptyNeighbor']) {
    assert.ok(tutorial.getText(6,{ruleType:rule},null,p));
    assert.equal(tutorial.getText(6,{ruleType:rule},null,tutorial.advance(p,`rule:${rule}`,6)),'');
  }
});
test('settings toggle independent defaults without mutating or accepting unknown keys', () => {
  const p={settings:{music:false,effects:true,vibration:true,reducedMotion:false}};
  assert.equal(settings.toggle(p,'music').settings.music,true); assert.equal(p.settings.music,false);
  assert.equal(settings.toggle({},'reducedMotion').settings.reducedMotion,true);
  assert.deepEqual(settings.toggle(p,'__proto__'),p);
});
test('initial hint is one per level revision; first ten are unlimited; ads need first ten passes', () => {
  const p={completed:[],hintAccess:{grants:[],consumedIds:[],fallbackClaimed:[]}};
  assert.equal(hints.getAccess(p,{levelId:'bus-001',displayNumber:1}).unlimited,true);
  const context={levelId:'bus-011',displayNumber:11}; const access=hints.getAccess(p,context);
  assert.equal(access.free,true); assert.equal(access.canRequestAd,false);
  const granted=hints.grant(p,access.grant); assert.equal(granted.ok,true);
  const receipt={placementRevision:1,hint:{personId:'a',seatId:'s1',reason:'window'}};
  const used=hints.consume(granted.progress,{grantId:access.grant.grantId,levelId:context.levelId,hintReceipt:receipt});
  assert.equal(used.ok,true); assert.deepEqual(used.receipt,receipt);
  assert.equal(hints.getAccess(used.progress,context).free,false);
  assert.equal(hints.getAccess(used.progress,{...context,contentRevision:2}).free,true);
  assert.equal(hints.getAccess({...p,completed},context).canRequestAd,true);
  assert.equal(hints.getAccess(p,{levelId:'daily-001',displayNumber:1,isDaily:true}).unlimited,false);
  assert.deepEqual(p.hintAccess.grants,[]);
});
test('hint rewarded/fallback reports bind level/request and dedupe; consume stores exact isolated receipt', () => {
  const p={}; const adResult={status:'earned',requestId:'r1',levelId:'daily-001'};
  const req={grantId:'r1',levelId:'daily-001',source:'rewarded',adResult};
  assert.equal(hints.grant(p,{...req,adResult:{...adResult,status:'cancelled'}}).ok,false);
  assert.equal(hints.grant(p,{...req,levelId:'bus-011'}).ok,false);
  const g=hints.grant(p,req); assert.equal(g.ok,true);
  assert.equal(hints.grant(g.progress,req).ok,false);
  assert.equal(hints.consume(g.progress,{grantId:'r1',levelId:'bus-011',hintReceipt:{}}).ok,false);
  assert.equal(hints.consume(g.progress,{grantId:'r1',levelId:'daily-001',hintReceipt:null}).ok,false);
  const receipt={placementRevision:1,hint:{text:'exact'}};
  const c=hints.consume(g.progress,{grantId:'r1',levelId:'daily-001',hintReceipt:receipt});
  receipt.hint.text='changed'; assert.equal(c.receipt.hint.text,'exact');
  const again=hints.consume(c.progress,{grantId:'r1',levelId:'daily-001',hintReceipt:{placementRevision:2}});
  assert.equal(again.ok,false); assert.equal(again.reason,'already-consumed'); assert.deepEqual(again.receipt,c.receipt);
  const fresh=hints.consume(c.progress,{grantId:'r1',levelId:'daily-001',recompute:true,hintReceipt:{placementRevision:2,hint:{text:'new'}}});
  assert.equal(fresh.ok,true); assert.equal(fresh.progress.hintAccess.consumedIds.length,1);
  assert.equal(hints.consume(fresh.progress,{grantId:'r1',levelId:'daily-001',recompute:true,hintReceipt:{placementRevision:3}}).ok,false);
  const fallback={grantId:'fallback-r',levelId:'daily-001',source:'fallback',adResult:{status:'unavailable',levelId:'daily-001',requestId:'failed'}};
  assert.equal(hints.grant(p,{...fallback,adResult:{...fallback.adResult,status:'cancelled'}}).ok,false);
  const f=hints.grant(p,fallback); assert.equal(f.ok,true);
  assert.equal(hints.getAccess(f.progress,{levelId:'daily-001',isDaily:true}).canFallback,false);
  assert.equal(hints.grant(f.progress,{...fallback,grantId:'another'}).ok,false);
});
test('config only reduces intensity, filters paused content and falls back on malformed/expired values', () => {
  const opts={now:100,publishedIds:['bus-001']};
  const valid={schemaVersion:1,version:1,expiresAt:1000,ads:{enabled:true,minIntervalMs:120000,maxPerSession:2},telemetry:{sampleRate:0.5},pausedLevelIds:['bus-001','reserve-001'],code:'evil'};
  const value=config.resolve(valid,opts); assert.equal(value.ads.maxPerSession,2); assert.equal(value.ads.minIntervalMs,120000);
  assert.deepEqual(value.pausedLevelIds,['bus-001']); assert.equal(value.code,undefined);
  for(const raw of [null,{...valid,expiresAt:99},{...valid,ads:{enabled:true,minIntervalMs:1}},{...valid,ads:{enabled:true,maxPerSession:4}},{...valid,telemetry:{sampleRate:2}}]) {
    assert.equal(config.resolve(raw,opts).ads.enabled,false); assert.equal(config.resolve(raw,opts).telemetry.sampleRate,0);
  }
  let now=100; const service=config.createConfigService({now:()=>now,publishedIds:opts.publishedIds});
  service.update(valid); assert.equal(service.get().ads.enabled,true);
  service.update({...valid,version:0}); assert.equal(service.get().version,1);
  now=1001; assert.equal(service.get().ads.enabled,false);
});
test('policy denials do not mint fallback rights, but load/no-fill failures do', () => {
  for(const reason of ['busy','cooldown','session-cap','duplicate-request','invalid-request','not-configured','invalid-adapter','invalid-clock']) {
    const result=hints.grant({}, {grantId:'f',levelId:'bus-011',source:'fallback',adResult:{requestId:'r',levelId:'bus-011',status:'unavailable',reason}});
    assert.equal(result.ok,false,reason);
  }
  const result=hints.grant({}, {grantId:'f',levelId:'bus-011',source:'fallback',adResult:{requestId:'r',levelId:'bus-011',status:'error',reason:'sdk-error'}});
  assert.equal(result.ok,true);
});
test('paid grants survive revision changes and cannot collide with deterministic initial grant IDs', () => {
  const earned={status:'earned',requestId:'paid',levelId:'bus-011'};
  const g=hints.grant({}, {grantId:'paid',levelId:'bus-011',source:'rewarded',contentRevision:1,adResult:earned});
  const access=hints.getAccess(g.progress,{levelId:'bus-011',displayNumber:11,contentRevision:2});
  assert.equal(access.grant.grantId,'paid');
  const initial=hints.getAccess({}, {levelId:'bus-011',displayNumber:11}).grant;
  const other=hints.grant({}, {...initial,levelId:'bus-012'});
  assert.equal(other.ok,false);
});
test('receipt rejects lossy JSON including sparse arrays and undefined fields', () => {
  const initial=hints.getAccess({}, {levelId:'bus-011',displayNumber:11}).grant;
  const granted=hints.grant({},initial).progress;
  for(const receipt of [{hint:undefined},{hint:[, 'seat']},{hint:NaN},{hint:new Date()}]) {
    assert.equal(hints.consume(granted,{grantId:initial.grantId,levelId:'bus-011',hintReceipt:receipt}).ok,false);
  }
});

test('load/show timeouts grant one fallback per level revision and never count as rewarded evidence',()=>{
  for(const reason of ['load-timeout','show-timeout']){
    const input={grantId:'fallback-first',levelId:'bus-011',source:'fallback',contentRevision:2,
      adResult:{requestId:'timed-out',levelId:'bus-011',status:'error',reason}};
    const original={completed:[],hintAccess:{grants:[],consumedIds:[],fallbackClaimed:[]}},before=clone(original);
    const first=hints.grant(original,input);assert.equal(first.ok,true,reason);assert.deepEqual(original,before);
    assert.equal(first.grant.source,'fallback');assert.equal(first.progress.hintAccess.grants.length,1);
    assert.equal(hints.grant(first.progress,input).reason,'duplicate-grant');
    const retry={...input,grantId:'fallback-again',adResult:{...input.adResult,requestId:'retry',reason:reason==='load-timeout'?'show-timeout':'load-timeout'}};
    assert.equal(hints.grant(first.progress,retry).reason,'fallback-claimed');
    assert.equal(hints.getAccess(first.progress,{levelId:'bus-011',displayNumber:11,contentRevision:2}).canFallback,false);
    const spent=hints.consume(first.progress,{grantId:input.grantId,levelId:input.levelId,hintReceipt:{placementRevision:1,hint:{text:'有理由的一步'}}});
    assert.equal(spent.ok,true);assert.equal(hints.grant(spent.progress,retry).reason,'fallback-claimed');
    assert.equal(hints.grant(first.progress,{...retry,contentRevision:3}).ok,true);
    assert.equal(hints.grant(original,{...input,grantId:input.adResult.requestId,source:'rewarded'}).reason,'invalid-ad-result');
    assert.equal(hints.grant(original,{...input,levelId:'bus-012'}).reason,'invalid-ad-result');
    for(const status of ['earned','cancelled'])assert.equal(hints.grant(original,{...input,adResult:{...input.adResult,status}}).reason,'invalid-ad-result');
  }
});

test('timeout whitelist expansion preserves existing failures and rejects missing platform and policy denials',()=>{
  const request={grantId:'f',levelId:'bus-011',source:'fallback'};
  for(const status of ['error','unavailable']){
    for(const reason of [undefined,'sdk-error','ad-error','no-fill','load-failed','show-failed','load-timeout','show-timeout']){
      assert.equal(hints.grant({}, {...request,adResult:{status,reason,requestId:'r',levelId:request.levelId}}).ok,true,`${status}/${reason}`);
    }
    for(const reason of ['not-configured','busy','cooldown','session-cap','duplicate-request','invalid-request','invalid-adapter','invalid-clock','timer-error','unknown-timeout']){
      const original={hintAccess:{grants:[],consumedIds:[],fallbackClaimed:[]}},before=clone(original);
      const denied=hints.grant(original,{...request,adResult:{status,reason,requestId:'r',levelId:request.levelId}});
      assert.equal(denied.reason,'ineligible-fallback',`${status}/${reason}`);
      assert.deepEqual(original,before);assert.deepEqual(denied.progress,before);
    }
  }
});

test('real ad service timeout results qualify for fallback without inventing an ad completion',async()=>{
  const {createAdService}=require('../src/services/ads');
  for(const phase of ['load','show']){
    const jobs=new Map();let nextId=0;
    const service=createAdService({
      createAd:()=>({load:()=>phase==='load'?new Promise(()=>{}):Promise.resolve(),show:()=>Promise.resolve(),onClose(){},offClose(){},onError(){},offError(){}}),
      setTimeout(fn){const id=nextId++;jobs.set(id,fn);return id;},clearTimeout(id){jobs.delete(id);}
    });
    const pending=service.request({requestId:`timeout-${phase}`,levelId:'daily-001'});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.size,1);[...jobs.values()][0]();
    const adResult=await pending;assert.equal(adResult.status,'error');assert.equal(adResult.reason,`${phase}-timeout`);
    const result=hints.grant({}, {grantId:`fallback-${phase}`,levelId:'daily-001',source:'fallback',adResult});
    assert.equal(result.ok,true);assert.equal(result.grant.source,'fallback');assert.equal(service.getState().completed,0);assert.equal(jobs.size,0);
  }
});
