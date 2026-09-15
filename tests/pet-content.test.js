'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const levels = require('../content/authoring/levels.json');
const manifest = require('../content/manifest.json');
const { animalProfile } = require('../src/ui/animals');
const { evaluate, solve } = require('../src/core/engine');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const oldTheme = /电影|银幕|庭院|花园|野餐|观影|音箱|灯笼|树荫|树影|放映|片尾|字幕|爆米花|影票|餐台/;
const tagLabels = { window:'靠窗',door:'车门旁',front:'第一排',middle:'中间排',back:'最后一排',left:'每排最左侧',right:'每排最右侧',center:'每排非两端',shade:'遮光位',serving:'取餐位',lantern:'暖灯旁',screen:'晨光区',speaker:'轻音乐旁',edge:'每排两端',row1:'第一排',row2:'第二排',row3:'第三排' };
const zoneLabels = { front:'车厢前排',middle:'车厢中排',back:'车厢后排',garden:'窗边区',kitchen:'取餐侧',screen:'晨光区',rear:'里侧窝' };

test('pet release uses 1.1.0 with stable chapter identities and animal scene names', () => {
  assert.equal(manifest.contentVersion, '1.1.0');
  assert.deepEqual(manifest.chapters.map(c => [c.id,c.title]), [['bus','萌宠巴士'],['garden','萌宠食堂'],['cinema','呼噜午睡屋']]);
  assert.equal(manifest.dailyCycleAnchorDay,'2026-09-15');
  assert.deepEqual([manifest.campaign.length,manifest.daily.length,manifest.reserve.length],[90,14,20]);
});
test('theme-only migration preserves every non-prose level field, including all 124 saved-layout contracts', () => {
  const semantics = levels.map(({ title,intro,designIntent,...level }) => ({...level, people:level.people.map(p => ({...p,rules:p.rules.map(({text,...r})=>r)}))}));
  // Captured before this intentional prose migration; includes IDs, revisions,
  // cast names/colors, geometry, tags/zones, rule parameters, references and metadata.
  assert.equal(hash(JSON.stringify(semantics)), '5202797599446fdb8f484ada34d3d44add42b70d89d6a536b37b756c8d1574be');
  assert.equal(hash(fs.readFileSync(path.join(__dirname,'../content/authoring/legacy.json'))), 'f90482a3ca3337ee04c6ab93b14f6423278d7f55ddf89b7b511bf5b1db53f7b1');
});
test('all 124 puzzles have individual pet stories using the actual stable species and nickname', () => {
  assert.equal(new Set(levels.map(l=>l.title)).size,124);
  assert.equal(new Set(levels.map(l=>l.intro)).size,124);
  for(const l of levels) {
    assert.ok(l.intro.includes(`${animalProfile(l.people[0]).label}${l.people[0].name}`),l.id);
    for(const value of [l.title,l.intro,l.designIntent,...l.people.flatMap(p=>p.rules.map(r=>r.text))]) assert.doesNotMatch(value,oldTheme,l.id);
    assert.ok(l.designIntent.length>15,l.id);
  }
  for(const chapter of manifest.chapters) assert.doesNotMatch(chapter.title+chapter.subtitle,oldTheme);
});
test('rule text expresses exactly the unchanged condition and identifies relationship partners correctly', () => {
  for(const l of levels) for(const p of l.people) for(const r of p.rules) {
    let expected;
    if(r.type==='tag') expected=`想坐${tagLabels[r.value]}的位置`;
    if(r.type==='notTag') expected=`不坐${tagLabels[r.value]}的位置`;
    if(r.type==='zone') expected=`想坐${zoneLabels[r.value]}`;
    if(r.type==='emptyNeighbor') expected='左右至少留一个相邻空位';
    if(['adjacent','apart'].includes(r.type)) {
      const other=l.people.find(p=>p.id===r.person);
      expected=`${r.type==='adjacent'?'想和':'不和'}${animalProfile(other).label}${other.name}左右相邻`;
    }
    assert.equal(r.text,expected,`${l.id}/${p.id}/${r.type}`);
  }
});
test('offline composition yields the same pet prose and semantics without touching frozen history', () => {
  const { expand, themeLevel } = require('../content/authoring/compose');
  assert.equal(typeof themeLevel,'function');
  for(const old of require('../content/authoring/legacy.json')) assert.deepEqual(themeLevel(old),levels.find(l=>l.id===old.id));
  const cards=fs.readFileSync(path.join(__dirname,'../content/authoring/design-cards.txt'),'utf8').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  cards.forEach((card,i)=>assert.deepEqual(expand(card,i),levels.find(l=>l.id===card.split('|')[0])));
});
test('real engine accepts all original references and solves every rethemed puzzle', () => {
  for(const l of levels) {
    assert.equal(evaluate(l,l.reference).complete,true,l.id);
    assert.equal(evaluate(l,solve(l)).complete,true,l.id);
  }
});
test('album copy is pet themed while milestone identities and thresholds remain unchanged', () => {
  const cards=require('../src/features/album').getCards();
  assert.deepEqual(cards.map(c=>c.threshold),[5,10,15,20,30,40,50,60,70,80,85,90]);
  assert.deepEqual(cards.map(c=>c.id),Array.from({length:12},(_,i)=>`album-${String(i+1).padStart(2,'0')}`));
  assert.deepEqual(cards.map(c=>c.scene),['bus','bus','bus','bus','garden','garden','garden','garden','cinema','cinema','cinema','cinema']);
  cards.forEach(c=>assert.doesNotMatch(c.title,oldTheme));
  assert.match(cards.map(c=>c.title).join(''),/爪|毛|呼噜|窝/);
});

test('release validator accepts supported content versions and rejects unknown or malformed versions', () => {
  const {validateContent}=require('../scripts/validate-content');
  for(const contentVersion of ['1.0.0','1.1.0']) {
    const result=validateContent(levels,{...manifest,contentVersion},{release:true});
    assert.equal(result.ok,true,JSON.stringify(result.errors));
  }
  for(const contentVersion of [null,'','1.1','1.1.0-beta','1.1.0-extra','1.2.0','9.0.0',110]) {
    const result=validateContent(levels,{...manifest,contentVersion},{release:true});
    assert.equal(result.ok,false,String(contentVersion));
    assert.ok(result.errors.some(e=>e.code==='manifest'),String(contentVersion));
  }
});
