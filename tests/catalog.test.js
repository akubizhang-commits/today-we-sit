const test=require('node:test');
const assert=require('node:assert/strict');
const {createCatalog}=require('../src/content/catalog');
const data=[
  {id:'bus-001',chapterId:'bus',legacyId:1},
  {id:'garden-001',chapterId:'garden',legacyId:11},
  {id:'bus-002',chapterId:'bus',legacyId:2},
  {id:'daily-001',chapterId:'bus',kind:'daily'},
];
test('catalog separates identity from explicit order and display number',()=>{
  const c=createCatalog({campaign:['bus-002','bus-001','garden-001'],daily:['daily-001']},data);
  assert.equal(c.next('bus-002'),'bus-001');
  assert.equal(c.next('garden-001'),null);
  assert.equal(c.next('daily-001'),null);
  assert.equal(c.displayNumber('garden-001'),3);
  assert.equal(c.get('missing'),null);
  assert.deepEqual(c.chapters[0].levelIds,['bus-002','bus-001']);
});
test('catalog rejects missing references and duplicate IDs/categories',()=>{
  assert.throws(()=>createCatalog({campaign:['missing']},data),/missing/i);
  assert.throws(()=>createCatalog({campaign:['bus-001','bus-001']},data),/duplicate/i);
  assert.throws(()=>createCatalog({campaign:['bus-001'],daily:['bus-001']},data),/duplicate/i);
  assert.throws(()=>createCatalog({campaign:['bus-001']},[...data,data[0]]),/duplicate/i);
});
test('reserves cannot be looked up through playable catalogue',()=>{
  const c=createCatalog({campaign:['bus-001'],reserve:['reserve-001']},[...data,{id:'reserve-001',chapterId:'bus'}]);
  assert.equal(c.get('reserve-001'),null);
});
