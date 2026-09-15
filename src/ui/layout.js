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
 const b=layout.board,cellW=(b.w-16)/xs.length,cellH=(b.h-28)/ys.length;
 const w=Math.min(100,cellW-4),h=Math.min(90,cellH-4);
 return seats.map(seat=>({id:seat.id,seat,x:b.x+8+xs.indexOf(seat.x)*cellW+(cellW-w)/2,y:b.y+24+ys.indexOf(seat.y)*cellH+(cellH-h)/2,w,h}));
}
module.exports={computeLayout,seatRegions,clamp,rect};
