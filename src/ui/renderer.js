'use strict';
const {C}=require('./draw');
const {computeLayout}=require('./layout');
const {createPainter}=require('./components');
const pages=require('./pages');
const {overlay,help}=require('./overlays');
/** Pure frame rendering; state/navigation/entitlements remain owned by GameApp. */
function render(ctx,app){
 const hits=[],width=app.width||app.platform.width||390,height=app.height||app.platform.height||844;
 const waiting=app.level&&app.session?app.level.people.filter(p=>!app.session.placement[p.id]).length:0;
 const layout=computeLayout({width,height,insets:app.platform.insets||{},waitingCount:waiting,expandedRules:app.rulesExpanded});
 ctx.save();ctx.fillStyle='#D9DFD2';ctx.fillRect(0,0,width,height);
 ctx.beginPath();ctx.rect(layout.viewport.x,0,layout.viewport.w,height);ctx.clip();
 ctx.fillStyle=C.paper;ctx.fillRect(layout.viewport.x,0,layout.viewport.w,height);
 ctx.fillStyle='#294D4308';for(let y=8;y<height;y+=24)for(let x=layout.viewport.x+8;x<layout.viewport.x+layout.viewport.w;x+=24)ctx.fillRect(x,y,1,1);
 const painter=createPainter(ctx,hits);
 const page=app.screen==='help'?help:pages[app.screen]||pages.home;
 page(painter,app,layout);overlay(painter,app,layout);
 ctx.restore();return hits;
}
module.exports={render};
