'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../tools/editor/model');
const engine = require('../src/core/engine');
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({ id: 'custom-001', chapter: 0, chapterId: 'bus', title: 'Local puzzle', kind: 'original',
  seats: [{id:'s1',x:0,y:0,tags:['window'],zone:'front'}, {id:'s2',x:1,y:0,tags:[],zone:'front'}],
  adjacency: [['s1','s2']], people: [{id:'p1',name:'A',rules:[{type:'tag',value:'window',text:'Window'}]}] });

test('demo is an independent original draft of the existing legacy puzzle without its answer', () => {
  const demo = model.createDemo();
  const legacy = require('../src/content/levels').levels[0];
  assert.equal(demo.id, 'custom-001'); assert.equal(demo.kind, 'original');
  assert.deepEqual(demo.seats, legacy.seats); assert.deepEqual(demo.people, legacy.people);
  assert.equal(demo.reference, undefined);
  demo.seats[0].tags.push('edited'); assert.ok(!model.createDemo().seats[0].tags.includes('edited'));
});
test('import normalizes identities and their relationship references without mutating input', () => {
  const input = fixture(); input.id = ' My Puzzle '; input.people[0].id = ' Person A ';
  input.seats[0].id = ' Seat One '; input.adjacency[0][0] = ' Seat One ';
  input.people.push({id:'B',name:'B',rules:[{type:'adjacent',person:' Person A '}]});
  const before = clone(input), result = model.importLevel(JSON.stringify(input));
  assert.equal(result.id, 'my-puzzle'); assert.equal(result.people[1].rules[0].person, 'person-a');
  assert.deepEqual(result.adjacency,[['seat-one','s2']]); assert.deepEqual(input,before);
});
test('invalid JSON, malformed rules, unknown identities, duplicate identities and oversized imports fail', () => {
  assert.throws(() => model.importLevel('{'), /JSON/);
  const cases = [
    l => { l.people[0].rules = {}; },
    l => { l.people[0].rules = [{type:'code',value:'anything'}]; },
    l => { l.people[0].rules = [{type:'adjacent',person:'ghost'}]; },
    l => { l.people[0].rules = [{type:'apart',person:'p1'}]; },
    l => { l.people[0].rules = [{type:'tag',value:''}]; },
    l => { l.adjacency = [['s1','ghost']]; },
    l => { l.seats[1].id = ' S1 '; },
    l => { l.people.push(clone(l.people[0])); },
    l => { l.people = Array.from({length:9},(_,i)=>({id:`p${i}`,name:'P',rules:[]})); },
    l => { l.seats = Array.from({length:13},(_,i)=>({id:`s${i}`,x:i%8,y:Math.floor(i/8),tags:[]})); },
    l => { l.seats[1].x = 0; },
    l => { l.seats[0].x = 8; },
    l => { l.people[0].id = '__proto__'; },
    l => { l.reference = {ghost:'s1'}; },
    l => { l.seats[0].tags = 'window'; }
  ];
  for (const mutate of cases) { const l=fixture(); mutate(l); assert.throws(()=>model.importLevel(JSON.stringify(l))); }
});
test('grid toggles allocate unused ids, prune deleted edges and never infer adjacency or tags', () => {
  let l = model.toggleSeat(fixture(),0,0);
  assert.deepEqual(l.adjacency,[]); assert.deepEqual(l.seats.map(s=>s.id),['s2']);
  l = model.toggleSeat(l,2,0);
  assert.deepEqual(l.seats[1],{id:'s1',x:2,y:0,tags:[],zone:'',label:''});
  assert.deepEqual(l.adjacency,[]);
  l = model.horizontalAdjacency(l); assert.deepEqual(l.adjacency,[['s2','s1']]);
  assert.equal(fixture().seats.length,2);
  const full=fixture(); full.seats=Array.from({length:12},(_,i)=>({id:`s${i+1}`,x:i%4,y:Math.floor(i/4),tags:[]}));
  assert.throws(()=>model.toggleSeat(full,4,0),/12/);
});
test('renaming people rewrites rule targets and deletion removes only rules targeting that person', () => {
  const l=fixture(); l.people.push({id:'p2',name:'B',rules:[{type:'adjacent',person:'p1'},{type:'notTag',value:'door'}]});
  const renamed=model.renamePerson(l,'p1',' New Person ');
  assert.equal(renamed.people[1].rules[0].person,'new-person');
  assert.throws(()=>model.renamePerson(renamed,'new-person','p2'),/重复/);
  const removed=model.removePerson(renamed,'new-person');
  assert.deepEqual(removed.people[0].rules,[{type:'notTag',value:'door',text:''}]);
});
test('validated export retains explicit rules; only requested solver export adds a valid reference', () => {
  const l=fixture(), before=clone(l);
  assert.equal(model.exportLevel(l).reference,undefined);
  const exported=model.exportLevel(l,{withReference:true});
  assert.deepEqual(exported.reference,{p1:'s1'}); assert.equal(engine.evaluate(exported,exported.reference).complete,true);
  assert.deepEqual(exported.people[0].rules,l.people[0].rules); assert.deepEqual(l,before);
  assert.equal(model.importLevel(JSON.stringify(exported)).reference,undefined);
  l.people[0].rules.push({type:'notTag',value:'window'});
  assert.throws(()=>model.exportLevel(l,{withReference:true}),/无解/);
  l.people=[]; assert.throws(()=>model.exportLevel(l),/人物/);
});
test('manual preview swaps occupants and engine evaluates explicit rule edits', () => {
  const l=fixture(); l.people.push({id:'p2',name:'B',rules:[]});
  const placement=model.assignPerson(l,{p1:'s1',p2:'s2'},'p1','s2');
  assert.deepEqual(placement,{p1:'s2',p2:'s1'});
  assert.equal(engine.evaluate(l,placement).people.p1.status,'conflict');
  assert.deepEqual(model.assignPerson(l,placement,'p1',null),{p2:'s1'});
  assert.throws(()=>model.assignPerson(l,{},'ghost','s1'));
});

test('browser bundle graph runs model and solver without Node globals or builtin imports', () => {
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const root=path.resolve(__dirname,'..'),modules=new Map();
  function collect(file){
    const id=path.relative(root,file).split(path.sep).join('/');if(modules.has(id))return id;
    modules.set(id,'');
    const source=fs.readFileSync(file,'utf8').replace(/require\((['"])([^'"]*)\1\)/g,(_,quote,request)=>{
      assert.ok(request.startsWith('.'),`Browser dependency cannot use ${request}`);
      return `require(${JSON.stringify(collect(path.resolve(path.dirname(file),request.endsWith('.js')?request:request+'.js')))})`;
    });
    modules.set(id,source);return id;
  }
  collect(path.join(root,'tools/editor/entry.js'));
  const source=`const modules={${[...modules].map(([id,code])=>`${JSON.stringify(id)}:function(module,exports,require){${code}\n}`).join(',')}};
    const cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;modules[id](m,m.exports,require);return m.exports;}
    const model=require('tools/editor/model.js');JSON.stringify(model.exportLevel(model.createDemo(),{withReference:true}));`;
  const exported=JSON.parse(vm.runInNewContext(source,{}, {timeout:1000}));
  assert.deepEqual(exported.reference,{p1:'s1'});
  assert.equal(engine.evaluate(exported,exported.reference).complete,true);
});

test('text labels survive round-trip literally and invalid edits cannot contaminate the previous draft', () => {
  const input=fixture();input.seats[0].label='<img src=x onerror=alert(1)>';
  input.people[0].name='<script>bad()</script>';
  const draft=model.importLevel(JSON.stringify(input));
  assert.equal(model.exportLevel(draft).seats[0].label,'<img src=x onerror=alert(1)>');
  assert.equal(model.exportLevel(draft).people[0].name,'<script>bad()</script>');
  const before=clone(draft);
  assert.throws(()=>model.renamePerson(draft,'p1','__proto__'));
  assert.deepEqual(draft,before);
});

test('adjacency rejects self and reverse duplicate edges and empty-neighbor export respects the graph', () => {
  for(const adjacency of [[['s1','s1']],[['s1','s2'],['s2','s1']]]){
    const l=fixture();l.adjacency=adjacency;assert.throws(()=>model.normalizeLevel(l));
  }
  const l=fixture();l.people[0].rules=[{type:'emptyNeighbor'}];
  assert.deepEqual(model.exportLevel(l,{withReference:true}).reference,{p1:'s1'});
  l.adjacency=[];assert.throws(()=>model.exportLevel(l,{withReference:true}),/无解/);
});


test('published nine-seat boards and twelve-seat boards import and solve with up to eight people', () => {
  for(const count of [9,12]) {
    const l=fixture(),cols=count===9?3:4;l.seats=Array.from({length:count},(_,i)=>({id:`s${i+1}`,x:i%cols,y:Math.floor(i/cols),tags:[],zone:''}));
    l.people=Array.from({length:8},(_,i)=>({id:`p${i+1}`,name:`P${i+1}`,rules:i===0?[{type:'emptyNeighbor'}]:[]}));
    const imported=model.importLevel(JSON.stringify(l));
    assert.equal(imported.seats.length,count);
    const exported=model.exportLevel(imported,{withReference:true});
    assert.equal(engine.evaluate(exported,exported.reference).complete,true);
    assert.equal(Object.keys(exported.reference).length,8);
  }
});
test('bounded editor search distinguishes exhausted budget from proven impossible and preserves rules', () => {
  const l=fixture(),before=clone(l);
  assert.throws(()=>model.solveLevel(l,{maxSteps:1}),/预算/);
  assert.deepEqual(model.solveLevel(l),{p1:'s1'});
  assert.deepEqual(l,before);
  l.people[0].rules.push({type:'notTag',value:'window'});
  assert.equal(model.solveLevel(l),null);
});
