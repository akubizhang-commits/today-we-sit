'use strict';

// Browser-safe authoring boundary: no storage, source-file access, or inferred rules.
const { evaluate } = require('../../src/core/engine');
const TYPES = ['tag', 'notTag', 'zone', 'adjacent', 'apart', 'emptyNeighbor'];
// Display vocabulary only. Never apply these labels to stored IDs or rule values.
const DISPLAY_LABELS = {
  chapter: {bus:'萌宠巴士',garden:'萌宠食堂',cinema:'呼噜午睡屋'},
  tag: {window:'靠窗',door:'门旁',front:'前排',middle:'中排',back:'后排',
    left:'左侧',center:'中间位',right:'右侧',shade:'遮光位',serving:'取餐侧',
    lantern:'暖灯',screen:'晨光区',speaker:'轻音乐',edge:'两端位置',
    row1:'第一排',row2:'第二排',row3:'第三排'},
  zone: {front:'前排',middle:'中排',back:'后排',garden:'窗边区',kitchen:'取餐侧',
    screen:'晨光区',rear:'里侧窝'}
};
function displayLabel(kind, value) {
  const labels=Object.prototype.hasOwnProperty.call(DISPLAY_LABELS,kind)?DISPLAY_LABELS[kind]:{};
  return Object.prototype.hasOwnProperty.call(labels,value)?labels[value]:value;
}
const clone = value => JSON.parse(JSON.stringify(value));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function check(ok, message) { if (!ok) throw new Error(message); }
function text(value, name, fallback = '') {
  if (value === undefined) return fallback;
  check(typeof value === 'string' && value.length <= 2000, `${name}必须为文本，且不超过 2000 个字符。`);
  return value;
}
function normalizeId(value) {
  check(typeof value === 'string', 'ID 必须为文本。');
  const id = value.trim().toLowerCase().replace(/\s+/g, '-');
  check(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) && !['constructor','prototype','__proto__'].includes(id),
    'ID 须以英文字母或数字开头，仅使用英文字母、数字、- 或 _，最多 64 个字符，不能使用保留名称。');
  return id;
}
function coordinate(value) { check(Number.isInteger(value) && value >= 0 && value < 8, '网格坐标必须是 0–7 之间的整数。'); return value; }
function unique(values, name) { check(new Set(values).size === values.length, `${name}重复。`); }
function normalizeLevel(input) {
  check(record(input), '请输入一个关卡的 JSON 对象。');
  check(Array.isArray(input.seats) && input.seats.length <= 12, '编辑器最多支持 12 个座位。');
  check(Array.isArray(input.people) && input.people.length <= 8, '编辑器最多支持 8 位人物。');
  const seats = input.seats.map(s => {
    check(record(s), '座位数据格式不正确。');
    check(s.tags === undefined || (Array.isArray(s.tags) && s.tags.length <= 32), '座位标签须为数组，最多 32 个。');
    const result = {id:normalizeId(s.id),x:coordinate(s.x),y:coordinate(s.y),
      tags:[...new Set((s.tags || []).map(t=>{const v=text(t,'标签').trim(); check(v,'标签不能为空。');return v;}))],
      zone:text(s.zone,'区域')};
    if (s.label !== undefined) result.label=text(s.label,'座位名称');
    return result;
  });
  unique(seats.map(s=>s.id),'座位 ID'); unique(seats.map(s=>`${s.x},${s.y}`),'座位位置');
  const people = input.people.map(p => {
    check(record(p), '人物数据格式不正确。');
    check(Array.isArray(p.rules) && p.rules.length <= 32, '人物规则须为数组，每人最多 32 条。');
    const color = text(p.color,'颜色','#8FAE92');
    check(/^#[0-9a-f]{6}$/i.test(color), '颜色须为 # 加六位十六进制色值。');
    return {id:normalizeId(p.id),name:text(p.name,'人物姓名',p.id),color,rules:p.rules.map(r=>{
      check(record(r) && TYPES.includes(r.type), '规则类型未知或格式不正确。');
      const result={type:r.type,text:text(r.text,'规则说明')};
      if (r.type==='adjacent' || r.type==='apart') result.person=normalizeId(r.person);
      else if (r.type!=='emptyNeighbor') { result.value=text(r.value,'规则值').trim(); check(result.value,'规则值不能为空。'); }
      return result;
    })};
  });
  unique(people.map(p=>p.id),'人物 ID');
  const personIds=new Set(people.map(p=>p.id)), seatIds=new Set(seats.map(s=>s.id));
  for (const p of people) for (const r of p.rules) if (r.person) check(personIds.has(r.person) && r.person!==p.id,'规则目标须为另一位已存在人物的 ID。');
  check(Array.isArray(input.adjacency) && input.adjacency.length <= 66,'相邻关系须为数组，最多 66 条连线。');
  const adjacency=input.adjacency.map(edge=>{
    check(Array.isArray(edge) && edge.length===2,'每条相邻连线必须包含两个座位 ID。');
    const [a,b]=edge.map(normalizeId);
    check(a!==b && seatIds.has(a) && seatIds.has(b),'相邻连线须连接两个不同且已存在的座位。');
    return [a,b];
  });
  unique(adjacency.map(edge=>[...edge].sort().join('|')),'相邻连线');
  if (input.reference !== undefined) {
    check(record(input.reference),'参考答案必须为对象。');
    const keys=Object.keys(input.reference).map(normalizeId), values=Object.values(input.reference).map(normalizeId);
    unique(keys,'参考答案中的人物'); unique(values,'参考答案中的座位');
    check(keys.every(id=>personIds.has(id)) && values.every(id=>seatIds.has(id)),'参考答案包含未知 ID。');
  }
  const chapter=input.chapter===undefined?0:input.chapter;
  check(Number.isInteger(chapter) && chapter>=0 && chapter<=99,'章节编号必须是 0–99 之间的整数。');
  return {id:normalizeId(input.id),title:text(input.title,'关卡标题'),intro:text(input.intro,'关卡介绍'),chapter,
    chapterId:normalizeId(input.chapterId || 'custom'),kind:'original',revision:1,seats,adjacency,people};
}
function importLevel(source) {
  check(typeof source==='string' && source.length<=256*1024,'JSON 须为文本，大小不超过 256 KiB。');
  let parsed; try { parsed=JSON.parse(source); } catch (_) { throw new Error('JSON 格式不正确，请检查逗号、引号和括号。'); }
  return normalizeLevel(parsed);
}
function createDemo() {
  // Standalone snapshot of original legacy level 1, without its author reference.
  return normalizeLevel({id:'custom-001',chapter:0,chapterId:'bus',title:'车窗里的云',intro:'萌宠巴士出发啦。小满想趴在窗边看云，给小爪子找个舒服的位置吧。左侧靠窗，右侧是车门旁。',
    seats:[{id:'s1',x:0,y:0,tags:['row1','left','front','back','window'],zone:'front'},
      {id:'s2',x:1,y:0,tags:['row1','right','front','back','door'],zone:'front'}],adjacency:[['s1','s2']],
    people:[{id:'p1',name:'小满',color:'#D5986D',rules:[{type:'tag',value:'window',text:'想坐靠窗的位置'}]}]});
}
function nextId(items,prefix) { let i=1; while(items.some(item=>item.id===`${prefix}${i}`)) i++; return `${prefix}${i}`; }
function toggleSeat(input,x,y) {
  coordinate(x); coordinate(y);
  const level=normalizeLevel(input), index=level.seats.findIndex(s=>s.x===x && s.y===y);
  if(index>=0) { const id=level.seats[index].id; level.seats.splice(index,1); level.adjacency=level.adjacency.filter(edge=>!edge.includes(id)); }
  else { check(level.seats.length<12,'编辑器最多支持 12 个座位。'); level.seats.push({id:nextId(level.seats,'s'),x,y,tags:[],zone:'',label:''}); }
  return level;
}
function horizontalAdjacency(input) {
  const level=normalizeLevel(input);
  level.adjacency=level.seats.flatMap(a=>level.seats.filter(b=>a.y===b.y && b.x===a.x+1).map(b=>[a.id,b.id]));
  return level;
}
function renamePerson(input,id,next) {
  const level=normalizeLevel(input), person=level.people.find(p=>p.id===id), normalized=normalizeId(next);
  check(person,'人物 ID 不存在。'); check(!level.people.some(p=>p.id===normalized && p!==person),'人物 ID 重复。');
  person.id=normalized;
  for(const p of level.people) for(const r of p.rules) if(r.person===id) r.person=normalized;
  return level;
}
function removePerson(input,id) {
  const level=normalizeLevel(input); level.people=level.people.filter(p=>p.id!==id);
  for(const p of level.people) p.rules=p.rules.filter(r=>r.person!==id);
  return level;
}
function exportLevel(input, options={}) {
  const level=normalizeLevel(input);
  check(level.title.trim(),'关卡标题不能为空。');
  check(level.people.length>0,'导出前请至少添加一位人物。');
  check(level.seats.length>=level.people.length,'导出前请确保座位数不少于人物数。');
  if(options.withReference===true) {
    const reference=solveLevel(level); check(reference && evaluate(level,reference).complete,'当前规则下无解。');
    level.reference=reference;
  }
  return level;
}
// Each candidate evaluation spends a step. Exhaustion is distinct from no solution.
// The shared engine remains the authority for every rule and final completion.
function solveLevel(input, options={}) {
  const level=exportLevel(input), p={}, used=new Set();
  const maxSteps=options.maxSteps===undefined?25000:options.maxSteps;
  check(Number.isInteger(maxSteps) && maxSteps>=1 && maxSteps<=25000,'求解预算必须为 1–25000 步。');
  let steps=0;
  const deadline=Date.now()+1500;
  const neighbors=new Map(level.seats.map(s=>[s.id,new Set()]));
  for(const [a,b] of level.adjacency){neighbors.get(a).add(b);neighbors.get(b).add(a);}
  function compatible(){
    check(++steps<=maxSteps && Date.now()<=deadline,'已达到求解预算上限，尚不能判断是否有解。请简化布局或补充明确的规则后再试。');
    const result=evaluate(level,p);
    if(Object.values(result.people).some(person=>person.status==='conflict'))return false;
    return level.people.every(person=>!p[person.id] || !person.rules.some(rule=>
      rule.type==='emptyNeighbor' && ![...neighbors.get(p[person.id])].some(id=>!used.has(id))));
  }
  function search(){
    if(!compatible())return null;
    const remaining=level.people.filter(person=>!p[person.id]);
    if(!remaining.length)return {...p};
    let chosen,candidates;
    for(const person of remaining){
      const available=[];
      for(const seat of level.seats){
        if(used.has(seat.id))continue;
        p[person.id]=seat.id;used.add(seat.id);
        if(compatible())available.push(seat.id);
        used.delete(seat.id);delete p[person.id];
      }
      if(!available.length)return null;
      if(!candidates || available.length<candidates.length){chosen=person.id;candidates=available;}
    }
    for(const id of candidates){
      p[chosen]=id;used.add(id);
      const result=search();if(result)return result;
      delete p[chosen];used.delete(id);
    }
    return null;
  }
  return search();
}
function assignPerson(input, placement, personId, seatId) {
  const level=normalizeLevel(input);
  check(level.people.some(p=>p.id===personId),'人物 ID 不存在。');
  check(seatId===null || level.seats.some(s=>s.id===seatId),'座位 ID 不存在。');
  check(record(placement),'试坐安排必须为对象。');
  const next={};
  for(const [p,s] of Object.entries(placement)) {
    check(level.people.some(person=>person.id===p) && level.seats.some(seat=>seat.id===s),'试坐安排包含未知人物或座位 ID。');
    next[p]=s;
  }
  unique(Object.values(next),'已占用座位');
  const old=next[personId]; delete next[personId];
  if(seatId!==null) {
    const other=Object.keys(next).find(p=>next[p]===seatId);
    if(other) { if(old) next[other]=old; else delete next[other]; }
    next[personId]=seatId;
  }
  return next;
}
module.exports={TYPES,displayLabel,normalizeId,normalizeLevel,importLevel,createDemo,nextId,toggleSeat,horizontalAdjacency,renamePerson,removePerson,exportLevel,solveLevel,assignPerson,clone};
