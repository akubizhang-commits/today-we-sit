'use strict';
const thresholds = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90];
const scenes = ['bus', 'garden', 'cinema'];
const titles = ['初次同行', '窗边的云', '一路欢笑', '温柔停靠', '满载回忆', '树下小聚', '花间午后', '庭院晚风', '银幕初亮', '星光相伴', '好戏将至', '我们同坐'];
const releaseIds = scenes.flatMap(scene => Array.from({ length: 30 }, (_, i) => `${scene}-${String(i + 1).padStart(3, '0')}`));
/** Cards count unique published campaign completions only; optional manifest membership supports inserted IDs.
 * @param {string[]} completed @param {string[]} claimedIds @param {string[]} [campaignIds]
 * @returns {{id:string,title:string,threshold:number,unlocked:boolean,claimed:boolean,scene:string}[]}
 */
function getCards(completed = [], claimedIds = [], campaignIds = releaseIds) {
  const allowed = new Set(campaignIds), claimed = new Set(claimedIds);
  const count = new Set(completed.filter(id => allowed.has(id))).size;
  return thresholds.map((threshold, i) => ({ id: `album-${String(i + 1).padStart(2, '0')}`, title: titles[i], threshold,
    unlocked: count >= threshold, claimed: claimed.has(`album-${String(i + 1).padStart(2, '0')}`), scene: scenes[Math.floor(i / 4)] }));
}
/** Return a new JSON progress snapshot; locked, unknown and already claimed cards are idempotent no-ops.
 * @param {object} progress @param {string} id @param {string[]} [campaignIds] @returns {object}
 */
function claim(progress, id, campaignIds) {
  const next = JSON.parse(JSON.stringify(progress));
  const card = getCards(next.completed || [], next.album && next.album.claimedIds || [], campaignIds).find(c => c.id === id);
  if (card && card.unlocked && !card.claimed) next.album = { ...next.album, claimedIds: [...(next.album && next.album.claimedIds || []), id] };
  return next;
}
module.exports = { getCards, claim };
