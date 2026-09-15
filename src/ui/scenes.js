'use strict';
// Original Canvas geometry. No external images, reference tracing, or copied assets.
const {C,round,circle,line,leaf,person,text}=require('./draw');
const themes={bus:'#DFE8DC',garden:'#EAE6CD',cinema:'#DFE5E9'};
function sceneId(level){return level.chapterId||['bus','garden','cinema'][level.chapter]||'bus';}
function windowPane(ctx,x,y,w,h){
 round(ctx,x,y,w,h,8,'#AFC9C0');round(ctx,x+3,y+3,w-6,h-6,6,'#E8F1DE');
 circle(ctx,x+w*.72,y+h*.32,Math.min(8,h*.14),'#E6BD78');
 line(ctx,x+5,y+h*.72,x+w-5,y+h*.58,'#A2B59A',3);line(ctx,x+w/2,y+2,x+w/2,y+h-2,'#83A598',2);
}
function lantern(ctx,x,y,size=18){line(ctx,x,y-size,x,y-size/2,C.ink,1);round(ctx,x-size*.4,y-size*.5,size*.8,size,6,C.orange);line(ctx,x,y-size*.4,x,y+size*.4,'#E9B777',2);line(ctx,x,y+size*.5,x,y+size*.75,C.orange,2);}
function speaker(ctx,x,y,size=26){round(ctx,x-size/2,y-size*.65,size,size*1.3,5,C.ink);circle(ctx,x,y+size*.2,size*.28,'#829790');circle(ctx,x,y+size*.2,size*.13,'#CAD1BB');circle(ctx,x,y-size*.3,size*.12,'#CAD1BB');}
function scene(ctx,r,id='garden',variant=0,mini=false){
 round(ctx,r.x,r.y,r.w,r.h,24,themes[id]||themes.garden);
 const x=r.x,y=r.y,w=r.w,h=r.h;
 if(id==='bus'){
  round(ctx,x+10,y+12,w-20,h-24,18,'#B8CBBB');
  round(ctx,x+17,y+18,w-34,h-36,14,'#EAF0DB');
  for(let i=0;i<3;i++)windowPane(ctx,x+23+i*(w-50)/3,y+25,(w-65)/3,Math.max(26,h*.28));
  round(ctx,x+w-53,y+h*.46,29,h*.43,5,'#A6BEB0');line(ctx,x+w-39,y+h*.49,x+w-39,y+h*.86,C.ink,1);
  circle(ctx,x+w-34,y+h*.67,2,C.orange);
  line(ctx,x+29,y+h*.61,x+w-66,y+h*.61,'#C6B786',4);
  for(let i=0;i<3;i++){const sx=x+38+i*(w-102)/3;round(ctx,sx,y+h*.59,32,h*.25,8,'#7E9F8C');round(ctx,sx-3,y+h*.78,38,12,5,'#668E7D');line(ctx,sx+4,y+h*.84,sx+4,y+h*.91,C.ink,2);}
  if(mini)person(ctx,x+w*.38,y+h*.60,Math.min(54,h*.28),'#C66949',variant);
 }else if(id==='garden'){
  circle(ctx,x+w*.83,y+h*.22,Math.min(25,h*.13),'#E9CB8F');
  line(ctx,x+18,y+28,x+w-18,y+16,'#789180',1.5);
  for(let i=0;i<3;i++)lantern(ctx,x+60+i*(w-110)/2,y+37-i*4,16);
  leaf(ctx,x+23,y+h*.67,Math.min(1.6,h/120));leaf(ctx,x+w-21,y+h*.69,Math.min(1.5,h/125));
  round(ctx,x+w*.2,y+h*.48,w*.61,h*.32,30,'#BDA17A');round(ctx,x+w*.18,y+h*.43,w*.64,h*.3,30,'#DBC5A0');
  for(let i=0;i<3;i++){circle(ctx,x+w*(.32+i*.17),y+h*.58,Math.min(13,w*.04),C.white);circle(ctx,x+w*(.32+i*.17),y+h*.58,7,'#E7B984');}
  if(mini){person(ctx,x+w*.32,y+h*.38,Math.min(58,h*.30),'#C66949',variant);person(ctx,x+w*.72,y+h*.8,Math.min(56,h*.28),'#8BA79C',variant+3);}
 }else{
  for(let i=0;i<9;i++)circle(ctx,x+18+(i*43)%(w-36),y+15+(i*17)%Math.max(20,h*.3),i%3===0?2:1,'#869C98');
  round(ctx,x+w*.19,y+h*.15,w*.62,h*.38,6,C.ink);round(ctx,x+w*.21,y+h*.17,w*.58,h*.33,4,'#FCF4D8');
  circle(ctx,x+w*.63,y+h*.29,Math.min(17,h*.09),'#E9C990');line(ctx,x+w*.29,y+h*.40,x+w*.69,y+h*.40,'#B6C4AB',3);
  line(ctx,x+w*.27,y+h*.53,x+w*.27,y+h*.62,C.ink,3);line(ctx,x+w*.73,y+h*.53,x+w*.73,y+h*.62,C.ink,3);
  speaker(ctx,x+w*.1,y+h*.44,Math.min(26,w*.08));speaker(ctx,x+w*.9,y+h*.44,Math.min(26,w*.08));
  for(let i=0;i<4;i++){const sx=x+w*(.19+i*.205);round(ctx,sx-16,y+h*.73,32,h*.17,8,'#879E96');line(ctx,sx-12,y+h*.88,sx-12,y+h*.96,C.ink);line(ctx,sx+12,y+h*.88,sx+12,y+h*.96,C.ink);}
  if(mini)person(ctx,x+w*.40,y+h*.73,Math.min(48,h*.24),'#C66949',variant+2);
 }
}
const tagNames={window:'窗',door:'门',shade:'树荫',serving:'取餐',lantern:'灯笼',speaker:'音箱',front:'前排',middle:'中排',back:'后排',left:'左',center:'中',right:'右',screen:'银幕前',edge:'两端',row1:'第1排',row2:'第2排',row3:'第3排'};
const zoneNames={front:'前排',middle:'中排',back:'后排',garden:'花园侧',kitchen:'餐台侧',screen:'银幕前排',rear:'观影后排'};
function seatDescription(seat){return [...new Set([zoneNames[seat.zone]||seat.zone,...(seat.tags||[]).map(t=>tagNames[t]||t)].filter(Boolean))].join(' · ');}
function seatFeatures(seat){return (seat.tags||[]).filter(t=>['window','door','shade','serving','lantern','speaker'].includes(t)).map(t=>tagNames[t]);}
function boardFrame(ctx,r,level){
 const id=sceneId(level);round(ctx,r.x,r.y,r.w,r.h,20,themes[id]);
 if(id==='bus'){
  round(ctx,r.x+4,r.y+22,r.w-8,r.h-27,17,null,'#A4BCA7');
  line(ctx,r.x+r.w/2,r.y+29,r.x+r.w/2,r.y+r.h-12,'#C0CDB0',2);
  round(ctx,r.x+r.w*.26,r.y+4,r.w*.48,18,7,'#C6D8BC');
 }
 if(id==='garden'){
  round(ctx,r.x+r.w*.22,r.y+28,r.w*.56,r.h-36,25,'#BEA27A');
  round(ctx,r.x+r.w*.23,r.y+26,r.w*.54,r.h-38,25,'#DBC5A0');
  for(let i=0;i<3;i++){circle(ctx,r.x+r.w/2,r.y+50+i*(r.h-80)/2,9,C.white);circle(ctx,r.x+r.w/2,r.y+50+i*(r.h-80)/2,5,'#E3B983');}
 }
 if(id==='cinema'){
  round(ctx,r.x+r.w*.16,r.y+2,r.w*.68,21,5,C.ink);
  round(ctx,r.x+r.w*.17,r.y+4,r.w*.66,17,3,'#FBF2D8');
  for(let i=0;i<5;i++)circle(ctx,r.x+14+(i*67)%(r.w-28),r.y+36+(i*37)%(r.h-50),1.5,'#9BAD9F');
 }
 text(ctx,{bus:'接驳车 · 车头 ↑',garden:'庭院 · 花园侧 ↑',cinema:'露天电影 · 银幕 ↑'}[id],r.x+r.w/2,r.y+13,12,C.ink,'600','center');
 // Environment objects are attached only to seats that carry the corresponding tag.
 // This prevents decorative windows/speakers from implying additional rule regions.
}
function environment(ctx,r,seat){
 const tags=seat.tags||[];
 if(tags.includes('window'))windowPane(ctx,r.x+3,r.y+3,17,20);
 if(tags.includes('door')){round(ctx,r.x+r.w-20,r.y+3,16,23,3,'#BAD0BF',C.ink);line(ctx,r.x+r.w-12,r.y+4,r.x+r.w-12,r.y+25,C.ink,1);}
 if(tags.includes('shade')){circle(ctx,r.x+10,r.y+9,8,'#ABC198');line(ctx,r.x+10,r.y+13,r.x+10,r.y+23,'#688871',2);}
 if(tags.includes('lantern'))lantern(ctx,r.x+r.w-12,r.y+13,13);
 if(tags.includes('speaker'))speaker(ctx,r.x+r.w-12,r.y+14,14);
 if(tags.includes('serving')){round(ctx,r.x+r.w-23,r.y+8,20,12,4,'#D0AD74');circle(ctx,r.x+r.w-13,r.y+8,6,C.white);}
}
module.exports={scene,sceneId,boardFrame,environment,seatFeatures,seatDescription,themes};
