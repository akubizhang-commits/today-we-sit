const test=require('node:test');
const assert=require('node:assert/strict');
const {createCatalog}=require('../src/content/catalog');
const {canEnter,getContinueLevelId}=require('../src/features/campaign');
const levels=[
  {id:'bus-001',chapterId:'bus'},{id:'bus-011',chapterId:'bus'},
  {id:'garden-001',chapterId:'garden'},{id:'garden-002',chapterId:'garden'},
];
const c=createCatalog({campaign:levels.map(l=>l.id)},levels);
test('fresh progression follows chapter preconditions, not arithmetic IDs',()=>{
  const p={completed:[],chapterAccess:['bus']};
  assert.equal(canEnter(c,p,'bus-001'),true);
  assert.equal(canEnter(c,p,'garden-001'),false);
  p.completed=['bus-001'];
  assert.equal(canEnter(c,p,'bus-011'),true);
  assert.equal(canEnter(c,p,'garden-001'),false);
  p.completed.push('bus-011');
  assert.equal(canEnter(c,p,'garden-001'),true);
});
test('legacy chapter access and disjoint completed levels survive inserted content',()=>{
  const p={completed:['bus-001','garden-001'],chapterAccess:['bus','garden'],currentLevelId:'garden-002'};
  assert.equal(canEnter(c,p,'garden-002'),true);
  assert.equal(getContinueLevelId(c,p),'garden-002');
  assert.equal(canEnter(c,p,'garden-001'),true);
  assert.equal(canEnter(c,p,'no-such-level'),false);
});
test('all completed has no nonexistent next level',()=>{
  assert.equal(getContinueLevelId(c,{completed:levels.map(l=>l.id),chapterAccess:['bus','garden']}),null);
});
