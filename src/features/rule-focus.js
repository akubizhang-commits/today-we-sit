'use strict';
const {evaluate}=require('../core/engine');
const {applyMove}=require('../core/session');
function ruleFocus(level,placement,selection){
 const person=level.people.find(p=>p.id===selection?.personId),index=selection?.index;
 const rule=person&&Number.isInteger(index)&&person.rules[index];if(!rule)return null;
 const seatIds=[],pendingIds=[];
 for(const seat of level.seats){
  const next=applyMove(level,{placement,history:[]},person.id,seat.id).placement,status=evaluate(level,next).people[person.id].rules[index].status;
  if(status==='satisfied')seatIds.push(seat.id);else if(status==='pending')pendingIds.push(seat.id);
 }
 const condition=['tag','notTag'].includes(rule.type)?`tag:${rule.value}`:rule.type==='zone'?`zone:${rule.value}`:null;
 return {personId:person.id,index,text:rule.text,seatIds,pendingIds,condition,avoid:rule.type==='notTag',referenceSeat:rule.person?placement[rule.person]:null};
}
function sortedRules(person,state){return (state?.rules||person.rules||[]).map((rule,index)=>({...rule,index})).sort((a,b)=>({conflict:0,pending:1,satisfied:2}[a.status]??1)-({conflict:0,pending:1,satisfied:2}[b.status]??1)||a.index-b.index);}
module.exports={ruleFocus,sortedRules};
