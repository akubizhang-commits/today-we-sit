'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {computeLayout,seatRegions}=require('../src/ui/layout');
const inside=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w+.01&&a.y+a.h<=b.y+b.h+.01;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
for(const width of [320,360,375,390,414,430,1024])for(const height of [568,667,844,932])test(`CSS layout ${width}x${height}`,()=>{
 const l=computeLayout({width,height,insets:{top:24,bottom:20,left:0,right:0},waitingCount:8});
 assert.ok(l.viewport.w<=430); assert.equal(l.viewport.w,Math.min(width,430));
 for(const name of ['header','rules','board','waiting','toolbar'])assert.ok(inside(l[name],l.safe),name);
 const areas=['header','rules','board','waiting','toolbar'];
 for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++)assert.ok(!overlap(l[areas[i]],l[areas[j]]),areas[i]+' / '+areas[j]);
 for(const [cols,rows] of [[2,1],[3,2],[3,3],[4,2],[4,3]]){
  const seats=Array.from({length:cols*rows},(_,i)=>({id:`s${i}`,x:i%cols,y:Math.floor(i/cols)}));
  const regions=seatRegions(l,seats);
  assert.equal(regions.length,seats.length);
  regions.forEach(r=>{assert.ok(r.w>=44&&r.h>=44);assert.ok(inside(r,l.board));});
  regions.forEach((a,i)=>regions.slice(i+1).forEach(b=>assert.ok(!overlap(a,b))));
 }
});
test('short screen with large top and bottom safe areas still has 44px seats',()=>{
 const l=computeLayout({width:320,height:568,insets:{top:48,bottom:34},waitingCount:8});
 const seats=Array.from({length:12},(_,i)=>({id:`s${i}`,x:i%4,y:Math.floor(i/4)}));
 for(const r of seatRegions(l,seats)){assert.ok(r.w>=44&&r.h>=44);assert.ok(inside(r,l.board));}
});
test('asymmetric insets and desktop centering',()=>{
 const l=computeLayout({width:1000,height:800,insets:{top:48,right:12,bottom:34,left:20}});
 assert.equal(l.viewport.x,285);assert.equal(l.safe.y,48);assert.equal(l.safe.h,718);
 assert.equal(l.safe.x,305);assert.equal(l.safe.w,398);
});
