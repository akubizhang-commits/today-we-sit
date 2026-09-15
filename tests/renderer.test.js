const test=require('node:test');
const assert=require('node:assert/strict');
const {GameApp}=require('../src/app');
const {render}=require('../src/ui/renderer');
function harness(){
  const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:(()=>{})});
  const p={canvas:{getContext:()=>ctx},width:390,height:844,dpr:1,storage:{get(){},set(){}},onPointer(){},onResize(){},onHide(){},requestFrame(){}};
  return {app:new GameApp(p),ctx};
}
test('every seat and waiting person has an unoccluded input target in all 30 levels',()=>{
  const {app,ctx}=harness();app.progress.completed=Array.from({length:30},(_,i)=>i+1);
  for(let id=1;id<=30;id++){
    app.startLevel(id);app.hits=render(ctx,app);
    const seats=app.hits.filter(h=>h.action==='seat');
    const people=app.hits.filter(h=>h.action==='person');
    assert.equal(seats.length,app.level.seats.length);
    assert.equal(people.length,app.level.people.length);
    for(const h of [...seats,...people]){
      assert.equal(app.target(h.x+h.w/2,h.y+h.h/2),h,`level ${id} target occluded`);
      assert.ok(h.x>=0&&h.y>=0&&h.x+h.w<=390&&h.y+h.h<=844);
    }
  }
});
test('hint overlay consumes clicks instead of selecting an obscured waiting person',()=>{
  const {app,ctx}=harness();app.progress.completed=Array.from({length:28},(_,i)=>i+1);
  app.startLevel(29);app.action('hint');app.hits=render(ctx,app);
  assert.equal(app.target(66,678).action,'dismissToast');
});
