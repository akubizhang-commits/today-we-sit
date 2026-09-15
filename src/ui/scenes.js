'use strict';
// Original pet-world sets drawn from project geometry; no external artwork.
// Internal chapter/tag IDs are retained so the visual redesign does not alter saved puzzles.
const {C,round,circle,line,leaf,person,text}=require('./draw');
const {drawRoomBoard}=require('./room-board');
const themes={bus:'#D6E5DC',garden:'#F0DFBB',cinema:'#DEDCEB'};
const names={bus:'萌宠巴士',garden:'萌宠食堂',cinema:'呼噜午睡屋'};
function sceneId(level){return level.chapterId||['bus','garden','cinema'][level.chapter]||'bus';}
function oval(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function paw(ctx,x,y,s=1,color='#648F7B'){
 oval(ctx,x,y+3*s,5*s,4*s,color);
 for(const [dx,dy,rx,ry] of [[-6,-2,2,3],[-2,-6,2,2.7],[3,-6,2,2.7],[7,-2,2,3]])oval(ctx,x+dx*s,y+dy*s,rx*s,ry*s,color);
}
function dash(ctx,x1,y1,x2,y2,color,width=1){
 const length=Math.hypot(x2-x1,y2-y1),steps=Math.max(1,Math.floor(length/8));
 for(let i=0;i<steps;i+=2)line(ctx,x1+(x2-x1)*i/steps,y1+(y2-y1)*i/steps,x1+(x2-x1)*Math.min(i+1,steps)/steps,y1+(y2-y1)*Math.min(i+1,steps)/steps,color,width);
}
function star(ctx,x,y,s,color='#D4B574'){line(ctx,x-s,y,x+s,y,color,1.4);line(ctx,x,y-s,x,y+s,color,1.4);}
function bowl(ctx,x,y,s=1,color='#C57958'){
 oval(ctx,x,y+7*s,14*s,4*s,'#715F4A19');round(ctx,x-12*s,y-2*s,24*s,11*s,5*s,color);
 oval(ctx,x,y-2*s,12*s,4*s,'#FFF3D9');oval(ctx,x,y-2*s,8*s,2*s,'#CBB58C');
 circle(ctx,x-4*s,y-2*s,1.3*s,'#88A27F');circle(ctx,x+3*s,y-2*s,1.3*s,'#DB9B66');
}
function windowPane(ctx,x,y,w,h){
 round(ctx,x,y,w,h,7,'#648D7D');round(ctx,x+3,y+3,w-6,h-6,5,'#CFE6DF');
 ctx.save();ctx.beginPath();ctx.rect(x+4,y+4,Math.max(1,w-8),Math.max(1,h-8));ctx.clip();
 circle(ctx,x+w*.72,y+h*.28,Math.min(8,h*.16),'#F1D18E');
 oval(ctx,x+w*.22,y+h*.9,w*.65,h*.25,'#A8C29A');oval(ctx,x+w*.86,y+h,w*.65,h*.35,'#829D83');
 line(ctx,x+w*.22,y+6,x+5,y+h*.5,'#FFFFFF99',2);ctx.restore();
 line(ctx,x+w/2,y+3,x+w/2,y+h-3,'#8CAB9A',1.5);
}
function lamp(ctx,x,y,s=1){
 line(ctx,x,y-9*s,x,y-2*s,'#B79A66',1.5);round(ctx,x-7*s,y-2*s,14*s,9*s,4*s,'#E5BB74');circle(ctx,x,y+7*s,2*s,'#FFF0BC');
}
function musicBox(ctx,x,y,s=1){
 round(ctx,x-8*s,y-10*s,16*s,21*s,4*s,'#A596B0');circle(ctx,x,y+3*s,4.5*s,'#DDD4E7');circle(ctx,x,y+3*s,1.5*s,'#8E7E9C');
 line(ctx,x-3*s,y-5*s,x+3*s,y-5*s,'#F6EBDD',1.5);
}
function counter(ctx,x,y,w,h){
 round(ctx,x,y+8,w,h-8,8,'#C89063');round(ctx,x+3,y+13,w-6,h-17,6,'#E7BF87');
 round(ctx,x-3,y,w+6,12,5,'#FFF4DA');
 for(let i=1;i<4;i++)line(ctx,x+w*i/4,y+17,x+w*i/4,y+h-5,'#CC9B64',1);
}
function boardFrame(ctx,r,level,focus){return drawRoomBoard(ctx,r,level,focus);}
function seatFurniture(ctx,r,id,active=false,conflict=false){
 const {x,y,w,h}=r,compact=h<76;
 oval(ctx,x+w/2,y+h-4,w*.42,4,'#536C5422');
 if(active||conflict)round(ctx,x-1,y-1,w+2,h+2,13,active?'#FFF2CC':'#F9DFD3',conflict?C.red:C.orange);
 if(id==='bus'){
  round(ctx,x+6,y+2,w-12,h-14,11,'#658C78');
  round(ctx,x+9,y+4,w-18,h-24,9,'#9DB99D');
  line(ctx,x+15,y+10,x+w-15,y+10,'#C7D5B1',1.3);
  round(ctx,x+4,y+h-31,w-8,19,7,'#7CA286');
  line(ctx,x+10,y+h-29,x+w-10,y+h-29,'#C0D1A7',1);
  line(ctx,x+3,y+h*.42,x+3,y+h-15,'#517561',3);line(ctx,x+w-3,y+h*.42,x+w-3,y+h-15,'#517561',3);
 }else if(id==='garden'){
  round(ctx,x+4,y+2,w-8,h-5,11,'#FBF0D5');
  dash(ctx,x+10,y+7,x+w-10,y+7,'#D6B286',1);
  round(ctx,x+8,y+h-25,w-16,20,7,'#D99674');
  if(!compact){line(ctx,x+12,y+18,x+12,y+34,'#B9AA8C',2);line(ctx,x+w-12,y+18,x+w-12,y+34,'#B9AA8C',2);}
 }else{
  round(ctx,x+2,y+4,w-4,h-6,18,'#9A8AAD');
  round(ctx,x+5,y+5,w-10,h-13,15,'#EFE0CF');
  round(ctx,x+10,y+9,w-20,compact?13:19,7,'#D2BCDD');
  line(ctx,x+15,y+13,x+w-15,y+13,'#EEE2F0',1.2);
  round(ctx,x+6,y+h-30,w-12,23,10,'#BAA7CB');
  dash(ctx,x+14,y+h-11,x+w-14,y+h-11,'#E3D7E9',1);
 }
}
function emptyFurniture(ctx,r,id){
 const center=r.x+r.w/2,compact=r.h<76,y=r.y+(r.h-27)/2;
 if(id==='garden')bowl(ctx,center,y,compact?.6:1.05,'#CF9977');
 else if(id==='cinema'){
  circle(ctx,center,y,compact?6:10,'#F8ECD0');circle(ctx,center+4,y-3,compact?5:8,'#EFE0CF');
 }else paw(ctx,center,y,compact?.7:1.1,'#6C957A');
}
function scene(ctx,r,id='garden',variant=0,mini=false,mood='neutral'){
 // Composition uses a fixed illustration aspect, so tall/narrow cards never stretch props.
 ctx.save();round(ctx,r.x,r.y,r.w,r.h,22,themes[id]||themes.garden);ctx.clip();
 if(r.w>210&&r.h>300){
  text(ctx,names[id],r.x+r.w/2,r.y+38,23,C.ink,'700','center');
  text(ctx,{bus:'爪印车票，带你慢慢出发',garden:'开饭啦，毛茸茸的小伙伴',cinema:'收好哈欠，一起做个好梦'}[id],r.x+r.w/2,r.y+67,14,C.muted,'normal','center');
  text(ctx,'慢慢来，舒服最重要。',r.x+r.w/2,r.y+r.h-33,14,C.ink,'500','center');
 }
 const scale=Math.max(.1,Math.min(r.w/360,r.h/240)),x=r.x+(r.w-360*scale)/2,y=r.y+(r.h-240*scale)/2;
 ctx.translate(x,y);ctx.scale(scale,scale);
 if(id==='bus'){
  oval(ctx,180,215,138,10,'#526D5022');circle(ctx,89,207,17,'#4A6456');circle(ctx,274,207,17,'#4A6456');circle(ctx,89,207,8,'#E8DAB5');circle(ctx,274,207,8,'#E8DAB5');
  round(ctx,26,31,308,174,32,'#669780');round(ctx,31,37,298,155,28,'#B9D4AF');round(ctx,32,132,296,53,13,'#E7D4A7');
  for(let i=0;i<3;i++)windowPane(ctx,47+i*72,61,63,66);
  round(ctx,270,64,42,114,10,'#648E7C');round(ctx,276,71,30,51,6,'#BAD6CB');line(ctx,291,72,291,175,'#7FA28F',2);
  round(ctx,58,43,127,12,5,'#496E5C');paw(ctx,228,155,1.7,'#75937A');
  circle(ctx,41,172,5,'#DCA37D');circle(ctx,317,172,5,'#FFF3CC');
  if(mini){person(ctx,77,99,41,'#C98E72',variant,mood);person(ctx,150,99,41,'#8A9DB6',variant+1,mood);}
  for(let i=0;i<4;i++)round(ctx,165+i*14,178,8,3,1,'#C2A97F');
 }else if(id==='garden'){
  round(ctx,17,19,326,203,22,'#F9EBD0');
  counter(ctx,30,43,300,56);
  for(let i=0;i<6;i++)round(ctx,29+i*50,22,50,21,5,i%2?'#F3DFBB':'#CA8165');
  round(ctx,145,43,71,31,6,'#698273');paw(ctx,180,59,1.4,'#EEE0B6');
  bowl(ctx,70,54,1,'#A8B58F');bowl(ctx,291,54,1,'#C78E6C');
  leaf(ctx,30,185,.8);leaf(ctx,332,185,.8);
  round(ctx,67,129,227,66,23,'#B88961');round(ctx,62,121,236,63,22,'#DDB987');
  for(let i=0;i<3;i++){
   round(ctx,83+i*68,127,49,39,9,'#F8E8C5');bowl(ctx,108+i*68,143,.78,['#D89775','#8BA696','#BBA9C5'][i]);
   round(ctx,90+i*68,198,40,13,6,'#C78267');
  }
  if(mini){person(ctx,108,112,48,'#93AE9B',variant,mood);person(ctx,245,191,48,'#C98E72',variant+3,mood);}
 }else{
  round(ctx,17,19,326,203,22,'#EDE4EC');
  round(ctx,128,30,104,66,14,'#B1A3C0');round(ctx,133,35,94,56,11,'#F3DCA2');
  circle(ctx,200,54,12,'#FFF1BF');line(ctx,180,37,180,90,'#B1A3C0',3);
  for(const cx of [118,239]){round(ctx,cx,29,15,81,6,'#BFAAD0');line(ctx,cx+5,33,cx+5,98,'#D4C1DC',2);}
  round(ctx,42,129,279,78,30,'#B7A3C6');dash(ctx,65,138,299,138,'#EADFEA',2);dash(ctx,65,196,299,196,'#EADFEA',2);
  for(let i=0;i<3;i++){
   const bx=62+i*88;round(ctx,bx,148,70,47,19,'#9A85AC');round(ctx,bx+4,143,62,43,17,'#E5D2BE');round(ctx,bx+11,145,48,14,7,'#C4B0D3');
   round(ctx,bx+5,170,60,22,11,'#D0BBDD');
  }
  musicBox(ctx,42,111,1.2);lamp(ctx,316,102,1.4);star(ctx,71,59,5);star(ctx,285,50,4);
  if(mini){person(ctx,94,153,39,'#8CA895',variant,mood);person(ctx,269,153,39,'#CE9B83',variant+6,mood);}
 }
 ctx.restore();
}
const tagNames={window:'靠窗',door:'近门',shade:'遮光位',serving:'取餐',lantern:'暖灯',speaker:'轻音乐',front:'前排',middle:'中排',back:'后排',left:'左',center:'中',right:'右',screen:'晨光区',edge:'两端',row1:'第1排',row2:'第2排',row3:'第3排'};
const zoneNames={front:'前排',middle:'中排',back:'后排',garden:'窗边区',kitchen:'取餐侧',screen:'晨光区',rear:'里侧窝'};
function seatDescription(seat){return [...new Set([zoneNames[seat.zone]||seat.zone,...(seat.tags||[]).map(t=>tagNames[t]||t)].filter(Boolean))].join(' · ');}
function seatFeatures(seat){return (seat.tags||[]).filter(t=>['window','door','shade','serving','lantern','speaker'].includes(t)).map(t=>tagNames[t]);}
module.exports={scene,sceneId,boardFrame,seatFurniture,emptyFurniture,seatFeatures,seatDescription,themes,names,paw};
