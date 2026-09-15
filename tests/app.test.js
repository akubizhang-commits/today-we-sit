const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const authoring=require('../content/authoring/levels.json');
function platform(){const data={};return {canvas:{getContext:()=>({})},width:390,height:844,dpr:1,storage:{get:k=>data[k],set:(k,v)=>{data[k]=v;}},onPointer(){},onResize(){},onHide(){},requestFrame(){}};}
const reference=id=>authoring.find(l=>l.id===id).reference;
async function make(p=platform()){const app=new GameApp(p);await app.ready;return app;}
test('locked levels cannot be entered by navigation',async()=>{
 const app=await make();assert.equal(app.startLevel('cinema-030'),false);assert.equal(app.startLevel('bus-001'),true);assert.equal(app.level.id,'bus-001');await app.pendingSave;
});
test('a legal solution completes and unlocks next level only once',async()=>{
 const app=await make();app.startLevel('bus-001');for(const [p,s]of Object.entries(reference(app.level.id)))app.place(p,s);
 assert.equal(app.won,true);assert.deepEqual(app.progress.completed,['bus-001']);assert.equal(app.startLevel('bus-002'),true);await app.pendingSave;
});
test('unfinished placements survive a fresh app instance',async()=>{
 const p=platform(),app=await make(p);app.startLevel('bus-001');for(const [id,s]of Object.entries(reference(app.level.id)))app.place(id,s);
 app.startLevel('bus-002');app.place('p1','s1');await app.pendingSave;
 const reopened=await make(p);reopened.startLevel('bus-002');assert.equal(reopened.session.placement.p1,'s1');await reopened.pendingSave;
});
test('seat tap survives hit regions being recreated by rendering between down and up',async()=>{
 const app=await make();app.startLevel('bus-001');app.selected='p1';const seatId='s1';
 app.hits=[{x:10,y:10,w:60,h:60,action:'seat',payload:{seatId,personId:null}}];app.pointer({type:'down',x:30,y:30});
 app.hits=[{x:10,y:10,w:60,h:60,action:'seat',payload:{seatId,personId:null}}];app.pointer({type:'up',x:30,y:30});
 assert.equal(app.session.placement.p1,'s1');await app.pendingSave;
});
test('tapping another seated person inspects unless a swap was explicitly armed',async()=>{
 const app=await make();app.progress.completed=['bus-001','bus-002','bus-003'];app.startLevel('bus-004');
 app.place('p1','s1');app.place('p2','s2');app.action('seat',{personId:'p1',seatId:'s1'});
 assert.equal(app.selected,'p1');assert.deepEqual(app.session.placement,{p1:'s1',p2:'s2'});
 app.action('armMove');app.action('seat',{personId:'p2',seatId:'s2'});assert.deepEqual(app.session.placement,{p1:'s2',p2:'s1'});await app.pendingSave;
});
test('dismiss hint leaves selected person and arrangement unchanged',async()=>{
 const app=await make();app.startLevel('bus-001');await app.advancedHint();const selected=app.selected;
 app.action('dismissToast');assert.equal(app.toast,'');assert.equal(app.selected,selected);assert.deepEqual(app.session.placement,{});await app.pendingSave;
});
test('all published campaign levels complete through application moves and replay retains unlocks',async()=>{
 const p=platform(),app=await make(p);
 for(const id of app.catalog.campaignIds){assert.equal(app.startLevel(id),true,id);for(const [person,seat]of Object.entries(reference(id)))app.place(person,seat);assert.equal(app.won,true,id);}
 await app.pendingSave;const reopened=await make(p);assert.equal(reopened.progress.completed.length,app.catalog.campaignIds.length);
 reopened.startLevel('bus-001');reopened.action('reset');reopened.action('confirmReset');await reopened.pendingSave;
 const replayed=await make(p);assert.equal(replayed.progress.completed.length,app.catalog.campaignIds.length);assert.equal(replayed.startLevel('cinema-030'),true);await replayed.pendingSave;
});
