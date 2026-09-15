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
function person(ctx,x,y,size,color,identity=0,mood='neutral',motion=0) {
  // The caller supplies the animation phase. Portraits never consult a clock.
  const aliases={satisfied:'happy',conflict:'hurt',pending:'curious'};
  if(Object.prototype.hasOwnProperty.call(aliases,mood))mood=aliases[mood];
  if(!['neutral','happy','sad','sleepy','hurt','angry','curious','surprised'].includes(mood))mood='neutral';
  motion=Number.isFinite(motion)?Math.max(-1,Math.min(1,motion)):0;
  const lift=Math.abs(motion);
  const droop={sad:2.5,sleepy:4,hurt:2,angry:1.5}[mood]||0;
  const earDrop=side=>droop+Math.max(0,side*motion)*1.8+(mood==='curious'&&side===1?3:0);

  const {id,fur,dark}=require('./animals').animalProfile(identity);
  ctx.save();
  try {
  ctx.translate(x,y);ctx.scale(size/50,size/50);
  // Existing shared envelope: rabbit ears at -35, rounded feet below +33.
  ctx.beginPath();ctx.rect(-28,-35,56,69);ctx.clip();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowColor='transparent';ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const oval=(x,y,rx,ry,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const triangle=(x1,y1,x2,y2,x3,y3,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();};
  // Tail, body and four rounded paws retain a readable animal silhouette at 23px.
  if(['cat','tiger','fox','raccoon'].includes(id)){
    ctx.beginPath();ctx.moveTo(11,22);ctx.quadraticCurveTo(30-lift*2,24-motion,22+motion*1.2,9+motion*1.5);ctx.strokeStyle=dark;ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();
    if(id==='fox')oval(23-lift*.8,13+motion*1.3,4,6,'#F6EADA');
  }
  oval(0,21,13,11,fur);oval(0,22,8,8,'#FFF6E099');
  oval(-8,29-Math.max(0,motion)*.7,6.5,4.5,fur);oval(8,29-Math.max(0,-motion)*.7,6.5,4.5,fur);
  // Ears and horns are drawn behind the head, with different silhouettes per species.
  if(['cat','fox'].includes(id)){
    for(const side of [-1,1]){
      const d=earDrop(side);
      ctx.beginPath();ctx.moveTo(side*17,-8);ctx.quadraticCurveTo(side*20,-17+d*.3,side*(18-lift*.5),-27+d);
      ctx.quadraticCurveTo(side*17,-30+d,side*14,-26+d);ctx.lineTo(side*4,-16);ctx.closePath();ctx.fillStyle=fur;ctx.fill();
      triangle(side*14,-15+d*.3,side*15,-23+d,side*8,-17,'#E3ACA6');
    }
  }else if(id==='rabbit'){
    for(const side of [-1,1]){const d=earDrop(side);oval(side*(9-lift*.3),-23+d,6,12-d*.3,fur);oval(side*(9-lift*.3),-24+d,2.5,8-d*.2,'#DAA3A0');}
  }else if(id==='dog'){
    for(const side of [-1,1]){const d=earDrop(side);oval(side*(17-lift*.4),-5+d,7.5,14-d*.2,dark);oval(side*(18-lift*.4),-8+d,3,7,'#FFFFFF18');}
  }else if(id==='cow'){
    triangle(-15,-17,-14,-29,-7,-19,'#C4A372');triangle(15,-17,14,-29,7,-19,'#C4A372');
    for(const side of [-1,1])oval(side*(19-lift*.4),-13+earDrop(side)*.6,7,4,fur);
  }else if(id==='sheep'){
    for(const side of [-1,1])oval(side*(19-lift*.5),-8+earDrop(side)*.5,7,5,dark);
  }else if(id==='pig'){
    for(const side of [-1,1]){const d=earDrop(side);triangle(side*16,-10,side*19,-24+d,side*5,-18,fur);triangle(side*14,-16,side*16,-21+d,side*9,-18,dark);}
  }else{
    const radius=id==='mouse'?10:7;
    for(const side of [-1,1]){const ex=side*(13-lift*.3),ey=-19+earDrop(side);circle(ctx,ex,ey,radius,id==='panda'?dark:fur);if(id!=='panda')circle(ctx,ex,ey,radius*.55,id==='mouse'?'#DBB4B7':dark);}
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
  const eyeCurve=(cx,y,control,width=2)=>{
    ctx.beginPath();ctx.moveTo(cx-3,y);ctx.quadraticCurveTo(cx,control,cx+3,y);
    ctx.strokeStyle=eyes;ctx.lineWidth=width;ctx.stroke();
  };
  for(const eye of [-6.5,6.5]){
    if(mood==='happy')eyeCurve(eye,-1,-6.5,2.1);
    else if(mood==='sleepy'){
      eyeCurve(eye,-2,.5,1.8);line(ctx,eye+2,-1.2,eye+3.4,-.6,eyes,1);
    }else if(mood==='hurt'){
      const toward=eye<0?1:-1;
      ctx.beginPath();ctx.moveTo(eye-toward*2.5,-5);ctx.lineTo(eye+toward*1.6,-2.6);ctx.lineTo(eye-toward*2.5,-.1);
      ctx.strokeStyle=eyes;ctx.lineWidth=1.9;ctx.stroke();
    }else{
      const big=mood==='surprised',curious=mood==='curious',sad=mood==='sad',angry=mood==='angry';
      const rx=big?3.1:curious?(eye<0?2.8:2.1):2.25;
      const ry=big?4:curious?(eye<0?3.7:2.7):sad?2.1:angry?1.8:2.9;
      const cy=sad||angry?-1.5:-2.8;
      if(masked)oval(eye,cy,rx+1,ry+.9,'#FFF9EB');
      oval(eye+(curious?.6:0),cy,rx,ry,'#35483F');
      circle(ctx,eye-.65+(curious?.6:0),cy-ry*.4,big?1.1:.8,'#FFFDF2');
      if(big)circle(ctx,eye+.9,cy+1.3,.5,'#FFFDF2');
    }
  }
  const brow=masked?'#FFF6DF':dark;
  if(mood==='sad'||mood==='hurt'){
    line(ctx,-10,-7,-4,-10,brow,1.6);line(ctx,4,-10,10,-7,brow,1.6);
    if(mood==='sad'){
      triangle(10,1,8.6,4.5,11.4,4.5,'#91BCCA');oval(10,4.4,1.5,1.8,'#91BCCA');
    }
  }else if(mood==='angry'){
    line(ctx,-10,-7.5,-3.8,-4.7,brow,2);line(ctx,3.8,-4.7,10,-7.5,brow,2);
  }else if(mood==='curious'){
    line(ctx,-10,-10,-4,-11.5,brow,1.6);line(ctx,4,-7,9,-6.2,brow,1.4);
  }else if(mood==='surprised'){
    for(const eye of [-6.5,6.5]){ctx.beginPath();ctx.moveTo(eye-2.7,-9);ctx.quadraticCurveTo(eye,-12,eye+2.7,-9);ctx.strokeStyle=brow;ctx.lineWidth=1.5;ctx.stroke();}
  }
  if(id==='pig'||id==='cow'){
    oval(0,5,id==='cow'?9:7.5,5.5,id==='pig'?'#DD9DA5':'#E7B7AF');circle(ctx,-2.8,4.5,1.1,dark);circle(ctx,2.8,4.5,1.1,dark);
  }else{
    oval(0,2.5,2.3,1.5,id==='mouse'?'#C68C96':dark);
    if(['cat','mouse','tiger'].includes(id))for(const side of [-1,1]){line(ctx,side*11,2,side*18,1,dark,.8);line(ctx,side*12,5,side*18,6,dark,.8);}
  }
  const snout=id==='pig'||id==='cow',my=snout?11.6:9;
  ctx.beginPath();ctx.strokeStyle='#5E6250';ctx.lineWidth=1.5;
  if(mood==='happy'){
    ctx.moveTo(-4,my-1);ctx.quadraticCurveTo(0,my+(snout?2:5),4,my-1);ctx.closePath();ctx.fillStyle='#75534C';ctx.fill();
    oval(0,my+(snout?.2:1.2),1.8,snout?.6:1.1,'#D69596');
  }else if(mood==='surprised'){
    oval(0,my,snout?2:2.5,snout?1.5:3,'#75534C');oval(-.5,my-.6,.7,.8,'#E6B8A3');
  }else if(mood==='sleepy'){
    oval(1,my,1.7,snout?1:1.7,'#75534C');
  }else if(mood==='sad'){
    ctx.moveTo(-3.5,my+1);ctx.quadraticCurveTo(0,my-3,3.5,my+1);ctx.stroke();
  }else if(mood==='hurt'){
    ctx.moveTo(-4,my+.4);ctx.quadraticCurveTo(-2,my-2,0,my+.4);ctx.quadraticCurveTo(2,my+2,4,my-.4);ctx.stroke();
  }else if(mood==='angry'){
    ctx.moveTo(-3,my+.2);ctx.quadraticCurveTo(0,my-1.8,3,my+.2);ctx.stroke();
    line(ctx,-1.3,my+1.7,1.3,my+1.7,'#A87D6A',1);
  }else if(mood==='curious'){
    ctx.moveTo(-2,my);ctx.quadraticCurveTo(1,my+2.8,4,my-.6);ctx.stroke();
  }else{
    ctx.moveTo(-3.5,my-.5);ctx.quadraticCurveTo(0,my+2.8,3.5,my-.5);ctx.stroke();
  }
  // Character-specific scarf helps distinguish friends of the same species.
  round(ctx,-11,14,22,5,2.5,color||'#8DAA96');round(ctx,5,17,6,8,2,color||'#8DAA96');
  circle(ctx,6,16,2.8,color||'#8DAA96');
  const pawLift=mood==='surprised'?2.4:mood==='happy'?1:mood==='hurt'?1.6:0;
  const pawMotion=['rabbit','cat','dog','fox'].includes(id)?2:1.1;
  oval(-10+lift*.3,23-pawLift-Math.max(0,motion)*pawMotion,4.5,5,fur);
  oval(10-lift*.3,23-pawLift-Math.max(0,-motion)*pawMotion,4.5,5,fur);
  oval(-8.5,30,2.5,1.4,'#FFF3DF55');oval(8.5,30,2.5,1.4,'#FFF3DF55');
  } finally {ctx.restore();}
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
