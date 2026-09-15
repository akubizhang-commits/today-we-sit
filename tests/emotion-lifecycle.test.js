'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
function platform(){const memory=new Map();return {canvas:{getContext:()=>({})},width:390,height:844,dpr:1,storage:{get:k=>memory.get(k),set:(k,v)=>memory.set(k,structuredClone(v)),remove:k=>memory.delete(k)},memory,onPointer(){},onResize(){},onHide(){},requestFrame(){}};}
test('moves, undo and level changes keep reactions transient and outside saved progress',async()=>{
 const p=platform(),app=new GameApp(p);await app.ready;app.progress.completed=['bus-001'];app.startLevel('bus-002');
 app.place('p1','s1');assert.ok(Object.keys(app.emotionReactions).length);await app.pendingSave;
 assert.ok(!JSON.stringify([...p.memory.values()]).includes('emotionReactions'));
 app.action('undo');assert.equal(Object.keys(app.session.placement).length,0);assert.deepEqual(app.emotionReactions,{});
 app.startLevel('bus-002');assert.deepEqual(app.emotionReactions,{});
});
test('reaction rendering stops after expiry and does not save per animation frame',async t=>{
 let now=1800000000000,frames=0;t.mock.method(Date,'now',()=>now);
 const p=platform(),ctx=new Proxy({measureText:s=>({width:String(s).length*7}),setTransform:()=>frames++},{get:(o,k)=>k in o?o[k]:(()=>{})});
 p.canvas.getContext=()=>ctx;const app=new GameApp(p);await app.ready;
 app.progress.completed=['bus-001'];app.startLevel('bus-002');app.place('p1','s1');await app.pendingSave;
 const revision=app.progress.localRevision;app.loop();const first=frames;
 now+=40;app.loop();assert.equal(frames,first+1);
 now+=1600;app.loop();assert.deepEqual(app.emotionReactions,{});const final=frames;
 now+=40;app.loop();assert.equal(frames,final);assert.equal(app.progress.localRevision,revision);
 app.emotionReactions={p1:{at:now,until:now+1500,mood:'surprised'}};app.progress.settings.reducedMotion=true;
 app.loop();assert.equal(frames,final);
});
