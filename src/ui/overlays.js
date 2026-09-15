'use strict';
const {C,round,text,circle,person}=require('./draw');
const {emotionFor}=require('../features/emotions');
const {lines,paragraph}=require('./components');
const {seatDescription,scene,sceneId}=require('./scenes');
const {pageIndex,heading}=require('./pages');
const HELP=[
 ['慢慢安排，没有倒计时','先点选一个伙伴，再点空位让他入座。点已入座的人，可以查看他的全部偏好。'],
 ['换位与退回','选中已入座伙伴，点“换个位置”，再点目标座位；目标有人时会交换。也可以拖动伙伴换位。点“退回候场”让他暂时离席。'],
 ['看懂条件状态','✓ 表示满足；! 表示冲突；尚未入座或关系对象未入座时，条件等待判断。所有人入座并满足全部条件，才算完成。'],
 ['动物的表情','开心表示偏好满足；午睡屋里满足后会安心犯困。委屈或生气表示有具体偏好未满足，点选伙伴查看原因。朋友还没入座时先期待等待；惊喜和难过是换位后的短暂反应。设置中可减少动态效果。'],
 ['座位标签','窗、门、窗帘、取餐柜、暖灯和音响摆在房间里，对应位置保留文字标签；绿植、挂画等装饰不增加条件。座位显示“多标签”时，点偏好卡查看完整环境。'],
 ['六种小偏好','想坐某个标签、避开某个标签、指定区域、与某人相邻、不与某人相邻、至少留一个相邻空位。相邻关系以关卡连线为准。'],
 ['可以反悔','撤销回到上一步；重新安排会先确认。候场左右箭头可以翻看全部伙伴，偏好面板的翻页按钮可以阅读完整条件。'],
 ['提示由你选择','“免费读规则”只解释条件。高级提示提供一步建议与理由，需要你手动操作。高级提示按钮会显示当前免费权益或广告状态；未配置广告时不宣称可以播放。'],
 ['每日与纪念册','完成五个不同主线关卡后开放每日挑战。纪念卡按主线完成数量解锁，只能领取一次，不需要购买或抽取。']
];
const PRIVACY=[['本机进度','游戏使用本机存档保存主线完成记录、当前排座、每日记录、纪念卡、提示权益和设备设置。清理本机数据会影响这些记录，请先确认。'],['服务状态','云备份与激励广告是否可用，以设置页显示的实际状态为准。未配置的服务不能备份数据或播放真实广告。'],['数据操作','这里不提供虚构的云删除成功提示。需要清理设备记录时，请使用设置中的“清理本机数据”并完成确认。'],['关于这份说明','这是客户端已实现能力的说明。运营主体、联系渠道和平台正式隐私告知应以实际发布配置为准。']];
function blocksToRows(ctx,blocks,width){
 const rows=[];
 for(const block of blocks){
  const [title,body,color]=block;
  if(title)lines(ctx,title,width,15).forEach(value=>rows.push({value,size:15,color:color||C.ink,weight:'600'}));
  if(body)lines(ctx,body,width,14).forEach(value=>rows.push({value,size:14,color:color||C.muted}));
  rows.push({value:'',size:14});
 }return rows;
}
function reader(p,app,r,title,blocks,closeAction='cancelModal',closeLabel='知道了',pet=null){
 const {ctx,button}=p;round(ctx,r.x,r.y,r.w,r.h,22,C.paper);
 text(ctx,title,r.x+18,r.y+28,19,C.ink,'700');
 const extra=pet?74:0;
 if(pet){
  const feeling=emotionFor(app,pet.id);
  person(ctx,r.x+42,r.y+79,48,pet.color,pet,feeling.mood,feeling.motion);
  text(ctx,`${pet.name} · ${feeling.label}`,r.x+79,r.y+65,15,C.ink,'600');
  lines(ctx,feeling.reason,r.w-98,12).slice(0,2).forEach((row,i)=>text(ctx,row,r.x+79,r.y+87+i*17,12,C.muted));
 }
 const content={x:r.x+18,y:r.y+62+extra,w:r.w-36,h:r.h-190-extra};
 const rows=blocksToRows(ctx,blocks,content.w),capacity=Math.max(1,Math.floor(content.h/22)),count=Math.max(1,Math.ceil(rows.length/capacity)),page=pageIndex(app,count);
 rows.slice(page*capacity,(page+1)*capacity).forEach((row,i)=>text(ctx,row.value,content.x,content.y+i*22,row.size,row.color,row.weight));
 const pager={x:r.x+16,y:r.y+r.h-116,w:r.w-32,h:48};p.pager(pager,page,count);
 button(closeLabel,{x:r.x+16,y:r.y+r.h-60,w:r.w-32,h:48},closeAction,null,'primary');
 return {page,count,capacity};
}
function rulesBlocks(app){
 const level=app.level,people=[...level.people];
 people.sort((a,b)=>(b.id===app.selected?1:0)-(a.id===app.selected?1:0));
 const blocks=[];
 if(app.tutorialText)blocks.push(['现在试试',app.tutorialText]);
 if(app.statusNote)blocks.push(['当前状态',app.statusNote]);
 blocks.push([level.title,level.intro]);
 for(const person of people){
  const state=(app.result.people||{})[person.id]||{};
  const feeling=emotionFor(app,person.id);
  blocks.push([`${person.name} · ${app.session.placement[person.id]?'已入座':'候场中'}`,`${feeling.label}：${feeling.reason}`]);
  const rules=state.rules||person.rules||[];
  if(!rules.length)blocks.push(['','坐在哪里都可以。']);
  rules.forEach((rule,i)=>blocks.push(['',`${i+1}. ${rule.status==='satisfied'?'✓ 已满足':rule.status==='conflict'?'! 有冲突':'待安排'}：${rule.text||'请查看本关规则说明'}`,rule.status==='conflict'?C.red:null]));
 }
 blocks.push(['座位环境 · 完整标签','图中每个环境物件只对应带该标签的座位。']);
 level.seats.forEach((seat,i)=>blocks.push([`${i+1}号座位`,seatDescription(seat)]));
 blocks.push(['相邻关系',(level.adjacency||[]).map(([a,b])=>`${level.seats.findIndex(s=>s.id===a)+1}号与${level.seats.findIndex(s=>s.id===b)+1}号`).join('；')||'本关没有相邻座位。']);
 return blocks;
}
function help(p,app,l){
 heading(p,l,'把偏好读懂','规则随时可以重看');
 reader(p,app,{x:l.pageBody.x,y:l.pageBody.y,w:l.pageBody.w,h:l.safe.y+l.safe.h-l.pageBody.y},'排座小手册',HELP,'settings','返回设置');
}
function overlay(p,app,l){
 const {ctx,button}=p,toast=app.toast&&Date.now()<app.toastUntil;
 if(!toast&&!app.modal&&!app.rulesExpanded&&!app.won)return;
 p.hits.length=0;
 ctx.fillStyle='#183E34B8';ctx.fillRect(l.viewport.x,l.viewport.y,l.viewport.w,l.viewport.h);
 const r=l.overlay;
 if(toast){
  const rows=blocksToRows(ctx,[['',app.toast]],r.w-36);
  if(rows.length<=Math.floor((r.h-150)/22)){
   round(ctx,r.x,r.y,r.w,r.h,22,C.paper);text(ctx,'一点小提醒',r.x+18,r.y+32,20,C.ink,'700');
   rows.forEach((row,i)=>text(ctx,row.value,r.x+18,r.y+75+i*22,14,C.ink));
   round(ctx,r.x+16,r.y+r.h-64,r.w-32,48,14,C.ink);text(ctx,'轻点关闭',r.x+r.w/2,r.y+r.h-40,14,C.white,'600','center');p.hit(l.safe,'dismissToast');
  }else reader(p,app,r,'一点小提醒',[['',app.toast]],'dismissToast','关闭说明');
 }else if(app.modal==='reset'||app.modal==='deleteLocal'){
  const deleting=app.modal==='deleteLocal';
  const box={x:r.x,y:r.y+(r.h-Math.min(352,r.h))/2,w:r.w,h:Math.min(352,r.h)};
  round(ctx,box.x,box.y,box.w,box.h,24,C.paper);text(ctx,deleting?'清理这台设备的进度？':'重新安排这一席？',box.x+20,box.y+40,20,C.ink,'700');
  paragraph(ctx,deleting?'本机关卡进度、纪念卡、每日记录和设置将被清除。此操作不能撤销，也不代表删除了云端数据。':'伙伴会回到候场区。已完成进度会保留，重置后仍可以撤销。',box.x+20,box.y+86,box.w-40,15,C.muted,24);
  button(deleting?'确认清理本机数据':'重新安排',{x:box.x+16,y:box.y+box.h-120,w:box.w-32,h:48},deleting?'confirmDeleteLocal':'confirmReset',null,'accent');
  button(deleting?'保留我的进度':'继续想想',{x:box.x+16,y:box.y+box.h-64,w:box.w-32,h:48},'cancelModal',null,'secondary');
 }else if(app.modal==='privacy')reader(p,app,r,'隐私与本机数据',PRIVACY);
 else if(app.modal==='rules')reader(p,app,r,'排座小手册',HELP);
 else if(app.rulesExpanded)reader(p,app,r,'每个伙伴的小偏好',rulesBlocks(app),'rulesToggle','收起，继续安排',app.level.people.find(p=>p.id===app.selected));
 else if(app.won){
  round(ctx,r.x,r.y,r.w,r.h,24,C.paper);
  const artH=Math.min(210,Math.max(112,r.h-300));scene(ctx,{x:r.x+14,y:r.y+14,w:r.w-28,h:artH},sceneId(app.level),1,true,sceneId(app.level)==='cinema'?'sleepy':'happy');
  const cast=app.level.people,columns=Math.min(5,cast.length),rows=Math.ceil(cast.length/columns),gap=(r.w-44)/columns;
  round(ctx,r.x+22,r.y+artH-(rows>1?44:19),r.w-44,rows>1?74:49,15,'#FFF8E9');
  cast.forEach((pet,i)=>{
   const feeling=emotionFor(app,pet.id),x=r.x+22+gap*(i%columns+.5),y=r.y+artH+(rows>1?-20+Math.floor(i/columns)*27:0);
   person(ctx,x,y,rows>1?24:30,pet.color,pet,feeling.mood,feeling.motion);
   if(sceneId(app.level)==='garden'){round(ctx,x-7,y+9,14,6,3,'#C98D69');round(ctx,x-7,y+8,14,3,1.5,'#FAE7BC');}
  });
  const y=r.y+artH+48;text(ctx,'每只毛茸茸，都刚刚好。',r.x+r.w/2,y,22,C.ink,'700','center');
  paragraph(ctx,({bus:'大家坐稳啦，带着好心情出发！',garden:'小碗抱好啦，一起开饭吧！',cinema:'偏好都满足了，安心睡个好觉。'})[sceneId(app.level)],r.x+22,y+40,r.w-44,14,C.muted,22);
  const index=app.levels.findIndex(level=>level.id===app.level.id),last=index===app.levels.length-1;
  const chapterEnd=index>=0&&!last&&sceneId(app.levels[index+1])!==sceneId(app.level);
  text(ctx,index<0?'今日的一席，圆满了':last?'已到达主线故事的最后一站':chapterEnd?'这一章的相遇，圆满了':`第 ${app.catalog?app.catalog.displayNumber(app.level.id):index+1} 关完成`,r.x+r.w/2,y+91,13,C.orange,'600','center');
  button(index<0?'返回每日挑战':last?'回看这些好时光':'下一个小故事  →',{x:r.x+16,y:r.y+r.h-120,w:r.w-32,h:48},index<0?'daily':last?'levels':'next');
  button('返回场景',{x:r.x+16,y:r.y+r.h-64,w:r.w-32,h:48},'levels',null,'secondary');
 }
}
module.exports={overlay,help,reader,rulesBlocks,HELP};
