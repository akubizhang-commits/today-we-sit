'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SPECIES,animalIndex}=require('../src/ui/animals');
const {person}=require('../src/ui/draw');
function trace(identity,mood){
  const ops=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>{args.filter(v=>typeof v==='number').forEach(v=>assert.ok(Number.isFinite(v)));ops.push([key,...args]);},set:(_,key,value)=>{ops.push([key,value]);return true;}});
  person(ctx,0,0,23,'#A8BA99',identity,mood);return JSON.stringify(ops);
}
test('all twelve species have distinct drawing geometry at smallest gameplay portrait size',()=>{
  assert.equal(new Set(SPECIES.map(a=>a.id)).size,12);
  assert.deepEqual(SPECIES.slice(0,7).map(a=>a.id),['cat','dog','pig','tiger','mouse','cow','sheep']);
  assert.equal(new Set(SPECIES.map((_,i)=>trace(i,'neutral'))).size,12);
});
test('character identities survive reordered people and repeated local person IDs',()=>{
  assert.equal(animalIndex({name:'小满',id:'p1'}),0);
  assert.equal(animalIndex({name:'阿穗',id:'p1'}),1);
  assert.equal(animalIndex({name:'小满',id:'p8'}),0);
  assert.equal(animalIndex({name:'新伙伴',id:'p1'}),animalIndex({name:'新伙伴',id:'p7'}));
});
test('every species visibly distinguishes neutral, satisfied and conflict without altering identity',()=>{
  SPECIES.forEach((_,i)=>assert.equal(new Set(['neutral','satisfied','conflict'].map(m=>trace(i,m))).size,3));
});
