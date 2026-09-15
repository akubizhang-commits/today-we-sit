'use strict';
const {C,round,circle,line,text}=require('./draw');
const {createRoomPlan}=require('./room-plan');
const {drawRoomProp}=require('./room-props');
function polygon(ctx,points,fill){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function roomShell(ctx,plan){
 const {board:b,id,metrics:m}=plan,x=b.x,y=b.y,w=b.w,h=b.h,side=Math.max(18,m.side*.64),back=y+m.top-5;
 const colors=id==='bus'?{outside:'#C1D2B2',wall:'#86AF99',side:'#64947E',floor:'#EFE2BF',plank:'#D4C5A2',trim:'#547E69'}:id==='garden'?{outside:'#DCE5C5',wall:'#F4DDAA',side:'#DCB27D',floor:'#F4E8CD',plank:'#DFCBA7',trim:'#B98E64'}:{outside:'#D9DEE7',wall:'#DED2E8',side:'#B4A3CA',floor:'#EDE0CE',plank:'#D8C4B1',trim:'#9F8AAF'};
 // Outside is visible around the open-front cutaway, rather than an enclosing board outline.
 round(ctx,x,y,w,h,22,colors.outside);
 for(let i=0;i<5;i++){
  const px=x+8+(i%2)*(w-16),py=y+31+i*(h-60)/5;
  circle(ctx,px,py,8,id==='cinema'?'#C2C9D8':'#A8BF99');circle(ctx,px+4,py+3,5,id==='cinema'?'#CCD3E0':'#C3D3AC');
 }
 ellipse(ctx,x+w/2,y+h-9,w*.44,8,'#3B4D3B22');
 polygon(ctx,[[x+side+3,back+6],[x+w-side+2,back+6],[x+w-side+5,y+h-15],[x+side+3,y+h-15]],'#786B5D22');
 // Back wall has height, wall skirting, and separate side faces.
 round(ctx,x+side-4,y+17,w-side*2+8,m.top-18,4,colors.wall);
 polygon(ctx,[[x+7,y+28],[x+side,y+17],[x+side,back],[x+7,back+8]],colors.side);
 polygon(ctx,[[x+w-side,y+17],[x+w-7,y+28],[x+w-7,back+8],[x+w-side,back]],colors.side);
 round(ctx,x+side,back,w-side*2,h-m.top-12,3,colors.floor);
 ctx.save();ctx.beginPath();ctx.rect(x+side,back,w-side*2,Math.max(1,h-m.top-12));ctx.clip();
 if(id==='garden'){
  for(let yy=back;yy<y+h;yy+=29)for(let xx=x+side;xx<x+w-side;xx+=29){if((Math.floor((yy-back)/29)+Math.floor((xx-x-side)/29))%2===0)round(ctx,xx,yy,28,28,1,'#DFC6A42F');}
 }else{
  for(let yy=back+14;yy<y+h;yy+=24){line(ctx,x+side,yy,x+w-side,yy,colors.plank,.8);for(let xx=x+side+30+((Math.floor((yy-back)/24)%2)*28);xx<x+w-side;xx+=70)line(ctx,xx,yy-23,xx,yy,colors.plank,.6);}
 }
 ctx.restore();
 polygon(ctx,[[x+7,back+8],[x+side,back],[x+side,y+h-18],[x+7,y+h-10]],colors.side);
 polygon(ctx,[[x+w-side,back],[x+w-7,back+8],[x+w-7,y+h-10],[x+w-side,y+h-18]],colors.side);
 line(ctx,x+side,back,x+w-side,back,colors.trim,4);
 line(ctx,x+side,back,x+side,y+h-18,colors.trim,2);line(ctx,x+w-side,back,x+w-side,y+h-18,colors.trim,2);
 line(ctx,x+7,y+28,x+side,y+17,'#FFF7E9AA',2);line(ctx,x+w-side,y+17,x+w-7,y+28,'#FFF7E9AA',2);
 // Open threshold makes this a room with an entrance, not a bordered panel.
 round(ctx,x+w/2-29,y+h-24,58,15,5,id==='bus'?'#A4B894':id==='garden'?'#C79574':'#BAA8C6');
 for(let i=0;i<3;i++)line(ctx,x+w/2-21+i*20,y+h-20,x+w/2-17+i*20,y+h-14,'#E9DFCB',2);
 text(ctx,{bus:'萌宠巴士',garden:'萌宠食堂',cinema:'呼噜午睡屋'}[id],x+w/2,y+8,12,C.ink,'600','center');
}
function drawInfluences(ctx,plan){
 const colors={window:'#FFF1AF55',door:'#CDAE7A35',stereo:'#B2A6D34D',curtain:'#ADA4C445',buffet:'#F7C97B4D',lamp:'#FFD68D55'};
 for(const prop of plan.props){
  if(!colors[prop.kind]||!prop.seatIds.length)continue;
  for(const sid of prop.seatIds){
   const s=plan.seats.find(s=>s.id===sid);
   if(!s)continue;
   // Discrete floor footprints match rule tags; no hidden distance/radius inference.
   round(ctx,s.x-2,s.y-3,s.w+4,s.h+8,10,colors[prop.kind]);
   if(prop.kind==='window'){
    const fromY=prop.y+prop.h*.75;
    if(prop.id==='rear-window')polygon(ctx,[[s.x+5,Math.min(s.y,fromY)],[s.x+s.w-5,Math.min(s.y,fromY)],[s.x+s.w,s.y+s.h],[s.x,s.y+s.h]],'#FFF0B82B');
    else polygon(ctx,[[prop.x+prop.w,prop.y+8],[s.x+s.w*.6,s.y+8],[s.x+s.w*.6,s.y+s.h-8],[prop.x+prop.w,prop.y+prop.h-8]],'#FFF0B845');
   }
  }
 }
 if(plan.id==='cinema'&&plan.seats.length){
  const left=Math.min(...plan.seats.map(s=>s.x))-5,top=Math.min(...plan.seats.map(s=>s.y))-5,right=Math.max(...plan.seats.map(s=>s.x+s.w))+5,bottom=Math.max(...plan.seats.map(s=>s.y+s.h))+6;
  round(ctx,left,top,right-left,bottom-top,18,'#BDA8CE33','#BAA4C344');
 }
}
function drawRoomBoard(ctx,board,level,focus){
 const plan=createRoomPlan(board,level);
 ctx.save();round(ctx,board.x,board.y,board.w,board.h,22,'#E4E6D7');ctx.clip();
 roomShell(ctx,plan);drawInfluences(ctx,plan);
 // Props live on walls/perimeter, away from seat hit rectangles.
 for(const prop of plan.props){
  drawRoomProp(ctx,prop);
  if(focus&&focus.condition&&focus.condition===prop.condition){round(ctx,prop.x,prop.y,prop.w,prop.h,5,null,focus.avoid?C.red:C.orange);circle(ctx,prop.x+prop.w-4,prop.y+5,5,focus.avoid?C.red:C.orange);text(ctx,focus.avoid?'×':'✓',prop.x+prop.w-4,prop.y+5,9,C.white,'600','center');}
 }
 ctx.restore();return plan;
}
module.exports={drawRoomBoard};
