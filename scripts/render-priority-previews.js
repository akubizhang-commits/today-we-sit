'use strict';
// Deterministic memory-only UI verification, no player storage or browser session.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
for(const [file,family] of [['/System/Library/Fonts/Supplemental/Arial Unicode.ttf','-apple-system'],['/System/Library/Fonts/Hiragino Sans GB.ttc','PingFang SC']])if(fs.existsSync(file))GlobalFonts.registerFromPath(file,family);
const {GameApp}=require('../src/app'),{render}=require('../src/ui/renderer');
async function main(){
 const directory=path.resolve(__dirname,'../assets/marketing/priority-polish');fs.mkdirSync(directory,{recursive:true});
 const combined=createCanvas(960,568);
 for(const [i,name] of ['preferences','environment-focus','local-settings'].entries()){
  const canvas=createCanvas(320,568),memory=new Map();
  const app=new GameApp({canvas,width:320,height:568,dpr:1,insets:{top:48,bottom:34},storage:{get:k=>memory.get(k),set:(k,v)=>memory.set(k,structuredClone(v)),remove:k=>memory.delete(k)},onPointer(){},onResize(){},onHide(){},requestFrame(){}});
  await app.ready;app.progress.completed=[...app.catalog.campaignIds];app.startLevel('cinema-001');
  const seat=app.level.seats.find(s=>s.zone==='rear'&&s.tags.includes('speaker'));app.place('p3',seat.id);app.selected='p3';
  if(name==='preferences')app.action('rulesToggle');
  if(name==='environment-focus')app.action('focusRule',{personId:'p3',index:1});
  if(name==='local-settings')app.action('settings');
  app.frameNow=Number.MAX_SAFE_INTEGER;app.toast='';app.statusNote='';app.levelPage=0;
  render(canvas.getContext('2d'),app);await app.pendingSave;
  fs.writeFileSync(path.join(directory,`${name}-320.png`),canvas.toBuffer('image/png'));combined.getContext('2d').drawImage(canvas,i*320,0);
 }
 const file=path.join(directory,'priority-polish.png');fs.writeFileSync(file,combined.toBuffer('image/png'));console.log(file);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
