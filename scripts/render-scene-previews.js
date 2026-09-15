'use strict';
// Deterministic offline visual QA; does not read or mutate any player's storage.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const cjkFont=process.env.SEAT_PREVIEW_FONT||'/System/Library/Fonts/Hiragino Sans GB.ttc';
if(fs.existsSync(cjkFont))GlobalFonts.registerFromPath(cjkFont,'PingFang SC');
const symbols='/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
if(fs.existsSync(symbols))GlobalFonts.registerFromPath(symbols,'-apple-system');
const {GameApp}=require('../src/app');
const {render}=require('../src/ui/renderer');
const {solve}=require('../src/core/engine');
const {catalog}=require('../src/content/current');
const {computeLayout}=require('../src/ui/layout');
async function main(){
 const dir=process.env.SEAT_PREVIEW_DIR||path.resolve(__dirname,'../assets/marketing/scenes');fs.mkdirSync(dir,{recursive:true});
 const width=Number(process.env.SEAT_PREVIEW_WIDTH)||390,height=Number(process.env.SEAT_PREVIEW_HEIGHT)||844,combined=createCanvas(width*3,height);
 const board=computeLayout({width,height}).board,closeup=createCanvas(width*3,board.h);
 for(const [i,id] of ['bus-006','garden-016','cinema-019'].entries()){
  const canvas=createCanvas(width,height),store=new Map();
  const platform={canvas,width,height,dpr:1,storage:{get:k=>store.get(k),set:(k,v)=>store.set(k,structuredClone(v)),remove:k=>store.delete(k)},onPointer(){},onResize(){},onHide(){},requestFrame(){}};
  const app=new GameApp(platform);await app.ready;app.progress.completed=[...catalog.campaignIds];app.startLevel(id);
  const solution=solve(app.level);
  for(const [p,s] of Object.entries(solution).slice(0,Math.min(3,app.level.people.length-1)))app.place(p,s);
  app.selected=null;app.toast='';app.statusNote='';app.moveArmed=false;
  render(canvas.getContext('2d'),app);await app.pendingSave;
  const file=path.join(dir,`${id}-preview.png`);fs.writeFileSync(file,canvas.toBuffer('image/png'));
  combined.getContext('2d').drawImage(canvas,i*width,0);console.log(file);
  closeup.getContext('2d').drawImage(canvas,0,board.y,width,board.h,i*width,0,width,board.h);
 }
 const file=path.join(dir,'pet-world-preview.png');fs.writeFileSync(file,combined.toBuffer('image/png'));console.log(file);
 const cropped=path.join(dir,'pet-world-scenes.png');fs.writeFileSync(cropped,closeup.toBuffer('image/png'));console.log(cropped);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
