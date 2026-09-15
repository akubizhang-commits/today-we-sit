'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../src/core/engine');
const {baseEmotion,createReactions,emotionFor,REACTION_MS}=require('../src/features/emotions');
const level={chapterId:'bus',seats:[{id:'s1',tags:['speaker'],zone:'front'},{id:'s2',tags:[],zone:'rear'},{id:'s3',tags:[],zone:'rear'}],adjacency:[['s1','s2']],people:[{id:'a',name:'小满',rules:[{type:'notTag',value:'speaker',text:'不喜欢轻音乐'}]},{id:'b',name:'阿穗',rules:[{type:'adjacent',person:'a',text:'想挨着小满'}]}]};
const feel=(placement,id='a',l=level)=>baseEmotion(l,evaluate(l,placement),placement,id);
test('feelings reflect explicit conflicts and do not punish pending friends',()=>{
 assert.equal(feel({a:'s1'}).mood,'angry');assert.equal(feel({b:'s2'},'b').mood,'curious');
 assert.match(feel({b:'s2'},'b').reason,/等小满入座/);
 assert.equal(feel({a:'s3',b:'s2'},'b').mood,'hurt');assert.equal(feel({a:'s2'}).mood,'happy');
 assert.equal(feel({}).mood,'curious');
});
test('sleepy is a satisfied nap-room state, never an error',()=>{
 const state=feel({a:'s2'},'a',{...level,chapterId:'cinema'});
 assert.equal(state.mood,'sleepy');assert.equal(state.status,'satisfied');assert.match(state.reason,/都满足/);
});
test('surprise and sadness are bounded transitions; reduced motion preserves static meaning',()=>{
 const initial=evaluate(level,{}),good=evaluate(level,{a:'s2'}),bad=evaluate(level,{a:'s1'});
 assert.equal(createReactions(level,initial,good,{a:'s2'},100).a.mood,'surprised');
 const emotionReactions=createReactions(level,good,bad,{a:'s1'},100);
 const app={level,result:bad,session:{placement:{a:'s1'}},emotionReactions,progress:{settings:{}},frameNow:200};
 assert.equal(emotionFor(app,'a').mood,'sad');assert.match(emotionFor(app,'a').reason,/轻音乐/);
 app.frameNow=100+REACTION_MS;assert.equal(emotionFor(app,'a').mood,'angry');assert.equal(emotionFor(app,'a').motion,0);
 app.frameNow=200;app.progress.settings.reducedMotion=true;assert.equal(emotionFor(app,'a').motion,0);assert.equal(emotionFor(app,'a').mood,'angry');
 assert.deepEqual(createReactions(level,bad,bad,{a:'s1'},200),{});
});
test('all authored emotions preserve rule status and refer only to evaluated conflicts',()=>{
 const levels=require('../content/authoring/levels.json'),{solve}=require('../src/core/engine');
 for(const l of levels){const before=JSON.stringify(l),p=solve(l),r=evaluate(l,p);
  for(const person of l.people){assert.equal(baseEmotion(l,r,p,person.id).status,'satisfied');assert.ok(['happy','sleepy'].includes(baseEmotion(l,r,p,person.id).mood));}
  assert.equal(JSON.stringify(l),before);
 }
});
