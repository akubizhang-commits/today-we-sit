'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GameApp}=require('../src/app'),{solve}=require('../src/core/engine');
async function fixture(t){
 let now=1800000000000,hide,show;t.mock.method(Date,'now',()=>now);
 const memory=new Map(),ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const platform={canvas:{getContext:()=>ctx},width:320,height:568,dpr:1,storage:{get:k=>memory.get(k),set:(k,v)=>memory.set(k,structuredClone(v)),remove:k=>memory.delete(k)},onPointer(){},onResize(){},onHide:f=>hide=f,onShow:f=>show=f,requestFrame(){}};
 const app=new GameApp(platform);await app.ready;app.startLevel('bus-001');
 for(const [id,seat] of Object.entries(solve(app.level)))app.place(id,seat);
 await app.pendingSave;return {app,advance:n=>now+=n,hide:()=>hide(),show:()=>show()};
}
test('win saves immediately, holds scene for 2400ms, blocks moves and then shows settlement once',async t=>{
 const {app,advance}=await fixture(t);assert.equal(app.won,true);assert.ok(app.progress.completed.includes('bus-001'));
 app.loop();assert.deepEqual(app.hits.map(h=>h.action),['showSettlement']);
 const placement=structuredClone(app.session.placement),revision=app.progress.localRevision;
 app.place('p1',null);app.action('undo');assert.deepEqual(app.session.placement,placement);
 advance(2399);app.loop();assert.equal(app.completionPending,true);
 advance(1);app.loop();assert.equal(app.completionPending,false);assert.ok(app.hits.some(h=>h.action==='next'));
 assert.equal(app.progress.localRevision,revision);assert.equal(app.progress.completed.filter(id=>id==='bus-001').length,1);
});
test('manual continue skips the pause and new level does not inherit it',async t=>{
 const {app}=await fixture(t);app.action('showSettlement');assert.equal(app.completionPending,false);
 app.action('next');assert.equal(app.level.id,'bus-002');assert.equal(app.won,false);assert.equal(app.completionPending,false);
});
test('background time does not consume celebration and reduced motion still gets reading time',async t=>{
 const {app,advance,hide,show}=await fixture(t);app.progress.settings.reducedMotion=true;
 advance(500);hide();advance(10000);app.loop();assert.equal(app.completionPending,true);
 show();advance(1899);app.loop();assert.equal(app.completionPending,true);
 advance(1);app.loop();assert.equal(app.completionPending,false);
});
