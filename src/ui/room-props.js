'use strict';

// Original, static room furniture. No scene imports, assets, clock, or game state.
// Each painter works exclusively in the clipped 0..100 local coordinate space.
const {round,circle,line}=require('./draw');
const P={wood:'#B68D69',edge:'#80634D',light:'#E8CFAB',cream:'#FFF6E4',ink:'#354E45',
  sage:'#A2B89A',leaf:'#5E8062',darkLeaf:'#3F6553',clay:'#C78B70',blue:'#A5C4CE',
  shadow:'#294D4325',gold:'#D8B66F',rose:'#C99891'};
const box=(c,x,y,w,h,fill,r=2)=>round(c,x,y,w,h,r,fill);
function oval(c,x,y,rx,ry,fill,angle=0){
  c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=fill;c.fill();
}
function poly(c,points,fill){
  c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);
  c.closePath();c.fillStyle=fill;c.fill();
}
function curve(c,points,color,width=1.5){
  c.beginPath();c.moveTo(points[0],points[1]);
  c.bezierCurveTo(...points.slice(2));c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
// Keep round hardware round in pixels even on a narrow wall or wide dashboard.
function disc(c,x,y,r,color,aspect){oval(c,x,y,r/Math.max(1,aspect),r*Math.min(1,aspect),color);}
function cloud(c,x,y){
  oval(c,x,y,8,3,'#FFFFFFBE');oval(c,x-4,y-2,4,3,'#FFFFFFBE');oval(c,x+3,y-3,4,4,'#FFFFFFBE');
}
function note(c,x,y){
  line(c,x+3,y,x+3,y+10,P.ink,1.8);line(c,x+3,y,x+8,y+2,P.ink,2);
  oval(c,x,y+10,3.5,2.4,P.ink,-.3);
}

function windowProp(c,variant){
  const night=variant==='night';
  box(c,9,8,86,84,P.shadow,4);
  box(c,5,3,86,82,P.edge,3);box(c,8,5,80,77,P.light,2);
  box(c,13,10,70,65,night?'#4E6878':'#BEDBE0',1);
  if(night){
    circle(c,67,23,7,'#F5DE9C');circle(c,70,20,6,'#4E6878');
    for(const [x,y] of [[20,20],[41,16],[53,28],[77,37]]){line(c,x-1,y,x+1,y,P.cream,.9);line(c,x,y-1,x,y+1,P.cream,.9);}
  }else{circle(c,67,24,7,'#F5DEA2');cloud(c,31,23);}
  poly(c,[[13,58],[26,48],[43,57],[63,49],[83,55],[83,75],[13,75]],night?'#5C786E':'#A2B99A');
  box(c,54,47,23,26,night?'#B59778':'#E3C59B',0);
  poly(c,[[48,49],[65,33],[82,49]],P.clay);poly(c,[[65,33],[82,49],[77,49]],'#A66E59');
  box(c,60,54,8,10,night?'#F3D893':'#ACC9CC',1);line(c,64,54,64,64,P.cream,1);
  line(c,29,48,29,72,P.edge,3);
  oval(c,27,44,12,16,night?'#426858':'#6C936F');oval(c,35,51,10,12,night?'#4B715E':'#82A17B');
  line(c,29,63,34,54,'#557355',1.2);
  line(c,18,15,29,12,'#FFFFFF83',2);line(c,17,22,25,15,'#FFFFFF65',1.4);
  // Frame, mullion, meeting rail and projecting sill sit in front of the view.
  box(c,46,9,5,68,P.light,0);box(c,12,42,72,4,P.light,0);
  line(c,51,11,51,75,'#AC9477',1);line(c,14,46,82,46,'#AC9477',1);
  box(c,3,79,93,8,P.light,2);poly(c,[[3,87],[96,87],[89,92],[10,92]],P.wood);
  line(c,10,81,89,81,'#FFF4DC',1.3);box(c,13,92,70,3,P.shadow,1);
}

function door(c,variant,aspect){
  box(c,9,6,86,90,P.shadow,3);box(c,5,3,85,92,P.edge,2);
  box(c,9,6,77,87,P.light,1);box(c,14,10,67,81,'#394942',0);
  if(variant==='closed'){
    box(c,15,11,65,78,P.wood,1);
    box(c,21,17,53,31,'#C8A17A',1);box(c,21,55,53,28,'#AA825F',1);
    line(c,23,19,72,19,P.light,1);disc(c,70,52,3,P.gold,aspect);line(c,69,52,63,52,P.gold,2);
  }else{
    poly(c,[[15,11],[66,21],[66,85],[15,90]],'#C7A07B');
    poly(c,[[66,21],[71,18],[71,84],[66,85]],P.edge);
    poly(c,[[21,21],[59,28],[59,47],[21,44]],P.wood);
    poly(c,[[21,54],[59,56],[59,78],[21,81]],P.wood);
    line(c,24,24,57,30,P.light,1.3);line(c,25,57,25,76,P.light,1);
    line(c,62,24,62,81,'#A07856',1);disc(c,59,51,3,P.gold,aspect);line(c,58,51,53,50,P.gold,2);
    poly(c,[[72,81],[80,78],[80,90],[41,90]],'#758073');
  }
  for(const y of [25,72])box(c,12,y,4,7,P.edge,1);
  box(c,4,90,88,6,P.light,1);line(c,8,94,88,94,P.wood,1.5);
  box(c,35,3,24,5,'#D5B58C',1);
}

function stereo(c,variant,aspect){
  oval(c,49,95,38,3,P.shadow);
  poly(c,[[72,9],[86,17],[86,88],[72,93]],'#65796B');
  box(c,16,9,59,82,P.wood,3);box(c,20,13,51,74,'#40584D',2);
  line(c,76,18,82,21,'#AAB6A2',1);line(c,80,27,80,80,'#526A5E',1.4);
  box(c,24,16,24,6,'#B3C7A8',1);
  for(const x of [52,59,65])disc(c,x,19,2.4,P.gold,aspect);
  for(const y of [37,71]){
    disc(c,45,y,18,'#1E3934',aspect);disc(c,45,y,15,'#78887C',aspect);
    disc(c,45,y,11,'#425D52',aspect);disc(c,45,y,5,'#B0B8A0',aspect);
    disc(c,43,y-2,1.8,'#D2DAC1',aspect);
  }
  for(const x of [23,66])for(const y of [28,83])disc(c,x,y,1.1,P.light,aspect);
  box(c,22,91,9,5,P.edge,1);box(c,62,91,9,5,P.edge,1);
  note(c,87,25);note(c,87,48);
}

function curtain(c,variant){
  box(c,14,15,72,74,'#D9E3D5',1);box(c,18,19,64,66,'#F9F0D8',1);
  line(c,5,7,95,7,P.edge,3);circle(c,4,7,3,P.gold);circle(c,96,7,3,P.gold);
  line(c,14,4,14,11,P.edge,2);line(c,86,4,86,11,P.edge,2);
  const closed=variant==='closed';
  if(closed){
    poly(c,[[7,14],[48,14],[48,91],[39,94],[28,92],[17,95],[7,93]],'#A4B79B');
    poly(c,[[52,14],[93,14],[93,93],[82,95],[71,92],[60,94],[52,91]],'#9BAE94');
    for(const x of [15,26,38,61,73,85])curve(c,[x,18,x-4,43,x+4,66,x,89],'#748E78',2);
  }else{
    poly(c,[[7,14],[39,14],[28,59],[35,93],[25,95],[16,92],[7,94]],'#A4B79B');
    poly(c,[[61,14],[93,14],[93,94],[84,92],[75,95],[65,93],[72,59]],'#9BAE94');
    for(const [top,mid,bottom] of [[15,14,14],[25,20,23],[34,25,30],[66,75,70],[75,80,77],[85,86,86]]){
      curve(c,[top,19,mid,45,mid,69,bottom,90],'#748E78',1.6);
    }
    box(c,8,57,23,5,P.gold,1);box(c,69,57,23,5,P.gold,1);
    line(c,26,61,30,72,P.gold,1.5);line(c,74,61,70,72,P.gold,1.5);
  }
  for(const x of [12,24,35,65,77,88])line(c,x,9,x,15,P.cream,2);
}

function bowl(c,x,y){
  oval(c,x,y+8,13,3,P.shadow);
  poly(c,[[x-12,y],[x+12,y],[x+8,y+9],[x-7,y+9]],'#CFDBCF');
  oval(c,x,y,12,4,P.cream);oval(c,x,y,9,2.5,'#A8BA87');
  circle(c,x-3,y-1,1.5,P.clay);circle(c,x+4,y,1.6,P.gold);
  line(c,x-7,y+6,x+6,y+6,'#EFF4E4',1.1);
}
function buffet(c){
  oval(c,50,95,41,3,P.shadow);
  poly(c,[[80,40],[93,34],[93,88],[80,93]],P.edge);
  box(c,10,39,72,52,P.wood,2);box(c,15,46,29,36,'#D3B28D',1);box(c,48,46,28,36,'#D3B28D',1);
  line(c,20,51,39,51,P.light,1.3);line(c,53,51,71,51,P.light,1.3);
  line(c,36,59,36,68,P.edge,2);line(c,55,59,55,68,P.edge,2);
  box(c,7,34,84,9,P.light,2);line(c,11,36,86,36,'#FFF2D8',1.6);
  box(c,11,24,34,10,'#819487',2);box(c,14,25,28,6,'#D4DCC9',1);
  box(c,49,22,35,12,'#819487',2);box(c,52,24,29,7,'#D4DCC9',1);
  bowl(c,28,20);bowl(c,66,17);
  box(c,16,91,8,5,P.edge,1);box(c,70,91,8,5,P.edge,1);
}

function lamp(c,variant){
  if(variant==='hanging'){
    line(c,50,3,50,24,P.edge,2);box(c,41,2,18,4,P.wood,2);box(c,44,20,12,5,P.gold,1);
    oval(c,50,62,31,20,'#F3D79436');
    poly(c,[[34,25],[66,25],[80,50],[20,50]],'#DABF89');
    poly(c,[[59,25],[66,25],[80,50],[67,50]],'#BB9A66');
    oval(c,50,50,30,5,'#F8E8BE');circle(c,50,51,4,'#FFF5D7');
    line(c,39,29,31,45,'#F3DFB2',2);line(c,51,28,51,46,'#E8CFA0',1.5);
  }else{
    oval(c,50,93,26,4,P.shadow);oval(c,50,91,21,4,P.edge);oval(c,49,89,18,3,P.wood);
    line(c,50,39,50,88,P.edge,4);line(c,49,43,49,85,P.gold,1.3);
    oval(c,50,50,32,20,'#F3D79430');
    poly(c,[[32,12],[68,12],[83,42],[17,42]],'#DDC38F');
    poly(c,[[61,12],[68,12],[83,42],[71,42]],'#BCA172');
    oval(c,50,42,33,5,'#F8E8BE');line(c,40,16,31,36,'#F8E7C0',2);
    line(c,51,16,51,36,'#E8CFA0',1.5);line(c,62,46,62,59,P.edge,1);
    circle(c,62,60,2,P.gold);box(c,39,10,22,3,P.gold,1);
  }
}

function plant(c){
  oval(c,50,94,27,3,P.shadow);
  line(c,50,74,50,18,P.darkLeaf,3);
  line(c,50,54,29,40,P.darkLeaf,2);line(c,50,41,70,28,P.darkLeaf,2);
  line(c,50,64,70,53,P.darkLeaf,2);line(c,50,32,34,21,P.darkLeaf,1.8);
  oval(c,30,37,16,7,P.leaf,.55);oval(c,70,26,16,8,P.sage,-.5);
  oval(c,70,52,17,8,P.leaf,-.4);oval(c,33,20,14,7,'#7D9B71',.6);
  oval(c,49,17,7,13,P.sage,.05);oval(c,32,55,15,7,'#8FA57C',.45);
  line(c,23,34,37,40,'#AFC29A',1);line(c,61,54,78,49,'#AFC29A',1);
  poly(c,[[29,67],[72,67],[66,91],[36,91]],P.clay);
  poly(c,[[63,68],[72,67],[66,91],[59,91]],'#A76F57');
  oval(c,50,66,22,5,'#DBA58A');oval(c,50,66,17,3,'#645C46');
  box(c,29,67,43,5,'#DCA88A',2);line(c,36,77,64,77,'#EDC0A2',2);line(c,38,82,62,82,'#EDC0A2',1);
}

function shelf(c,variant,aspect){
  box(c,17,9,76,86,P.shadow,2);poly(c,[[82,6],[91,12],[91,91],[82,95]],P.edge);
  box(c,10,6,74,86,P.wood,2);box(c,16,12,62,71,'#DDC4A1',1);
  box(c,20,18,9,24,'#879F9D',1);box(c,30,15,9,27,'#BD8576',1);box(c,40,21,8,21,'#929D76',1);
  for(const [x,y,h] of [[23,21,17],[33,18,20],[43,24,14]]){line(c,x,y,x,y+h,'#FFFFFF55',1);line(c,x,y+3,x+3,y+3,P.cream,1);}
  // A small soft toy, with separate ears, muzzle and paws, sits on the upper shelf.
  disc(c,57,22,5,P.clay,aspect);disc(c,71,22,5,P.clay,aspect);
  oval(c,64,35,10,8,'#DDBB91');disc(c,64,29,10,'#DDBB91',aspect);
  disc(c,60,28,1.2,P.ink,aspect);disc(c,68,28,1.2,P.ink,aspect);
  oval(c,64,32,3,2,P.cream);circle(c,64,31,1,P.edge);
  oval(c,57,40,4,2,P.clay);oval(c,71,40,4,2,P.clay);
  box(c,15,42,65,5,P.edge,1);line(c,17,43,78,43,P.light,1.5);
  box(c,21,66,23,5,'#8FA4A0',1);box(c,23,60,24,5,'#C6977C',1);box(c,25,54,21,5,P.cream,1);
  line(c,29,56,42,56,'#D3BE9B',1);
  box(c,56,62,17,10,P.blue,2);oval(c,64,61,9,2.5,'#E4EADB');
  line(c,64,61,64,51,P.leaf,1.5);oval(c,60,53,6,2.5,P.sage,.4);oval(c,69,50,5,2.5,P.leaf,-.4);
  box(c,15,72,65,5,P.edge,1);line(c,17,73,78,73,P.light,1.5);
  box(c,14,92,8,4,P.edge,1);box(c,72,92,8,4,P.edge,1);
}

function picture(c){
  line(c,26,20,50,5,P.edge,1.4);line(c,50,5,76,20,P.edge,1.4);circle(c,50,5,2,P.gold);
  box(c,21,23,66,72,P.shadow,2);box(c,14,18,69,73,P.edge,2);box(c,17,21,63,67,P.light,1);
  box(c,23,27,51,54,P.cream,0);box(c,26,30,45,48,'#E5E9D8',0);
  oval(c,49,62,14,11,P.clay,-.08);
  oval(c,34,47,5.5,7,P.clay,-.4);oval(c,44,39,5.5,7,P.clay,-.12);
  oval(c,57,40,5.5,7,P.clay,.16);oval(c,66,49,5.5,7,P.clay,.45);
  oval(c,47,59,4,2,'#E3B195',-.1);
  line(c,18,23,22,27,'#FFF0D3',1.3);line(c,76,23,73,27,'#FFF0D3',1.3);
  line(c,19,86,24,81,'#C1A37C',1.2);line(c,78,86,73,81,'#C1A37C',1.2);
}

function toybox(c){
  oval(c,51,94,42,3,P.shadow);
  box(c,13,42,76,43,'#8F7556',4);
  circle(c,30,35,18,'#9EBBC0');
  curve(c,[15,26,22,30,36,29,41,22],'#F5E6C5',3);
  curve(c,[19,49,25,39,36,36,47,34],'#F5E6C5',3);
  circle(c,69,37,19,'#C78E83');
  for(const y of [26,33,40])curve(c,[54,y+3,62,y-5,77,y-3,85,y+4],'#E1ADA0',1.8);
  curve(c,[60,21,70,30,72,40,67,53],'#A46D68',1.6);
  curve(c,[74,48,82,46,87,53,84,59],'#C78E83',2);
  poly(c,[[10,48],[87,48],[92,43],[92,85],[84,92],[14,92]],'#A9815D');
  box(c,10,48,75,44,'#D2AE7C',4);
  for(const y of [57,67,77,87])line(c,14,y,81,y,'#B89062',1.8);
  for(const x of [19,31,43,55,67,79])line(c,x,53,x,88,'#E6C493',1.3);
  box(c,8,45,80,8,'#E4C695',3);line(c,12,48,83,48,P.cream,1.3);
  box(c,33,65,29,12,'#F6E5C5',3);oval(c,48,72,4,3,P.clay);
  for(const [x,y] of [[43,68],[47,67],[51,67],[54,69]])circle(c,x,y,1.3,P.clay);
}

function dashboard(c,variant,aspect){
  const night=variant==='night';
  box(c,2,3,96,53,P.edge,5);box(c,5,7,90,43,night?'#476473':'#B9D5DB',3);
  if(night){circle(c,82,17,5,'#F2DD9B');for(const x of [18,38,64])circle(c,x,13,1,P.cream);}
  else{cloud(c,21,18);circle(c,83,16,5,'#F0D6A0');}
  poly(c,[[5,32],[20,23],[39,33],[53,24],[76,29],[95,25],[95,50],[5,50]],night?'#587768':'#94B18C');
  poly(c,[[36,50],[48,21],[53,21],[68,50]],'#8D9689');
  poly(c,[[38,50],[48,21],[49,21],[41,50]],P.cream);poly(c,[[64,50],[52,21],[53,21],[68,50]],P.cream);
  line(c,51,25,52,31,P.cream,1);line(c,53,37,55,45,P.cream,1.2);
  box(c,71,29,11,12,'#D5B88F',0);poly(c,[[68,29],[76,20],[85,29]],P.clay);
  line(c,16,30,16,45,P.edge,1.8);oval(c,16,29,7,9,P.leaf);
  line(c,6,48,94,48,P.light,2);line(c,8,10,8,44,'#E9EBDD90',1);
  poly(c,[[3,51],[97,51],[94,95],[6,95]],'#829789');box(c,3,49,94,9,'#ADBAA2',3);
  poly(c,[[6,89],[94,89],[94,95],[6,95]],'#5C7669');
  box(c,42,61,29,20,'#38554C',3);box(c,45,64,23,12,'#BACBB0',1);
  for(const x of [50,62]){
    disc(c,x,70,4.5,'#607A6C',aspect);disc(c,x,70,3,'#E7E7CF',aspect);line(c,x,70,x+1,67,P.clay,1);
  }
  // Wide dashboards retain a genuinely circular steering wheel after scaling.
  const rx=22/Math.max(1,aspect),ry=22*Math.min(1,aspect);
  c.beginPath();c.ellipse(25,73,rx,ry,0,0,Math.PI*2);c.strokeStyle=P.ink;c.lineWidth=2.5;c.stroke();
  for(const [dx,dy] of [[-rx*.8,-ry*.5],[rx*.8,-ry*.5],[0,ry*.85]])line(c,25,73,25+dx,73+dy,P.ink,2.2);
  disc(c,25,73,5,P.wood,aspect);
  box(c,79,62,11,16,'#526F63',2);for(const x of [81,84,87])line(c,x,65,x,75,'#ADBEA8',1);
  box(c,47,83,17,3,'#D7D5B5',1);poly(c,[[73,81],[77,88],[69,88]],P.clay);
}

const painters={window:windowProp,door,stereo,curtain,buffet,lamp,plant,shelf,picture,toybox,dashboard};
/**
 * Draw one prop inside {x,y,w,h}; returns false for unknown kinds/invalid bounds.
 * Variants: window/dashboard "night", door/curtain "closed", lamp "hanging".
 * Other variants use the default drawing. No mutation of prop or persistent state.
 */
function drawRoomProp(ctx,prop){
  if(!prop||!Object.prototype.hasOwnProperty.call(painters,prop.kind)||
    ![prop.x,prop.y,prop.w,prop.h].every(Number.isFinite)||prop.w<=0||prop.h<=0)return false;
  ctx.save();
  try{
    ctx.translate(prop.x,prop.y);ctx.scale(prop.w/100,prop.h/100);
    ctx.beginPath();ctx.rect(0,0,100,100);ctx.clip();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowBlur=0;ctx.shadowColor='transparent';ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
    painters[prop.kind](ctx,prop.variant,prop.w/prop.h);
  }finally{ctx.restore();}
  return true;
}
module.exports={drawRoomProp};
