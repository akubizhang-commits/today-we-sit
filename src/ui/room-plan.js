'use strict';
const {seatRegions,roomMetrics}=require('./layout');
const identity=level=>level.chapterId||['bus','garden','cinema'][level.chapter]||'bus';
/** Single source of placement for room props and their exact rule-bearing seats. */
function createRoomPlan(board,level){
 const id=identity(level),metrics=roomMetrics(board,level.seats),seats=seatRegions({board},level.seats),props=[];
 const {side,top,bottom}=metrics,b=board;
 const byTag=tag=>seats.filter(r=>(r.seat.tags||[]).includes(tag));
 const byZone=zone=>seats.filter(r=>r.seat.zone===zone);
 function add(kind,key,x,y,w,h,affected=[],variant,condition){
  w=Math.max(1,Math.min(w,b.w));h=Math.max(1,Math.min(h,b.h));
  x=Math.max(b.x,Math.min(x,b.x+b.w-w));y=Math.max(b.y,Math.min(y,b.y+b.h-h));
  props.push({id:key,kind,x,y,w,h,seatIds:affected.map(s=>s.id),...(variant?{variant}:{}),...(condition?{condition}:{})});
 }
 const headerY=b.y+17,headerH=Math.max(1,top-21);
 const left=b.x+3,right=b.x+b.w-side+5,propW=side-9;
 if(id==='bus'){
  add('dashboard','driver',b.x+side-10,headerY,b.w-side*2+20,headerH,[]);
  for(const seat of byTag('window'))add('window',`window:${seat.id}`,left,seat.y+2,propW,Math.min(65,seat.h-4),[seat],'outside','tag:window');
 }else{
  const zone=id==='garden'?'garden':'screen',affected=byZone(zone);
  const width=Math.min(119,(b.w-side*2)*.47),height=headerH;
  // The rear window lights only the named window/morning zone, not every seat.
  if(affected.length)add('window','rear-window',b.x+side-3,headerY,width,height,affected,id==='garden'?'garden':'morning',`zone:${zone}`);
  if(top>=55){
   add('picture','paw-picture',b.x+b.w*.56,b.y+24,28,Math.min(36,top-30),[]);
   add('shelf','back-shelf',b.x+b.w-side-54,b.y+30,55,Math.min(47,top-34),[]);
  }
 }
 for(const seat of byTag('door'))add('door',`door:${seat.id}`,right,seat.y-2,propW+3,Math.min(72,seat.h+3),[seat],null,'tag:door');
 const music=byTag('speaker');
 if(music.length){
  const y=music.reduce((sum,s)=>sum+s.y+s.h/2,0)/music.length;
  add('stereo','music-cabinet',right,y-37,propW+2,Math.min(78,b.h-top-bottom),music,null,'tag:speaker');
 }
 for(const seat of byTag('serving'))add('buffet',`buffet:${seat.id}`,right,seat.y+3,propW+2,Math.min(67,seat.h-6),[seat],null,'tag:serving');
 const curtains=byTag('shade'),rows=[...new Set(curtains.map(s=>s.seat.y))];
 for(const row of rows){const affected=curtains.filter(s=>s.seat.y===row),first=affected[0];add('curtain',`curtain:${row}`,left,first.y+2,propW,Math.min(68,first.h-4),affected,null,'tag:shade');}
 const lamps=byTag('lantern');
 if(lamps.length){
  // A real pendant occupies the rear wall; projected warm pools identify its exact targets.
  add('lamp','warm-pendant',b.x+b.w*.50-11,headerY,22,Math.min(57,headerH),lamps,null,'tag:lantern');
 }
 if(bottom>=30){
  add('plant','floor-plant',b.x+5,b.y+b.h-45,32,40,[]);
  add('toybox','toy-basket',b.x+b.w-49,b.y+b.h-34,42,28,[]);
 }
 return {id,board,metrics,seats,props};
}
module.exports={createRoomPlan};
