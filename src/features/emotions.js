'use strict';
// Presentation only: no extra conditions, timers in saves, or species-based rules.
const labels={neutral:'平静',happy:'开心',sad:'难过',sleepy:'困倦',hurt:'委屈',angry:'生气',curious:'期待',surprised:'惊喜'};
const REACTION_MS=1500;
function baseEmotion(level,result,placement,id){
 const person=level.people.find(p=>p.id===id),state=result?.people?.[id];
 if(!person||!state)return {mood:'curious',label:labels.curious,reason:'等你帮忙安排位置。',status:'pending'};
 let mood,reason;
 if(!placement[id]){mood='curious';reason='还在候场，等你安排一个位置。';}
 else if(state.status==='conflict'){
  const index=state.rules.findIndex(r=>r.status==='conflict'),rule=person.rules[index];
  mood=['notTag','apart'].includes(rule?.type)?'angry':'hurt';
  reason=state.rules[index]?.text||'这个位置还没有满足我的偏好。';
 }else if(state.status==='pending'){
  const index=state.rules.findIndex(r=>r.status==='pending'),rule=person.rules[index];
  mood='curious';
  const friend=level.people.find(p=>p.id===rule?.person);
  reason=friend?`等${friend.name}入座后，再看看这个偏好。`:rule?.type==='emptyNeighbor'?'等大家入座后，再看看旁边能否留空。':'等其他伙伴安排好，再看看。';
 }else{
  mood=(level.chapterId==='cinema'||level.chapter===2)?'sleepy':'happy';
  reason=mood==='sleepy'?'偏好都满足了，可以安心打个盹。':'这个位置满足了我的全部偏好。';
 }
 return {mood,label:labels[mood],reason,status:state.status};
}
function createReactions(level,previous,next,placement,now){
 const reactions={};
 for(const person of level.people){
  const base=baseEmotion(level,next,placement,person.id),old=previous?.people?.[person.id];
  if(!placement[person.id]||!old||old.status===base.status)continue;
  let mood=base.mood;
  if(base.status==='satisfied')mood='surprised';
  else if(old.status==='satisfied'&&base.status==='conflict')mood='sad';
  reactions[person.id]={mood,at:now,until:now+REACTION_MS};
 }
 return reactions;
}
function emotionFor(app,id){
 const base=baseEmotion(app.level,app.result,app.session.placement,id),now=app.frameNow??Date.now(),reaction=app.emotionReactions?.[id];
 if(!reaction||now>=reaction.until||app.progress?.settings?.reducedMotion)return {...base,motion:0};
 const elapsed=Math.max(0,now-reaction.at),t=Math.min(1,elapsed/REACTION_MS);
 const mood=t<.65?reaction.mood:base.mood;
 return {...base,mood,label:labels[mood],motion:Math.sin(t*Math.PI*6)*(1-t)};
}
module.exports={labels,REACTION_MS,baseEmotion,createReactions,emotionFor};
