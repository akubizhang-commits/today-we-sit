'use strict';
const {catalog:defaultCatalog}=require('./content/current');
const {evaluate}=require('./core/engine');
const {getAdvancedHint}=require('./core/hints');
const {createSession,applyMove,undo,reset}=require('./core/session');
const {createProgress,validateProgress}=require('./progress/schema');
const {loadLocal,saveLocal,resetLocal}=require('./progress/repository');
const {canEnter,getContinueLevelId}=require('./features/campaign');
const daily=require('./features/daily');
const album=require('./features/album');
const tutorial=require('./features/tutorial');
const settings=require('./features/settings');
const hintAccess=require('./features/hint-access');
const {createAdService}=require('./services/ads');
const {createAudioController}=require('./services/audio');
const {createTelemetry}=require('./services/telemetry');
const {render}=require('./ui/renderer');
const clone=value=>JSON.parse(JSON.stringify(value));
const uniqueId=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

class GameApp {
  constructor(platform,{catalog=defaultCatalog}={}){
    this.platform=platform;this.ctx=platform.canvas.getContext('2d');this.catalog=catalog;
    this.levels=catalog.campaignIds.map(id=>catalog.get(id));this.chapters=catalog.chapters;
    this.progress=createProgress(catalog);this.loading=true;this.readOnly=false;
    this.screen='home';this.chapter=0;this.levelPage=0;this.selected=null;this.moveArmed=false;
    this.won=false;this.modal=null;this.rulesExpanded=false;this.waitingOffset=0;
    this.hits=[];this.drag=null;this.toast='';this.toastUntil=0;this.dirty=true;
    this.hintBusy=false;this.transactionBusy=false;this.pendingSave=Promise.resolve({ok:true});
    this.progressGeneration=0;this.resetting=false;
    this.playSessionId=null;this.moveRevision=0;this.isDaily=false;this.activeDay=null;
    this.ads=createAdService({createAd:platform.createRewardedAd});
    this.audio=createAudioController({createAudio:platform.createAudio,settings:this.progress.settings});
    this.telemetry=createTelemetry({buildId:'1.0.0-local',contentVersion:catalog.contentVersion,environment:'development'});
    this.serviceStatus={cloud:'未配置，进度保存在本机',ads:platform.createRewardedAd?'已配置，待真机验收':'未配置，暂无真实广告',feedback:'运营联系方式待配置'};
    this.statusNote='开发候选版 · 尚未发布';
    this.resize(platform.width,platform.height,platform.dpr);
    platform.onPointer(e=>this.pointer(e));
    platform.onResize((w,h,dpr)=>this.resize(w,h,dpr));
    platform.onHide(()=>{this.drag=null;this.dirty=true;this.audio.suspend();this.persist();});
    if(platform.onShow)platform.onShow(()=>{this.audio.resume();this.refreshDaily();this.dirty=true;});
    this.loop=this.loop.bind(this);platform.requestFrame(this.loop);
    this.ready=this.initialize();
  }
  async initialize(){
    const loaded=await loadLocal(this.platform.storage,this.catalog);
    this.progress=loaded.progress;this.readOnly=Boolean(loaded.readOnly);this.loading=false;
    this.audio.setSettings(this.progress.settings);this.refreshDaily();
    if(this.readOnly)this.message('当前存档暂不能写入，本次可试玩但不会覆盖已有进度。');
    else if(loaded.recovered)this.message('已从上一份有效存档恢复进度。');
    else if(loaded.migrationWarnings.length)this.message('旧版进度已保留并迁移到新版关卡。');
    this.dirty=true;
    return this;
  }
  resize(width,height,dpr=1){
    this.width=width;this.height=height;this.dpr=dpr;this.scale=1;this.offsetX=0;this.offsetY=0;
    this.platform.canvas.width=Math.round(width*dpr);this.platform.canvas.height=Math.round(height*dpr);this.dirty=true;
  }
  loop(){
    const now=Date.now();
    if(!this.loading&&now-(this.lastDayCheck||0)>30000){this.refreshDaily();this.lastDayCheck=now;}
    if(this.dirty||this.drag||(this.toast&&now>=this.toastUntil)){
      if(this.toast&&now>=this.toastUntil)this.toast='';
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.hits=render(this.ctx,this);this.dirty=false;
    }
    this.platform.requestFrame(this.loop);
  }
  get albumCards(){return album.getCards(this.progress.completed,this.progress.album.claimedIds,this.catalog.campaignIds);}
  get tutorialText(){return this.screen==='play'&&!this.isDaily&&this.level?tutorial.getText(this.catalog.displayNumber(this.level.id),this.session,this.result,this.progress):'';}
  get hintLabel(){
    if(this.hintBusy)return '正在思考…';
    if(!this.level)return '一步提示';
    if(this.reusableHint())return '重看／重算提示';
    const access=this.access();
    if(access.free)return '免费一步提示';
    return access.canRequestAd&&this.platform.createRewardedAd?'看广告 · 一步提示':'一步提示';
  }
  access(){return hintAccess.getAccess(this.progress,{levelId:this.level.id,displayNumber:this.catalog.displayNumber(this.level.id),isDaily:this.isDaily,contentRevision:this.level.revision||1});}
  hintMatchesPlacement(receipt){
    // Older receipts only recorded the move counter. New receipts can also
    // recognize an identical board reached through undo without spending a retry.
    if(!receipt.placement)return receipt.placementRevision===this.moveRevision;
    const placement=this.session.placement;
    return Object.keys(receipt.placement).length===Object.keys(placement).length
      &&Object.entries(receipt.placement).every(([person,seat])=>placement[person]===seat);
  }
  reusableHint(){
    if(!this.level)return null;
    const candidates=[...(this.progress.hintAccess.grants||[])].reverse().filter(g=>g.levelId===this.level.id
      &&g.hintReceipt&&g.hintReceipt.hint&&g.hintReceipt.sessionId===this.playSessionId
      &&(g.hintReceipt.contentRevision??g.contentRevision)===(this.level.revision||1)
      &&this.progress.hintAccess.consumedIds.includes(g.grantId));
    return candidates.find(g=>this.hintMatchesPlacement(g.hintReceipt))||candidates.find(g=>!g.recomputed)||null;
  }
  isUnlocked(id){return canEnter(this.catalog,this.progress,id);}
  dailySnapshot(id,dayKey){
    const live=this.progress.placements[id],saved=this.progress.daily.savedSessions?.[dayKey];
    const snapshot=live&&live.dayKey===dayKey?live:saved&&saved.levelId===id&&saved.snapshot?.dayKey===dayKey?saved.snapshot:null;
    // savedSessions is an optional v2 domain extension. Validate each archived
    // snapshot before allowing it to become a canonical placement again.
    return snapshot&&validateProgress({...createProgress(this.catalog),placements:{[id]:snapshot}}).ok?snapshot:null;
  }
  findDailyResume(){
    let latest=daily.findResume(this.progress,this.catalog,this.dailyView.dayKey);
    for(const [dayKey,saved] of Object.entries(this.progress.daily.savedSessions||{})){
      if(!saved||!this.catalog.dailyIds.includes(saved.levelId))continue;
      const snapshot=this.dailySnapshot(saved.levelId,dayKey);
      if(!snapshot)continue;
      const candidate=daily.findResume({...this.progress,placements:{[saved.levelId]:snapshot}},this.catalog,this.dailyView.dayKey);
      if(candidate&&(!latest||candidate.dayKey>latest.dayKey))latest=candidate;
    }
    return latest;
  }
  refreshDaily(){
    if(this.catalog.dailyIds.length!==14){this.dailyView={available:false,completed:false,dayKey:'',levelId:null,isReplay:false};return;}
    const value=daily.resolve({deviceNow:Date.now(),lastSeenDay:this.progress.daily.lastSeenDay,anchorDay:this.catalog.dailyCycleAnchorDay,ids:this.catalog.dailyIds});
    const changed=this.dailyView&&this.dailyView.dayKey!==value.dayKey;
    this.dailyView={...value,available:this.progress.completed.length>=5,completed:this.progress.daily.completedDays.includes(value.dayKey)};
    this.progress.daily.lastSeenDay=value.dayKey;
    this.dailyResume=this.findDailyResume();
    if(changed){this.dirty=true;if(this.isDaily&&this.screen==='play')this.message('新的一天到了。这一题仍可继续，完成后再去看今日题。');}
  }
  startLevel(id,{dayKey=null,resumeDaily=false}={}){
    if(this.loading||this.transactionBusy)return false;
    const source=this.catalog.get(id);if(!source)return false;
    const isDaily=this.catalog.dailyIds.includes(id);
    const oldDaily=resumeDaily&&this.findDailyResume();
    if(isDaily?(!this.dailyView.available||(resumeDaily?(!oldDaily||oldDaily.levelId!==id||oldDaily.dayKey!==dayKey)
      :id!==this.dailyView.levelId||(dayKey!==null&&dayKey!==this.dailyView.dayKey))):!this.isUnlocked(id))return false;
    this.exitEvent();this.level={...source,chapter:this.chapters.findIndex(c=>c.id===source.chapterId)};
    this.chapter=Math.max(0,this.level.chapter);this.screen='play';this.won=false;this.modal=null;
    this.selected=null;this.moveArmed=false;this.drag=null;this.toast='';this.rulesExpanded=false;this.waitingOffset=0;
    this.isDaily=isDaily;this.activeDay=isDaily?(dayKey||this.dailyView.dayKey):null;
    const snapshot=isDaily?this.dailySnapshot(id,this.activeDay):this.progress.placements[id];
    let resumable=snapshot&&snapshot.contentRevision===(this.level.revision||1)&&(!isDaily||snapshot.dayKey===this.activeDay);
    this.session=createSession(this.level,resumable?snapshot.placement:{});
    this.result=evaluate(this.level,this.session.placement);
    if(this.result.complete){this.session=createSession(this.level);resumable=false;}
    this.result=evaluate(this.level,this.session.placement);
    this.playSessionId=resumable?snapshot.sessionId:uniqueId();this.moveRevision=resumable?snapshot.moveSequence:0;
    if(!isDaily)this.progress.currentLevelId=id;
    this.startedAt=Date.now();this.audio.setScene(source.chapterId);
    this.persist();this.event('level_start',{levelId:id});this.dirty=true;
    const receipt=this.reusableHint();
    if(receipt&&this.hintMatchesPlacement(receipt.hintReceipt)){this.showHint(receipt.hintReceipt.hint);}
    return true;
  }
  message(text){this.toast=text;this.toastUntil=Date.now()+7000;this.dirty=true;}
  snapshotPlacement(progress=this.progress){
    if(this.level&&this.session){
      const previous=progress.placements[this.level.id];
      if(this.isDaily){
        // The 14-day rotation reuses IDs; switching dates must not destroy the
        // other unfinished session (including today's board when resuming an old day).
        if(previous&&previous.dayKey&&previous.dayKey!==this.activeDay
          &&Object.keys(previous.placement).length&&!progress.daily.completedDays.includes(previous.dayKey)
          &&!evaluate(this.level,previous.placement).complete){
          progress.daily.savedSessions={...progress.daily.savedSessions,[previous.dayKey]:{levelId:this.level.id,snapshot:clone(previous)}};
        }
        if(progress.daily.savedSessions)delete progress.daily.savedSessions[this.activeDay];
      }
      progress.placements[this.level.id]={contentRevision:this.level.revision||1,sessionId:this.playSessionId,moveSequence:this.moveRevision,placement:{...this.session.placement},savedAt:Date.now(),...(this.isDaily?{dayKey:this.activeDay}:{})};
    }
  }
  persist(){
    // A transaction already includes the current board. In particular, onHide
    // must not enqueue the pre-transaction ledger behind that transaction.
    if(this.loading||this.readOnly||this.resetting||this.transactionBusy)return this.pendingSave;
    const generation=this.progressGeneration;
    this.snapshotPlacement();this.progress.localRevision++;
    this.pendingSave=saveLocal(this.platform.storage,this.progress).then(result=>{
      if(!result.ok&&generation===this.progressGeneration&&!this.resetting){this.message('进度暂时无法保存；请不要清理本机数据。');this.event('storage_error',{code:result.reason});}
      return result;
    });return this.pendingSave;
  }
  async commitProgress(next,{generation=this.progressGeneration}={}){
    if(this.loading||this.readOnly||this.resetting||this.transactionBusy||generation!==this.progressGeneration)return false;
    this.transactionBusy=true;this.snapshotPlacement(next);next.localRevision=this.progress.localRevision+1;
    try{
      this.pendingSave=saveLocal(this.platform.storage,next);
      const saved=await this.pendingSave;
      if(generation!==this.progressGeneration||this.readOnly||this.resetting)return false;
      if(saved.ok)this.progress=next;else this.message('保存失败，没有扣除提示权益，请稍后重试。');
      return saved.ok;
    }finally{this.transactionBusy=false;this.dirty=true;}
  }
  event(type,fields={}){this.telemetry.track(type,fields);}
  exitEvent(){if(this.screen==='play'&&this.level&&!this.won)this.event('level_exit',{levelId:this.level.id,durationMs:Date.now()-(this.startedAt||Date.now()),moveCount:this.moveRevision});}
  learn(action){if(this.level&&!this.isDaily)this.progress=tutorial.advance(this.progress,action,this.catalog.displayNumber(this.level.id));}
  afterChange(){
    this.result=evaluate(this.level,this.session.placement);
    if(this.result.complete&&!this.won){
      this.won=true;this.audio.playEffect('complete');
      if(this.isDaily){
        if(!this.progress.daily.completedDays.includes(this.activeDay))this.progress.daily.completedDays.push(this.activeDay);
        this.event('daily_complete',{levelId:this.level.id,dayKey:this.activeDay});
      }else{
        if(!this.progress.completed.includes(this.level.id))this.progress.completed.push(this.level.id);
        this.event('level_complete',{levelId:this.level.id,durationMs:Date.now()-this.startedAt,moveCount:this.moveRevision});
        this.progress.currentLevelId=getContinueLevelId(this.catalog,this.progress);
      }
      this.refreshDaily();
    }
    this.persist();this.dirty=true;
  }
  place(personId,seatId){
    if(this.screen!=='play'||this.won||this.transactionBusy)return;
    try{
      const occupied=Object.values(this.session.placement).includes(seatId);
      const next=applyMove(this.level,this.session,personId,seatId);
      if(JSON.stringify(next.placement)===JSON.stringify(this.session.placement))return;
      this.session=next;this.moveRevision++;this.selected=personId;this.moveArmed=false;this.toast='';
      this.learn(occupied?'swap':'place');this.audio.playEffect(occupied?'swap':'place');
      if(this.progress.settings.vibration&&this.platform.vibrate)this.platform.vibrate();
      this.afterChange();
    }catch(_){this.message('这个位置暂时不能这样安排，请换一个位置。');}
  }
  selectPerson(id){
    this.selected=id;const person=this.level.people.find(p=>p.id===id);this.audio.playEffect('select');this.learn('select');
    if(this.result.people[id]&&this.result.people[id].status==='conflict')this.learn('conflict');
    for(const r of person.rules){if(['adjacent','apart'].includes(r.type))this.learn('relation');if(r.type==='emptyNeighbor')this.learn('emptyNeighbor');this.learn(`rule:${r.type}`);}
    this.persist();
  }
  showHint(hint){this.selected=hint.personId;this.moveArmed=true;this.message(hint.text);this.audio.playEffect('hint');}
  explain(){
    if(!this.selected){const conflict=this.level.people.find(p=>this.result.people[p.id].status!=='satisfied');if(conflict)this.selected=conflict.id;}
    const p=this.level.people.find(p=>p.id===this.selected);if(!p)return;
    this.rulesExpanded=true;
    const state=this.result.people[p.id];
    const i=state.rules.findIndex(r=>r.status==='conflict');
    if(i>=0)this.message(`${p.name}还不满足：${p.rules[i].text}。点击人物，结合座位环境再看看。`);
    else this.message(`${p.name}：${p.rules.map(r=>r.text).join('；')}。左右同排的紧邻座位才算相邻。`);
  }
  async advancedHint(){
    if(this.hintBusy||this.won||this.transactionBusy||this.screen!=='play')return;
    if(this.readOnly||this.resetting){this.message('当前存档暂不能写入，本次未发放提示权益。免费规则说明仍可使用。');return;}
    const level=this.level,sessionId=this.playSessionId,revision=this.moveRevision,generation=this.progressGeneration;
    this.hintBusy=true;this.dirty=true;
    const current=()=>generation===this.progressGeneration&&!this.resetting&&!this.readOnly;
    const active=()=>current()&&this.screen==='play'&&this.playSessionId===sessionId&&this.moveRevision===revision&&!this.won;
    try{
      let access=this.access(),grant=access.grant;
      const reusable=this.reusableHint();
      const recompute=Boolean(reusable&&!this.hintMatchesPlacement(reusable.hintReceipt));
      if(reusable&&!recompute){this.showHint(reusable.hintReceipt.hint);return;}
      if(recompute){grant=reusable;access={...access,free:true,unlimited:false};}
      this.event('hint_request',{levelId:level.id});
      if(!access.free){
        if(!access.canRequestAd&&this.platform.createRewardedAd){this.message('先完成前10关，即可使用广告提示。规则说明始终免费。');return;}
        const requestId=uniqueId();this.event('ad_request',{levelId:level.id,requestId});
        const result=await this.ads.request({requestId,levelId:level.id,sessionId});
        if(!current())return;
        this.event(result.status==='earned'?'ad_complete':result.status==='cancelled'?'ad_cancel':'ad_error',{levelId:level.id,requestId,code:result.reason});
        if(result.status==='cancelled'){this.message('已取消，没有扣除任何提示权益。');return;}
        const fallback=result.status!=='earned';
        if(fallback&&!access.canFallback){this.message('暂时没有可用广告。你仍可查看免费规则说明、撤销或重新安排。');return;}
        const proposed=hintAccess.grant(this.progress,{grantId:fallback?`fallback:${level.id}:${level.revision||1}`:requestId,levelId:level.id,contentRevision:level.revision||1,source:fallback?'fallback':'rewarded',adResult:result});
        if(!proposed.ok){this.message('本次未发放提示权益。广告暂不可用或不符合领取条件，免费规则说明仍可使用。');return;}
        if(!await this.commitProgress(proposed.progress,{generation}))return;
        grant=proposed.grant;
        if(!active()){this.message('提示权益已保留，返回原关卡后可使用。');return;}
      }else if(!access.unlimited&&grant){
        if(!(this.progress.hintAccess.grants||[]).some(g=>g.grantId===grant.grantId)){
          const proposed=hintAccess.grant(this.progress,grant);
          if(!proposed.ok){this.message('本次未发放提示权益，请稍后重试。免费规则说明仍可使用。');return;}
          if(!await this.commitProgress(proposed.progress,{generation}))return;
        }
      }
      if(!active())return;
      const computed=await getAdvancedHint(level,{...this.session.placement},{isCancelled:()=>!active()});
      if(computed.status==='cancelled')return;
      if(computed.status!=='ready'){this.message(computed.status==='budgetExceeded'?'这题需要多想一会，先调整几位人物再试。没有消耗提示权益。':'暂时无法给出下一步，请查看规则或重新安排。');return;}
      if(!active())return;
      if(!access.unlimited){
        const consumed=hintAccess.consume(this.progress,{grantId:grant.grantId,levelId:level.id,recompute,hintReceipt:{hint:computed.hint,placementRevision:revision,sessionId,contentRevision:level.revision||1,placement:{...this.session.placement}}});
        if(!consumed.ok||!await this.commitProgress(consumed.progress,{generation}))return;
      }
      if(active()){this.showHint(computed.hint);this.event('hint_granted',{levelId:level.id});}
    }catch(_){if(current())this.message('提示暂时不可用，没有扣除未使用的权益。');}
    finally{if(generation===this.progressGeneration){this.hintBusy=false;this.dirty=true;}}
  }
  async clearLocal(){
    if(this.loading||this.transactionBusy||this.resetting)return false;
    // Retire every outstanding hint before yielding, including SDK callbacks
    // that arrive after deletion. Only an explicit reset may leave readOnly.
    this.progressGeneration++;this.resetting=true;this.transactionBusy=true;this.readOnly=true;this.hintBusy=false;
    const previousSave=this.pendingSave;
    this.pendingSave=previousSave.then(()=>resetLocal(this.platform.storage,this.catalog));
    try{
      const result=await this.pendingSave;
      if(result.ok){
        this.level=null;this.session=null;this.playSessionId=null;this.moveRevision=0;
        this.progress=createProgress(this.catalog);this.screen='home';this.modal=null;
        this.won=false;this.rulesExpanded=false;this.drag=null;this.selected=null;this.moveArmed=false;this.isDaily=false;this.activeDay=null;
        this.readOnly=false;this.refreshDaily();this.audio.setSettings(this.progress.settings);this.message('本机进度已清除。');
      }else this.message('清理未完成，已有存档不会被当作已清除。请重试。');
      return result.ok;
    }finally{this.resetting=false;this.transactionBusy=false;this.dirty=true;}
  }
  action(action,payload){
    if(this.loading||this.transactionBusy)return;
    if(action==='dismissToast')this.toast='';
    else if(action==='pageNext'){const count=payload&&Number.isInteger(payload.pageCount)?payload.pageCount:Math.ceil(this.chapters[this.chapter].levelIds.length/10);this.levelPage=Math.min(Math.max(0,count-1),this.levelPage+1);}
    else if(action==='pagePrev')this.levelPage=Math.max(0,this.levelPage-1);
    else if(action==='cancelModal'){this.modal=null;}
    else if(action==='confirmDeleteLocal'){void this.clearLocal();return;}
    else if(action==='deleteLocal')this.modal='deleteLocal';
    else if(action==='confirmReset'&&this.modal==='reset'){this.modal=null;this.session=reset(this.session);this.moveRevision++;this.selected=null;this.audio.playEffect('reset');this.afterChange();}
    else if(this.modal)return;
    else if(action==='home'){this.exitEvent();this.screen='home';this.toast='';this.drag=null;this.won=false;this.rulesExpanded=false;this.levelPage=0;}
    else if(action==='continue'){const id=getContinueLevelId(this.catalog,this.progress);if(id)this.startLevel(id);else this.screen='levels';}
    else if(action==='levels'){this.exitEvent();this.screen='levels';this.levelPage=0;this.toast='';this.won=false;this.drag=null;this.rulesExpanded=false;}
    else if(action==='chapter'){this.chapter=Number(payload);this.levelPage=0;}
    else if(action==='start')this.startLevel(payload);
    else if(action==='next'){if(this.isDaily){this.screen='daily';this.won=false;this.refreshDaily();}else{const id=getContinueLevelId(this.catalog,this.progress);if(id)this.startLevel(id);else{this.screen='levels';this.won=false;}}}
    else if(action==='daily'){this.exitEvent();this.screen='daily';this.levelPage=0;this.rulesExpanded=false;this.won=false;this.refreshDaily();this.toast='';}
    else if(action==='startDaily'){this.refreshDaily();if(this.dailyView.available)this.startLevel(this.dailyView.levelId,{dayKey:this.dailyView.dayKey});else this.message('完成5个不同主线关卡后开放每日挑战。');}
    else if(action==='resumeDaily'){this.refreshDaily();if(this.dailyResume)this.startLevel(this.dailyResume.levelId,{dayKey:this.dailyResume.dayKey,resumeDaily:true});}
    else if(action==='album'){this.exitEvent();this.screen='album';this.levelPage=0;this.rulesExpanded=false;this.toast='';}
    else if(action==='albumNext')this.albumPage=Math.min(1,(this.albumPage||0)+1);
    else if(action==='albumPrev')this.albumPage=Math.max(0,(this.albumPage||0)-1);
    else if(action==='claimCard'){const next=album.claim(this.progress,payload,this.catalog.campaignIds);if(JSON.stringify(next.album)!==JSON.stringify(this.progress.album)){this.progress=next;this.audio.playEffect('claim');this.persist();}}
    else if(action==='settings'){this.exitEvent();this.returnScreen=this.screen;this.screen='settings';this.levelPage=0;this.rulesExpanded=false;this.toast='';}
    else if(action==='setting'){this.progress=settings.toggle(this.progress,payload);this.audio.setSettings(this.progress.settings);this.persist();}
    else if(action==='help'){this.returnScreen=this.screen;this.screen='help';this.levelPage=0;this.toast='';}
    else if(action==='privacy'){this.modal='privacy';this.levelPage=0;}
    else if(action==='back'){this.screen=this.returnScreen||'home';this.toast='';}
    else if(action==='feedback')this.message('公开发布前将配置正式反馈渠道。当前可直接在开发任务中反馈。');
    else if(action==='cloud')this.message('云环境尚未配置；当前仅保存本机进度，不会上传。');
    else if(this.screen==='play'&&!this.won){
      if(action==='person'){this.selectPerson(payload);this.moveArmed=true;}
      else if(action==='armMove')this.moveArmed=true;
      else if(action==='seat'){
        if(this.selected&&payload.personId!==this.selected&&(!payload.personId||this.moveArmed))this.place(this.selected,payload.seatId);
        else if(payload.personId){this.selectPerson(payload.personId);this.moveArmed=false;}
      }else if(action==='unseat'&&this.selected)this.place(this.selected,null);
      else if(action==='undo'){this.session=undo(this.session);this.moveRevision++;this.toast='';this.learn('undo');this.audio.playEffect('undo');this.afterChange();}
      else if(action==='reset')this.modal='reset';
      else if(action==='hint')this.explain();
      else if(action==='hintAdvanced'){void this.advancedHint();}
      else if(action==='rulesToggle'){this.rulesExpanded=!this.rulesExpanded;this.levelPage=0;}
      else if(action==='waitingPrev')this.waitingOffset=Math.max(0,this.waitingOffset-1);
      else if(action==='waitingNext')this.waitingOffset=Math.min(Math.max(0,this.level.people.filter(p=>!this.session.placement[p.id]).length-1),this.waitingOffset+1);
    }
    this.dirty=true;
  }
  target(x,y){return this.hits.slice().reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);}
  pointer(event){
    if(this.loading||this.transactionBusy)return;
    const x=event.x,y=event.y;
    if(event.type==='down'){
      this.audio.unlock(this.level?this.level.chapterId:'bus');
      const target=this.target(x,y);if(!target)return;
      let personId=target.action==='person'?target.payload:target.action==='seat'?target.payload.personId:null;
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
      }else if(!drag.moved&&end&&end.action===drag.target.action&&JSON.stringify(end.payload)===JSON.stringify(drag.target.payload))this.action(end.action,end.payload);
      this.dirty=true;
    }else if(event.type==='cancel'){this.drag=null;this.dirty=true;}
  }
}
module.exports={GameApp};
