'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {catalog}=require('../src/content/current');
const {createProgress}=require('../src/progress/schema');
const {STORAGE_KEYS:K}=require('../src/progress/repository');
const {solve}=require('../src/core/engine');

function fixture(progress=createProgress(catalog)){
  const data=new Map([[K.current,structuredClone(progress)]]);
  return {canvas:{getContext:()=>({})},width:390,height:844,dpr:1,
    storage:{get:key=>structuredClone(data.get(key)),set:(key,value)=>data.set(key,structuredClone(value)),remove:key=>data.delete(key)},
    onPointer(){},onResize(){},onHide(){},onShow(){},requestFrame(){},
  };
}
async function campaign(){
  const progress=createProgress(catalog);progress.completed=catalog.campaignIds.slice(0,10);
  const platform=fixture(progress),app=new GameApp(platform);await app.ready;app.startLevel('bus-011');await app.pendingSave;
  return {app,platform};
}

test('starting the same daily ID fourteen days later preserves both dated sessions through reboot',async t=>{
  let now=Date.parse('2026-09-15T04:00:00Z');t.mock.method(Date,'now',()=>now);
  const progress=createProgress(catalog);progress.completed=catalog.campaignIds.slice(0,5);
  const platform=fixture(progress),first=new GameApp(platform);await first.ready;first.action('startDaily');
  const id=first.level.id,person=first.level.people[0].id;
  first.place(person,'s1');await first.pendingSave;await first.advancedHint();
  const oldHint=first.toast;
  assert.equal(first.progress.hintAccess.consumedIds.length,1);
  const oldSession=first.playSessionId;
  now+=14*86400000;
  const next=new GameApp(platform);await next.ready;
  assert.deepEqual(next.dailyResume,{levelId:id,dayKey:'2026-09-15'});
  next.action('startDaily');assert.equal(next.level.id,id);assert.equal(next.activeDay,'2026-09-29');
  assert.notEqual(next.playSessionId,oldSession);
  assert.equal(next.reusableHint(),null);assert.equal(next.access().free,false);
  next.place(person,'s2');await next.pendingSave;
  const newSession=next.playSessionId;
  next.action('daily');
  assert.deepEqual(next.dailyResume,{levelId:id,dayKey:'2026-09-15'});
  const restored=new GameApp(platform);await restored.ready;restored.action('resumeDaily');
  assert.equal(restored.activeDay,'2026-09-15');assert.equal(restored.playSessionId,oldSession);
  assert.deepEqual(restored.session.placement,{[person]:'s1'});
  assert.equal(restored.toast,oldHint);
  for(const [p,s] of Object.entries(solve(restored.level)))restored.place(p,s);
  await restored.pendingSave;
  assert.deepEqual(restored.progress.daily.completedDays,['2026-09-15']);
  restored.action('daily');restored.action('startDaily');
  assert.equal(restored.activeDay,'2026-09-29');assert.equal(restored.playSessionId,newSession);
  assert.deepEqual(restored.session.placement,{[person]:'s2'});
  for(const [p,s] of Object.entries(solve(restored.level)))restored.place(p,s);
  await restored.pendingSave;
  assert.deepEqual(restored.progress.daily.completedDays,['2026-09-15','2026-09-29']);
});

test('daily entry rejects a caller-supplied old date unless it is an eligible resume',async t=>{
  t.mock.method(Date,'now',()=>Date.parse('2026-09-29T04:00:00Z'));
  const progress=createProgress(catalog);progress.completed=catalog.campaignIds.slice(0,5);
  const app=new GameApp(fixture(progress));await app.ready;
  assert.equal(app.startLevel(app.dailyView.levelId,{dayKey:'2026-09-15'}),false);
  assert.equal(app.screen,'home');
});

test('undo back to a hinted layout rereads it without spending the recomputation',async()=>{
  const {app,platform}=await campaign();await app.advancedHint();
  const grantId=app.progress.hintAccess.consumedIds[0],firstText=app.toast;
  app.action('dismissToast');app.place(app.level.people[0].id,'s1');app.action('undo');
  assert.deepEqual(app.session.placement,{});
  await app.advancedHint();
  assert.equal(app.toast,firstText);
  assert.equal(app.progress.hintAccess.grants.find(g=>g.grantId===grantId).recomputed,undefined);
  await app.pendingSave;
  const restored=new GameApp(platform);await restored.ready;restored.startLevel('bus-011');
  assert.equal(restored.toast,firstText);
  restored.action('dismissToast');restored.place(restored.level.people[0].id,'s1');
  await restored.advancedHint();
  assert.equal(restored.progress.hintAccess.grants.find(g=>g.grantId===grantId).recomputed,true);
  await restored.pendingSave;
});

test('compatible content revision upgrade never auto-displays an old hint receipt',async()=>{
  const {app,platform}=await campaign();await app.advancedHint();await app.pendingSave;
  const upgraded={...catalog,get:id=>{const level=catalog.get(id);return level&&{...level,revision:level.revision+1};}};
  const restored=new GameApp(platform,{catalog:upgraded});await restored.ready;
  restored.startLevel('bus-011');
  assert.equal(restored.toast,'');
  assert.equal(restored.reusableHint(),null);
  await restored.pendingSave;
});

test('a previously earned grant used on newer content can reread its newly computed receipt',async()=>{
  const {app,platform}=await campaign();
  // Earned rights survive revisions; the new receipt must carry the version used to compute it.
  app.progress.hintAccess.grants=[{grantId:'earned-before-update',levelId:'bus-011',contentRevision:1,source:'rewarded'}];
  await app.persist();
  const upgraded={...catalog,get:id=>{const level=catalog.get(id);return level&&{...level,revision:level.revision+1};}};
  const restored=new GameApp(platform,{catalog:upgraded});await restored.ready;restored.startLevel('bus-011');
  await restored.advancedHint();
  assert.deepEqual(restored.progress.hintAccess.consumedIds,['earned-before-update']);
  assert.ok(restored.reusableHint());
  restored.action('dismissToast');await restored.advancedHint();
  assert.deepEqual(restored.progress.hintAccess.consumedIds,['earned-before-update']);
  await restored.pendingSave;
});

test('an exact older receipt wins over spending a newer grant recomputation',async()=>{
  const {app}=await campaign();await app.advancedHint();app.action('dismissToast');
  app.place(app.level.people[0].id,'s1');await app.advancedHint();
  const exactText=app.toast;
  app.action('dismissToast');app.action('reset');app.action('confirmReset');
  app.ads={async request(input){return {...input,status:'earned'};}};
  await app.advancedHint();app.action('dismissToast');
  app.place(app.level.people[0].id,'s1');await app.advancedHint();
  assert.equal(app.toast,exactText);
  assert.equal(app.progress.hintAccess.grants.find(g=>g.source==='rewarded').recomputed,undefined);
  assert.equal(app.progress.hintAccess.consumedIds.length,2);
  await app.pendingSave;
});

test('multiple archived cycles resume newest unfinished date first without mixing same-ID boards',async t=>{
  let now=Date.parse('2026-09-15T04:00:00Z');t.mock.method(Date,'now',()=>now);
  const progress=createProgress(catalog);progress.completed=catalog.campaignIds.slice(0,5);
  const platform=fixture(progress),app=new GameApp(platform);await app.ready;
  for(const seat of ['s1','s2','s3']){
    app.action('startDaily');app.place(app.level.people[0].id,seat);await app.pendingSave;
    now+=14*86400000;app.action('daily');
  }
  const restored=new GameApp(platform);await restored.ready;
  for(const [dayKey,seat] of [['2026-10-13','s3'],['2026-09-29','s2'],['2026-09-15','s1']]){
    assert.equal(restored.dailyResume.dayKey,dayKey);
    restored.action('resumeDaily');assert.deepEqual(restored.session.placement,{[restored.level.people[0].id]:seat});
    for(const [p,s] of Object.entries(solve(restored.level)))restored.place(p,s);
    await restored.pendingSave;restored.action('daily');
  }
  assert.equal(restored.dailyResume,null);
});
