const {C,round,text,wrap,circle,line,person,leaf}=require('./draw');
const {chapters}=require('../content/levels');

function render(ctx,app) {
  const hits=[];
  function hit(x,y,w,h,action,payload){hits.push({x,y,w,h,action,payload});}
  function button(label,x,y,w,h,action,payload,style='primary',disabled=false){
    const fill=disabled?'#E5E4D9':style==='primary'?C.ink:style==='orange'?C.orange:C.white;
    round(ctx,x,y,w,h,16,fill,style==='secondary'?C.line:null);
    text(ctx,label,x+w/2,y+h/2,14,disabled?C.muted:style==='secondary'?C.ink:C.white,'600','center');
    if(!disabled)hit(x,y,w,h,action,payload);
  }
  const completed=app.progress.completed.length;
  ctx.fillStyle=C.paper;ctx.fillRect(0,0,390,844);
  // Fine paper motif, deterministic and cheap.
  ctx.fillStyle='#294D4306';for(let y=12;y<844;y+=19)for(let x=12;x<390;x+=19)ctx.fillRect(x,y,1,1);
  if(app.screen==='home'){
    round(ctx,26,39,37,37,12,C.ink);
    round(ctx,35,46,19,17,5,null,C.paper);line(ctx,35,65,35,69,C.paper,2);line(ctx,54,65,54,69,C.paper,2);
    text(ctx,'今天怎么坐',75,57,17,C.ink,'600');
    text(ctx,'慢慢想，刚刚好',364,57,11,C.muted,'normal','right');
    round(ctx,27,106,120,25,12,'#E5EAD9');
    text(ctx,'一款有温度的逻辑游戏',87,119,10,C.ink,'500','center');
    text(ctx,'给每个人',26,173,37,C.ink,'700');
    text(ctx,'一个好位置。',26,222,37,C.ink,'700');
    wrap(ctx,'一点小偏好，一场恰到好处的相遇。',28,267,328,14,C.muted,2,23);
    // Illustrated miniature community dinner.
    round(ctx,24,310,342,246,30,'#E5E8D7');
    circle(ctx,317,352,25,'#EEC995');
    round(ctx,43,329,99,88,15,'#F7F3E8');line(ctx,92,334,92,410,'#C8D4BE',3);line(ctx,48,374,137,374,'#C8D4BE',3);
    leaf(ctx,333,503,1.25);
    ctx.save();ctx.translate(190,450);ctx.rotate(-0.06);round(ctx,-103,-47,206,96,35,'#C7A780');round(ctx,-101,-52,202,94,34,'#E2CAA6');ctx.restore();
    [[123,385,0,'#C66949'],[235,386,1,'#A8BA99'],[118,488,2,'#718EAA'],[236,488,3,'#D0A057']].forEach(([x,y,i,c])=>person(ctx,x,y,65,c,i));
    circle(ctx,172,444,16,C.white);circle(ctx,213,451,16,C.white);circle(ctx,172,444,10,'#EDD4A5');circle(ctx,213,451,10,'#EDD4A5');
    round(ctx,268,407,71,35,12,C.white);text(ctx,'这里真好',303,424,11,C.ink,'500','center');
    text(ctx,'没有倒计时 · 只有小小的成就感',195,581,12,C.muted,'normal','center');
    button(completed?'继续安排  →':'开始今天的安排  →',26,615,338,57,'continue');
    button('挑选一个场景',26,685,338,49,'levels',undefined,'secondary');
    line(ctx,27,765,363,765,C.line,1);
    text(ctx,'3 个生活场景',29,790,12,C.muted);
    text(ctx,`${completed} / 30  已完成`,362,790,12,C.ink,'600','right');
  } else if(app.screen==='levels'){
    button('‹',22,39,44,44,'home',null,'secondary');
    text(ctx,'选择一个好时光',82,61,19,C.ink,'600');
    text(ctx,`${completed}/30`,361,61,12,C.muted,'normal','right');
    text(ctx,'生活里的小小谜题',25,127,27,C.ink,'700');
    text(ctx,'先照顾每个人的小偏好，再把故事继续。',26,169,12,C.muted);
    chapters.forEach((ch,i)=>{
      button(['接驳车','朋友聚餐','露天电影'][i],24+i*117,204,108,42,'chapter',i,app.chapter===i?'primary':'secondary');
    });
    const chapter=chapters[app.chapter];
    text(ctx,chapter.title,26,275,15,C.ink,'600');
    app.levels.filter(l=>l.chapter===app.chapter).forEach((l,i)=>{
      const x=24+(i%2)*177,y=301+Math.floor(i/2)*80;
      const locked=!app.isUnlocked(l.id),done=app.progress.completed.includes(l.id);
      round(ctx,x,y,165,68,17,locked?'#ECEBE2':C.white,done?C.sage:C.line);
      circle(ctx,x+29,y+30,17,done?C.ink:locked?'#DEDED1':'#EDEAD9');
      text(ctx,done?'✓':String(l.id).padStart(2,'0'),x+29,y+30,12,done?C.white:C.ink,'600','center');
      text(ctx,l.title.length>7?l.title.slice(0,7)+'…':l.title,x+54,y+24,12,locked?C.muted:C.ink,'600');
      text(ctx,locked?'完成前一关解锁':done?'已完成 · 再玩一次':'等你来安排',x+54,y+45,10,C.muted);
      if(!locked)hit(x,y,165,68,'start',l.id);
    });
    wrap(ctx,chapter.subtitle||'不用着急，让每一次相遇都刚刚好。',26,742,337,13,C.muted,2);
    text(ctx,'人物和关卡均为原创 · 随时离开，进度会保存',195,805,10,C.muted,'normal','center');
  } else {
    const level=app.level,result=app.result,selected=level.people.find(p=>p.id===app.selected);
    const theme=['#DDE7DF','#EFE1C9','#DAE1E5'][level.chapter];
    button('‹',22,35,44,44,'levels',null,'secondary');
    text(ctx,chapters[level.chapter].title,80,49,11,C.muted);
    text(ctx,level.title,80,72,19,C.ink,'600');
    text(ctx,`${String(level.id).padStart(2,'0')} / 30`,365,57,12,C.muted,'500','right');
    const total=result.total||1;
    round(ctx,25,106,276,5,2,'#E3E2D6');round(ctx,25,106,276*Math.min(1,result.satisfied/total),5,2,C.ink);
    text(ctx,`${result.satisfied}/${result.total} 满足`,365,108,11,C.ink,'500','right');
    round(ctx,24,130,342,126,19,C.white,C.line);
    if(selected){
      const index=level.people.indexOf(selected),state=result.people[selected.id];
      person(ctx,53,168,35,selected.color,index,state.status);
      text(ctx,selected.name,80,153,15,C.ink,'600');
      text(ctx,'的小偏好',80+selected.name.length*15,153,11,C.muted);
      if(app.session.placement[selected.id]){
        round(ctx,263,136,90,33,10,app.moveArmed?C.ink:'#E9ECDC');
        text(ctx,app.moveArmed?'点目标座位':'换个位置',308,153,11,app.moveArmed?C.white:C.ink,'500','center');
        hit(263,131,90,44,'armMove');
      }
      const rules=state.rules;
      if(!rules.length)text(ctx,'随便坐哪里都很开心。',80,181,12,C.muted);
      rules.slice(0,4).forEach((r,i)=>{
        const mark=r.status==='satisfied'?'✓':r.status==='conflict'?'!':'·';
        text(ctx,mark,81,179+i*18,12,r.status==='conflict'?C.red:C.ink,'700');
        text(ctx,r.text.length>22?r.text.slice(0,22)+'…':r.text,98,179+i*18,11,r.status==='conflict'?C.red:C.muted);
      });
    } else {
      text(ctx,'先听听，大家想坐哪里？',43,157,16,C.ink,'600');
      wrap(ctx,level.intro,43,184,302,12,C.muted,2,19);
      text(ctx,'点选或拖动人物，开始安排座位。',43,229,11,C.orange);
    }
    round(ctx,24,272,342,281,24,theme);
    const sceneTitles=['社区接驳车  ·  前方 ↑','朋友聚餐  ·  一起开饭','露天电影  ·  银幕方向 ↑'];
    text(ctx,sceneTitles[level.chapter],195,295,12,C.ink,'600','center');
    if(level.chapter===0){
      round(ctx,33,326,8,179,4,'#B2C8BB');round(ctx,349,326,8,179,4,'#B2C8BB');
    } else if(level.chapter===1){
      round(ctx,58,318,274,189,39,'#DABF97');
    } else {
      round(ctx,83,312,224,8,3,'#98ABAD');
    }
    const maxX=Math.max(...level.seats.map(s=>s.x)),maxY=Math.max(...level.seats.map(s=>s.y));
    const stepX=Math.min(88,290/(maxX+1)),stepY=Math.min(84,186/(maxY+1));
    const originX=195-maxX*stepX/2,originY=410-maxY*stepY/2;
    level.seats.forEach((seat,i)=>{
      const x=originX+seat.x*stepX,y=originY+seat.y*stepY;
      const p=level.people.find(p=>app.session.placement[p.id]===seat.id);
      const s=p?result.people[p.id]:null;
      const active=p&&app.selected===p.id;
      const compact=maxY>=2;
      const halfHeight=compact?19:25;
      round(ctx,x-27,y-halfHeight,54,halfHeight*2+2,11,active?'#FFF4D7':'#FFFEF8DD',s&&s.status==='conflict'?C.red:active?C.orange:'#B7C1AE');
      if(!p){
        round(ctx,x-13,y-12,26,20,5,null,'#AAB7A5');line(ctx,x-13,y+11,x-13,y+16,'#AAB7A5',2);line(ctx,x+13,y+11,x+13,y+16,'#AAB7A5',2);
      }else{
        person(ctx,x,y-2,compact?29:37,p.color,level.people.indexOf(p),s.status);
        if(s.status==='satisfied'){circle(ctx,x+22,y-22,8,C.ink);text(ctx,'✓',x+22,y-22,10,C.white,'600','center');}
        if(s.status==='conflict'){circle(ctx,x+22,y-22,8,C.red);text(ctx,'!',x+22,y-22,10,C.white,'700','center');}
      }
      const tags=seat.tags||[];
      const zones={front:'前',middle:'中',back:'后',garden:'花园',kitchen:'餐台',screen:'前排',rear:'后排'};
      const features={window:'窗',door:'门',shade:'树荫',serving:'取餐',lantern:'灯笼',speaker:'音箱'};
      const feature=Object.keys(features).find(t=>tags.includes(t));
      const seatLabel=(zones[seat.zone]||'座位')+(feature?'·'+features[feature]:'');
      text(ctx,p?`${i+1} ${p.name}`:`${i+1} 号座位`,x,y+(compact?27:35),10,C.ink,'500','center');
      text(ctx,seatLabel,x,y+(compact?39:48),9,C.muted,'normal','center');
      hit(x-30,y-halfHeight-2,60,compact?62:81,'seat',{seatId:seat.id,personId:p&&p.id});
    });
    text(ctx,'左右同排才相邻，不跨行。',195,535,10,C.muted,'normal','center');
    text(ctx,'候场区',26,580,13,C.ink,'600');
    text(ctx,'点这里可让选中人物暂时离席',364,580,10,C.muted,'normal','right');
    round(ctx,24,596,342,119,18,'#EFEDE2',C.line);
    hit(24,567,342,148,'unseat');
    const waiting=level.people.filter(p=>!app.session.placement[p.id]);
    if(!waiting.length){
      text(ctx,'大家都入座了',195,636,14,C.ink,'600','center');
      text(ctx,'点选人物，检查偏好或交换位置',195,662,11,C.muted,'normal','center');
    }
    waiting.forEach((p,i)=>{
      const x=66+(i%4)*86,y=621+Math.floor(i/4)*57;
      if(app.selected===p.id)round(ctx,x-33,y-20,66,54,11,'#FFF4D7',C.orange);
      person(ctx,x,y-2,29,p.color,level.people.indexOf(p));
      text(ctx,p.name,x,y+25,10,C.ink,'500','center');
      hit(x-35,y-23,70,56,'person',p.id);
    });
    button('↶  撤销',24,738,100,47,'undo',null,'secondary',!app.session.history.length);
    button('重新安排',134,738,112,47,'reset',null,'secondary');
    button('给点提示',256,738,110,47,'hint',null,'primary');
    text(ctx,'不赶时间。每个人都有自己的好位置。',195,813,10,C.muted,'normal','center');
    if(app.drag&&app.drag.moved){
      const p=level.people.find(p=>p.id===app.drag.personId);
      if(p){circle(ctx,app.drag.x,app.drag.y,30,'#FFF4D7DD');person(ctx,app.drag.x,app.drag.y,47,p.color,level.people.indexOf(p));}
    }
    if(app.won){
      ctx.fillStyle='#17332BB3';ctx.fillRect(0,0,390,844);hits.length=0;
      round(ctx,33,223,324,370,28,C.paper);
      circle(ctx,195,287,35,'#DFE8D6');text(ctx,'✓',195,287,35,C.ink,'600','center');
      text(ctx,'每个人，都刚刚好。',195,353,23,C.ink,'700','center');
      text(ctx,'这一场相遇，被你安排得很温柔。',195,391,12,C.muted,'normal','center');
      text(ctx,`第 ${level.id} 关完成`,195,425,13,C.orange,'600','center');
      button(level.id===30?'三个场景，都坐好啦':'下一个小故事  →',57,464,276,49,'next');
      button('返回场景',57,528,276,43,'levels',null,'secondary');
    }
  }
  if(app.toast&&Date.now()<app.toastUntil){
    const toastY=app.screen==='play'?652:743;
    round(ctx,24,toastY,342,72,14,C.ink);
    wrap(ctx,app.toast,39,toastY+20,312,12,C.white,2,18);
    text(ctx,'轻点关闭',351,toastY+60,9,'#CFDCCB','normal','right');
    hit(24,toastY,342,72,'dismissToast');
  }
  return hits;
}
module.exports={render};
