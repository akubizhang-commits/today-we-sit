'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {computeLayout,seatRegions}=require('../src/ui/layout');
const {seatDescription,names,sceneId}=require('../src/ui/scenes');
const {render}=require('../src/ui/renderer');
const {catalog}=require('../src/content/current');
const {evaluate}=require('../src/core/engine');
function fixture(level,width,height){
 const draws=[],state={font:'12px sans-serif'};
 state.measureText=s=>({width:[...String(s)].reduce((n,c)=>n+(c.charCodeAt(0)<128?.5:1),0)*parseFloat(state.font.match(/[0-9.]+px/)[0])});
 state.fillText=(s,x,y)=>draws.push({s:String(s),x,y,w:state.measureText(s).width});
 const ctx=new Proxy(state,{get:(o,k)=>k in o?o[k]:(()=>{})});
 const app={screen:'play',width,height,platform:{insets:{top:48,bottom:34}},level,levels:catalog.campaignIds.map(id=>catalog.get(id)),catalog,progress:{completed:[],settings:{}},session:{placement:{},history:[]},result:evaluate(level,{}),waitingOffset:0,selected:null};
 return {app,ctx,draws};
}
test('dense pet furniture preserves 44px hits and keeps name and environment captions inside each seat',()=>{
 for(const [width,height] of [[320,568],[390,844]])for(const id of [...catalog.campaignIds,...catalog.dailyIds]){
  const f=fixture(catalog.get(id),width,height),hits=render(f.ctx,f.app);
  const seats=hits.filter(h=>h.action==='seat');assert.equal(seats.length,f.app.level.seats.length,id);
  for(const [i,r] of seats.entries()){
   assert.ok(r.w>=44&&r.h>=44,id);
   const label=f.draws.find(d=>d.s===`${i+1}号${sceneId(f.app.level)==='cinema'?'小窝':'空位'}`);
   assert.ok(label,id);assert.ok(label.w<=r.w,id+' name width');
   assert.ok(label.y-6>=r.y&&label.y+6<=r.y+r.h,id+' name height');
   const environment=f.draws.find(d=>d.x===label.x&&d.y>label.y&&d.y<=r.y+r.h);
   assert.ok(environment,id+' environment');assert.ok(environment.w<=r.w,id+' environment width');
  }
 }
});
test('tall scenes reserve a dashboard and pack seating without stretching the whole floor',()=>{
 const level=catalog.get('bus-006'),layout=computeLayout({width:390,height:932}),regions=seatRegions(layout,level.seats);
 assert.ok(Math.min(...regions.map(r=>r.y))>=layout.board.y+68);
 assert.ok(Math.max(...regions.map(r=>r.y+r.h))-Math.min(...regions.map(r=>r.y))<=342);
});
test('scene glossary exposes actual pet-world meanings while preserving internal saved IDs',()=>{
 assert.deepEqual(Object.keys(names),['bus','garden','cinema']);
 assert.equal(names.cinema,'呼噜午睡屋');
 assert.match(seatDescription({zone:'screen',tags:['speaker','shade']}),/晨光区.*轻音乐.*遮光位/);
 assert.match(seatDescription({zone:'garden',tags:['serving','lantern']}),/窗边区.*取餐.*暖灯/);
});
