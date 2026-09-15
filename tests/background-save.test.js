'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {STORAGE_KEYS}=require('../src/progress/repository');
function platform(storage){let hide;return {canvas:{getContext:()=>({})},width:390,height:844,dpr:1,storage,onPointer(){},onResize(){},onHide(fn){hide=fn;},onShow(){},requestFrame(){},hide(){hide();}};}
test('an untouched preview going into background does not overwrite another preview saved placement',async()=>{
 const data=new Map(),storage={get:k=>structuredClone(data.get(k)),set:(k,v)=>data.set(k,structuredClone(v)),remove:k=>data.delete(k)};
 const playingPlatform=platform(storage),observerPlatform=platform(storage);
 const playing=new GameApp(playingPlatform);await playing.ready;
 const observer=new GameApp(observerPlatform);await observer.ready;
 playing.progress.completed=['bus-001'];playing.startLevel('bus-002');playing.place('p1','s1');await playing.pendingSave;
 const before=structuredClone(data.get(STORAGE_KEYS.current));
 observerPlatform.hide();await observer.pendingSave;
 assert.deepEqual(data.get(STORAGE_KEYS.current),before);
 playingPlatform.hide();await playing.pendingSave;
 assert.equal(data.get(STORAGE_KEYS.current).placements['bus-002'].placement.p1,'s1');
});
