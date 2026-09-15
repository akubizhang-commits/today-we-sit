'use strict';
const rect=(x,y,w,h)=>({x,y,w,h});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
/** All rectangles are in platform CSS pixels. Never apply an 844px reference scale. */
function computeLayout({width=390,height=844,insets={},waitingCount=0,expandedRules=false}={}){
 const vw=Math.min(430,width),vx=(width-vw)/2;
 const viewport=rect(vx,0,vw,height);
 const safe=rect(vx+(insets.left||0),insets.top||0,vw-(insets.left||0)-(insets.right||0),height-(insets.top||0)-(insets.bottom||0));
 const tight=safe.h<520;
 const x=safe.x+12,w=safe.w-24,gap=tight?4:8;
 const header=rect(x,safe.y,w,48);
 const toolbar=rect(x,safe.y+safe.h-(tight?100:104),w,tight?100:104);
 const waitingRows=safe.h>=680?2:1,waitingH=waitingRows*64+(tight?4:8);
 const waiting=rect(x,toolbar.y-gap-waitingH,w,waitingH);
 const rules=rect(x,header.y+header.h+gap,w,tight?44:52);
 const board=rect(x,rules.y+rules.h+gap,w,waiting.y-gap-(rules.y+rules.h+gap));
 const body=rect(x,header.y+56,w,toolbar.y-8-(header.y+56));
 const footer=rect(x,safe.y+safe.h-52,w,52);
 const pageBody=rect(x,header.y+56,w,footer.y-8-(header.y+56));
 const overlay=rect(x,safe.y+8,w,safe.h-16);
 const waitingColumns=Math.max(1,Math.floor((w-96)/64)),waitingCapacity=waitingColumns*waitingRows;
 return {viewport,safe,header,body,pageBody,footer,rules,board,waiting,toolbar,overlay,waitingCapacity,waitingColumns,expandedRules,
  scrollRanges:{waiting:Math.max(0,waitingCount-waitingCapacity)}};
}
function seatRegions(layout,seats){
 if(!seats.length)return[];
 const xs=[...new Set(seats.map(s=>s.x))].sort((a,b)=>a-b),ys=[...new Set(seats.map(s=>s.y))].sort((a,b)=>a-b);
 const b=layout.board,m=roomMetrics(b,seats),cellW=(b.w-m.side*2)/xs.length;
 const areaH=b.h-m.top-m.bottom,gridH=Math.min(areaH,ys.length*112);
 const cellH=gridH/ys.length,gridY=b.y+m.top+(areaH-gridH)*.28;
 const w=Math.min(92,cellW-6),h=Math.min(92,cellH-6);
 return seats.map(seat=>({id:seat.id,seat,x:b.x+m.side+xs.indexOf(seat.x)*cellW+(cellW-w)/2,y:gridY+ys.indexOf(seat.y)*cellH+(cellH-h)/2,w,h}));
}
function roomMetrics(b,seats){
 const columns=Math.max(1,new Set(seats.map(s=>s.x)).size),rows=Math.max(1,new Set(seats.map(s=>s.y)).size);
 const bottom=b.h>=300?38:14;
 const side=Math.max(12,Math.min(49,b.w*.13,(b.w-columns*50)/2));
 const top=Math.max(20,Math.min(b.h>=300?102:64,b.h-bottom-rows*50));
 return {side,top,bottom};
}
module.exports={computeLayout,seatRegions,roomMetrics,clamp,rect};
