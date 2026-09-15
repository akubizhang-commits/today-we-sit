'use strict';
// Offline, deterministic QA only. No app, lifecycle or player-storage dependency.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const {person}=require('../src/ui/draw');
const {SPECIES}=require('../src/ui/animals');
const font=process.env.SEAT_PREVIEW_FONT||'/System/Library/Fonts/Hiragino Sans GB.ttc';
if(fs.existsSync(font))GlobalFonts.registerFromPath(font,'Preview CJK');
const moods=[['neutral','平静'],['happy','开心'],['sad','难过'],['sleepy','困倦'],['hurt','委屈'],['angry','生气'],['curious','期待'],['surprised','惊喜']];
function label(ctx,value,x,y,size=15,align='left'){
  ctx.font=`${size}px "Preview CJK", sans-serif`;ctx.fillStyle='#294D43';ctx.textAlign=align;ctx.fillText(value,x,y);
}
function page(w,h){const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');ctx.fillStyle='#F7F3E8';ctx.fillRect(0,0,w,h);return {canvas,ctx};}
function renderEmotionPreviews(directory=path.join(os.tmpdir(),'today-we-sit-emotions')){
  fs.mkdirSync(directory,{recursive:true});
  const sheet=page(1050,1260),{ctx}=sheet;
  label(ctx,'给喵挪个窝 · 12 种动物 × 8 种表情',26,35,24);
  label(ctx,'48px 原尺寸 · motion = 0 · 表情仅影响绘制，不改变规则或身份',26,63,14);
  for(let col=0;col<8;col++){label(ctx,moods[col][1],155+col*115,93,16,'center');label(ctx,moods[col][0],155+col*115,113,11,'center');}
  for(let row=0;row<12;row++){
    const cy=157+row*89;
    label(ctx,SPECIES[row].label,24,cy+1,14);label(ctx,SPECIES[row].id,24,cy+20,11);
    for(let col=0;col<8;col++){
      const cx=155+col*115;ctx.fillStyle=row%2?'#EFF0E3':'#FFFDF6';ctx.fillRect(cx-51,cy-36,102,77);
      person(ctx,cx,cy,48,'#8FAE92',row,moods[col][0],0);
    }
  }
  label(ctx,'兼容别名：satisfied → happy   conflict → hurt   pending → curious',26,1240,14);
  const expressions=path.join(directory,'animal-expressions.png');fs.writeFileSync(expressions,sheet.canvas.toBuffer('image/png'));
  const motionPage=page(1110,595),mc=motionPage.ctx;
  label(mc,'轻微动作与游戏内尺寸检查',22,32,23);
  label(mc,'外部传入 motion ∈ [-1, 1]；不读取时钟、不自动播放',22,57,13);
  for(let i=0;i<12;i++)label(mc,SPECIES[i].label,110+i*83,86,12,'center');
  for(const [row,phase] of [-1,0,1].entries()){
    const cy=135+row*85;label(mc,`motion ${phase}`,12,cy,12);
    for(let i=0;i<12;i++)person(mc,110+i*83,cy,48,'#8FAE92',i,'neutral',phase);
  }
  for(const [row,size] of [13,23,30,48].entries()){
    const cy=384+row*52;label(mc,`${size}px`,20,cy,14);
    for(let i=0;i<8;i++){
      const cx=150+i*116;person(mc,cx,cy,size,'#8FAE92',i%2?7:0,moods[i][0],.6);
      if(row===3)label(mc,moods[i][1],cx,cy+42,12,'center');
    }
  }
  const motions=path.join(directory,'animal-expression-motion-sizes.png');fs.writeFileSync(motions,motionPage.canvas.toBuffer('image/png'));
  return {expressions,motions};
}
if(require.main===module){try{console.log(JSON.stringify(renderEmotionPreviews(process.env.SEAT_EMOTION_PREVIEW_DIR),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={renderEmotionPreviews};
