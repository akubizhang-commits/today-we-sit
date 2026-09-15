'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const levels=require('../content/authoring/levels.json');
const {computeLayout}=require('../src/ui/layout');
const {createRoomPlan}=require('../src/ui/room-plan');
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.01&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.01;
for(const [width,height] of [[320,568],[390,844],[430,932]])test(`all 124 rooms keep physical props out of seat hit areas at ${width}x${height}`,()=>{
 const {board}=computeLayout({width,height,insets:{top:48,bottom:34}});
 for(const level of levels){
  const plan=createRoomPlan(board,level);
  for(const p of plan.props){
   assert.ok(p.x>=board.x&&p.y>=board.y&&p.x+p.w<=board.x+board.w+.01&&p.y+p.h<=board.y+board.h+.01,`${level.id} ${p.id} bounds`);
   for(const s of plan.seats)assert.ok(!overlap(p,s),`${level.id}: ${p.id} overlaps ${s.id}`);
  }
 }
});
test('room objects cover exactly the existing environmental tags without inventing rules',()=>{
 const board=computeLayout({width:390,height:844}).board;
 for(const level of levels){
  const before=JSON.stringify(level),plan=createRoomPlan(board,level);
  for(const tag of ['window','door','speaker','serving','shade','lantern']){
   const actual=[...new Set(plan.props.filter(p=>p.condition===`tag:${tag}`).flatMap(p=>p.seatIds))].sort();
   assert.deepEqual(actual,level.seats.filter(s=>s.tags.includes(tag)).map(s=>s.id).sort(),`${level.id} ${tag}`);
  }
  for(const p of plan.props){
   if(!p.condition)assert.deepEqual(p.seatIds,[]);
   else if(p.condition.startsWith('zone:'))assert.deepEqual(p.seatIds,level.seats.filter(s=>s.zone===p.condition.slice(5)).map(s=>s.id));
  }
  assert.ok(plan.props.filter(p=>p.kind==='stereo').length<=1);
  assert.equal(JSON.stringify(level),before);
 }
});
