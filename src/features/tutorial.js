'use strict';
const steps = {
  1: [{ id: 'select', actions: ['select'], text: '点选一位乘客，看看他的需求。' }],
  2: [{ id: 'place', actions: ['place'], text: '选好人物后，点一个空座位让他坐下。' }],
  3: [{ id: 'conflict', actions: ['conflict'], text: '查看标出的冲突，读一读尚未满足的条件。' }],
  4: [{ id: 'swap-or-undo', actions: ['swap', 'undo'], text: '移动人物到已有人的座位可以换位，也可以撤销上一步。' }],
  5: [{ id: 'relation', actions: ['relation'], text: '查看人物之间的关系，留意谁需要坐在一起。' },
    { id: 'emptyNeighbor', actions: ['emptyNeighbor'], text: '空位也有作用：查看需要空邻座的人物。' }]
};
const rules = { tag: '这个人需要座位带有指定的环境标签。', notTag: '这个人要避开带有指定标签的座位。',
  zone: '这个人需要坐在指定区域。', adjacent: '这两个人需要坐在相邻座位。', apart: '这两个人不能坐在相邻座位。', emptyNeighbor: '这个人旁边至少要留一个空座位。' };
const completed = progress => progress && progress.tutorial && progress.tutorial.completedSteps || [];
const stepId = (n, step) => `level-${n}:${step.id}`;
/** Current action prompt, or a first-appearance rule explanation; empty string means no prompt.
 * session.ruleType optionally selects a rule explanation. result is accepted for renderer compatibility;
 * evaluation alone never completes a step.
 * @param {number} levelDisplayNumber @param {object} session @param {object|null} result @param {object} progress @returns {string}
 */
function getText(levelDisplayNumber, session, result, progress) {
  const done = completed(progress);
  const step = (steps[levelDisplayNumber] || []).find(s => !done.includes(stepId(levelDisplayNumber, s)));
  if (step) return step.text;
  const rule = session && session.ruleType;
  return Object.prototype.hasOwnProperty.call(rules, rule) && !done.includes(`rule:${rule}`) ? rules[rule] : '';
}
/** Record only an actual verified action supplied by the app; never mutate progress or skip a step.
 * @param {object} progress @param {string} action @param {number} levelNumber @returns {object}
 */
function advance(progress, action, levelNumber) {
  const next = JSON.parse(JSON.stringify(progress));
  const done = [...completed(next)];
  const step = (steps[levelNumber] || []).find(s => !done.includes(stepId(levelNumber, s)));
  let id = step && step.actions.includes(action) ? stepId(levelNumber, step) : null;
  if (typeof action === 'string' && action.startsWith('rule:') && Object.prototype.hasOwnProperty.call(rules, action.slice(5))) id = action;
  if (id && !done.includes(id)) next.tutorial = { ...next.tutorial, completedSteps: [...done, id] };
  return next;
}
module.exports = { getText, advance };
