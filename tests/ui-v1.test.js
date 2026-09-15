'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {render}=require('../src/ui/renderer');
const {evaluate}=require('../src/core/engine');
const content=require('../src/content/levels');
function fixture(width=390,height=844){
 const drawn=[],base={font:'14px sans-serif'};
 base.measureText=s=>({width:[...String(s)].reduce((n,c)=>n+(/[\x00-\x7F]/.test(c)?.5:1)*parseFloat((base.font.match(/[\d.]+px/)||['14'])[0]),0)});
 base.fillText=(s,x,y)=>drawn.push({s:String(s),x,y,font:base.font,width:base.measureText(s).width,align:base.textAlign});
 const ctx=new Proxy(base,{get:(o,k)=>k in o?o[k]:(()=>{})});
 const levels=content.levels.map((l,i)=>({...l,id:`test-${i}`,chapterId:['bus','garden','cinema'][l.chapter]}));
 const app={width,height,platform:{insets:{top:24,bottom:20}},screen:'home',levels,chapters:[{id:'bus',title:'社区接驳车'},{id:'garden',title:'庭院野餐'},{id:'cinema',title:'露天电影'}],chapter:0,catalog:{displayNumber:id=>levels.findIndex(l=>l.id===id)+1},progress:{completed:[],settings:{music:true,effects:true,vibration:false,reducedMotion:false}},session:{placement:{},history:[]},isUnlocked:()=>true,level:levels[0],result:evaluate(levels[0],{}),dailyView:{available:true,dayKey:'2026-09-15',isReplay:true,completed:false},albumCards:Array.from({length:12},(_,i)=>({id:`card-${i}`,title:`第${i+1}次相遇`,threshold:(i+1)*5,unlocked:i<2,claimed:i===0,scene:['bus','garden','cinema'][i%3]})),serviceStatus:{cloud:'未配置',ads:'未配置'},hintLabel:'免费高级提示',levelPage:0,waitingOffset:0};return{app,ctx,drawn};
}
function verify(hits,app){
 assert.equal(new Set(hits.map(h=>h.id)).size,hits.length,'stable unique IDs');
 for(const h of hits){assert.ok(h.w>=44&&h.h>=44,`small ${h.id}`);assert.ok(h.x>=0&&h.y>=24&&h.x+h.w<=app.width&&h.y+h.h<=app.height-20,`bounds ${h.id}`);}
 for(let i=0;i<hits.length;i++)for(let j=i+1;j<hits.length;j++){
 const a=hits[i],b=hits[j];assert.ok(!(a.x<b.x+b.w-.1&&a.x+a.w>b.x+.1&&a.y<b.y+b.h-.1&&a.y+a.h>b.y+.1),`occlusion ${a.id} ${b.id}`);
 }
}
for(const width of [320,390,430,1000])for(const height of [568,844])for(const screen of ['home','levels','play','daily','album','settings','help'])test(`${screen} ${width}x${height} hit geometry`,()=>{const f=fixture(width,height);f.app.screen=screen;verify(render(f.ctx,f.app),f.app);});
test('generated levels retain every seat hit and paginate waiting without overlap',()=>{
 for(const width of [320,430])for(const height of [568,844]){const f=fixture(width,height);f.app.screen='play';for(const level of f.app.levels){Object.assign(f.app,{level,result:evaluate(level,{}),waitingOffset:0});const hits=render(f.ctx,f.app);verify(hits,f.app);assert.equal(hits.filter(h=>h.action==='seat').length,level.seats.length);const seen=new Set();for(let offset=0;offset<level.people.length;offset++){f.app.waitingOffset=offset;render(f.ctx,f.app).filter(h=>h.action==='person').forEach(h=>seen.add(h.payload));}assert.equal(seen.size,level.people.length);}}
});
test('levels paginate exactly ten stable IDs and home uses dynamic count',()=>{
 const f=fixture();f.app.levels=Array.from({length:30},(_,i)=>({...f.app.levels[0],id:`bus-${i}`}));f.app.catalog.displayNumber=id=>Number(id.split('-')[1])+1;
 f.app.screen='levels';for(let p=0;p<3;p++){f.app.levelPage=p;const hits=render(f.ctx,f.app);assert.deepEqual(hits.filter(h=>h.action==='start').map(h=>h.payload),f.app.levels.slice(p*10,p*10+10).map(l=>l.id));}
 f.app.screen='home';f.app.levels=f.app.levels.slice(0,17);render(f.ctx,f.app);assert.ok(f.drawn.some(t=>t.s.includes('/ 17')));
});
test('top layer exclusively owns targets: result, reset, rules, privacy, toast',()=>{
 for(const variant of ['won','reset','deleteLocal','rules','privacy','expanded','toast']){const f=fixture(320,568);f.app.screen='play';if(variant==='won')f.app.won=true;else if(variant==='expanded'){f.app.rulesExpanded=true;f.app.selected=f.app.level.people[0].id;}else if(variant==='toast'){f.app.toast='这是一条完整的说明';f.app.toastUntil=Date.now()+10000;}else f.app.modal=variant;
 const hits=render(f.ctx,f.app);verify(hits,f.app);assert.ok(hits.length);assert.ok(hits.every(h=>!['seat','person','undo','hint','reset'].includes(h.action)));
 }
});
test('long rules remain completely available across reading pages',()=>{
 const f=fixture(320,568);f.app.rulesDetail=true;f.app.screen='play';f.app.selected=f.app.level.people[0].id;f.app.rulesExpanded=true;
 const rules=Array.from({length:4},(_,i)=>({status:'pending',text:`条件${i}：`+'请照顾窗边每一个人的不同偏好，'.repeat(7)+`结束${i}`}));
 f.app.result.people[f.app.selected].rules=rules;
 for(let p=0;p<20;p++){f.app.levelPage=p;verify(render(f.ctx,f.app),f.app);}
 const printed=f.drawn.map(t=>t.s).join('');for(let i=0;i<4;i++)assert.ok(printed.includes(`结束${i}`));assert.ok(!printed.includes('…'));
});
test('settings truthfully show service status and separate hint actions',()=>{
 const f=fixture();f.app.screen='settings';render(f.ctx,f.app);assert.ok(f.drawn.some(t=>t.s.includes('仅保存在本机')));assert.ok(f.drawn.some(t=>t.s.includes('激励广告：'+f.app.serviceStatus.ads)));
 f.app.screen='play';let hits=render(f.ctx,f.app);assert.ok(hits.some(h=>h.action==='hint'));assert.ok(hits.some(h=>h.action==='hintAdvanced'));f.app.hintBusy=true;hits=render(f.ctx,f.app);assert.ok(!hits.some(h=>h.action==='hintAdvanced'));
});
test('all 124 authored regions fit short phones, including 4 by 3 boards',()=>{
 const authored=require('../content/authoring/levels.json');
 for(const width of [320,375,430])for(const height of [568,844]){
  const f=fixture(width,height);f.app.screen='play';
  for(const level of authored){
   f.app.level=level;f.app.result=evaluate(level,{});f.app.selected=level.people[0].id;
   const hits=render(f.ctx,f.app);verify(hits,f.app);
   assert.equal(hits.filter(h=>h.action==='seat').length,level.seats.length,level.id);
   const again=render(f.ctx,f.app);assert.deepEqual(hits,again,'stable targets across frames');
  }
 }
});
test('all pages respect large safe areas on a 320px short screen',()=>{
 for(const screen of ['home','levels','play','daily','album','settings','help']){
  const f=fixture(320,568);f.app.platform.insets={top:48,bottom:34};f.app.screen=screen;
  const hits=render(f.ctx,f.app);verify(hits,f.app);
  for(const h of hits)assert.ok(h.y>=48&&h.y+h.h<=534,screen+' '+h.id);
 }
});
test('session placement is authoritative and render does not mutate application state',()=>{
 const f=fixture();f.app.screen='play';const id=f.app.level.people[0].id,seatId=f.app.level.seats[0].id;
 f.app.progress.placements={[f.app.level.id]:{placement:{[id]:'invalid'}}};
 f.app.session.placement={[id]:seatId};f.app.result=evaluate(f.app.level,f.app.session.placement);
 const before=JSON.stringify(f.app),hits=render(f.ctx,f.app);
 assert.equal(hits.find(h=>h.action==='seat'&&h.payload.seatId===seatId).payload.personId,id);
 assert.equal(JSON.stringify(f.app),before);
});
test('each rule environmental tag is visible in the expanded complete seat glossary',()=>{
 const {rulesBlocks}=require('../src/ui/overlays');
 const all=require('../content/authoring/levels.json');
 for(const level of all){const f=fixture();f.app.level=level;f.app.result=evaluate(level,{});const blocks=rulesBlocks(f.app);
  for(let i=0;i<level.seats.length;i++)assert.ok(blocks.some(b=>b[0]===`${i+1}号座位`));
  for(const person of level.people)for(const rule of person.rules)assert.ok(blocks.some(b=>b[1].includes(rule.text)));
 }
});
test('page text stays on screen at readable sizes without ellipsis',()=>{
 for(const width of [320,430])for(const screen of ['home','levels','play','daily','album','settings','help']){
  const f=fixture(width,568);f.app.screen=screen;render(f.ctx,f.app);
  for(const item of f.drawn){
   const size=parseFloat(item.font.match(/[\d.]+px/)[0]);
   const left=item.align==='center'?item.x-item.width/2:item.align==='right'?item.x-item.width:item.x;
   assert.ok(size>=12,`${screen}: ${item.s}`);
   assert.ok(left>=0&&left+item.width<=width+.1,`${screen} clips ${item.s}`);
   assert.ok(item.y-size/2>=24&&item.y+size/2<=548,`${screen} vertical ${item.s}`);
   assert.ok(!item.s.includes('…'));
  }
 }
});
module.exports={fixture};
test('previous daily resume and today actions remain separately reachable on short safe-area screens',()=>{
 for(const [width,height] of [[320,568],[390,844]]){
  const f=fixture(width,height);f.app.screen='daily';f.app.dailyResume={levelId:'daily-001',dayKey:'2026-09-15'};
  f.app.platform.insets={top:48,bottom:34};const hits=render(f.ctx,f.app);verify(hits,f.app);
  assert.ok(hits.some(h=>h.action==='resumeDaily'));assert.ok(hits.some(h=>h.action==='startDaily'));
  const resume=hits.find(h=>h.action==='resumeDaily');
  const body=f.drawn.filter(d=>d.s.includes('成就感')||d.s.includes('安排好每个人'));
  for(const row of body)assert.ok(row.y<resume.y,'daily story does not overlap resume button');
 }
});
