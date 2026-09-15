'use strict';
function canEnter(catalog,progress,levelId){
  if(!catalog.campaignIds.includes(levelId))return false;
  const completed=new Set(progress.completed||[]);
  if(completed.has(levelId))return true;
  const level=catalog.get(levelId);
  const chapterIndex=catalog.chapters.findIndex(ch=>ch.id===level.chapterId);
  const chapter=catalog.chapters[chapterIndex];
  if(!chapter)return false;
  const previous=catalog.chapters[chapterIndex-1];
  const chapterOpen=chapterIndex===0||(progress.chapterAccess||[]).includes(chapter.id)
    ||previous.levelIds.every(id=>completed.has(id));
  if(!chapterOpen)return false;
  const index=chapter.levelIds.indexOf(levelId);
  return index===0||completed.has(chapter.levelIds[index-1]);
}
function getContinueLevelId(catalog,progress){
  const completed=new Set(progress.completed||[]);
  const current=progress.currentLevelId;
  if(current&&!completed.has(current)&&canEnter(catalog,progress,current))return current;
  return catalog.campaignIds.find(id=>!completed.has(id)&&canEnter(catalog,progress,id))||null;
}
module.exports={canEnter,getContinueLevelId};
