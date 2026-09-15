'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {catalog}=require('../src/content/current');
const {createProgress}=require('../src/progress/schema');
const {loadLocal,STORAGE_KEYS:K}=require('../src/progress/repository');
const {solve}=require('../src/core/engine');

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
// Delay the real repository's storage boundary, not its commit/verification logic.
function fixture(seed){
  const progress=createProgress(catalog);
  progress.completed=catalog.campaignIds.slice(0,10);
  progress.currentLevelId='bus-011';
  const data=new Map(seed||[[K.current,progress]]);
  let onHide,gate;
  const platform={
    canvas:{getContext:()=>({})},width:390,height:844,dpr:1,
    onPointer(){},onResize(){},onHide(fn){onHide=fn;},onShow(){},requestFrame(){},
    storage:{
      async get(key){return structuredClone(data.get(key));},
      async set(key,value){
        if(gate&&gate.matches(key,value)){
          const held=gate;gate=null;held.entered.resolve();
          await held.release.promise;
        }
        data.set(key,structuredClone(value));
      },
      async remove(key){data.delete(key);},
    },
  };
  return {platform,data,hide:()=>onHide(),hold(matches){
    const entered=deferred(),release=deferred();gate={matches,entered,release};
    return {entered:entered.promise,release:release.resolve,fail:release.reject};
  }};
}
async function start(f=fixture()){
  const app=new GameApp(f.platform);await app.ready;
  app.startLevel('bus-011');await app.pendingSave;
  return {app,f};
}
async function reload(f){return (await loadLocal(f.platform.storage,catalog)).progress;}
// The ad SDK is independently tested; here only control when its result arrives.
function pendingAd(app){
  const entered=deferred(),result=deferred();
  app.ads={request(input){entered.resolve(input);return result.promise;}};
  return {entered:entered.promise,finish(input,status='earned',reason){
    result.resolve({...input,status,...(reason?{reason}:{})});
  },reject:result.reject};
}
async function useInitial(app){
  await app.advancedHint();app.action('dismissToast');
  app.place(app.level.people[0].id,app.level.seats[0].id);
  await app.advancedHint();app.action('dismissToast');
  app.action('reset');app.action('confirmReset');await app.pendingSave;
}

test('onHide during hint consumption preserves the receipt and charge after reload',async()=>{
  const {app,f}=await start();
  const held=f.hold((key,value)=>key===K.candidate&&value.hintAccess.consumedIds.length===1);
  const hint=app.advancedHint();await held.entered;
  f.hide();held.release();await hint;await app.pendingSave;
  const restored=await reload(f);
  assert.equal(restored.hintAccess.consumedIds.length,1);
  assert.ok(restored.hintAccess.grants[0].hintReceipt.hint.text);
  const resumed=new GameApp(f.platform);await resumed.ready;resumed.startLevel('bus-011');
  assert.equal(resumed.toast,restored.hintAccess.grants[0].hintReceipt.hint.text);
  await resumed.pendingSave;
});

test('onHide while saving a late ad reward preserves its original-level entitlement',async()=>{
  const {app,f}=await start();await useInitial(app);
  const ad=pendingAd(app),hint=app.advancedHint(),input=await ad.entered;
  app.action('levels');app.startLevel('bus-001');await app.pendingSave;
  const held=f.hold((key,value)=>key===K.candidate&&value.hintAccess.grants.some(g=>g.source==='rewarded'));
  ad.finish(input);await held.entered;f.hide();held.release();await hint;await app.pendingSave;
  const restored=await reload(f),reward=restored.hintAccess.grants.find(g=>g.source==='rewarded');
  assert.equal(reward.levelId,'bus-011');
  assert.equal(restored.hintAccess.consumedIds.includes(reward.grantId),false);
  assert.equal(app.level.id,'bus-001');
});

test('pendingSave includes a progress transaction and rejects overlapping commits',async()=>{
  const {app,f}=await start();
  const held=f.hold(key=>key===K.candidate);
  const next=structuredClone(app.progress);next.album.claimedIds=['album-01'];
  const commit=app.commitProgress(next);await held.entered;
  let settled=false;const pending=app.pendingSave.then(()=>{settled=true;});
  await Promise.resolve();
  const overlap=app.commitProgress({...next,album:{claimedIds:['album-02']}});
  held.release();
  assert.equal(settled,false);
  assert.equal(await overlap,false);
  assert.equal(await commit,true);await pending;
  assert.deepEqual((await reload(f)).album.claimedIds,['album-01']);
});

for(const timing of ['during','after']){
  test(`ad callback ${timing} reset cannot resurrect deleted progress or emit an old toast`,async()=>{
    const {app,f}=await start();await useInitial(app);
    const ad=pendingAd(app),hint=app.advancedHint(),input=await ad.entered;
    const held=f.hold(key=>key===K.reset),clearing=app.clearLocal();await held.entered;
    if(timing==='during'){ad.finish(input);await Promise.resolve();}
    f.hide();held.release();await clearing;
    const toast=app.toast;
    if(timing==='after')ad.finish(input);
    await hint;await app.pendingSave;
    const restored=await reload(f);
    assert.deepEqual(restored.completed,[]);
    assert.deepEqual(restored.hintAccess.grants,[]);
    assert.deepEqual(restored.placements,{});
    assert.equal(app.toast,toast);
    assert.equal(app.screen,'home');
  });
}

test('clearLocal drains a delayed autosave and blocks onHide writes throughout deletion',async()=>{
  const {app,f}=await start();
  const held=f.hold(key=>key===K.candidate);
  app.place(app.level.people[0].id,app.level.seats[0].id);
  await held.entered;
  const clearing=app.clearLocal();f.hide();held.release();await clearing;await app.pendingSave;
  const restored=await reload(f);
  assert.deepEqual(restored.completed,[]);
  assert.deepEqual(restored.placements,{});
  assert.equal(app.transactionBusy,false);
});

test('retired hint finally cannot unlock a new hint transaction after reset',async()=>{
  const {app,f}=await start();await useInitial(app);
  const oldAd=pendingAd(app),oldHint=app.advancedHint(),input=await oldAd.entered;
  await app.clearLocal();
  // Arrange a new campaign visit without depending on cloud or SDK configuration.
  app.progress.completed=catalog.campaignIds.slice(0,10);
  app.startLevel('bus-011');await app.pendingSave;
  const held=f.hold(key=>key===K.candidate);
  const newHint=app.advancedHint();
  try{
    assert.equal(app.hintBusy,true);
    assert.equal(app.transactionBusy,true);
    await held.entered;
    oldAd.finish(input);await oldHint;
    assert.equal(app.hintBusy,true);
  }finally{held.release();oldAd.finish(input);await oldHint;await newHint;}
  assert.equal(app.hintBusy,false);
  assert.equal((await reload(f)).hintAccess.grants.some(g=>g.source==='rewarded'),false);
});

test('a rejected retired ad cannot replace the reset success message',async()=>{
  const {app}=await start();await useInitial(app);
  const ad=pendingAd(app),hint=app.advancedHint();await ad.entered;
  await app.clearLocal();const toast=app.toast;
  ad.reject(new Error('late SDK rejection'));await hint;
  assert.equal(app.toast,toast);
});

test('failed receipt write releases the transaction without consuming the free hint',async()=>{
  const {app,f}=await start();
  const held=f.hold((key,value)=>key===K.candidate&&value.hintAccess.consumedIds.length===1);
  const hint=app.advancedHint();await held.entered;f.hide();held.fail(new Error('quota exceeded'));
  await hint;await app.pendingSave;
  assert.equal(app.transactionBusy,false);
  assert.equal(app.hintBusy,false);
  assert.deepEqual((await reload(f)).hintAccess.consumedIds,[]);
  assert.equal(app.access().free,true);
});

test('readOnly prevents autosave and transaction writes while explicit reset still recovers corruption',async()=>{
  const future={version:99,owner:'newer-build'};
  const f=fixture([[K.current,future]]),app=new GameApp(f.platform);await app.ready;
  const before=structuredClone([...f.data]);
  app.startLevel('bus-001');f.hide();await app.persist();
  assert.equal(await app.commitProgress(createProgress(catalog)),false);
  await app.clearLocal();
  assert.deepEqual([...f.data],before);
  assert.equal(app.readOnly,true);
  const corrupt=fixture([[K.current,'not json']]),recovery=new GameApp(corrupt.platform);await recovery.ready;
  assert.equal(recovery.readOnly,true);
  await recovery.clearLocal();
  assert.equal(recovery.readOnly,false);
  recovery.startLevel('bus-001');await recovery.pendingSave;
  assert.equal((await reload(corrupt)).currentLevelId,'bus-001');
});

test('interrupted reset leaves the app readOnly until a successful retry',async()=>{
  const {app,f}=await start();
  const originalRemove=f.platform.storage.remove;
  f.platform.storage.remove=async key=>{if(key===K.current)throw new Error('storage unavailable');return originalRemove(key);};
  await app.clearLocal();
  assert.equal(app.readOnly,true);
  assert.equal(app.transactionBusy,false);
  const before=structuredClone([...f.data]);f.hide();await app.persist();
  assert.equal(await app.commitProgress(createProgress(catalog)),false);
  assert.deepEqual([...f.data],before);
  f.platform.storage.remove=originalRemove;await app.clearLocal();
  assert.equal(app.readOnly,false);
  assert.deepEqual((await reload(f)).completed,[]);
});

test('ineligible unconfigured-ad fallback gives feedback without minting an entitlement',async()=>{
  const {app,f}=await start();await useInitial(app);
  const before=structuredClone(app.progress.hintAccess);
  await app.advancedHint();await app.pendingSave;
  assert.match(app.toast,/未.*(权益|发放)|没有.*权益/);
  assert.deepEqual((await reload(f)).hintAccess,before);
});

test('daily result return clears completion state',async()=>{
  const {app}=await start();app.action('startDaily');
  for(const [person,seat] of Object.entries(solve(app.level)))app.place(person,seat);
  assert.equal(app.won,true);app.action('daily');
  assert.equal(app.screen,'daily');
  assert.equal(app.won,false);
  await app.pendingSave;
});
