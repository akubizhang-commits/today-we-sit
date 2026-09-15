const {levels}=require('./content/levels');
const {evaluate,getHint}=require('./core/engine');
const {createSession,applyMove,undo,reset,loadProgress,saveProgress}=require('./core/session');
const {render}=require('./ui/renderer');

class GameApp {
  constructor(platform){
    this.platform=platform;this.ctx=platform.canvas.getContext('2d');this.levels=levels;
    this.progress=loadProgress(platform.storage,levels);
    this.screen='home';this.chapter=0;this.selected=null;this.moveArmed=false;this.won=false;
    this.hits=[];this.drag=null;this.toast='';this.toastUntil=0;
    this.lastFrame=0;this.dirty=true;this.events=[];
    this.resize(platform.width,platform.height,platform.dpr);
    platform.onPointer(e=>this.pointer(e));
    platform.onResize((w,h,dpr)=>this.resize(w,h,dpr));
    platform.onHide(()=>{this.drag=null;this.dirty=true;this.persist();});
    this.loop=this.loop.bind(this);platform.requestFrame(this.loop);
  }
  resize(width,height,dpr=1){
    this.width=width;this.height=height;this.dpr=dpr;
    const inset=this.platform.insets||{top:0,bottom:0};
    const availableHeight=Math.max(1,height-inset.top-inset.bottom);
    this.scale=Math.min(width/390,availableHeight/844);
    this.offsetX=(width-390*this.scale)/2;
    this.offsetY=inset.top+(availableHeight-844*this.scale)/2;
    this.platform.canvas.width=Math.round(width*dpr);
    this.platform.canvas.height=Math.round(height*dpr);this.dirty=true;
  }
  loop(){
    if(this.dirty||this.drag||(this.toast&&Date.now()>=this.toastUntil)){
      if(this.toast&&Date.now()>=this.toastUntil)this.toast='';
      const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);
      c.fillStyle='#E4E6D9';c.fillRect(0,0,this.width,this.height);
      c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);
      this.hits=render(c,this);this.dirty=false;
    }
    this.platform.requestFrame(this.loop);
  }
  isUnlocked(id){return id===1||this.progress.completed.includes(id-1);}
  startLevel(id){
    const level=levels.find(l=>l.id===id);
    if(!level||!this.isUnlocked(id))return false;
    this.level=level;this.chapter=level.chapter;this.screen='play';this.won=false;
    this.selected=null;this.moveArmed=false;this.drag=null;this.toast='';
    this.session=createSession(level,this.progress.placements[id]||{});
    this.result=evaluate(level,this.session.placement);
    // Replaying a completed board begins fresh; unfinished positions resume.
    if(this.result.complete)this.session=createSession(level);
    this.result=evaluate(level,this.session.placement);
    this.progress.currentLevel=id;this.persist();this.event('level_start',{level:id});
    this.dirty=true;return true;
  }
  message(value){this.toast=value;this.toastUntil=Date.now()+5500;this.dirty=true;}
  persist(){
    if(this.level&&this.session)this.progress.placements[this.level.id]={...this.session.placement};
    if(!saveProgress(this.platform.storage,this.progress)){
      this.toast='进度暂时无法保存；你仍然可以继续玩。';this.toastUntil=Date.now()+5500;
    }
  }
  event(type,data={}){
    this.events.push({type,...data,at:Date.now()});this.events=this.events.slice(-100);
    try{this.platform.storage.set('today-we-sit:events',this.events);}catch(_){/* Optional local diagnostic events. */}
  }
  afterChange(){
    this.result=evaluate(this.level,this.session.placement);
    if(this.result.complete&&!this.won){
      this.won=true;
      if(!this.progress.completed.includes(this.level.id)){
        this.progress.completed.push(this.level.id);
        this.progress.completed.sort((a,b)=>a-b);
      }
      this.event('level_complete',{level:this.level.id});
      const next=Math.min(30,this.level.id+1);
      this.progress.currentLevel=next;
    }
    this.persist();this.dirty=true;
  }
  place(personId,seatId){
    if(this.screen!=='play'||this.won)return;
    try{
      this.session=applyMove(this.level,this.session,personId,seatId);
      this.selected=personId;this.moveArmed=false;this.toast='';
      this.event('move',{level:this.level.id});this.afterChange();
    }catch(_){this.message('这个位置暂时不能这样安排，请换一个位置。');}
  }
  action(action,payload){
    if(action==='dismissToast'){this.toast='';}
    else if(action==='home'){this.screen='home';this.toast='';}
    else if(action==='continue')this.startLevel(this.progress.currentLevel);
    else if(action==='levels'){this.screen='levels';this.toast='';this.won=false;this.drag=null;}
    else if(action==='chapter')this.chapter=payload;
    else if(action==='start')this.startLevel(payload);
    else if(action==='next'){if(this.level.id<30)this.startLevel(this.level.id+1);else{this.screen='levels';this.won=false;}}
    else if(this.screen==='play'&&!this.won){
      if(action==='person'){this.selected=payload;this.moveArmed=true;}
      else if(action==='armMove')this.moveArmed=true;
      else if(action==='seat'){
        if(this.selected&&payload.personId!==this.selected&&(!payload.personId||this.moveArmed))this.place(this.selected,payload.seatId);
        else if(payload.personId){this.selected=payload.personId;this.moveArmed=false;}
      }else if(action==='unseat'&&this.selected)this.place(this.selected,null);
      else if(action==='undo'){this.session=undo(this.session);this.toast='';this.afterChange();}
      else if(action==='reset'){this.session=reset(this.session);this.selected=null;this.toast='';this.afterChange();}
      else if(action==='hint'){
        const hint=getHint(this.level,this.session.placement);
        if(hint){this.selected=hint.personId;this.moveArmed=true;this.message(hint.text);this.event('hint',{level:this.level.id});}
        else this.message('已经安排得很好啦。');
      }
    }
    this.dirty=true;
  }
  target(x,y){
    return this.hits.slice().reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
  }
  pointer(event){
    const x=(event.x-this.offsetX)/this.scale,y=(event.y-this.offsetY)/this.scale;
    if(event.type==='down'){
      const target=this.target(x,y);
      if(!target)return;
      let personId=null;
      if(target.action==='person')personId=target.payload;
      if(target.action==='seat')personId=target.payload.personId;
      this.drag={startX:x,startY:y,x,y,target,personId,moved:false};
    }else if(event.type==='move'&&this.drag){
      this.drag.x=x;this.drag.y=y;
      if(Math.hypot(x-this.drag.startX,y-this.drag.startY)>8)this.drag.moved=true;
      if(this.drag.personId&&this.drag.moved)this.selected=this.drag.personId;
      this.dirty=true;
    }else if(event.type==='up'&&this.drag){
      const drag=this.drag;this.drag=null;const end=this.target(x,y);
      if(drag.moved&&drag.personId){
        if(end&&end.action==='seat')this.place(drag.personId,end.payload.seatId);
        else if(end&&['unseat','person'].includes(end.action))this.place(drag.personId,null);
      }else if(!drag.moved&&end&&end.action===drag.target.action&&JSON.stringify(end.payload)===JSON.stringify(drag.target.payload)){
        this.action(drag.target.action,drag.target.payload);
      }
      this.dirty=true;
    }else if(event.type==='cancel'){this.drag=null;this.dirty=true;}
  }
}
module.exports={GameApp};
