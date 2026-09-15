'use strict';
// Keep persisted step IDs stable. Prompts describe real app events, never require
// a deliberately wrong move, and do not themselves acknowledge a completed step.
const steps = {
  1: [{ id: 'select', actions: ['select'], focus: 'person', text: '点选一位小动物，先读读它想坐哪里。' }],
  2: [{ id: 'place', actions: ['place'], focus: 'seat', text: '选好伙伴后，点空座入座；留意靠窗和避开窗边的不同。' }],
  3: [{ id: 'conflict', actions: ['relation', 'conflict', 'place'], focus: 'rules', text: '先看后排和相邻条件，再安排伙伴；同排左右紧挨才算相邻。' }],
  4: [{ id: 'swap-or-undo', actions: ['swap', 'undo', 'place'], focus: 'swap', text: '需要调整时可换位或撤销；摆对就继续点空座入座。' }],
  // Level five has no adjacent/apart rules. The historical "relation" ID now
  // means selecting a partner to inspect its conditions; no migration is needed.
  5: [{ id: 'relation', actions: ['select', 'relation'], focus: 'person', text: '先点选伙伴看条件，找找谁需要身旁留空位。' },
    { id: 'emptyNeighbor', actions: ['emptyNeighbor'], focus: 'rules', text: '点选需要空邻座的伙伴：同排紧挨的空位才算，前后排不算。' }]
};
const rules = {
  tag: '这位小动物需要座位带有指定标签。',
  notTag: '这位小动物要避开带有指定标签的座位。',
  zone: '这位小动物需要坐在指定区域。',
  adjacent: '两位伙伴需要坐在相邻座位；同排左右紧挨才算。',
  apart: '两位伙伴不能坐在相邻座位；不相邻不等于必须隔一排。',
  emptyNeighbor: '这位小动物身旁至少留一个相邻空位；前后排的空位不算。'
};
// Optional rule-reader context for levels 6–10, not a new mandatory step queue.
// These explanations are shown only when the caller requests a ruleType that has
// not yet been acknowledged by a real rule:<type> event.
const orientations = {
  6: {
    apart: '不相邻不等于必须隔一排。先看门旁伙伴，再读另一组的相邻条件。',
    adjacent: '先找条件明确的伙伴，再把想挨着它的小动物安排在同排邻座。'
  },
  7: {
    adjacent: '两组伙伴各自看相邻条件；别把中排需要的空位占掉。',
    emptyNeighbor: '中排伙伴需要身旁留空位。先读它的条件，再安排两组同行伙伴。'
  },
  8: {
    adjacent: '这关三对伙伴会坐满。先找区域明确的小动物，再沿相邻关系补位。',
    zone: '满座时更要看清区域：同伴的区域条件，也能帮助确定相邻伙伴的位置。'
  },
  9: {
    emptyNeighbor: '两位伙伴都需要空邻座。逐一看各自区域，不能拿别排的空位凑数。',
    apart: '先安排需要留空位的伙伴，再核对另一组是否相邻，以及谁不能挨着谁。'
  },
  10: {
    emptyNeighbor: '后排伙伴需要身旁留空位；只有一个空位，别在安排两组伙伴时占掉它。',
    adjacent: '结合区域条件安排两组相邻伙伴，最后再核对后排的空邻座。'
  }
};
// Opening orientation is independent of rule-reader acknowledgments.
const intros = {
  6: '先看门旁伙伴；不相邻不等于必须隔一排。',
  7: '先给中排伙伴留空邻座，再安排两组同行伙伴。',
  8: '三对伙伴会坐满；先找区域明确的小动物，再安排邻座。',
  9: '两位伙伴都要空邻座，别把前后排空位算进去。',
  10: '后排要留一个相邻空位，再核对两组伙伴的条件。'
};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const completed=progress=>{
  const value=progress&&progress.tutorial&&progress.tutorial.completedSteps;
  return Array.isArray(value)?value:[];
};
const stepId=(n,step)=>`level-${n}:${step.id}`;
function currentStep(n,done){
  return Number.isInteger(n)&&own(steps,n)?steps[n].find(step=>!done.includes(stepId(n,step))):undefined;
}
/** Current prompt or an optional first-appearance rule explanation.
 * session.ruleType selects rule-reader context; evaluation never advances steps.
 * @returns {string} Empty string means there is no current prompt.
 */
function getText(levelDisplayNumber,session,result,progress){
  const done=completed(progress),step=currentStep(levelDisplayNumber,done);
  if(step)return step.text;
  const rule=session&&session.ruleType;
  if(!own(rules,rule)||done.includes(`rule:${rule}`))return '';
  const context=own(orientations,levelDisplayNumber)?orientations[levelDisplayNumber]:null;
  return context&&own(context,rule)?context[rule]:rules[rule];
}
/** Semantic highlight for the current existing step; no progress mutation.
 * The UI resolves visible targets and may omit a highlight if none is available.
 * @returns {'person'|'seat'|'rules'|'swap'|null}
 */
function getFocus(levelNumber,progress){
  const step=currentStep(levelNumber,completed(progress));
  return step?step.focus:null;
}
/** Pure opening tip for levels 6–10, otherwise an empty string.
 * The caller shows it only with empty placement before the first move.
 * No progress fields, acknowledgment events or required steps are added.
 */
function getIntro(levelNumber){
  return Number.isInteger(levelNumber)&&own(intros,levelNumber)?intros[levelNumber]:'';
}
/** Record only verified app actions. Keep existing completedSteps schema and IDs. */
function advance(progress,action,levelNumber){
  const next=JSON.parse(JSON.stringify(progress));
  const done=[...completed(next)],step=currentStep(levelNumber,done);
  let id=step&&step.actions.includes(action)?stepId(levelNumber,step):null;
  if(typeof action==='string'&&action.startsWith('rule:')&&own(rules,action.slice(5)))id=action;
  if(id&&!done.includes(id))next.tutorial={...next.tutorial,completedSteps:[...done,id]};
  return next;
}
module.exports={getText,getFocus,getIntro,advance};
