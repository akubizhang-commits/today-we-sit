'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ruleFocus,sortedRules}=require('../src/features/rule-focus');
const {evaluate,solve}=require('../src/core/engine');
const {applyMove}=require('../src/core/session');
const levels=require('../content/authoring/levels.json');
test('focused seats satisfy exactly the chosen rule after the real move or swap',()=>{
 for(const level of levels.slice(0,90)){
  const placement=solve(level),before=JSON.stringify(placement);
  for(const person of level.people)for(let index=0;index<person.rules.length;index++){
   const focus=ruleFocus(level,placement,{personId:person.id,index});
   for(const seat of level.seats){const moved=applyMove(level,{placement,history:[]},person.id,seat.id).placement;assert.equal(focus.seatIds.includes(seat.id),evaluate(level,moved).people[person.id].rules[index].status==='satisfied',`${level.id} ${person.id} ${index} ${seat.id}`);}
  }
  assert.equal(JSON.stringify(placement),before);
 }
});
test('pending relations produce waiting guidance rather than false available seats',()=>{
 const level=levels.find(l=>l.people.some(p=>p.rules.some(r=>r.type==='adjacent'))),person=level.people.find(p=>p.rules.some(r=>r.type==='adjacent')),index=person.rules.findIndex(r=>r.type==='adjacent');
 const focus=ruleFocus(level,{}, {personId:person.id,index});assert.deepEqual(focus.seatIds,[]);assert.equal(focus.pendingIds.length,level.seats.length);
 assert.equal(ruleFocus(level,{},null),null);assert.equal(ruleFocus(level,{}, {personId:person.id,index:999}),null);
});
test('conflicting and pending preferences appear before satisfied preferences without changing original indices',()=>{
 const rules=[{status:'satisfied',text:'a'},{status:'pending',text:'b'},{status:'conflict',text:'c'}],before=JSON.stringify(rules);
 assert.deepEqual(sortedRules({rules}, {rules}).map(r=>r.index),[2,1,0]);assert.equal(JSON.stringify(rules),before);
});
