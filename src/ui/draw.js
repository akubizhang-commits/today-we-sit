const C = {
  paper:'#F7F3E8', ink:'#294D43', muted:'#697469', orange:'#C66949',
  sage:'#A8BA99', line:'#DEDCCD', white:'#FFFEF8', red:'#A64E37',
};
function round(ctx,x,y,w,h,r,fill,stroke) {
  const q=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();ctx.moveTo(x+q,y);ctx.lineTo(x+w-q,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+q);ctx.lineTo(x+w,y+h-q);
  ctx.quadraticCurveTo(x+w,y+h,x+w-q,y+h);ctx.lineTo(x+q,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-q);ctx.lineTo(x,y+q);
  ctx.quadraticCurveTo(x,y,x+q,y);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}
}
function text(ctx,str,x,y,size=14,color=C.ink,weight='normal',align='left') {
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(str),x,y);
}
function wrap(ctx,str,x,y,width,size=13,color=C.muted,maxLines=3,lineHeight=20) {
  ctx.font=`${size}px -apple-system, "PingFang SC", sans-serif`;
  const lines=[];let line='';
  for(const ch of str){
    if(ctx.measureText(line+ch).width>width && line){lines.push(line);line=ch;}
    else line+=ch;
  }
  if(line)lines.push(line);
  lines.slice(0,maxLines).forEach((s,i)=>{
    text(ctx,(i===maxLines-1&&lines.length>maxLines)?s.slice(0,-1)+'…':s,x,y+i*lineHeight,size,color);
  });
}
function circle(ctx,x,y,r,color) {
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
}
function line(ctx,x1,y1,x2,y2,color=C.ink,width=2){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
}
// Original vector characters: all shapes are authored here, no external art.
function person(ctx,x,y,size,color,index=0,mood='neutral') {
  ctx.save();ctx.translate(x,y);ctx.scale(size/50,size/50);
  const skin=['#EFC39B','#DCA87C','#F1D0AE','#C9936D'][index%4];
  round(ctx,-19,7,38,26,13,color);
  if(index%3===0){line(ctx,-6,14,6,14,'#FFFFFF88',3);line(ctx,0,11,0,28,'#FFFFFF66',1.5);}
  circle(ctx,0,-4,17,skin);
  ctx.fillStyle=['#4D4B3F','#6E493C','#354A44','#94704C'][index%4];
  ctx.beginPath();ctx.arc(0,-8,17,Math.PI,Math.PI*2);ctx.lineTo(15,-7);ctx.lineTo(7,-12);ctx.lineTo(-10,-5);ctx.closePath();ctx.fill();
  const profile=index%12,hair=['#4D4B3F','#6E493C','#354A44','#94704C'][index%4];
  if(profile===1){circle(ctx,14,-18,7,hair);}
  if(profile===2){round(ctx,-21,-20,42,8,4,C.ink);round(ctx,-13,-30,26,16,6,C.sage);}
  if(profile===3){round(ctx,-19,-12,7,24,4,hair);round(ctx,12,-12,7,24,4,hair);}
  if(profile===4){for(let i=0;i<5;i++)circle(ctx,-14+i*7,-21-(i%2)*3,6,hair);}
  if(profile===5){round(ctx,-18,-25,36,13,6,C.orange);round(ctx,3,-17,22,5,2,C.orange);}
  if(profile===6){circle(ctx,-16,-16,7,hair);circle(ctx,16,-16,7,hair);line(ctx,-13,-15,13,-15,'#DDB677',3);}
  if(profile===7){round(ctx,-18,-22,36,8,4,'#B7B8A5');line(ctx,-17,-14,-17,1,'#B7B8A5',4);}
  if(profile===8){round(ctx,-18,-26,36,14,5,'#D3B575');circle(ctx,0,-30,5,'#D3B575');}
  if(profile===9){line(ctx,-15,-15,-19,6,hair,6);line(ctx,15,-15,19,6,hair,6);circle(ctx,-19,10,4,C.orange);}
  if(profile===10){round(ctx,-20,-18,40,7,3,'#819CB8');round(ctx,-7,13,14,18,4,'#E8C89A');}
  if(profile===11){circle(ctx,-12,-21,8,hair);circle(ctx,0,-25,9,hair);circle(ctx,12,-21,8,hair);}
  circle(ctx,-6,-3,1.6,C.ink);circle(ctx,6,-3,1.6,C.ink);
  if(index%4===0){
    ctx.strokeStyle=C.ink;ctx.lineWidth=1;ctx.beginPath();ctx.arc(-6,-3,5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(6,-3,5,0,Math.PI*2);ctx.stroke();line(ctx,-1,-3,1,-3,C.ink,1);
  }
  ctx.beginPath();ctx.strokeStyle=C.ink;ctx.lineWidth=1.3;
  if(mood==='conflict'){ctx.moveTo(-4,8);ctx.quadraticCurveTo(0,3,4,8);}
  else {ctx.moveTo(-4,5);ctx.quadraticCurveTo(0,10,4,5);}
  ctx.stroke();circle(ctx,-11,4,2.5,'#DD957E66');circle(ctx,11,4,2.5,'#DD957E66');
  ctx.restore();
}
function leaf(ctx,x,y,scale=1){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  line(ctx,0,23,0,-20,C.ink,2);
  for(let i=0;i<3;i++){
    ctx.fillStyle=i%2?C.sage:C.ink;ctx.beginPath();ctx.ellipse(-8,8-i*12,10,5,-0.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(8,2-i*12,10,5,0.5,0,Math.PI*2);ctx.fill();
  }ctx.restore();
}
module.exports={C,round,text,wrap,circle,line,person,leaf};
