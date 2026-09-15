'use strict';
const model = require('./model');
const engine = require('../../src/core/engine');
const $ = id => document.getElementById(id);
const STORAGE = 'today-we-sit.editor.draft.v1';
let level=model.createDemo(), placement={}, personId=level.people[0].id, seatId=level.seats[0].id;
let mode='inspect', cols=4, rows=3, paint='window', dirty=true, pending=false, storageAvailable=true;
const statusNames={pending:'待安排',conflict:'不满足',satisfied:'已满足'};
const names={tag:'需要指定标签',notTag:'避开指定标签',zone:'位于指定区域',adjacent:'与指定小动物相邻',apart:'不与指定小动物相邻',emptyNeighbor:'身旁至少有一个空位'};
function notice(message, error=false) { $('notice').textContent=message; $('notice').className=error?'error':''; }
function safe(action) { return (...args)=>{try{action(...args);}catch(error){notice(error.message,true);}}; }
function node(tag, label, className) { const el=document.createElement(tag); if(label!==undefined)el.textContent=label; if(className)el.className=className; return el; }
function button(label, action, className) { const b=node('button',label,className); b.type='button'; b.addEventListener('click',safe(action)); return b; }
function field(parent,label,value,change,options) {
  const wrapper=node('label',undefined,'field'); wrapper.append(node('span',label));
  const input=node(options?'select':'input');
  if(options) for(const [id,name] of options) {const option=node('option',name);option.value=id;input.append(option);}
  input.value=value;
  input.addEventListener('change',safe(()=>change(input.value)));
  wrapper.append(input);parent.append(wrapper);return input;
}
function save() {
  try{localStorage.setItem(STORAGE,JSON.stringify(level));storageAvailable=true;}catch(_){storageAvailable=false;}
  $('save-state').textContent=dirty?`尚未下载 · ${storageAvailable?'草稿已保存在本机':'本机存储不可用，请下载保留修改'}`:'已发起下载，请妥善保存 JSON 文件';
}
function commit(next) {
  level=model.normalizeLevel(next); placement={};dirty=true;pending=false;
  if(!level.people.some(p=>p.id===personId))personId=level.people[0]?.id || '';
  if(!level.seats.some(s=>s.id===seatId))seatId=level.seats[0]?.id || '';
  fitGrid();save();render();
}
function edit(action) {const next=model.clone(level);action(next);commit(next);}
function fitGrid(){cols=Math.max(cols,...level.seats.map(s=>s.x+1));rows=Math.max(rows,...level.seats.map(s=>s.y+1));}
function replaceDraft(next) {
  if((dirty||pending)&&!window.confirm('要替换当前草稿吗？如需保留，请先取消并下载 JSON。'))return;
  personId='';seatId='';commit(next);notice('草稿已载入，导入文件中的参考答案已移除。');
}
function render() {renderMetadata();renderBoard();renderEdges();renderSeat();renderPeople();}
function renderMetadata() {
  const box=$('metadata');box.replaceChildren();
  field(box,'关卡标题',level.title,value=>edit(l=>{l.title=value;}));
  field(box,'关卡 ID',level.id,value=>edit(l=>{l.id=value;}));
  field(box,'章节 ID',level.chapterId,value=>edit(l=>{l.chapterId=value;}));
  box.append(node('p',`当前场景：${model.displayLabel('chapter',level.chapterId)}。章节 ID 仅用于标识，显示名称不会改写存档。`,'help'));
  field(box,'章节编号（0–99）',level.chapter,value=>edit(l=>{l.chapter=Number(value);}));
  field(box,'关卡介绍',level.intro,value=>edit(l=>{l.intro=value;}));
}
function renderBoard() {
  $('counts').textContent=`${level.seats.length}/12 个座位 · ${level.people.length}/8 位小动物`;
  const modes=$('modes');modes.replaceChildren();
  for(const [value,label] of [['inspect','查看座位'],['seats','增删座位'],['labels','涂改标签'],['preview','试坐预览']]) {
    const b=button(label,()=>{mode=value;renderBoard();});b.setAttribute('aria-pressed',String(mode===value));modes.append(b);
  }
  const options=$('board-options');options.replaceChildren();options.className='two';
  const sizes=Array.from({length:8},(_,i)=>[String(i+1),String(i+1)]);
  field(options,'网格列数',cols,value=>{const n=Number(value);if(level.seats.some(s=>s.x>=n))throw Error('请先移除缩小后会落在网格外的座位。');cols=n;renderBoard();},sizes);
  field(options,'网格行数',rows,value=>{const n=Number(value);if(level.seats.some(s=>s.y>=n))throw Error('请先移除缩小后会落在网格外的座位。');rows=n;renderBoard();},sizes);
  if(mode==='labels'){
    field(options,'点击时添加或移除的标签',paint,value=>{paint=value.trim();renderBoard();});
    options.append(node('p',`场景中的称呼：${model.displayLabel('tag',paint)||'未设置'}。标签值保持不变。`,'help'));
  }
  $('board-help').textContent={inspect:'点击座位，在右侧编辑座位名称、标签和区域。',seats:'点击空格添加座位；点击已有座位，移除该座位及其相邻连线。',labels:'点击座位，添加或移除上方输入的标签。英文标签区分大小写。',preview:'先选择下方小动物，再点击座位安排入座。再次点击其座位可让小动物回到候场区。'}[mode];
  const board=$('board');board.replaceChildren();board.style.gridTemplateColumns=`repeat(${cols}, minmax(58px, 1fr))`;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    const seat=level.seats.find(s=>s.x===x&&s.y===y);
    const occupant=seat&&level.people.find(p=>placement[p.id]===seat.id);
    const cell=button('',()=>{
      if(mode==='seats'){commit(model.toggleSeat(level,x,y));notice('座位布局已更新，试坐安排已清空。');return;}
      if(!seat)return;
      seatId=seat.id;
      if(mode==='labels'){if(!paint)throw Error('请先输入要涂改的标签。');edit(l=>{const s=l.seats.find(s=>s.id===seat.id);s.tags=s.tags.includes(paint)?s.tags.filter(t=>t!==paint):[...s.tags,paint];});}
      else if(mode==='preview'){
        if(!personId)throw Error('请先添加并选择一位小动物。');
        placement=model.assignPerson(level,placement,personId,placement[personId]===seat.id?null:seat.id);renderBoard();renderPeople();renderSeat();
      }else{renderBoard();renderSeat();}
    },`cell${seat?' seat':''}${seat?.id===seatId?' selected':''}${occupant?' occupied':''}`);
    cell.setAttribute('aria-label',seat?`${seat.label||seat.id}，第 ${y+1} 行第 ${x+1} 列${occupant?`，${occupant.name}已入座`:''}`:`在第 ${y+1} 行第 ${x+1} 列添加座位`);
    if(seat){cell.append(node('small',seat.id),node('strong',occupant?occupant.name:seat.label||'空座'),node('small',seat.tags.map(tag=>model.displayLabel('tag',tag)).join(' · ')||'无标签'));}
    else{cell.append(node('span','+'),node('small',`${x+1}, ${y+1}`));if(mode!=='seats')cell.disabled=true;}
    board.append(cell);
  }
}
function renderEdges() {
  const edges=$('edges');edges.replaceChildren();
  if(!level.adjacency.length)edges.append(node('p','暂未设置相邻连线。','help'));
  level.adjacency.forEach(([a,b],i)=>edges.append(button(`${a} ↔ ${b} ×`,()=>edit(l=>l.adjacency.splice(i,1)))));
  const box=$('edge-controls');box.replaceChildren();
  if(level.seats.length<2)return;
  const opts=level.seats.map(s=>[s.id,s.label?`${s.id} · ${s.label}`:s.id]);
  const pair=node('div',undefined,'two');let a=opts[0][0],b=opts[1][0];
  field(pair,'座位 A',a,value=>{a=value;},opts);field(pair,'座位 B',b,value=>{b=value;},opts);
  box.append(pair,button('添加相邻连线',()=>edit(l=>l.adjacency.push([a,b]))));
}
function renderSeat() {
  const box=$('seat-inspector');box.replaceChildren();
  const s=level.seats.find(s=>s.id===seatId);
  if(!s){box.append(node('p','请先在网格中添加一个座位。','help'));return;}
  field(box,'当前座位',s.id,value=>{seatId=value;renderSeat();renderBoard();},level.seats.map(s=>[s.id,s.id]));
  box.append(node('p',`第 ${s.y+1} 行 · 第 ${s.x+1} 列`,'help'));
  field(box,'座位名称',s.label||'',value=>edit(l=>{l.seats.find(s=>s.id===seatId).label=value;}));
  field(box,'座位标签（用逗号分隔）',s.tags.join(', '),value=>edit(l=>{l.seats.find(s=>s.id===seatId).tags=value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);}));
  box.append(node('p',`标签展示：${s.tags.map(tag=>model.displayLabel('tag',tag)).join('、')||'无标签'}。上方编辑的是内部值，自定义标签原样显示。`,'help'));
  field(box,'所属区域',s.zone,value=>edit(l=>{l.seats.find(s=>s.id===seatId).zone=value;}));
  box.append(node('p',`区域展示：${model.displayLabel('zone',s.zone)||'未设置'}。改变显示名称不改变区域匹配规则。`,'help'));
  box.append(button('移除此座位',()=>commit(model.toggleSeat(level,s.x,s.y)),'danger'));
}
function renderPeople() {
  const people=$('people');people.replaceChildren();
  for(const p of level.people){
    const b=button(p.name||p.id,()=>{personId=p.id;mode='preview';renderBoard();renderPeople();});
    b.setAttribute('aria-pressed',String(p.id===personId));const dot=node('span',undefined,'dot');dot.style.backgroundColor=p.color;b.prepend(dot);people.append(b);
  }
  const result=engine.evaluate(level,placement), evaluation=$('evaluation');evaluation.replaceChildren();
  evaluation.append(node('p',level.people.length?(result.complete?'所有小动物已入座，全部规则均满足':`${result.satisfied}/${result.total} 条规则已满足 · ${Object.keys(placement).length}/${level.people.length} 位小动物已入座`):'添加小动物后即可试坐预览。'));
  for(const p of level.people){const status=result.people[p.id];const row=node('div',undefined,`status-row ${status.status}`);row.append(node('strong',`${p.name||p.id} · ${statusNames[status.status]}`));for(let i=0;i<status.rules.length;i++){const r=status.rules[i],rule=p.rules[i];row.append(node('div',`${statusNames[r.status]} — ${r.text||names[rule.type]}${rule.value?` (${model.displayLabel(rule.type==='zone'?'zone':'tag',rule.value)})`:rule.person?` (${rule.person})`:''}`));}evaluation.append(row);}
  renderPersonInspector();
}
function renderPersonInspector(){
  const box=$('person-inspector');box.replaceChildren();$('add-person').disabled=level.people.length>=8;
  const person=level.people.find(p=>p.id===personId);
  if(!person){box.append(node('p','先添加小动物，再逐条设置你希望使用的规则。','help'));return;}
  field(box,'当前小动物',person.id,value=>{personId=value;renderPeople();},level.people.map(p=>[p.id,`${p.name} · ${p.id}`]));
  field(box,'小动物姓名',person.name,value=>edit(l=>{l.people.find(p=>p.id===personId).name=value;}));
  field(box,'小动物 ID',person.id,value=>{const next=model.renamePerson(level,personId,value);personId=model.normalizeId(value);commit(next);});
  box.append(button('移除小动物及以其为目标的规则',()=>commit(model.removePerson(level,personId)),'danger'));
  const rules=node('div');
  person.rules.forEach((rule,index)=>{
    const row=node('div',undefined,'rule');const change=action=>edit(l=>action(l.people.find(p=>p.id===personId).rules[index]));
    field(row,`规则 ${index+1}`,rule.type,type=>change(r=>{
      const other=level.people.find(p=>p.id!==personId);
      if(['adjacent','apart'].includes(type)&&!other)throw Error('请先添加另一位小动物，再设置小动物之间的关系规则。');
      delete r.person;delete r.value;r.type=type;
      if(['adjacent','apart'].includes(type))r.person=other.id;
      else if(type!=='emptyNeighbor')r.value=type==='zone'?(level.seats.find(s=>s.zone)?.zone||'front'):(level.seats.flatMap(s=>s.tags)[0]||'window');
    }),model.TYPES.map(t=>[t,names[t]]));
    if(['adjacent','apart'].includes(rule.type))field(row,'目标小动物',rule.person,value=>change(r=>{r.person=value;}),level.people.filter(p=>p.id!==personId).map(p=>[p.id,p.name||p.id]));
    else if(rule.type!=='emptyNeighbor')field(row,rule.type==='zone'?'区域值':'标签值',rule.value,value=>change(r=>{r.value=value;}));
    if(rule.value)row.append(node('p',`场景中的称呼：${model.displayLabel(rule.type==='zone'?'zone':'tag',rule.value)}。规则仍使用上方内部值。`,'help'));
    field(row,'规则说明',rule.text,value=>change(r=>{r.text=value;}));
    row.append(button('移除此规则',()=>edit(l=>l.people.find(p=>p.id===personId).rules.splice(index,1))));rules.append(row);
  });
  box.append(rules,button('+ 添加规则',()=>edit(l=>l.people.find(p=>p.id===personId).rules.push({type:'tag',value:level.seats.flatMap(s=>s.tags)[0]||'window',text:''}))));
}
function download(withReference){
  const exported=model.exportLevel(level,{withReference});
  const json=JSON.stringify(exported,null,2);$('json-text').value=json;
  const url=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'}));
  const a=node('a');a.href=url;a.download=`${exported.id}${withReference?'':'-draft'}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  dirty=false;pending=false;save();notice(withReference?'已发起作者 JSON 下载，包含求解验证通过的参考答案；关卡尚未发布。':'已发起草稿 JSON 下载，不包含参考答案。');
}
$('horizontal').addEventListener('click',safe(()=>{commit(model.horizontalAdjacency(level));notice('已按同排左右紧邻重新生成全部连线，未自动添加规则或标签。');}));
$('add-person').addEventListener('click',safe(()=>{
  if(level.people.length>=8)throw Error('编辑器最多支持 8 位小动物。');
  const id=model.nextId(level.people,'p');personId=id;edit(l=>l.people.push({id,name:`小动物 ${l.people.length+1}`,color:'#8FAE92',rules:[]}));
}));
$('reset-preview').addEventListener('click',()=>{placement={};renderBoard();renderPeople();});
$('solve').addEventListener('click',safe(()=>{
  const validated=model.exportLevel(level);const result=model.solveLevel(validated);
  if(!result)throw Error('当前规则下无解，请调整座位、相邻连线或规则。');
  placement=result;mode='preview';renderBoard();renderPeople();notice('已在试坐区展示解法，未修改规则或写入参考答案。');
}));
$('download').addEventListener('click',safe(()=>download(false)));
$('download-reference').addEventListener('click',safe(()=>download(true)));
$('show-json').addEventListener('click',safe(()=>{$('json-text').value=JSON.stringify(model.exportLevel(level),null,2);notice('已在文本框中生成校验通过的草稿 JSON，不包含参考答案。');}));
$('import-text').addEventListener('click',safe(()=>replaceDraft(model.importLevel($('json-text').value))));
$('json-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>256*1024)throw Error('文件超过 256 KiB 导入上限。');const source=await file.text();replaceDraft(model.importLevel(source));}
  catch(error){notice(error.message,true);}finally{event.target.value='';}
});
$('demo').addEventListener('click',safe(()=>replaceDraft(model.createDemo())));
$('clear-draft').addEventListener('click',safe(()=>{
  if(!window.confirm('要清除本机草稿并恢复示例吗？如需保留，请先取消并下载作品。'))return;
  localStorage.removeItem(STORAGE);level=model.createDemo();placement={};personId=level.people[0].id;seatId=level.seats[0].id;dirty=false;pending=false;cols=4;rows=3;
  $('json-text').value='';render();$('save-state').textContent='本机草稿已清除 · 示例尚未保存';notice('本机草稿已清除，再次编辑会创建新草稿。');
}));
document.addEventListener('input',event=>{if(['INPUT','TEXTAREA'].includes(event.target.tagName)){pending=true;$('save-state').textContent='输入尚未保存 · 完成输入并离开字段后生效；请下载留存副本';}});
window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
try{const saved=localStorage.getItem(STORAGE);if(saved){level=model.importLevel(saved);personId=level.people[0]?.id||'';seatId=level.seats[0]?.id||'';notice('已恢复此浏览器中的本机草稿，请下载 JSON 留存副本。');}}
catch(error){storageAvailable=false;notice(`无法恢复本机草稿：${error.message}. 已打开示例。`,true);}
fitGrid();render();$('save-state').textContent=`尚未下载 · ${storageAvailable?'修改仅保存在当前浏览器':'本机存储不可用'}`;
