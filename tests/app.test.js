const test = require('node:test');
const assert = require('node:assert/strict');
const { GameApp } = require('../src/app');

function platform() {
  const data = {};
  return {
    canvas: { getContext: () => ({}) }, width:390,height:844,dpr:1,
    storage: {get:k=>data[k],set:(k,v)=>{data[k]=v;}},
    onPointer(){},onResize(){},onHide(){},requestFrame(){},
  };
}
test('locked levels cannot be entered by navigation', () => {
  const app = new GameApp(platform());
  assert.equal(app.startLevel(30),false);
  assert.equal(app.startLevel(1),true);
  assert.equal(app.level.id,1);
});
test('a legal solution completes and unlocks next level only once', () => {
  const app = new GameApp(platform());
  app.startLevel(1);
  for (const [person,seat] of Object.entries(app.level.reference)) app.place(person,seat);
  assert.equal(app.won,true);
  assert.deepEqual(app.progress.completed,[1]);
  assert.equal(app.startLevel(2),true);
});
test('unfinished placements survive a fresh app instance', () => {
  const p = platform();
  const app = new GameApp(p);
  app.startLevel(1);
  for (const [person,seat] of Object.entries(app.level.reference)) app.place(person,seat);
  app.startLevel(2);
  const [person,seat] = Object.entries(app.level.reference)[0];
  app.place(person,seat);
  const reopened = new GameApp(p);
  reopened.startLevel(2);
  assert.equal(reopened.session.placement[person],seat);
});
test('seat tap survives hit regions being recreated by rendering between down and up',()=>{
  const app=new GameApp(platform());
  app.startLevel(1);app.selected=app.level.people[0].id;
  const seatId=app.level.seats[0].id;
  app.hits=[{x:10,y:10,w:60,h:60,action:'seat',payload:{seatId,personId:null}}];
  app.pointer({type:'down',x:30,y:30});
  app.hits=[{x:10,y:10,w:60,h:60,action:'seat',payload:{seatId,personId:null}}];
  app.pointer({type:'up',x:30,y:30});
  assert.equal(app.session.placement[app.selected],seatId);
});
test('tapping another seated person after a move inspects rather than silently swapping',()=>{
  const app=new GameApp(platform());app.progress.completed=[1,2,3];app.startLevel(4);
  app.place('p1','s1');app.place('p2','s2');
  app.action('seat',{personId:'p1',seatId:'s1'});
  assert.equal(app.selected,'p1');
  assert.deepEqual(app.session.placement,{p1:'s1',p2:'s2'});
  app.action('armMove');
  app.action('seat',{personId:'p2',seatId:'s2'});
  assert.deepEqual(app.session.placement,{p1:'s2',p2:'s1'});
});
test('dismiss hint leaves selected person and arrangement unchanged',()=>{
  const app=new GameApp(platform());app.startLevel(1);
  app.action('hint');const selected=app.selected;
  app.action('dismissToast');
  assert.equal(app.toast,'');
  assert.equal(app.selected,selected);
  assert.deepEqual(app.session.placement,{});
});
test('all 30 levels can be completed through application moves, restored and replayed without losing unlocks',()=>{
  const p=platform();const app=new GameApp(p);
  for(let id=1;id<=30;id++){
    assert.equal(app.startLevel(id),true);
    for(const [person,seat] of Object.entries(app.level.reference))app.place(person,seat);
    assert.equal(app.won,true,`level ${id} did not complete`);
  }
  const reloaded=new GameApp(p);
  assert.equal(reloaded.progress.completed.length,30);
  reloaded.startLevel(1);reloaded.action('reset');
  const replayed=new GameApp(p);
  assert.equal(replayed.progress.completed.length,30);
  assert.equal(replayed.startLevel(30),true);
});
