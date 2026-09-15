'use strict';
const {C,round,text,person}=require('./draw');
const {emotionFor}=require('../features/emotions');
const {sortedRules}=require('../features/rule-focus');
const {lines}=require('./components');
function preferencePanel(p,app,r){
 const pet=app.level.people.find(p=>p.id===app.selected)||app.level.people.find(p=>app.result.people[p.id].status==='conflict')||app.level.people[0];
 const feeling=emotionFor(app,pet.id),{ctx,button}=p;
 round(ctx,r.x,r.y,r.w,r.h,22,C.paper);
 text(ctx,`${pet.name}的小偏好`,r.x+18,r.y+28,19,C.ink,'700');
 person(ctx,r.x+43,r.y+81,51,pet.color,pet,feeling.mood,feeling.motion);
 text(ctx,feeling.label,r.x+80,r.y+68,16,C.ink,'600');
 text(ctx,'点条件，看看对应位置',r.x+80,r.y+93,12,C.muted);
 const ordered=sortedRules(pet,app.result.people[pet.id]),capacity=Math.max(1,Math.min(3,Math.floor((r.h-310)/78))),count=Math.max(1,Math.ceil(ordered.length/capacity)),page=Math.max(0,Math.min(app.levelPage||0,count-1));
 ordered.slice(page*capacity,(page+1)*capacity).forEach((rule,i)=>{
  const b={x:r.x+16,y:r.y+132+i*78,w:r.w-32,h:70};
  round(ctx,b.x,b.y,b.w,b.h,12,C.white,rule.status==='conflict'?C.orange:C.line);
  text(ctx,`${rule.index+1} · ${rule.status==='conflict'?'待调整':rule.status==='satisfied'?'已满足':'待安排'}`,b.x+12,b.y+15,12,rule.status==='conflict'?C.orange:C.muted,'600');
  const rows=lines(ctx,rule.text||'坐哪里都可以',b.w-40,14);
  rows.slice(0,2).forEach((row,j)=>text(ctx,j===1&&rows.length>2?row.slice(0,-1)+'…':row,b.x+12,b.y+36+j*18,14,C.ink));
  text(ctx,'›',b.x+b.w-14,b.y+37,22,C.orange,'600','center');
  if(pet.rules[rule.index])p.hit(b,'focusRule',{personId:pet.id,index:rule.index});
 });
 if(!ordered.length)text(ctx,'坐在哪里都可以。',r.x+20,r.y+150,14,C.ink);
 p.pager({x:r.x+16,y:r.y+r.h-168,w:r.w-32,h:48},page,count);
 button('全部偏好与场景说明',{x:r.x+16,y:r.y+r.h-112,w:r.w-32,h:48},'rulesDetail',null,'secondary');
 button('回到场景',{x:r.x+16,y:r.y+r.h-56,w:r.w-32,h:44},'rulesToggle',null,'primary');
}
module.exports={preferencePanel};
