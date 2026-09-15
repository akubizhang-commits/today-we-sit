const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {solve}=require('../src/core/engine');
function platform(seed={}){
  const data=new Map(Object.entries(seed));
  return {canvas:{getContext:()=>({})},width:390,height:844,dpr:1,
    storage:{get:k=>data.get(k),set:(k,v)=>data.set(k,JSON.parse(JSON.stringify(v))),remove:k=>data.delete(k)},
    onPointer(){},onResize(){},onHide(){},onShow(){},requestFrame(){},
  };
}
test('real application loads legacy garden progress into stable identities',async()=>{
  const p=platform({'seating-progress':{version:1,currentLevel:13,completed:Array.from({length:12},(_,i)=>i+1),placements:{13:{p1:'s4'}}}});
  const app=new GameApp(p);await app.ready;
  assert.equal(app.progress.version,2);
  assert.equal(app.progress.currentLevelId,'garden-003');
  assert.ok(app.progress.completed.includes('garden-002'));
  assert.equal(app.startLevel('garden-003'),true);
  assert.equal(app.session.placement.p1,'s4');
});
test('new player completes campaign first level and sees a stable next identity',async()=>{
  const app=new GameApp(platform());await app.ready;
  assert.equal(app.startLevel('garden-001'),false);
  assert.equal(app.startLevel('bus-001'),true);
  for(const [p,s] of Object.entries(solve(app.level)))app.place(p,s);
  await app.pendingSave;
  assert.equal(app.won,true);
  assert.ok(app.progress.completed.includes('bus-001'));
  assert.equal(app.progress.currentLevelId,'bus-002');
});
test('confirmed reset and undo preserve original position, opening reset does not mutate',async()=>{
  const app=new GameApp(platform());await app.ready;
  app.progress.completed=['bus-001'];app.startLevel('bus-002');
  app.place('p1','s1');
  app.action('reset');assert.equal(app.session.placement.p1,'s1');
  app.action('confirmReset');assert.deepEqual(app.session.placement,{});
  app.action('undo');assert.equal(app.session.placement.p1,'s1');
  await app.pendingSave;
});
test('read-only future snapshot is never overwritten by play',async()=>{
  const future={version:99,owner:'newer-build'};
  const p=platform({'seating-progress-v2':future}),app=new GameApp(p);await app.ready;
  app.startLevel('bus-001');app.place('p1','s1');await app.pendingSave;
  assert.deepEqual(p.storage.get('seating-progress-v2'),future);
});
module.exports={platform};
test('replaying a completed layout starts a new session and navigation closes play overlays',async()=>{
  const app=new GameApp(platform());await app.ready;
  app.startLevel('bus-001');const sessionId=app.playSessionId;
  for(const [p,s] of Object.entries(solve(app.level)))app.place(p,s);
  app.startLevel('bus-001');
  assert.notEqual(app.playSessionId,sessionId);assert.equal(app.moveRevision,0);
  assert.deepEqual(app.session.placement,{});
  app.rulesExpanded=true;app.action('levels');assert.equal(app.rulesExpanded,false);
  app.won=true;app.action('home');assert.equal(app.won,false);
  await app.pendingSave;
});
test('consumed hint can be reread and recomputed once without requesting another ad',async()=>{
  const p=platform();let ads=0;p.createRewardedAd=()=>{ads++;return null;};
  const app=new GameApp(p);await app.ready;
  app.progress.completed=app.catalog.campaignIds.slice(0,10);app.startLevel('bus-011');
  await app.advancedHint();
  const first=app.progress.hintAccess.grants.find(g=>g.hintReceipt);
  assert.ok(first);const count=app.progress.hintAccess.consumedIds.length;
  await app.advancedHint();assert.equal(app.progress.hintAccess.consumedIds.length,count);assert.equal(ads,0);
  const person=app.level.people[0].id;app.place(person,app.level.seats[0].id);
  await app.advancedHint();
  const changed=app.progress.hintAccess.grants.find(g=>g.grantId===first.grantId);
  assert.equal(changed.recomputed,true);assert.equal(changed.hintReceipt.placementRevision,app.moveRevision);
  assert.equal(app.progress.hintAccess.consumedIds.length,count);assert.equal(ads,0);
  await app.pendingSave;
});
test('unfinished previous daily can resume its original day after reboot and complete separately',async()=>{
  const p=platform(),app=new GameApp(p);await app.ready;
  app.progress.completed=app.catalog.campaignIds.slice(0,5);
  const daily=require('../src/features/daily');
  const tomorrow=new Date(Date.parse(app.catalog.dailyCycleAnchorDay+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const id=app.catalog.dailyIds[0],level=app.catalog.get(id);
  app.progress.daily.lastSeenDay=tomorrow;
  app.progress.placements[id]={contentRevision:level.revision,sessionId:'unfinished',moveSequence:1,placement:{[level.people[0].id]:level.seats[0].id},savedAt:1,dayKey:app.catalog.dailyCycleAnchorDay};
  app.refreshDaily();assert.deepEqual(app.dailyResume,{levelId:id,dayKey:app.catalog.dailyCycleAnchorDay});
  app.persist();await app.pendingSave;
  const restored=new GameApp(p);await restored.ready;restored.action('resumeDaily');
  assert.equal(restored.level.id,id);assert.equal(restored.activeDay,app.catalog.dailyCycleAnchorDay);
  assert.equal(restored.playSessionId,'unfinished');
  for(const [person,seat] of Object.entries(solve(restored.level)))restored.place(person,seat);
  assert.ok(restored.progress.daily.completedDays.includes(app.catalog.dailyCycleAnchorDay));
  assert.equal(restored.progress.completed.length,5);
  restored.action('daily');assert.equal(restored.won,false);await restored.pendingSave;
});
