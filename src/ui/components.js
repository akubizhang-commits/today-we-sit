'use strict';
const {C,round,text,line,circle}=require('./draw');
const FONT='-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
function lines(ctx,value,width,size=14){
 ctx.font=`${size}px ${FONT}`;
 const out=[];for(const paragraph of String(value==null?'':value).split('\n')){
  let row='';for(const ch of paragraph){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}out.push(row);
 }return out;
}
function paragraph(ctx,value,x,y,width,size=14,color=C.muted,lineHeight=22){
 const rows=lines(ctx,value,width,size);rows.forEach((row,i)=>text(ctx,row,x,y+i*lineHeight,size,color));return rows.length*lineHeight;
}
function createPainter(ctx,hits){
 function hit(r,action,payload,id){hits.push({...r,id:id||`${action}:${payload&&typeof payload==='object'?(payload.seatId||JSON.stringify(payload)):payload==null?'':payload}`,action,payload});}
 function button(label,r,action,payload,style='primary',disabled=false,id){
  const fg=disabled?C.muted:style==='primary'?C.white:style==='accent'?C.white:C.ink;
  round(ctx,r.x,r.y,r.w,r.h,14,disabled?'#E6E5DA':style==='primary'?C.ink:style==='accent'?C.orange:C.white,style==='secondary'?C.line:null);
  const rows=lines(ctx,label,r.w-16,14),step=17;rows.forEach((s,i)=>text(ctx,s,r.x+r.w/2,r.y+r.h/2+(i-(rows.length-1)/2)*step,14,fg,'600','center'));
  if(!disabled)hit(r,action,payload,id);
 }
 function pager(r,page,count){
  button('上一页',{x:r.x,y:r.y,w:80,h:48},'pagePrev',{pageCount:count},'secondary',page<=0);
  text(ctx,`${page+1} / ${Math.max(1,count)}`,r.x+r.w/2,r.y+24,12,C.muted,'500','center');
  button('下一页',{x:r.x+r.w-80,y:r.y,w:80,h:48},'pageNext',{pageCount:count},'secondary',page>=count-1);
 }
 return{ctx,hits,hit,button,pager};
}
function progress(ctx,r,value,total){
 round(ctx,r.x,r.y,r.w,5,3,'#DEDCCD');if(value>0)round(ctx,r.x,r.y,r.w*Math.min(1,value/Math.max(1,total)),5,3,C.orange);
}
function icon(ctx,name,x,y,size=22,color=C.ink){
 const s=size/24;ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 if(name==='chair'){round(ctx,-8,-9,16,14,4,null,color);line(ctx,-9,7,9,7,color);line(ctx,-8,7,-8,12,color);line(ctx,8,7,8,12,color);}
 else if(name==='sun'){circle(ctx,0,0,5,color);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(ctx,Math.cos(a)*8,Math.sin(a)*8,Math.cos(a)*11,Math.sin(a)*11,color,1.5);}}
 else if(name==='book'){round(ctx,-10,-8,20,17,3,null,color);line(ctx,0,-8,0,9,color);line(ctx,-7,-3,-3,-3,color,1);line(ctx,3,-3,7,-3,color,1);}
 else if(name==='gear'){circle(ctx,0,0,8,color);circle(ctx,0,0,3,C.paper);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(ctx,Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*11,Math.sin(a)*11,color,3);}}
 else {line(ctx,-6,0,6,0,color);line(ctx,0,-6,0,6,color);}
 ctx.restore();
}
module.exports={lines,paragraph,createPainter,progress,icon};
