'use strict';
// Native-canvas samples with isolated in-memory progress, never browser storage.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
for(const [file,family] of [['/System/Library/Fonts/Supplemental/Arial Unicode.ttf','-apple-system'],['/System/Library/Fonts/Hiragino Sans GB.ttc','PingFang SC']])if(fs.existsSync(file))GlobalFonts.registerFromPath(file,family);
const {GameApp}=require('../src/app'),{render}=require('../src/ui/renderer'),{solve}=require('../src/core/engine');
async function main(){
 const dir=path.resolve(__dirname,'../assets/marketing/emotions');fs.mkdirSync(dir,{recursive:true});
 const {person,text}=require('../src/ui/draw');
 const sample=createCanvas(900,394),sc=sample.getContext('2d');sc.fillStyle='#F7F3E8';sc.fillRect(0,0,900,394);
 text(sc,'给喵挪个窝 · 小伙伴的七种心情',450,25,23,'#294D43','600','center');
 const moods=[['happy','开心'],['sad','难过'],['sleepy','困倦'],['hurt','委屈'],['angry','生气'],['curious','期待'],['surprised','惊喜']];
 for(let row=0;row<3;row++){
  text(sc,['小猫','小狗','小猪'][row],32,112+row*105,15,'#294D43','600','center');
  moods.forEach(([mood,label],col)=>{const x=124+col*117,y=107+row*105;person(sc,x,y,62,'#8FAE92',row,mood,0);if(row===0)text(sc,label,x,61,15,'#294D43','600','center');});
 }
 fs.writeFileSync(path.join(dir,'emotion-highlights.png'),sample.toBuffer('image/png'));

 for(const [name,width,height,reader,complete] of [['music-conflict',390,844,false,false],['emotion-reader-small',320,568,true,false],['nap-complete-small',320,568,false,true],['nap-celebration-small',320,568,false,true]]){
  const canvas=createCanvas(width,height),memory=new Map(),platform={canvas,width,height,dpr:1,insets:{top:48,bottom:34},storage:{get:k=>memory.get(k),set:(k,v)=>memory.set(k,structuredClone(v)),remove:k=>memory.delete(k)},onPointer(){},onResize(){},onHide(){},requestFrame(){}};
  const app=new GameApp(platform);await app.ready;app.progress.completed=[...app.catalog.campaignIds];app.startLevel('cinema-001');
  if(complete){for(const [id,seat] of Object.entries(solve(app.level)))app.place(id,seat);}
  else{const seat=app.level.seats.find(s=>s.zone==='rear'&&s.tags.includes('speaker'));app.place('p3',seat.id);app.selected='p3';}
  if(complete)app.completionPending=name==='nap-celebration-small';
  app.frameNow=Number.MAX_SAFE_INTEGER;app.statusNote='';app.toast='';app.rulesExpanded=reader;app.levelPage=0;
  render(canvas.getContext('2d'),app);await app.pendingSave;
  const file=path.join(dir,`${name}.png`);fs.writeFileSync(file,canvas.toBuffer('image/png'));console.log(file);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
