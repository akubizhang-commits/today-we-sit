'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { evaluate } = require('../src/core/engine');
const CHAPTERS = ['bus', 'garden', 'cinema'];
const KINDS = ['campaign', 'daily', 'reserve'];
const TAGS = new Set(['window','door','front','middle','back','left','center','right','shade','serving','lantern','screen','speaker','edge','row1','row2','row3']);
const TYPES = new Set(['tag','notTag','zone','adjacent','apart','emptyNeighbor']);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.trim().length > 0;
const safeId = v => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
const canonical = v => JSON.stringify(v);
const unary = (p,s) => p.rules.every(r => r.type==='tag' ? s.tags.includes(r.value) : r.type==='notTag' ? !s.tags.includes(r.value) : r.type==='zone' ? s.zone===r.value : true);

// Geometry and allowed-seat domains, not names, colors, prose, rule order or IDs.
// Canonicalize the undirected relationship graph over all indistinguishable people.
// At <=8 people the worst case is 40320 cheap encodings (no engine searches).
function structuralSignature(level) {
  const seats=[...level.seats].sort((a,b)=>a.y-b.y||a.x-b.x);
  const seatIndex=new Map(seats.map((s,i)=>[s.id,i]));
  const people=level.people;
  const edges=new Set();
  people.forEach((p,i)=>p.rules.forEach(r=>{
    if(r.type==='adjacent'||r.type==='apart') {
      const j=people.findIndex(q=>q.id===r.person);
      edges.add(canonical([r.type,...[i,j].sort((a,b)=>a-b)]));
    }
  }));
  const relations=[...edges].map(JSON.parse);
  const labels=people.map((p,i)=>canonical([
    seats.flatMap((s,j)=>unary(p,s)?[j]:[]),p.rules.some(r=>r.type==='emptyNeighbor'),
    ...['adjacent','apart'].map(type=>relations.filter(([t,a,b])=>t===type&&(a===i||b===i)).length)
  ]));
  const groups=[...new Set(labels)].sort().map(label=>people.flatMap((p,i)=>labels[i]===label?[i]:[]));
  let best=null;
  function permute(values, prefix, emit) {
    if(!values.length) return emit(prefix);
    for(let i=0;i<values.length;i++) permute(values.filter((_,j)=>i!==j),[...prefix,values[i]],emit);
  }
  function visit(group, order) {
    if(group<groups.length) return permute(groups[group],[],p=>visit(group+1,[...order,...p]));
    const mapped=new Map(order.map((old,i)=>[old,i]));
    const code=canonical(relations.map(([type,a,b])=>[type,...[mapped.get(a),mapped.get(b)].sort((a,b)=>a-b)]).sort());
    if(best===null||code<best)best=code;
  }
  visit(0,[]);
  const minX=Math.min(...seats.map(s=>s.x)),minY=Math.min(...seats.map(s=>s.y));
  return canonical({geometry:seats.map(s=>[s.x-minX,s.y-minY]),adjacency:level.adjacency.map(e=>e.map(id=>seatIndex.get(id)).sort((a,b)=>a-b)).sort(),domains:labels.sort(),relations:best});
}

// Search stops at two solutions or the candidate-evaluation budget; never labels
// a capped or interrupted count as an exact count. Every candidate uses the real engine.
function countSolutions(level, nodeBudget) {
  const domains=new Map(level.people.map(p=>[p.id,level.seats.filter(s=>unary(p,s)).map(s=>s.id)]));
  const ordered=[...level.people].sort((a,b)=>domains.get(a.id).length-domains.get(b.id).length||b.rules.length-a.rules.length);
  const neighbors=new Map(level.seats.map(s=>[s.id,new Set()]));
  level.adjacency.forEach(([a,b])=>{neighbors.get(a).add(b);neighbors.get(b).add(a);});
  const placement={},used=new Set();
  let nodes=0,count=0,exhausted=false,first=null;
  function search(index) {
    if(count>=2||exhausted)return;
    if(index===ordered.length) { count++;if(!first)first={...placement};return; }
    const person=ordered[index];
    for(const seat of domains.get(person.id)) {
      if(used.has(seat))continue;
      if(nodes>=nodeBudget){exhausted=true;return;}
      nodes++;placement[person.id]=seat;used.add(seat);
      const result=evaluate(level,placement);
      const conflict=Object.values(result.people).some(p=>p.status==='conflict');
      const stranded=level.people.some(p=>placement[p.id]&&p.rules.some(r=>r.type==='emptyNeighbor')&&![...neighbors.get(placement[p.id])].some(s=>!used.has(s)));
      if(!conflict&&!stranded)search(index+1);
      delete placement[person.id];used.delete(seat);
      if(count>=2||exhausted)return;
    }
  }
  search(0);
  return {solutionCount:count,solutionCountCapped:count>=2,searchStatus:exhausted?'budgetExceeded':count>=2?'multiple':'exhaustive',nodes,first};
}
function validDay(day) {
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const date=new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;
}
function validateContent(levels, manifest, options={}) {
  const errors=[];
  const report={counts:{campaign:0,daily:0,reserve:0},difficulty:{easy:0,normal:0,challenge:0},levels:[],manualPhoneQA:'pending'};
  const error=(code,message,levelId)=>errors.push({code,message,...(levelId?{levelId}:{})});
  const result=()=>({ok:errors.length===0,errors,report});
  if(!Array.isArray(levels)||!object(manifest)){error('schema','Expected levels array and manifest object');return result();}
  const budget=options.nodeBudget===undefined?20000:options.nodeBudget;
  if(!Number.isInteger(budget)||budget<1||budget>1000000){error('schema','nodeBudget must be an integer in 1..1000000');return result();}
  if(manifest.schemaVersion!==1||!text(manifest.contentVersion))error('manifest','Unsupported schemaVersion or missing contentVersion');
  if(!validDay(manifest.dailyCycleAnchorDay))error('manifest','Invalid dailyCycleAnchorDay');
  if(!Array.isArray(manifest.chapters)||manifest.chapters.length!==3||manifest.chapters.some((c,i)=>!object(c)||c.id!==CHAPTERS[i]||!text(c.title)||!text(c.subtitle)||!/^#[0-9a-f]{6}$/i.test(c.color)))error('manifest','Expected bus/garden/cinema chapter metadata');
  const membership=new Map();
  for(const kind of KINDS) {
    const ids=manifest[kind];
    if(!Array.isArray(ids)){error('manifest',`Missing ${kind} array`);continue;}
    report.counts[kind]=ids.length;
    for(const id of ids) {
      if(!safeId(id))error('id',`Invalid manifest ID ${String(id)}`);
      if(membership.has(id))error('duplicate-id',`Repeated manifest ID ${id}`);
      membership.set(id,kind);
    }
  }
  if(options.release) {
    if(manifest.contentVersion!=='1.0.0')error('manifest','v1 release requires contentVersion 1.0.0');
    for(const [kind,count] of Object.entries({campaign:90,daily:14,reserve:20}))if(report.counts[kind]!==count)error('release-count',`${kind} requires ${count} levels`);
    const expectedCampaign=CHAPTERS.flatMap(c=>Array.from({length:30},(_,i)=>`${c}-${String(i+1).padStart(3,'0')}`));
    if(canonical(manifest.campaign)!==canonical(expectedCampaign))error('manifest','v1 campaign order must contain 30 IDs per chapter');
    for(const [kind,count]of [['daily',14],['reserve',20]])if(canonical(manifest[kind])!==canonical(Array.from({length:count},(_,i)=>`${kind}-${String(i+1).padStart(3,'0')}`)))error('manifest',`Invalid ${kind} release IDs/order`);
  }
  const ids=new Set(), signatures=new Map();
  for(const level of levels) {
    if(!object(level)){error('schema','Each level must be an object');continue;}
    const id=level.id;
    const start=errors.length;
    if(!safeId(id)){error('id','Invalid level ID',id);continue;}
    if(ids.has(id))error('duplicate-id','Duplicate authoring ID',id);
    ids.add(id);
    if(!KINDS.includes(level.kind)||membership.get(id)!==level.kind)error('membership','Level kind does not match manifest membership',id);
    if(!CHAPTERS.includes(level.chapterId)||(level.chapter!==undefined&&level.chapter!==CHAPTERS.indexOf(level.chapterId)))error('chapter','Invalid chapter identity',id);
    if(level.kind==='campaign'&&!id.startsWith(`${level.chapterId}-`))error('chapter','Campaign ID does not match chapter',id);
    if(!Number.isInteger(level.revision)||level.revision<1)error('revision','revision must be a positive integer',id);
    if(!['easy','normal','challenge'].includes(level.difficulty)||!text(level.designIntent)||!text(level.title)||!text(level.intro))error('metadata','Missing title, intro, designIntent or difficulty',id);
    if(level.kind==='campaign'&&Object.hasOwn(report.difficulty,level.difficulty))report.difficulty[level.difficulty]++;
    if(!Array.isArray(level.seats)||level.seats.length<1||level.seats.length>12||level.seats.some(s=>!object(s)||!safeId(s.id)||!Array.isArray(s.tags)||!s.tags.every(text)||!text(s.zone))){error('schema','Invalid seat records (1..12 required)',id);continue;}
    if(!Array.isArray(level.people)||level.people.length<1||level.people.length>8||level.people.length>level.seats.length||level.people.some(p=>!object(p)||!safeId(p.id)||!Array.isArray(p.rules)||p.rules.some(r=>!object(r)))){error('people','Invalid person records (1..8 required)',id);continue;}
    const seats=new Map(level.seats.map(s=>[s.id,s])),people=new Map(level.people.map(p=>[p.id,p]));
    if(seats.size!==level.seats.length)error('duplicate-id','Duplicate seat IDs',id);
    if(people.size!==level.people.length)error('people','Duplicate person IDs',id);
    const coords=new Set();
    for(const s of level.seats) {
      if(!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<0||s.x>3||s.y<0||s.y>2||coords.has(`${s.x},${s.y}`))error('geometry','Seats need unique integer coordinates within 4 columns/3 rows',id);
      coords.add(`${s.x},${s.y}`);
      if(s.tags.some(t=>!TAGS.has(t))||new Set(s.tags).size!==s.tags.length)error('tag','Unknown or repeated tag',id);
    }
    // Require complete, visibly horizontal adjacency, not hidden or vertical links.
    const expected=new Set(level.seats.flatMap(a=>level.seats.filter(b=>a.y===b.y&&b.x===a.x+1).map(b=>[a.id,b.id].sort().join(':'))));
    if(!Array.isArray(level.adjacency)||level.adjacency.some(e=>!Array.isArray(e)||e.length!==2||!seats.has(e[0])||!seats.has(e[1])))error('adjacency','Invalid edge references',id);
    else {
      const actual=level.adjacency.map(e=>[...e].sort().join(':'));
      if(actual.length!==new Set(actual).size||actual.length!==expected.size||actual.some(e=>!expected.has(e)))error('adjacency','Edges must equal all immediate horizontal neighbors',id);
    }
    // Scene tags are mechanics, not decoration: match the documented layout convention.
    for(const s of level.seats) {
      const row=level.seats.filter(t=>t.y===s.y),maxX=Math.max(...row.map(t=>t.x)),maxY=Math.max(...level.seats.map(t=>t.y));
      const tags=[`row${s.y+1}`,s.x===0?'left':s.x===maxX?'right':'center'];
      if(s.y===0)tags.push('front');if(s.y===maxY)tags.push('back');if(s.y>0&&s.y<maxY)tags.push('middle');
      let zone;
      if(level.chapterId==='bus'){zone=s.y===0?'front':s.y===maxY?'back':'middle';if(s.x===0)tags.push('window');if(s.x===maxX&&s.y===0)tags.push('door');}
      if(level.chapterId==='garden'){zone=s.y===0?'garden':'kitchen';if(s.x===0)tags.push('shade');if(s.x===maxX)tags.push('serving');if(s.x===1&&s.y===1)tags.push('lantern');}
      if(level.chapterId==='cinema'){zone=s.y===0?'screen':'rear';if(s.y===0)tags.push('screen');if(s.x===maxX)tags.push('speaker');if(s.x===0||s.x===maxX)tags.push('edge');if(s.y===1&&s.x<2)tags.push('shade');}
      if(canonical([...s.tags].sort())!==canonical(tags.sort())||s.zone!==zone)error('tag','Scene labels/zone disagree with seat geometry',id);
    }
    for(const p of level.people) {
      if(!text(p.name)||!/^#[0-9a-f]{6}$/i.test(p.color)||!p.rules.length)error('people','People need names, colors and rules',id);
      for(const r of p.rules) {
        if(!TYPES.has(r.type)||!text(r.text))error('rule','Unsupported rule or missing explanation',id);
        if(['adjacent','apart'].includes(r.type)&&(!people.has(r.person)||r.person===p.id))error('rule-reference','Relationship target missing or self-referential',id);
        if(['tag','notTag'].includes(r.type)&&!level.seats.some(s=>s.tags.includes(r.value)))error('rule-reference','Rule references absent tag',id);
        if(r.type==='zone'&&!level.seats.some(s=>s.zone===r.value))error('rule-reference','Rule references absent zone',id);
        if(r.type==='emptyNeighbor'&&seats.size<=people.size)error('rule','Empty neighbor requires spare seat',id);
      }
    }
    // Invalid structure is not passed into the engine. Invalid reference alone still
    // permits independent solving, so unsatisfiable rules receive their own diagnostic.
    if(errors.length>start)continue;
    const signature=structuralSignature(level);
    if(signatures.has(signature))error('structural-duplicate',`Same geometry and constraint graph as ${signatures.get(signature)}`,id);
    else signatures.set(signature,id);
    if(!object(level.reference)||!evaluate(level,level.reference).complete)error('reference','Reference must seat every person legally, with no extra entries',id);
    const solved=countSolutions(level,budget);
    const {first,...summary}=solved;
    report.levels.push({id,...summary});
    if(solved.searchStatus==='budgetExceeded')error('search-budget',`Search reached ${budget} candidate evaluations; count is incomplete`,id);
    else if(!solved.solutionCount)error('unsolvable','No solution exists',id);
  }
  for(const id of membership.keys())if(!ids.has(id))error('membership',`Manifest references missing level ${id}`);
  if(options.release&&canonical(report.difficulty)!==canonical({easy:36,normal:40,challenge:14}))error('difficulty','Campaign author targets must be 36 easy / 40 normal / 14 challenge');
  return result();
}
function readContent(root) {
  return {levels:JSON.parse(fs.readFileSync(path.join(root,'content/authoring/levels.json'),'utf8')),manifest:JSON.parse(fs.readFileSync(path.join(root,'content/manifest.json'),'utf8'))};
}
if(require.main===module) {
  try {
    const args=process.argv.slice(2);
    let root=path.resolve(__dirname,'..'),release=false;
    for(let i=0;i<args.length;i++) {
      if(args[i]==='--release')release=true;
      else if(args[i]==='--root'&&args[i+1]&&!args[i+1].startsWith('--'))root=path.resolve(args[++i]);
      else throw Error('Usage: node scripts/validate-content.js [--release] [--root directory]');
    }
    const {levels,manifest}=readContent(root);
    const result=validateContent(levels,manifest,{release});
    console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
  }catch(e){console.error(JSON.stringify({ok:false,errors:[{code:'input',message:e.message}]}));process.exitCode=1;}
}
module.exports={validateContent,structuralSignature,readContent};
