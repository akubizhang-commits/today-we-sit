'use strict';

/** Identity is independent of order; reserved authoring content is not playable. */
function createCatalog(manifest,authoringLevels){
  if(!manifest||!Array.isArray(authoringLevels))throw new Error('Invalid catalogue');
  const source=new Map();
  for(const l of authoringLevels){
    if(!l||typeof l.id!=='string'||!l.id)throw new Error('Invalid level identity');
    if(source.has(l.id))throw new Error(`Duplicate level: ${l.id}`);
    source.set(l.id,l);
  }
  const categories=['campaign','daily','reserve'],seen=new Set();
  for(const category of categories){
    if(manifest[category]!==undefined&&!Array.isArray(manifest[category]))throw new Error(`Invalid ${category}`);
    for(const id of manifest[category]||[]){
      if(seen.has(id))throw new Error(`Duplicate manifest identity: ${id}`);
      seen.add(id);
      if(!source.has(id))throw new Error(`Missing level: ${id}`);
    }
  }
  const campaignIds=Object.freeze([...(manifest.campaign||[])]);
  const dailyIds=Object.freeze([...(manifest.daily||[])]);
  const playable=new Set([...campaignIds,...dailyIds]);
  const chapterIds=[];
  for(const id of campaignIds){
    const cid=source.get(id).chapterId;
    if(typeof cid!=='string'||!cid)throw new Error(`Missing chapter for ${id}`);
    if(!chapterIds.includes(cid))chapterIds.push(cid);
  }
  const defaults={
    bus:{title:'社区接驳车',subtitle:'带着早餐，慢慢出发',color:'#A8BA99'},
    garden:{title:'庭院聚餐',subtitle:'把晚餐摆到树影下面',color:'#C66949'},
    cinema:{title:'露天电影',subtitle:'等星星亮起，一起入座',color:'#758CA8'},
  };
  const chapters=chapterIds.map((id,index)=>Object.freeze({
    id,index,...defaults[id],...(manifest.chapters||[]).find(c=>c.id===id),
    levelIds:Object.freeze(campaignIds.filter(lid=>source.get(lid).chapterId===id)),
  }));
  const campaignIndex=new Map(campaignIds.map((id,i)=>[id,i]));
  return Object.freeze({
    campaignIds,dailyIds,chapters:Object.freeze(chapters),
    contentVersion:manifest.contentVersion||'dev',
    dailyCycleAnchorDay:manifest.dailyCycleAnchorDay||'2026-09-15',
    get:id=>playable.has(id)?source.get(id):null,
    next(id){const i=campaignIndex.get(id);return i===undefined?null:campaignIds[i+1]||null;},
    displayNumber(id){const i=campaignIndex.get(id);return i===undefined?null:i+1;},
  });
}
module.exports={createCatalog};
