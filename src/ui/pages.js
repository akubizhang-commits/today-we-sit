'use strict';
const {C,text,round,circle,line,person}=require('./draw');
const {paragraph,lines,progress,icon}=require('./components');
const {scene,sceneId,boardFrame,environment,seatFeatures}=require('./scenes');
const {clamp,seatRegions}=require('./layout');
const completedCount=app=>new Set((app.progress.completed||[]).filter(id=>(app.levels||[]).some(l=>l.id===id))).size;
const pageIndex=(app,count)=>clamp(Math.floor(app.levelPage||0),0,Math.max(0,count-1));
function heading(p,l,title,subtitle,back='home'){
 const {ctx,button}=p,r=l.header;
 button('‹',{x:r.x,y:r.y,w:44,h:48},back,null,'secondary');
 text(ctx,title,r.x+56,r.y+16,18,C.ink,'700');
 if(subtitle)text(ctx,subtitle,r.x+56,r.y+38,12,C.muted);
}
function navigation(p,l,current){
 const items=[['home','chair','首页'],['daily','sun','每日'],['album','book','纪念册'],['settings','gear','设置']];
 const r=l.footer,w=(r.w-12)/4;
 items.forEach(([action,name,label],i)=>{const b={x:r.x+i*(w+4),y:r.y,w,h:52};round(p.ctx,b.x,b.y,b.w,b.h,14,current===action?'#E1E8D8':C.white);icon(p.ctx,name,b.x+b.w/2,b.y+16,19,current===action?C.orange:C.ink);text(p.ctx,label,b.x+b.w/2,b.y+39,12,C.ink,'500','center');p.hit(b,action,null,`nav:${action}`);});
}
function home(p,app,l){
 const {ctx,button}=p,r=l.pageBody;
 icon(ctx,'chair',l.header.x+20,l.header.y+23,28);text(ctx,'给喵挪个位',l.header.x+44,l.header.y+(app.statusNote?16:23),20,C.ink,'700');
 if(app.statusNote)text(ctx,app.statusNote,l.header.x+44,l.header.y+38,12,C.muted);
 const done=completedCount(app),total=app.levels.length;
 text(ctx,'给小伙伴',r.x+6,r.y+23,30,C.ink,'700');text(ctx,'一个好位置。',r.x+6,r.y+61,30,C.ink,'700');
 text(ctx,'慢慢想，让相遇刚刚好。',r.x+8,r.y+98,14,C.muted);
 const artH=Math.max(72,r.h-280);
 scene(ctx,{x:r.x,y:r.y+119,w:r.w,h:artH},'garden',0,true);
 const base=r.y+119+artH;
 text(ctx,`${app.chapters.length} 个场景`,r.x+4,base+23,12,C.muted);
 text(ctx,`${done} / ${total} 已完成`,r.x+r.w-4,base+23,12,C.ink,'600','right');
 progress(ctx,{x:r.x+4,y:base+39,w:r.w-8},done,total);
 button(done===total&&total?'重温一个好时光':'继续今天的安排  →',{x:r.x,y:base+53,w:r.w,h:48},'continue');
 button('挑选场景与关卡',{x:r.x,y:base+109,w:r.w,h:48},'levels',null,'secondary');
 navigation(p,l,'home');
}
function levels(p,app,l){
 const {ctx,button}=p,r=l.pageBody;
 heading(p,l,'选择一个好时光',`${completedCount(app)} / ${app.levels.length} 个故事已完成`);
 const selected=clamp(app.chapter,0,app.chapters.length-1),chapter=app.chapters[selected]||{};
 const tabW=(r.w-12)/3;
 app.chapters.forEach((ch,i)=>button(ch.title,{x:r.x+i*(tabW+6),y:r.y,w:tabW,h:48},'chapter',i,selected===i?'primary':'secondary'));
 const list=app.levels.filter(item=>item.chapterId===chapter.id||item.chapter===selected);
 const count=Math.ceil(list.length/10),page=pageIndex(app,count),gridY=r.y+78;
 const rows=5,gap=6,tileH=(r.h-78-gap*4)/rows,tileW=(r.w-8)/2;
 text(ctx,chapter.subtitle||'每只毛茸茸，都有小偏好。',r.x+4,r.y+64,12,C.muted);
 list.slice(page*10,page*10+10).forEach((level,i)=>{
  const b={x:r.x+(i%2)*(tileW+8),y:gridY+Math.floor(i/2)*(tileH+gap),w:tileW,h:tileH};
  const done=app.progress.completed.includes(level.id),locked=!app.isUnlocked(level.id);
  round(ctx,b.x,b.y,b.w,b.h,14,locked?'#EBEADF':C.white,done?'#94AD8A':C.line);
  const n=app.catalog?app.catalog.displayNumber(level.id):app.levels.indexOf(level)+1;
  text(ctx,`${String(n).padStart(2,'0')}  ${done?'已完成':locked?'未解锁':'可安排'}`,b.x+10,b.y+14,12,done?C.orange:C.muted,'500');
  const titleLines=lines(ctx,level.title,b.w-20,14);
  titleLines.forEach((t,j)=>text(ctx,t,b.x+10,b.y+33+j*17,14,locked?C.muted:C.ink,'600'));
  if(!locked)p.hit(b,'start',level.id);
 });
 p.pager(l.footer,page,count);
}
function play(p,app,l){
 const {ctx,button}=p,level=app.level,result=app.result||{people:{}},placement=app.session.placement;
 const selected=level.people.find(person=>person.id===app.selected),n=app.catalog?app.catalog.displayNumber(level.id):app.levels.indexOf(level)+1;
 heading(p,l,level.title,`${n?`第 ${n} 关 · `:'每日挑战 · '}${result.satisfied||0} / ${result.total||0} 条件满足`,'levels');
 const r=l.rules;
 round(ctx,r.x,r.y,r.w,r.h,14,C.white,C.line);
 if(app.tutorialText&&lines(ctx,app.tutorialText,r.w-40,14).length<=2){
  const rows=lines(ctx,app.tutorialText,r.w-40,14);
  rows.forEach((row,i)=>text(ctx,row,r.x+12,r.y+(rows.length===1?r.h/2:16+i*20),14,C.ink,'500'));
 }else if(selected){
  person(ctx,r.x+24,r.y+25,29,selected.color,selected,(result.people[selected.id]||{}).status);
  text(ctx,`${selected.name}的小偏好`,r.x+48,r.y+17,14,C.ink,'600');
  text(ctx,'查看全部条件与座位环境',r.x+48,r.y+37,12,C.muted);
 }else{ text(ctx,app.tutorialText?'新手引导 · 看看下一步':'先听听，大家想坐哪里？',r.x+12,r.y+17,14,C.ink,'600');text(ctx,app.statusNote?'有一条状态说明 · 点此查看':'点选伙伴 · 点空位入座',r.x+12,r.y+37,12,C.muted); }
 text(ctx,'›',r.x+r.w-18,r.y+25,24,C.orange,'600','center');p.hit(r,'rulesToggle');
 boardFrame(ctx,l.board,level);
 const regions=seatRegions(l,level.seats);
 for(const [a,b] of level.adjacency||[]){
  const first=regions.find(r=>r.id===a),second=regions.find(r=>r.id===b);
  if(first&&second)line(ctx,first.x+first.w/2,first.y+first.h/2,second.x+second.w/2,second.y+second.h/2,'#A6B699',2);
 }
 regions.forEach((b,i)=>{
  const seat=b.seat,occupant=level.people.find(person=>placement[person.id]===seat.id),state=occupant?(result.people[occupant.id]||{}):{};
  const active=occupant&&occupant.id===app.selected;
  round(ctx,b.x,b.y,b.w,b.h,10,active?'#FFF0CC':'#FFFEF8E8',state.status==='conflict'?C.red:active?C.orange:'#BBC8B2');
  environment(ctx,b,seat);
  const center=b.x+b.w/2,compact=b.h<76;
  if(occupant)person(ctx,center,b.y+(compact?16:24),compact?23:34,occupant.color,occupant,state.status);
  else icon(ctx,'chair',center,b.y+(compact?16:25),compact?21:30,'#8EA28C');
  const nameY=b.y+(compact?35:48);
  text(ctx,occupant?`${i+1} ${occupant.name}`:`${i+1}号空位`,center,nameY,12,C.ink,'500','center');
  const features=seatFeatures(seat);const label=features.length?features.join('·'):({garden:'花园侧',kitchen:'餐台侧',screen:'银幕前',rear:'后排'}[seat.zone]||`第${seat.y+1}排`);
  const labelLines=lines(ctx,label,b.w-4,12);labelLines.forEach((row,j)=>text(ctx,row,center,nameY+15+j*13,12,C.muted,'normal','center'));
  if(state.status==='conflict')text(ctx,'!',b.x+b.w-8,b.y+11,12,C.red,'700','center');
  if(state.status==='satisfied')text(ctx,'✓',b.x+b.w-8,b.y+11,12,C.ink,'700','center');
  p.hit({x:b.x,y:b.y,w:b.w,h:b.h},'seat',{seatId:seat.id,personId:occupant&&occupant.id});
 });
 const waiting=level.people.filter(person=>!placement[person.id]),w=l.waiting;
 round(ctx,w.x,w.y,w.w,w.h,16,'#ECECDD');
 const max=Math.max(0,waiting.length-l.waitingCapacity),offset=clamp(Math.floor(app.waitingOffset||0),0,max);
 button('‹',{x:w.x,y:w.y+14,w:44,h:48},'waitingPrev',null,'secondary',offset<=0);
 button('›',{x:w.x+w.w-44,y:w.y+14,w:44,h:48},'waitingNext',null,'secondary',offset>=max);
 const areaW=w.w-96,cellW=areaW/l.waitingColumns;
 waiting.slice(offset,offset+l.waitingCapacity).forEach((personData,i)=>{
  const b={x:w.x+48+(i%l.waitingColumns)*cellW,y:w.y+4+Math.floor(i/l.waitingColumns)*64,w:cellW-2,h:64};
  if(personData.id===app.selected)round(ctx,b.x,b.y,b.w,b.h,12,'#FFF0CC',C.orange);
  person(ctx,b.x+b.w/2,b.y+22,32,personData.color,personData);text(ctx,personData.name,b.x+b.w/2,b.y+53,12,C.ink,'500','center');
  p.hit(b,'person',personData.id);
 });
 if(!waiting.length){text(ctx,'大家都入座了',w.x+w.w/2,w.y+25,14,C.ink,'600','center');text(ctx,'可选人换位或退回候场',w.x+w.w/2,w.y+49,12,C.muted,'normal','center');}
 const t=l.toolbar,bw=(t.w-12)/3;
 button('撤销',{x:t.x,y:t.y,w:bw,h:48},'undo',null,'secondary',!(app.session.history||[]).length);
 button('重新安排',{x:t.x+bw+6,y:t.y,w:bw,h:48},'reset',null,'secondary');
 button('免费读规则',{x:t.x+2*(bw+6),y:t.y,w:bw,h:48},'hint',null,'secondary');
 const placed=selected&&placement[selected.id];
 button(app.moveArmed?'点目标换位':'换个位置',{x:t.x,y:t.y+t.h-48,w:76,h:48},'armMove',null,app.moveArmed?'accent':'secondary',!placed);
 button('退回候场',{x:t.x+82,y:t.y+t.h-48,w:76,h:48},'unseat',null,'secondary',!placed);
 button(app.hintBusy?'正在准备提示':app.hintLabel||'高级提示',{x:t.x+164,y:t.y+t.h-48,w:t.w-164,h:48},'hintAdvanced',null,'primary',!!app.hintBusy);
 if(app.drag&&app.drag.moved){const personData=level.people.find(person=>person.id===app.drag.personId);if(personData){circle(ctx,app.drag.x,app.drag.y,29,'#FFF1CDDD');person(ctx,app.drag.x,app.drag.y,44,personData.color,personData);}}
}
function daily(p,app,l){
 heading(p,l,'每日一席','每天一个小故事，不赶时间。');
 const {ctx,button}=p,r=l.pageBody,d=app.dailyView||{},done=completedCount(app);
 const resume=d.available&&app.dailyResume;
 const artH=Math.max(64,Math.min(220,r.h-(resume?310:225)));scene(ctx,{x:r.x,y:r.y,w:r.w,h:artH},'cinema',3,true);
 let y=r.y+artH+28;
 text(ctx,d.dayKey||'今日挑战',r.x+8,y,20,C.ink,'700');y+=30;
 text(ctx,d.isReplay?'经典回顾 · 熟悉的相遇':'今日故事 · 留一个好位置',r.x+8,y,14,C.orange,'600');y+=30;
 y+=paragraph(ctx,d.available?(d.completed?'今天已完成，仍可以再安排一次。':'安排好每个伙伴，让今天多一点小小的成就感。'):`完成 5 个不同主线关卡后开放。当前 ${done} / 5。`,r.x+8,y,r.w-16,14,C.muted,22);
 if(resume)button(`继续 ${resume.dayKey} 的安排`,{x:r.x,y:r.y+r.h-108,w:r.w,h:48},'resumeDaily',null,'secondary');
 button(d.available?(d.completed?'重温今日挑战':'开始今日挑战'):'先去主线散散步',{x:r.x,y:resume?r.y+r.h-52:Math.max(y+14,r.y+r.h-52),w:r.w,h:48},d.available?'startDaily':'levels',null,'primary');
 navigation(p,l,'daily');
}
function album(p,app,l){
 const cards=app.albumCards||[];heading(p,l,'相遇纪念册',`${cards.filter(c=>c.claimed).length} / ${cards.length} 张珍藏 · 无需购买`);
 const {ctx,button}=p,r=l.pageBody,count=Math.ceil(cards.length/2),page=pageIndex(app,count),h=(r.h-12)/2;
 cards.slice(page*2,page*2+2).forEach((card,i)=>{
  const b={x:r.x,y:r.y+i*(h+12),w:r.w,h};round(ctx,b.x,b.y,b.w,b.h,18,C.white,C.line);
  const artW=Math.min(132,b.w*.4);scene(ctx,{x:b.x+8,y:b.y+8,w:artW,h:b.h-16},typeof card.scene==='string'?card.scene:['bus','garden','cinema'][Math.floor((page*2+i)/4)],page*2+i,true);
  const tx=b.x+artW+20,tw=b.w-artW-28;
  const titleH=paragraph(ctx,card.title,tx,b.y+23,tw,16,C.ink,21);
  paragraph(ctx,card.claimed?'已收藏 · 谢谢这次相遇':card.unlocked?'新的纪念，等你收好':`完成 ${card.threshold} 个主线故事后解锁`,tx,b.y+31+titleH,tw,12,C.muted,18);
  button(card.claimed?'已收藏':card.unlocked?'收进纪念册':'尚未解锁',{x:tx,y:b.y+b.h-58,w:tw,h:48},'claimCard',card.id,card.unlocked&&!card.claimed?'accent':'secondary',!card.unlocked||card.claimed);
 });
 p.pager(l.footer,page,count);
}
function settings(p,app,l){
 heading(p,l,'把节奏交给自己','设置保存在这台设备上');
 const {ctx,button}=p,r=l.pageBody,settings=app.progress.settings||{};
 const compact=r.h<400,step=compact?50:54;
 [['music','背景音乐'],['effects','轻轻的音效'],['vibration','触感反馈'],['reducedMotion','减少动效']].forEach(([key,label],i)=>{
  const b={x:r.x,y:r.y+i*step,w:r.w,h:48};round(ctx,b.x,b.y,b.w,b.h,14,C.white,C.line);text(ctx,label,b.x+14,b.y+24,15,C.ink,'500');
  const on=!!settings[key];round(ctx,b.x+b.w-70,b.y+10,56,28,14,on?C.ink:'#D8DDD0');circle(ctx,b.x+b.w-(on?28:56),b.y+24,10,C.white);
  text(ctx,on?'开':'关',b.x+b.w-93,b.y+24,12,C.muted,'normal','center');p.hit(b,'setting',key);
 });
 const y=r.y+(compact?208:224),status=app.serviceStatus||{};
 text(ctx,`云备份：${status.cloud||'未配置'}`,r.x+10,y,12,C.muted);text(ctx,`激励广告：${status.ads||'未配置'}`,r.x+10,y+21,12,C.muted);
 text(ctx,'主线进度保存在本机',r.x+10,y+42,12,C.ink);
 const bw=(r.w-8)/2;
 button('玩法帮助',{x:r.x,y:y+58,w:bw,h:48},'help',null,'secondary');button('隐私与数据',{x:r.x+bw+8,y:y+58,w:bw,h:48},'privacy',null,'secondary');
 button('清理本机数据',{x:r.x,y:y+114,w:r.w,h:48},'deleteLocal',null,'secondary');navigation(p,l,'settings');
}
module.exports={home,levels,play,daily,album,settings,heading,navigation,pageIndex,completedCount};
