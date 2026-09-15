'use strict';
// Offline expansion of explicitly authored cards. No random generation or remote inputs.
// levels.json is the editable authority; rerun only to rebuild it from these design cards.
const fs = require('node:fs');
const path = require('node:path');
const chapterIds = ['bus', 'garden', 'cinema'];
const cast = [
  ['xiaoman', '小满', '#D5986D'], ['asui', '阿穗', '#8FAE92'], ['atao', '阿陶', '#819CB8'],
  ['yuanyuan', '圆圆', '#BB88A0'], ['xiaolan', '小岚', '#C4AA61'], ['qinghe', '青禾', '#91AAA7'],
  ['ayu', '阿榆', '#AD96BA'], ['linshu', '林叔', '#C68C80'], ['axing', '阿杏', '#B39470'],
  ['xiaoyou', '小游', '#799FA8'], ['susu', '苏苏', '#A89B73'], ['an yi', '安姨', '#AF8397']
].map(([id, name, color]) => ({ id: id.replace(/ /g, '-'), name, color }));
const layouts = { A: [3,3], B: [2,3,2], C: [4,3], D: [3,4], E: [4,4], F: [2,4], G: [3,2], H: [4,2,2], I: [2,2,3], J: [3,3,3] };
const labels = { window:'靠窗', door:'车门旁', front:'第一排', middle:'中间排', back:'最后一排', left:'每排最左侧', right:'每排最右侧', center:'每排非两端', shade:'树荫下', serving:'取餐侧', lantern:'灯笼旁', screen:'银幕前排', speaker:'音箱旁', edge:'每排两端', row1:'第一排', row2:'第二排', row3:'第三排' };
const zones = { front:'车厢前排', middle:'车厢中排', back:'车厢后排', garden:'花园侧', kitchen:'餐台侧', screen:'银幕前排', rear:'观影后排' };
function geometry(chapter, widths) {
  const seats = [];
  widths.forEach((width,y) => {
    for (let x=0;x<width;x++) {
      const tags = [`row${y+1}`, x===0?'left':x===width-1?'right':'center'];
      if (y===0) tags.push('front');
      if (y===widths.length-1) tags.push('back');
      if (y>0 && y<widths.length-1) tags.push('middle');
      let zone;
      if (chapter===0) {
        zone=y===0?'front':y===widths.length-1?'back':'middle';
        if (x===0) tags.push('window');
        if (x===width-1 && y===0) tags.push('door');
      } else if(chapter===1) {
        zone=y===0?'garden':'kitchen';
        if(x===0) tags.push('shade');
        if(x===width-1) tags.push('serving');
        if(x===1&&y===1) tags.push('lantern');
      } else {
        zone=y===0?'screen':'rear';
        if(y===0) tags.push('screen');
        if(x===width-1) tags.push('speaker');
        if(x===0||x===width-1) tags.push('edge');
        if(y===1&&x<2) tags.push('shade');
      }
      seats.push({id:`s${seats.length+1}`,x,y,tags,zone});
    }
  });
  const adjacency = seats.flatMap(a => seats.filter(b=>a.y===b.y&&b.x===a.x+1).map(b=>[a.id,b.id]));
  return {seats,adjacency};
}
function expand(card, index) {
  const [id, chapterId, difficulty, layout, title, occupied, rules, designIntent] = card.split('|');
  const chapter=chapterIds.indexOf(chapterId);
  const refs=occupied.split(',').map(Number);
  const people=rules.split(';').map((line,i)=>({...cast[(index+i)%cast.length],rules:line.trim().split(/\s+/).map(token=> {
    if(token==='*') return {type:'emptyNeighbor',text:'左右至少留一个相邻空位'};
    if (/^[+!]/.test(token)) return {type:token[0]==='+'?'adjacent':'apart',target:Number(token.slice(1))-1};
    const type=token[0]==='@'?'zone':token[0]==='-'?'notTag':'tag';
    const value=/^[@-]/.test(token)?token.slice(1):token;
    return {type,value,text:type==='zone'?`想坐${zones[value]}`:type==='notTag'?`不坐${labels[value]}的位置`:`想坐${labels[value]}的位置`};
  })}));
  people.forEach(p=>p.rules.forEach(r=>{if(r.target!==undefined){const other=people[r.target];if(!other)throw Error(`${id} invalid target`);r.person=other.id;r.text=`${r.type==='adjacent'?'想和':'不和'}${other.name}左右相邻`;delete r.target;}}));
  const widths=layouts[layout];
  const description = ['每排左侧靠窗，第一排最右侧靠车门。','每排左侧有树荫，最右侧可取餐；第二排左起第二席挂着灯笼。','第一排靠银幕，每排最右侧靠音箱；第二排左起两席有树荫。'][chapter];
  return {id,revision:1,chapterId,chapter,kind:id.startsWith('daily-')?'daily':id.startsWith('reserve-')?'reserve':'campaign',difficulty,title,intro:`本场从前到后各排有${widths.join('、')}席。${description}只有同排左右紧邻才算相邻。`,layoutVariant:layout,...geometry(chapter,widths),people,reference:Object.fromEntries(people.map((p,i)=>[p.id,`s${refs[i]}`])),designIntent,manualPhoneQA:'pending'};
}
function compose() {
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname,'legacy.json'),'utf8'));
  const cards = fs.readFileSync(path.join(__dirname,'design-cards.txt'),'utf8').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  const additions=cards.map(expand);
  const levels=[...legacy,...additions];
  const ids=chapterIds.flatMap(c=>Array.from({length:30},(_,i)=>`${c}-${String(i+1).padStart(3,'0')}`));
  const daily=Array.from({length:14},(_,i)=>`daily-${String(i+1).padStart(3,'0')}`);
  const reserve=Array.from({length:20},(_,i)=>`reserve-${String(i+1).padStart(3,'0')}`);
  const order=[...ids,...daily,...reserve];
  levels.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  if(levels.length!==124) throw Error(`Expected 124 authored puzzles, got ${levels.length}`);
  fs.writeFileSync(path.join(__dirname,'levels.json'),JSON.stringify(levels,null,2)+'\n');
  const chapters=require('../../src/content/levels').chapters.map((c,i)=>({...c,id:chapterIds[i]}));
  fs.writeFileSync(path.join(__dirname,'../manifest.json'),JSON.stringify({schemaVersion:1,contentVersion:'1.0.0',campaign:ids,daily,reserve,chapters,dailyCycleAnchorDay:'2026-09-15'},null,2)+'\n');
}
if(require.main===module) compose();
module.exports={compose,expand,geometry,cast};
