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
  oval(0,21,13,11,fur);oval(0,22,8,8,'#FFF6E099');
  oval(-8,29,6.5,4.5,fur);oval(8,29,6.5,4.5,fur);
  // Ears and horns are drawn behind the head, with different silhouettes per species.
  if(['cat','fox'].includes(id)){
    for(const side of [-1,1]){
      ctx.beginPath();ctx.moveTo(side*17,-8);ctx.quadraticCurveTo(side*20,-17,side*18,-27);
      ctx.quadraticCurveTo(side*17,-30,side*14,-26);ctx.lineTo(side*4,-16);ctx.closePath();ctx.fillStyle=fur;ctx.fill();
      triangle(side*14,-15,side*15,-23,side*8,-17,'#E3ACA6');
    }
  }else if(id==='rabbit'){
    oval(-9,-23,6,12,fur);oval(9,-23,6,12,fur);oval(-9,-24,2.5,8,'#DAA3A0');oval(9,-24,2.5,8,'#DAA3A0');
  }else if(id==='dog'){
    oval(-17,-5,7.5,14,dark);oval(17,-5,7.5,14,dark);
    oval(-18,-8,3,7,'#FFFFFF18');oval(18,-8,3,7,'#FFFFFF18');
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
  // Fuller cheeks and a slightly larger head keep the existing drawing envelope.
  oval(0,-3,19,17.5,fur);
  oval(-12,4,7.5,7,fur);oval(12,4,7.5,7,fur);
  if(id==='sheep'){
    for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;circle(ctx,Math.cos(a)*13,-8+Math.sin(a)*12,6,'#FFF9E8');}
    oval(0,0,13,13,'#E2CFB3');
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
  const masked=id==='panda'||id==='raccoon',eyes=masked?'#FFF9EB':'#35483F';
  oval(-12,5,3.6,2.4,'#DE969477');oval(12,5,3.6,2.4,'#DE969477');
  if(mood==='satisfied'){
    for(const eye of [-6.5,6.5]){ctx.beginPath();ctx.moveTo(eye-2.6,-1.5);ctx.quadraticCurveTo(eye,-5.5,eye+2.6,-1.5);ctx.strokeStyle=eyes;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.stroke();}
  }else{
    for(const eye of [-6.5,6.5]){
      if(masked)oval(eye,-3,3.2,3.8,'#FFF9EB');
      oval(eye,-2.8,2.25,2.9,'#35483F');
      circle(ctx,eye-.65,-3.9,.8,'#FFFDF2');
    }
  }
  // A worried, upward brow reads as asking for help instead of looking angry.
  if(mood==='conflict'){line(ctx,-9,-8,-4,-9.5,dark,1.4);line(ctx,4,-9.5,9,-8,dark,1.4);}
  if(id==='pig'||id==='cow'){
    oval(0,5,id==='cow'?9:7.5,5.5,id==='pig'?'#DD9DA5':'#E7B7AF');circle(ctx,-2.8,4.5,1.1,dark);circle(ctx,2.8,4.5,1.1,dark);
  }else{
    oval(0,2.5,2.3,1.5,id==='mouse'?'#C68C96':dark);
    if(['cat','mouse','tiger'].includes(id))for(const side of [-1,1]){line(ctx,side*11,2,side*18,1,dark,.8);line(ctx,side*12,5,side*18,6,dark,.8);}
  }
  ctx.beginPath();ctx.strokeStyle='#5E6250';ctx.lineWidth=1.3;
  if(mood==='conflict'){ctx.moveTo(-3,11);ctx.quadraticCurveTo(0,7,3,11);}
  else{ctx.moveTo(-3.5,8);ctx.quadraticCurveTo(0,11.5,3.5,8);}
  ctx.stroke();
  if(mood==='satisfied'&&['cat','dog','fox'].includes(id))oval(0,10.2,1.6,1.5,'#D69596');
  // Character-specific scarf helps distinguish friends of the same species.
  round(ctx,-11,14,22,5,2.5,color||'#8DAA96');round(ctx,5,17,6,8,2,color||'#8DAA96');
  circle(ctx,6,16,2.8,color||'#8DAA96');
  oval(-10,23,4.5,5,fur);oval(10,23,4.5,5,fur);
  oval(-8.5,30,2.5,1.4,'#FFF3DF55');oval(8.5,30,2.5,1.4,'#FFF3DF55');
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
