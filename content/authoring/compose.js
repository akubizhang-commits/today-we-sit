'use strict';
// Offline expansion of explicitly authored cards. No random generation or remote inputs.
// levels.json is the editable authority; rerun only to rebuild it from these design cards.
const fs = require('node:fs');
const path = require('node:path');
const chapterIds = ['bus', 'garden', 'cinema'];
const { animalProfile } = require('../../src/ui/animals');
// Frozen legacy mechanics are reused; only their display prose is overlaid here.
const legacyCopy = {
  "bus-001": {
    "title": "小猫的第一扇窗",
    "story": "{0}第一次坐萌宠巴士，鼻尖贴近车窗，想看看云朵是不是也软乎乎的。"
  },
  "bus-002": {
    "title": "早餐袋上的爪印",
    "story": "{0}抱着自己的早餐袋上车，和{1}各自挑选喜欢的位置，车窗映出两张毛茸茸的脸。"
  },
  "bus-003": {
    "title": "后排的小声招呼",
    "story": "{0}在后排朝{1}挥挥手，刚认识的两位伙伴想挨着聊聊今天的出游。"
  },
  "bus-004": {
    "title": "去领新项圈",
    "story": "{0}带着项圈色卡上车，准备和伙伴们一起去挑新的小挂饰。"
  },
  "bus-005": {
    "title": "纸风车轻轻转",
    "story": "{0}领着伙伴们上车，{1}带来的纸风车正在转；请按各自的条件安排空位。"
  },
  "bus-006": {
    "title": "两串不同的叫声",
    "story": "{0}正在轻声打电话，{1}想和同伴聊聊新玩具。每位伙伴的相邻要求都写在卡片上。"
  },
  "bus-007": {
    "title": "画筒里的毛毛像",
    "story": "{0}带来刚画好的动物合照，两组伙伴结伴上车，中排还有一位想挨着空位。"
  },
  "bus-008": {
    "title": "三对爪爪一起出发",
    "story": "{0}招呼另外两对伙伴上车，大家都坐下后，就能一起出发去看新开的萌宠商店。"
  },
  "bus-009": {
    "title": "纸袋沙沙响",
    "story": "{0}抱着纸袋找座位，另一位伙伴也想邻接空位；让结伴同行的小动物坐得如愿。"
  },
  "bus-010": {
    "title": "周末的毛毛巴士",
    "story": "{0}拿出周末车票，五位伙伴兴冲冲上车。最后的空位也要符合它们的小偏好。"
  },
  "garden-001": {
    "title": "小碗排队开饭",
    "story": "{0}把自己的餐碗摆好，和{1}一起等开饭，另一位伙伴想坐在方便取餐的位置。"
  },
  "garden-002": {
    "title": "窗边闻到饭香",
    "story": "{0}在萌宠食堂闻到热饭香，窗边区和取餐侧都有座位，伙伴们正挑选各自喜欢的地方。"
  },
  "garden-003": {
    "title": "面包篮上的耳朵结",
    "story": "{0}带来系着耳朵结的篮子，想挨着{1}，还希望另一侧有空位。"
  },
  "garden-004": {
    "title": "两边都是毛毛朋友",
    "story": "{0}想左右都挨着朋友吃饭，暖灯旁也来了一位伙伴，食堂热闹起来了。"
  },
  "garden-005": {
    "title": "隔一席也能碰眼神",
    "story": "{0}朝窗边区的伙伴眨眨眼，即使不相邻也能同桌；其余小动物围着暖灯找位置。"
  },
  "garden-006": {
    "title": "餐碗之间的小留白",
    "story": "{0}和同区伙伴都希望邻接空位，暖灯这边则有三位朋友等着坐下开饭。"
  },
  "garden-007": {
    "title": "沿桌传来餐巾包",
    "story": "{0}把爪印餐巾包递给同伴，取餐侧的朋友想连着坐，另一边还想留些空位。"
  },
  "garden-008": {
    "title": "六只碗的一顿饭",
    "story": "{0}带伙伴们走进食堂，六只餐碗已经备好；从遮光位与暖灯的提示开始安排吧。"
  },
  "garden-009": {
    "title": "暖灯下等朋友",
    "story": "{0}在暖灯旁等{1}，想一边挨着朋友、一边挨着空位，其他伙伴也陆续端碗过来。"
  },
  "garden-010": {
    "title": "收好最后一张餐巾",
    "story": "{0}和两位同伴围着暖灯找位置，另一组朋友也想连着坐，大家准备一起开饭。"
  },
  "cinema-001": {
    "title": "晨光里的第一声哈欠",
    "story": "{0}来到呼噜午睡屋，在晨光区找个窝位，{1}也想挨着一起歇一会儿。"
  },
  "cinema-002": {
    "title": "遮光帘下的小耳朵",
    "story": "{0}钻进遮光帘旁的小窝，想和{1}挨着休息，其余伙伴也在晨光和轻音乐旁找位置。"
  },
  "cinema-003": {
    "title": "三个枕头连成串",
    "story": "{0}带来自己的枕头，想左右都挨着朋友，里侧窝的伙伴也有留空偏好。"
  },
  "cinema-004": {
    "title": "把哈欠留在中间",
    "story": "{0}打了个小哈欠，晨光区另一位伙伴也想邻接空位，里侧的同伴正在安顿。"
  },
  "cinema-005": {
    "title": "轻音乐旁的小靠枕",
    "story": "{0}听着轻音乐找位置，想和{1}挨着休息，另一对伙伴和里侧的小动物也准备午睡。"
  },
  "cinema-006": {
    "title": "里侧窝的悄悄话",
    "story": "{0}想和三位朋友在里侧窝连着休息，晨光区的伙伴则希望旁边还能空着。"
  },
  "cinema-007": {
    "title": "七只毛团等午睡",
    "story": "{0}轻轻放下枕头，晨光区的朋友想连着坐，遮光位附近还有伙伴需要空邻。"
  },
  "cinema-008": {
    "title": "两声哈欠共一席",
    "story": "{0}和里侧的另一位伙伴都想挨着空位，其中一位还想挨着朋友一起听轻音乐。"
  },
  "cinema-009": {
    "title": "八只枕头都到齐",
    "story": "{0}带着伙伴们走进午睡屋，两组朋友想挨着休息，八只枕头很快就能各就各位。"
  },
  "cinema-010": {
    "title": "最后一块软软留白",
    "story": "{0}和同伴在晨光区找窝位，两位伙伴都需要空邻，里侧还有一组等着结伴入座。"
  }
};
const chapterCopy = [
  {id:'bus',title:'萌宠巴士',subtitle:'带上小包，毛茸茸地出发',color:'#A8BA99'},
  {id:'garden',title:'萌宠食堂',subtitle:'小碗摆好，和伙伴一起开饭',color:'#C66949'},
  {id:'cinema',title:'呼噜午睡屋',subtitle:'抱着软枕，把午安说给朋友听',color:'#758CA8'}
];
const cast = [
  ['xiaoman', '小满', '#D5986D'], ['asui', '阿穗', '#8FAE92'], ['atao', '阿陶', '#819CB8'],
  ['yuanyuan', '圆圆', '#BB88A0'], ['xiaolan', '小岚', '#C4AA61'], ['qinghe', '青禾', '#91AAA7'],
  ['ayu', '阿榆', '#AD96BA'], ['linshu', '林叔', '#C68C80'], ['axing', '阿杏', '#B39470'],
  ['xiaoyou', '小游', '#799FA8'], ['susu', '苏苏', '#A89B73'], ['an yi', '安姨', '#AF8397']
].map(([id, name, color]) => ({ id: id.replace(/ /g, '-'), name, color }));
const layouts = { A: [3,3], B: [2,3,2], C: [4,3], D: [3,4], E: [4,4], F: [2,4], G: [3,2], H: [4,2,2], I: [2,2,3], J: [3,3,3] };
const labels = { window:'靠窗', door:'车门旁', front:'第一排', middle:'中间排', back:'最后一排', left:'每排最左侧', right:'每排最右侧', center:'每排非两端', shade:'遮光位', serving:'取餐位', lantern:'暖灯旁', screen:'晨光区', speaker:'轻音乐旁', edge:'每排两端', row1:'第一排', row2:'第二排', row3:'第三排' };
const zones = { front:'车厢前排', middle:'车厢中排', back:'车厢后排', garden:'窗边区', kitchen:'取餐侧', screen:'晨光区', rear:'里侧窝' };
// Translate scene vocabulary in author reasoning without changing any conditions.
function petTerms(value) {
  const replacements = [
    ['银幕前排','晨光区'],['银幕排','晨光区这一排'],['银幕','晨光区'],
    ['观影后排','里侧窝'],['花园侧','窗边区'],['花园','窗边区'],
    ['餐台侧','取餐侧'],['餐台','取餐侧'],['灯笼','暖灯'],
    ['树荫','遮光位'],['树影','遮光位'],['音箱','轻音乐'],
    ['观众','午睡伙伴'],['人物','伙伴'],['三人','三位伙伴'],['四人','四位伙伴'],
    ['两人','两位伙伴'],['二人','两位伙伴'],['七人','七位伙伴'],['八人','八位伙伴'],
    ['人组','伙伴组'],['每人','每位伙伴'],['一人','一位伙伴'],['个人','位伙伴']
  ];
  return replacements.reduce((text,[before,after])=>text.split(before).join(after),value);
}
function animalName(person) { return `${animalProfile(person).label}${person.name}`; }
function themeLevel(level, copy=legacyCopy[level.id]) {
  if(!copy || !copy.story) throw Error(`Missing individual pet story: ${level.id}`);
  const story=copy.story.replace(/\{(\d+)\}/g,(_,index)=>{
    const person=level.people[Number(index)];
    if(!person) throw Error(`Missing story actor ${index} in ${level.id}`);
    return animalName(person);
  });
  const rows=[...new Set(level.seats.map(seat=>seat.y))].sort((a,b)=>a-b);
  const widths=rows.map(y=>level.seats.filter(seat=>seat.y===y).length);
  const description={
    bus:'每排左侧靠窗，第一排最右侧靠车门。',
    garden:'第一排是窗边区，其余排在取餐侧；每排左端为遮光位、右端为取餐位，暖灯在第二排左起第二席。',
    cinema:'第一排是晨光区，其余排是里侧窝；每排最右侧有轻音乐，第二排左起两席为遮光位。'
  }[level.chapterId];
  const people=level.people.map(p=>({...p,rules:p.rules.map(rule=>{
    let text;
    if(rule.type==='emptyNeighbor') text='左右至少留一个相邻空位';
    else if(rule.type==='adjacent'||rule.type==='apart') {
      const other=level.people.find(person=>person.id===rule.person);
      text=`${rule.type==='adjacent'?'想和':'不和'}${animalName(other)}左右相邻`;
    } else if(rule.type==='zone') text=`想坐${zones[rule.value]}`;
    else if(rule.type==='tag') text=`想坐${labels[rule.value]}的位置`;
    else if(rule.type==='notTag') text=`不坐${labels[rule.value]}的位置`;
    else throw Error(`Unknown rule type ${rule.type}`);
    return {...rule,text};
  })}));
  return {...level,title:copy.title,
    intro:`${story}从前到后每排有${widths.join('、')}个位置。${description}只有同排左右紧邻才算相邻。`,
    people,designIntent:`${animalName(level.people[0])}的安置推理：${petTerms(copy.designIntent||level.designIntent)}`};
}
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
  const [id, chapterId, difficulty, layout, title, occupied, rules, designIntent, story] = card.split('|');
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
  const level={id,revision:1,chapterId,chapter,kind:id.startsWith('daily-')?'daily':id.startsWith('reserve-')?'reserve':'campaign',difficulty,title,intro:'',layoutVariant:layout,...geometry(chapter,widths),people,reference:Object.fromEntries(people.map((p,i)=>[p.id,`s${refs[i]}`])),designIntent,manualPhoneQA:'pending'};
  return themeLevel(level,{title,story,designIntent});
}
function compose() {
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname,'legacy.json'),'utf8'));
  const cards = fs.readFileSync(path.join(__dirname,'design-cards.txt'),'utf8').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  const additions=cards.map(expand);
  const levels=[...legacy.map(level=>themeLevel(level)),...additions];
  const ids=chapterIds.flatMap(c=>Array.from({length:30},(_,i)=>`${c}-${String(i+1).padStart(3,'0')}`));
  const daily=Array.from({length:14},(_,i)=>`daily-${String(i+1).padStart(3,'0')}`);
  const reserve=Array.from({length:20},(_,i)=>`reserve-${String(i+1).padStart(3,'0')}`);
  const order=[...ids,...daily,...reserve];
  levels.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  if(levels.length!==124) throw Error(`Expected 124 authored puzzles, got ${levels.length}`);
  fs.writeFileSync(path.join(__dirname,'levels.json'),JSON.stringify(levels,null,2)+'\n');
  const chapters=chapterCopy;
  fs.writeFileSync(path.join(__dirname,'../manifest.json'),JSON.stringify({schemaVersion:1,contentVersion:'1.1.0',campaign:ids,daily,reserve,chapters,dailyCycleAnchorDay:'2026-09-15'},null,2)+'\n');
}
if(require.main===module) compose();
module.exports={compose,expand,geometry,cast,themeLevel,petTerms};
