const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {render}=require('../src/ui/renderer');
async function harness(){const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:(()=>{})});const p={canvas:{getContext:()=>ctx},width:390,height:844,dpr:1,storage:{get(){},set(){}},onPointer(){},onResize(){},onHide(){},requestFrame(){}};const app=new GameApp(p);await app.ready;return {app,ctx};}
test('all published campaign seats have unoccluded targets and every waiting person is reachable by paging',async()=>{
 const {app,ctx}=await harness();app.progress.completed=[...app.catalog.campaignIds];
 for(const id of app.catalog.campaignIds){
  app.startLevel(id);app.toast='';app.hits=render(ctx,app);const seats=app.hits.filter(h=>h.action==='seat');assert.equal(seats.length,app.level.seats.length,id);
  for(const h of seats){assert.equal(app.target(h.x+h.w/2,h.y+h.h/2),h,id);assert.ok(h.w>=44&&h.h>=44);}
  const reachable=new Set();
  for(let offset=0;offset<app.level.people.length;offset++){app.waitingOffset=offset;app.hits=render(ctx,app);for(const h of app.hits.filter(h=>h.action==='person')){reachable.add(h.payload);assert.equal(app.target(h.x+h.w/2,h.y+h.h/2),h);}}
  assert.equal(reachable.size,app.level.people.length,id);
 }
 await app.pendingSave;
});
test('hint overlay consumes clicks instead of selecting obscured waiting people',async()=>{
 const {app,ctx}=await harness();app.progress.completed=[...app.catalog.campaignIds];app.startLevel('cinema-009');app.message('提示保留原人物。');app.hits=render(ctx,app);
 assert.equal(app.target(66,678).action,'dismissToast');await app.pendingSave;
});
