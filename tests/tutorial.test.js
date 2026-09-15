'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const tutorial=require('../src/features/tutorial');
const {evaluate,solve}=require('../src/core/engine');
const {createSession}=require('../src/core/session');
const {GameApp}=require('../src/app');
const levels=require('../content/authoring/levels.json');
const manifest=require('../content/manifest.json');
const firstTen=manifest.campaign.slice(0,10).map(id=>levels.find(l=>l.id===id));
const fresh=()=>({tutorial:{completedSteps:[]},settings:{vibration:false}});
const clone=value=>JSON.parse(JSON.stringify(value));

// Use the app's actual selection/move methods with a transient in-memory context.
// No platform constructor, real storage or browser is involved.
function playing(level,n){
  const app={level,screen:'play',won:false,transactionBusy:false,moveRevision:0,session:createSession(level),
    result:evaluate(level,{}),progress:fresh(),audio:{playEffect(){}},platform:{},persist(){},
    learn(action){this.progress=tutorial.advance(this.progress,action,n);},
    afterChange(){this.result=evaluate(this.level,this.session.placement);this.won=this.result.complete;},
    message(text){throw Error(text);}};
  app.selectPerson=GameApp.prototype.selectPerson;app.place=GameApp.prototype.place;
  return app;
}

test('first five prompts finish through actual correct app actions without manufactured conflicts or undo',()=>{
  for(let i=0;i<5;i++){
    const app=playing(firstTen[i],i+1),answer=solve(app.level);assert.ok(answer);
    for(const p of app.level.people){app.selectPerson(p.id);app.place(p.id,answer[p.id]);}
    assert.equal(app.result.complete,true,app.level.id);
    assert.equal(tutorial.getText(i+1,app.session,app.result,app.progress),'',`${app.level.id} must not retain an impossible tutorial step`);
    assert.equal(tutorial.getFocus(i+1,app.progress),null);
  }
});
test('level five teaches empty neighbors using real selection and emptyNeighbor events, not absent relationships',()=>{
  const level=firstTen[4];assert.ok(!level.people.some(p=>p.rules.some(r=>['adjacent','apart'].includes(r.type))));
  const app=playing(level,5);app.selectPerson('p1');
  assert.ok(app.progress.tutorial.completedSteps.includes('level-5:relation'),'keep the historical step identity');
  assert.equal(tutorial.getFocus(5,app.progress),'rules');
  assert.match(tutorial.getText(5,app.session,app.result,app.progress),/空位|空邻座/);
  app.selectPerson('p2');assert.equal(tutorial.getText(5,app.session,app.result,app.progress),'');
});
test('focus follows the exact current step, survives old saved IDs and never points beyond the tutorial',()=>{
  const p=fresh(),before=clone(p);
  for(const [n,focus] of [[1,'person'],[2,'seat'],[3,'rules'],[4,'swap'],[5,'person']])assert.equal(tutorial.getFocus(n,p),focus);
  assert.deepEqual(p,before);
  assert.equal(tutorial.getFocus(5,{tutorial:{completedSteps:['level-5:relation']}}),'rules');
  assert.equal(tutorial.getFocus(5,{tutorial:{completedSteps:['level-5:relation','level-5:emptyNeighbor']}}),null);
  for(const n of [0,6,7,8,9,10,11,999,'constructor','__proto__',NaN])assert.equal(tutorial.getFocus(n,p),null);
});
test('evaluation and unrelated actions cannot acknowledge unseen steps; updates remain pure and idempotent',()=>{
  const p=fresh(),before=clone(p);
  tutorial.getText(1,{placement:{p1:'s1'}},{complete:true},p);tutorial.getFocus(1,p);assert.deepEqual(p,before);
  for(const action of ['place','win','dismiss','highlight','rule:unknown'])assert.deepEqual(tutorial.advance(p,action,1),p);
  assert.deepEqual(tutorial.advance(p,'emptyNeighbor',5),p,'do not skip the first current step');
  const next=tutorial.advance(p,'select',1);assert.deepEqual(p,before);assert.notEqual(next,p);
  assert.deepEqual(tutorial.advance(next,'select',1),next);
  assert.equal(tutorial.getText(1,{},null,clone(next)),'');
});
test('existing conflict, undo and relation acknowledgements remain backward compatible',()=>{
  for(const [n,action,id] of [[3,'conflict','level-3:conflict'],[4,'undo','level-4:swap-or-undo'],[4,'swap','level-4:swap-or-undo'],[5,'relation','level-5:relation']]){
    const next=tutorial.advance(fresh(),action,n);assert.ok(next.tutorial.completedSteps.includes(id));
  }
});
test('pet rule explanations and later orientation appear only on a requested first-appearance rule',()=>{
  for(let n=1;n<=10;n++)assert.doesNotMatch(tutorial.getText(n,{},null,fresh()),/乘客|这个人|两个人/);
  for(let n=6;n<=10;n++){
    assert.equal(tutorial.getText(n,{},null,fresh()),'','later levels have no compulsory interaction task');
    for(const type of new Set(firstTen[n-1].people.flatMap(p=>p.rules.map(r=>r.type)))){
      const p=fresh(),message=tutorial.getText(n,{ruleType:type},null,p);
      assert.ok(message);assert.doesNotMatch(message,/乘客|这个人|两个人/);
      const seen=tutorial.advance(p,`rule:${type}`,n);
      assert.equal(tutorial.getText(n,{ruleType:type},null,seen),'');
    }
  }
  assert.match(tutorial.getText(6,{ruleType:'apart'},null,fresh()),/不相邻|不能.*相邻/);
  assert.match(tutorial.getText(8,{ruleType:'adjacent'},null,fresh()),/三对|三组|满座/);
  assert.match(tutorial.getText(9,{ruleType:'emptyNeighbor'},null,fresh()),/两位|两个/);
  assert.match(tutorial.getText(10,{ruleType:'emptyNeighbor'},null,fresh()),/后排/);
  assert.equal(tutorial.getText(10,{ruleType:'smell'},null,fresh()),'');
});
test('opening tips cover only levels six to ten with concise pet terms and actual rule concepts',()=>{
  for(const [n,type,concept] of [[6,'apart',/不相邻/],[7,'emptyNeighbor',/中排.*空邻座/],[8,'adjacent',/三对.*坐满/],[9,'emptyNeighbor',/两位.*空邻座/],[10,'emptyNeighbor',/后排.*空位/]]){
    const tip=tutorial.getIntro(n);
    assert.equal(typeof tip,'string');assert.ok([...tip].length>0&&[...tip].length<=35);
    assert.match(tip,concept);assert.doesNotMatch(tip,/乘客|这个人|两个人/);
    assert.ok(firstTen[n-1].people.some(p=>p.rules.some(r=>r.type===type)));
  }
  for(const n of [undefined,null,0,1,2,3,4,5,11,999,6.5,'6','constructor','__proto__',NaN,Infinity,{}]){
    assert.equal(tutorial.getIntro(n),'');
  }
});
test('opening tips are deterministic without progress flags or mandatory acknowledgment steps',()=>{
  for(let n=6;n<=10;n++){
    const p=fresh(),before=clone(p),tip=tutorial.getIntro(n);
    for(const action of ['select','place','swap','undo','dismiss']){
      assert.deepEqual(tutorial.advance(p,action,n),before);
      assert.equal(tutorial.getIntro(n),tip);
    }
    const seen=tutorial.advance(p,'rule:emptyNeighbor',n);
    assert.equal(tutorial.getText(n,{ruleType:'emptyNeighbor'},null,seen),'');
    assert.equal(tutorial.getIntro(n),tip,'opening orientation does not depend on previously seen rule types');
    assert.equal(tutorial.getText(n,{},null,p),'');
    assert.equal(tutorial.getFocus(n,p),null);assert.deepEqual(p,before);
  }
});
test('actual first-ten solutions and bounded exhaustive counts substantiate the learning-sequence audit',()=>{
  const counts=[];
  for(const level of firstTen){
    const before=clone(level);assert.equal(evaluate(level,level.reference).complete,true);
    assert.equal(evaluate(level,solve(level)).complete,true);
    let count=0,candidates=0;const placement={},used=new Set();
    function search(i){
      if(i===level.people.length){candidates++;if(evaluate(level,placement).complete)count++;return;}
      for(const s of level.seats)if(!used.has(s.id)){placement[level.people[i].id]=s.id;used.add(s.id);search(i+1);used.delete(s.id);delete placement[level.people[i].id];}
    }
    search(0);assert.ok(candidates<=720);counts.push(count);assert.deepEqual(level,before);
  }
  assert.deepEqual(counts,[1,1,2,2,2,1,2,1,2,2]);
});
