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
// Original animal portraits. Species is stable by character name, never by seat order.
function person(ctx,x,y,size,color,identity=0,mood='neutral') {
  const {id,fur,dark}=require('./animals').animalProfile(identity);
  ctx.save();ctx.translate(x,y);ctx.scale(size/50,size/50);
  const oval=(x,y,rx,ry,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const triangle=(x1,y1,x2,y2,x3,y3,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();};
  // Tail, body and four rounded paws retain a readable animal silhouette at 23px.
  if(['cat','tiger','fox','raccoon'].includes(id)){
    ctx.beginPath();ctx.moveTo(11,22);ctx.quadraticCurveTo(30,24,22,9);ctx.strokeStyle=dark;ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();
    if(id==='fox')oval(23,13,4,6,'#F6EADA');
  }
  oval(0,20,14,13,fur);oval(0,21,9,10,'#FFF6E088');
  oval(-9,30,7,4,fur);oval(9,30,7,4,fur);
  // Ears and horns are drawn behind the head, with different silhouettes per species.
  if(['cat','fox'].includes(id)){
    triangle(-17,-9,-18,-29,-3,-17,fur);triangle(17,-9,18,-29,3,-17,fur);
    triangle(-14,-15,-15,-24,-8,-17,'#D69491');triangle(14,-15,15,-24,8,-17,'#D69491');
  }else if(id==='rabbit'){
    oval(-9,-23,6,12,fur);oval(9,-23,6,12,fur);oval(-9,-24,2.5,8,'#DAA3A0');oval(9,-24,2.5,8,'#DAA3A0');
  }else if(id==='dog'){
    oval(-16,-6,7,15,dark);oval(16,-6,7,15,dark);
  }else if(id==='cow'){
    triangle(-15,-17,-14,-29,-7,-19,'#C4A372');triangle(15,-17,14,-29,7,-19,'#C4A372');
    oval(-19,-13,7,4,fur);oval(19,-13,7,4,fur);
  }else if(id==='sheep'){
    oval(-19,-8,7,5,dark);oval(19,-8,7,5,dark);
  }else if(id==='pig'){
    triangle(-16,-10,-19,-24,-5,-18,fur);triangle(16,-10,19,-24,5,-18,fur);
    triangle(-14,-16,-16,-21,-9,-18,dark);triangle(14,-16,16,-21,9,-18,dark);
  }else{
    const radius=id==='mouse'?10:7;
    circle(ctx,-13,-19,radius,id==='panda'?dark:fur);circle(ctx,13,-19,radius,id==='panda'?dark:fur);
    if(id!=='panda'){circle(ctx,-13,-19,radius*.55,id==='mouse'?'#DBB4B7':dark);circle(ctx,13,-19,radius*.55,id==='mouse'?'#DBB4B7':dark);}
  }
  oval(0,-4,17,17,fur);
  if(id==='sheep'){
    for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;circle(ctx,Math.cos(a)*13,-8+Math.sin(a)*12,6,'#FFF9E8');}
    oval(0,-1,12,13,'#DCC9AB');
  }
  if(id==='tiger'){
    for(const side of [-1,1]){line(ctx,side*16,-8,side*12,-5,dark,2.5);line(ctx,side*16,-1,side*13,1,dark,2.5);}
    line(ctx,0,-19,0,-12,dark,2.5);line(ctx,-6,-16,6,-16,dark,2);line(ctx,-4,-12,4,-12,dark,2);
  }
  if(id==='cow'){oval(-9,-12,7,7,dark);oval(10,17,5,5,dark);}
  if(id==='dog')oval(-7,-6,7,9,'#F7E9D7');
  if(id==='panda'){oval(-7,-6,5,7,dark);oval(7,-6,5,7,dark);}
  if(id==='raccoon'){oval(-7,-4,9,6,dark);oval(7,-4,9,6,dark);}
  if(id==='fox'){oval(-7,3,9,7,'#FFF0D7');oval(7,3,9,7,'#FFF0D7');}
  if(['bear','dog','tiger'].includes(id))oval(0,4,9,7,'#F7E6CA');
  const eyes=id==='panda'||id==='raccoon'?'#FFF9EB':'#35483F';
  if(mood==='satisfied'){
    for(const eye of [-6,6]){ctx.beginPath();ctx.moveTo(eye-2,-3);ctx.quadraticCurveTo(eye,-6,eye+2,-3);ctx.strokeStyle=eyes;ctx.lineWidth=1.7;ctx.stroke();}
  }else{circle(ctx,-6,-4,1.8,eyes);circle(ctx,6,-4,1.8,eyes);}
  if(mood==='conflict'){line(ctx,-9,-9,-4,-7,dark,1.5);line(ctx,4,-7,9,-9,dark,1.5);}
  if(id==='pig'||id==='cow'){
    oval(0,4,id==='cow'?10:8,6,id==='pig'?'#D98D98':'#E7B7AF');circle(ctx,-3,3,1.5,dark);circle(ctx,3,3,1.5,dark);
  }else{
    triangle(-3,1,3,1,0,4,id==='mouse'?'#C68C96':dark);
    if(['cat','mouse','tiger'].includes(id))for(const side of [-1,1]){line(ctx,side*9,2,side*19,0,dark,1);line(ctx,side*10,5,side*19,6,dark,1);}
  }
  ctx.beginPath();ctx.strokeStyle='#5E6250';ctx.lineWidth=1.3;
  if(mood==='conflict'){ctx.moveTo(-3,11);ctx.quadraticCurveTo(0,7,3,11);}
  else{ctx.moveTo(-3,8);ctx.quadraticCurveTo(0,12,3,8);}
  ctx.stroke();
  // Character-specific scarf helps distinguish friends of the same species.
  round(ctx,-11,13,22,5,2,color||'#8DAA96');triangle(4,16,12,16,9,24,color||'#8DAA96');
  oval(-12,23,4,6,fur);oval(12,23,4,6,fur);
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
