'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GameApp}=require('../src/app'),{render}=require('../src/ui/renderer');
async function fixture(){const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:(()=>{})});const app=new GameApp({canvas:{getContext:()=>ctx},width:320,height:568,dpr:1,insets:{top:48,bottom:34},storage:{get(){},set(){}},onPointer(){},onResize(){},onHide(){},requestFrame(){}});await app.ready;app.progress.completed=[...app.catalog.campaignIds];return {app,ctx};}
test('all campaign preference cards remain reachable and select the exact rule',async()=>{
 const {app,ctx}=await fixture();
 for(const id of app.catalog.campaignIds){app.startLevel(id);
  for(const pet of app.level.people){app.selectPerson(pet.id);app.rulesExpanded=true;app.toast='';const reachable=new Set();
   for(let page=0;page<pet.rules.length+1;page++){app.levelPage=page;const hits=render(ctx,app),cards=hits.filter(h=>h.action==='focusRule');
    for(const h of cards){assert.ok(h.w>=44&&h.h>=44);assert.ok(h.y+h.h<=568-34);reachable.add(h.payload.index);}
   }
   assert.equal(reachable.size,pet.rules.length,id);
   if(pet.rules.length){app.action('focusRule',{personId:pet.id,index:0});assert.deepEqual(app.focusedRule,{personId:pet.id,index:0});assert.equal(app.rulesExpanded,false);const hits=render(ctx,app);assert.ok(hits.some(h=>h.action==='clearRuleFocus'));app.action('clearRuleFocus');assert.equal(app.focusedRule,null);}
  }
 }
 await app.pendingSave;
});
test('full reference opens separately and changing level or hints clears stale focus',async()=>{
 const {app,ctx}=await fixture();app.startLevel('bus-002');app.selectPerson(app.level.people[0].id);app.action('rulesToggle');app.action('rulesDetail');
 assert.equal(app.rulesDetail,true);assert.ok(render(ctx,app).some(h=>h.action==='rulesDetailBack'));app.action('rulesDetailBack');assert.equal(app.rulesDetail,false);
 app.action('focusRule',{personId:app.level.people[0].id,index:0});app.showHint({personId:app.level.people[0].id,text:'测试'});assert.equal(app.focusedRule,null);
 app.startLevel('bus-003');assert.equal(app.focusedRule,null);assert.equal(app.rulesDetail,false);await app.pendingSave;
});
test('free rule reading opens the compact preference panel without an extra blocking toast',async()=>{
 const {app,ctx}=await fixture();app.startLevel('bus-002');app.action('hint');
 assert.equal(app.rulesExpanded,true);assert.equal(app.rulesDetail,false);assert.equal(app.toast,'');
 assert.ok(render(ctx,app).some(h=>h.action==='focusRule'));await app.pendingSave;
});
test('focused waiting pet can move into an occupied highlighted seat and dragging another pet clears old guidance',async()=>{
 const {app,ctx}=await fixture();app.startLevel('bus-002');
 const [a,b]=app.level.people;app.place(b.id,'s1');app.action('focusRule',{personId:a.id,index:0});
 assert.equal(app.moveArmed,true);app.action('seat',{seatId:'s1',personId:b.id});assert.equal(app.session.placement[a.id],'s1');assert.equal(app.session.placement[b.id],undefined);
 app.action('undo');app.action('focusRule',{personId:a.id,index:0});app.hits=render(ctx,app);
 const h=app.hits.find(h=>h.action==='seat'&&h.payload.personId===b.id),x=h.x+h.w/2,y=h.y+h.h/2;
 app.pointer({type:'down',x,y});app.pointer({type:'move',x:x+12,y});app.pointer({type:'cancel',x:x+12,y});
 assert.equal(app.selected,b.id);assert.equal(app.focusedRule,null);await app.pendingSave;
});
test('levels six to ten show a short orientation on an empty board without adding a saved tutorial task',async()=>{
 const {app}=await fixture();
 for(let n=6;n<=10;n++){app.startLevel(`bus-${String(n).padStart(3,'0')}`);const before=JSON.stringify(app.progress.tutorial);assert.ok(app.tutorialText.length>0);assert.equal(JSON.stringify(app.progress.tutorial),before);app.place(app.level.people[0].id,app.level.seats[0].id);assert.equal(app.tutorialText,'');}
 await app.pendingSave;
});
