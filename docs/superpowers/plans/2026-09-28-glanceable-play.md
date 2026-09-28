# v1.4「看图就能玩」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 正式关（主线/每日/小剧场）进关不读长文、摆完即时反馈并自动过关，心愿以图标呈现；新增可见的「一次到位」爪印。

**Architecture:** 新增纯数据模块 `rule-glyph.js`（规则→图标/短标签/命中座位）和绘制模块 `rule-icons.js`；`app.js` 去掉盲摆分支，统一由 `settleIfComplete()` 结算；存档只加可选字段（`paws`/`iconsSeen`/`pawIntroSeen`/草稿 `cleanRun:true`），不升 revision。内容只改 intro/ending/旧流程用语。

**Tech Stack:** 原生 Canvas 2D（微信小游戏 + 浏览器 dev server），Node `node --test`，`@napi-rs/canvas`（测试依赖，本机装在 `/tmp/wesit-deps`）。

**Spec:** `docs/superpowers/specs/2026-09-28-glanceable-play-prd.md`（PRD v0.2）+ `docs/superpowers/specs/2026-09-28-glanceable-play-tech-design.md`（设计 v0.2）+ 评审回应。执行者必须同时阅读。

## Global Constraints

- 测试命令：`NODE_PATH=/tmp/wesit-deps/node_modules node --test tests/*.test.js`（基线 3529 pass / 0 fail）。
- intro ≤20 字；story.ending ≤24 字；短标签 ≤6 字；玩法 toast ≤14 字；存档/广告/权益 toast 首行 ≤20 字，原文折叠在「了解详情」。
- 旧流程用语「安排好啦」「查看结算」「确认安排」在 `src/`（除 `src/challenge/`）与 `content/` 中出现 0 次。
- 不升任何关卡 `revision`；`contentVersion` 升一个小版本；存档 `version` 保持 2。
- 挑战（`src/challenge/*`、`tests/challenge-*`）与伙伴样板（`src/episodes/*`、`tests/episode-*`）行为与测试不改（AC8）。共享函数只新增函数或可选参数。
- 图标：候场 ≥12px，气泡 ≥20px，可点区域 ≥44px；状态三形状 ✓圆 / !三角 / …空心圆。
- 爪印条件：首次通关那一轮 + 未用提示 + 从未出现 conflict；草稿只写正向 `cleanRun:true`，缺字段视为不合格；重置不恢复。
- 星级：`grade` 公式不改；正式关不再调用 `performance.fail`。
- 提交：只 add 本任务文件；`git -c user.name=zhangnu -c user.email=zhangnu@zhangnudeMac-mini.local commit`，消息末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。工作区有大量他人未提交改动，不得混入。

## Review Focus

1. 保存失败（`saveLocal` 返回 `{ok:false}`）时完成的局面：应停在结算页并可「重试保存」，重试成功后星级与 completed 落盘，且不重复计 `level_complete`。
2. 旧存档里已摆满且全满足、`performance.current` 无 result 的草稿：进关应直接结算（不播演出），不卡在棋盘上也不重复结算。
3. 只读档（readOnly）下完成：内存 `completed` 前进使「下一关」可用，但不落盘、不写 paws。
4. 小剧场草稿往返：`normalizePlayground` 不得剥掉 `cleanRun:true`；`cleanRun:false`/字符串等非法值使整条 session 失效（走现有无效路径）。
5. 教程关（`isTutorial`）与前两关教学引导：故事不自动弹出后仍出现引导，教程仍走旧完成路径，不写 performance/paws。

以上每条在所属任务里有对应测试（T3: 1、2、3、5；T7: 4）。

---

### Task 1: rule-glyph 映射 + 覆盖校验

**Files:**
- Create: `src/features/rule-glyph.js`
- Create: `tests/rule-glyph.test.js`
- Modify: `scripts/validate-content.js`（规则检查段，~181-186）

**Interfaces:**
- Produces: `glyph(rule, level) → {icon, label, negated, peerId|null, region:{seatIds,color}|null} | null`；`covers(rule, level) → boolean`；`labelConflicts(level) → [[ruleA, ruleB]]`；导出 `FEATURES`（tag→短标签）、`COLORS`（位置标签→颜色）。
- icon ∈ `window|door|shade|serving|lantern|speaker|checkout|quiet|position|heart|cross|empty-side`。

- [ ] **Step 1: 写测试** `tests/rule-glyph.test.js`

```js
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {glyph,covers,labelConflicts}=require('../src/features/rule-glyph');
const {levels}=require('../src/content/runtime/levels');
const {levels:outings}=require('../src/content/playground');
const all=[...levels,...outings];
test('every rule in all 126 levels has a glyph with a short label',()=>{
  assert.equal(all.length,126);
  for(const l of all)for(const p of l.people)for(const r of p.rules)
    assert.ok(covers(r,l),`${l.id}/${p.id} ${JSON.stringify(r)}`);
});
test('labels stay within six characters and never repeat for different seats',()=>{
  for(const l of all){
    for(const p of l.people)for(const r of p.rules)assert.ok([...glyph(r,l).label].length<=6);
    assert.deepEqual(labelConflicts(l),[],l.id);
  }
});
test('cinema screen/front/row1 share one icon and label',()=>{
  const l=levels.find(x=>x.chapterId==='cinema'&&x.seats.some(s=>s.tags.includes('screen')));
  const a=glyph({type:'tag',value:'screen'},l),b=glyph({type:'tag',value:'row1'},l);
  assert.equal(a.label,'前排');assert.equal(b.label,'前排');assert.deepEqual(a.region.seatIds,b.region.seatIds);
});
test('negation, relations and empty side',()=>{
  const l=levels[0];
  assert.deepEqual(glyph({type:'notTag',value:'window'},l).label,'不靠窗');
  assert.equal(glyph({type:'notTag',value:'window'},l).negated,true);
  assert.deepEqual(glyph({type:'adjacent',person:'x'},l),{icon:'heart',label:'同排挨着',negated:false,peerId:'x',region:null});
  assert.equal(glyph({type:'apart',person:'x'},l).icon,'cross');
  assert.equal(glyph({type:'emptyNeighbor'},l).label,'旁边有空');
  assert.equal(glyph({type:'tag',value:'nope'},l),null);
});
test('labelConflicts flags near-identical labels on different icons',()=>{
  const level={seats:[{id:'s1',tags:['window','door'],zone:'front'}],people:[{id:'a',rules:[{type:'tag',value:'window'}]},{id:'b',rules:[{type:'notTag',value:'window'}]}]};
  assert.deepEqual(labelConflicts(level),[]);
});
```

- [ ] **Step 2:** 运行 `node --test tests/rule-glyph.test.js`，预期 FAIL（模块不存在）。
- [ ] **Step 3: 实现** `src/features/rule-glyph.js`：特征 tag 映射附录 A；位置类先算命中 seatIds，按 PRIORITY（zone front/middle/back → tag front/middle/back/row1-3/left/center/right/edge/screen → zone rear/screen/garden/kitchen/reading/stacks）取第一个命中集合相同的标签；否定为「不在X」（靠左/靠右为「不靠左/不靠右」）；R2.9 冲突 = 同标签不同座位集合的两条位置规则，或两条不同图标的非位置规则标签等长只差一字。
- [ ] **Step 4:** `validate-content.js` 对 manifest 的 campaign+daily 每条规则 `covers()`，每关 `labelConflicts()` 为空，否则 push 错误 `${id}: rule has no glyph` / `${id}: confusable wish labels`。
- [ ] **Step 5:** 跑 `node --test tests/rule-glyph.test.js` 与 `npm run content:validate`，PASS；提交 `feat: map every wish rule to an icon and short label`。

### Task 2: 只读报告 rule-report

**Files:**
- Create: `scripts/rule-report.js`、`tests/rule-report.test.js`
- Output: `docs/v1/rule-report-2026-09-28.json`、`docs/v1/rule-report-2026-09-28.md`

**Interfaces:**
- Consumes: `solutions(level)`（`tests/content-deduction-samples.helpers.js`）；小剧场用 `playground.materialize(id, spot)` 按 left/right 各求解，解集键为 `spot|placement`。
- Produces: `analyze(level, {seed}) → {id, solutions, rulesPerPet, singleRuleLocate, redundant:[{personId,index,type,value,onlyRule,referenced}], repairMedian, randomSuccess, shallow}`；`module.exports={analyze, report}`；CLI `node scripts/rule-report.js` 写两个文件。

- [ ] **Step 1: 测试**（3 个构造关）：
  - 冗余关：两只猫两座，a:`tag window`，a 另有 `notTag door`（s1 window，s2 door）→ `notTag door` 在 redundant 中，`onlyRule:false`。
  - 非冗余：同构造去掉第二条 → redundant 为空。
  - 指标：`solutions===1`；`randomSuccess` 在 [0,1]；同 seed 两次结果 deepEqual（可复现）；`shallow===(repairMedian<30||randomSuccess>=0.25)`。
- [ ] **Step 2:** 运行 FAIL。
- [ ] **Step 3: 实现**：
  - 冗余 = 删一条规则后解集（序列化后排序）不变；`referenced` = 规则 text 片段出现在 `story` JSON 或 `clueMap` 中。
  - 单条件定位率 = 只有 1 个座位满足该动物某条非关系规则的比例（该动物的全部非关系规则都算）。
  - 随机修补 = mulberry32(seed) 随机初始完整摆法，每步随机挑一只 conflict 动物移到随机空位或与人互换，最多 2000 步；200 次取中位（未解视为 2000）。
  - 随机图标摆放 = 每只按随机顺序坐进随机一个满足其全部非关系规则的空位（没有就随机空位），1000 次的完成比例。
- [ ] **Step 4:** 生成报告（114 关 + 12 小剧场），md 含：汇总、偏浅关清单、冗余规则表、数据异常（同座位同时带 front 与 back 等）。
- [ ] **Step 5:** 测试 PASS；提交 `feat: add read-only redundancy and depth report`。

### Task 3: 即时反馈 + 统一完成出口

**Files:**
- Modify: `src/app.js`（afterChange、startLevel、startPlayground、submitArrangement/checkHelp 删除、action 分发、loop）、`src/features/performance.js`（新增 `describeAssistance`）、`src/ui/pages.js`（删「安排好啦」、完成条、`ruleFocus` blind 参数）、`src/ui/overlays.js`（RATING_RULES/HELP 文案、helpChoice 删核对、没保存成功对话框）、`src/features/rule-focus.js`（不改）。
- Create: `tests/instant-feedback.test.js`
- Update tests: 设计 §5「需改为新行为断言」中盲摆、submitArrangement 调用方两组。

**Interfaces:**
- Produces: `app.settleIfComplete(): Promise<void>`；`app.settlePending: boolean`；action `settleRetry`；`performance.describeAssistance(result) → string`；`app.cleanRun`（T7 使用，本任务先初始化为 false，markPaw 为空实现 `markPaw(next){}`）。

- [ ] **Step 1: 测试** `tests/instant-feedback.test.js`（boot 同 `tests/hearts-app.test.js`：`createCanvas(390,844)`、内存 storage、`await app.ready`、`startLevel('bus-001')`）：
  1. 放一只满足的动物后 `app.result.blind` 为 undefined，`result.people[id].status==='satisfied'`。
  2. adjacent 规则在对方未入座前为 pending；emptyNeighbor 在有人未入座时为 pending。
  3. 按 `solve(level)` 逐个 `place` 后：`won===true`，`await app.pendingSave` 后 `progress.completed` 含该关、`performanceRecord.current.result.stars===3`；`level_complete` 事件恰好 1 次。
  4. 保存失败：storage.setItem 抛错/返回失败 → `settlePending===true`；恢复 storage 后 `action('settleRetry')` → `settlePending===false`、completed 落盘。
  5. 只读档：`app.readOnly=true` 后完成 → `progress.completed` 含该关，storage 未写入。
  6. 恢复已摆满草稿：预置 `placements[id]` 为完整解 → `startLevel` 后 `won===true`，结算后 `current.result` 存在，`completionPending===false`。
  7. `action('focusRule',{personId,index:0})` 在正式关后 `focusedRule===null`；`pages` 调用 ruleFocus 时 blind 为真（draw 后 hits 中无 rule-focus 高亮：断言 `ruleFocus` 被以 `{blind:true}` 调用，用 require cache 注入 spy）。
  8. `action('submitArrangement')`、`action('helpCheck')` 无效果（不抛错、不改 progress）。
  9. 教程：`startTutorial()` 完成后不写 `performance`。
  10. `describeAssistance({stars:3,assistance:'none',failures:0})==='没用提示'`；failures>0 时含「按旧版规则计」。
- [ ] **Step 2:** 运行 FAIL。
- [ ] **Step 3: 实现 app.js**
  - `afterChange`：删除 `if(this.ratedPlay&&!confirmed){...}` 分支与 `confirmed` 参数；评估后 `if(Object.values(this.result.people).some(p=>p.status==='conflict'))this.cleanRun=false;`；完成分支保留 won/completionPending/事件/音效，`completionUntil=this.frameNow+(reducedMotion?800:2400)`；教程分支不变；非教程删除直接 push 的三段，改为 `void this.settleIfComplete();`（事件 `daily_complete`/`level_complete` 保留在此处）。
  - 新增 `settleIfComplete()`（照设计 §3.6 代码；小剧场同样走 `performance.complete`，与 performanceKey 一致），`settleRetry` action：`if(this.settlePending)return this.settleIfComplete();`，放在 `if(this.modal)return` 之前。
  - `startLevel`/`startPlayground`：`this.result=evaluate(...)`；`if(!this.performanceRecord?.current?.result&&this.result.complete){this.won=true;this.completionPending=false;void this.settleIfComplete();}`（在 persist 前；persist 会因 transactionBusy 跳过）；初始化 `this.settlePending=false`。
  - 删除 `submitArrangement`、`checkHelp` 方法及 action 分支（`submitArrangement`/`helpCheck` 静默忽略）。
  - `focusRule`：`if(this.ratedPlay)` 直接忽略。
  - 完成条点击任意处 → `showSettlement`（pages 里给完成条画全屏 hit）。
- [ ] **Step 4: pages/overlays**：删除 toolbar「安排好啦」；完成条文字「都坐舒服啦！」无按钮；`ruleFocus(...,{blind:app.ratedPlay})`；RATING_RULES/HELP 改为「没用提示 3 星 · 用方向提示 2 星 · 用一步提示 1 星；移动、撤销、重置不影响」；helpChoice 删「核对」；`settlement&&app.settlePending` 时画 compactDialog「没保存成功」+「重试保存」(`settleRetry`)+「返回关卡」(`levels`)。
- [ ] **Step 5:** 更新受影响测试：凡 `act(app,'submitArrangement')` 改为无操作（删除该调用，完成已自动触发并 `await app.pendingSave`）；盲摆断言改为即时状态断言。不得改 challenge-*/episode-*。
- [ ] **Step 6:** 全量测试 PASS；提交 `feat: instant feedback and automatic settlement for rated levels`。

### Task 4: 无文字提示

**Files:** Modify `src/features/manual-play.js`、`src/app.js`（directionHelp、showHint、playgroundHint、rereadHint、place）、`src/ui/pages.js`（候场卡/座位高亮）。Create `tests/hint-visual.test.js`。

**Interfaces:**
- `directionHint(level, selectedId) → {personId, peerId|null, ruleIndex}`（无 text）。
- `app.hintFlash={personId, peerId, until}`（direction，until=now+1200，闪 2 次）；`app.hintTarget={personId, seatId|null}`（answer，下一次 place/undo/reset 清除）。

- [ ] **Step 1: 测试**：`directionHint` 返回对象无 `text` 键且 personId 属于关卡；`directionHelp` 后 `app.hintFlash.personId` 存在且 `app.toast===''`；`showHint({personId:'a',seatId:'s2',text:'x'})` 后 `hintTarget` 为 `{personId:'a',seatId:'s2'}` 且 toast 不含「号座位」；`seatId:null` 时 toast==='↩ 回候场'；place 后 `hintTarget===null`。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 实现；`rememberHint` 仍记录 lastHint（供 rereadHint 恢复高亮而非文字）；小剧场「移动音响」提示改为 `hintTarget={personId:null,seatId:null,speaker:spot}` + toast「移一下音响」。pages：hintFlash 期间对应候场卡/座位描边以 300ms 周期闪烁；hintTarget 画金色描边于动物与座位。
- [ ] **Step 4:** 更新依赖旧提示文字的测试（hearts-hints、pm-hint-reading 等只改断言）。全量 PASS；提交 `feat: text-free direction and step hints`。

### Task 5: 图标绘制与接入

**Files:** Create `src/ui/rule-icons.js`、`tests/rule-icons.test.js`。Modify `src/ui/pages.js`（候场卡 2×2 图标、座位角标、portraitSize≤50、删名字/caption 行）、`src/ui/layout.js`（dialogueMode waiting.h +8）、`src/ui/animal-bubble.js` + `src/ui/scene-dialogue.js`（clues 行 = 20px 图标 + 短标签 + 状态形状；response 改为表情+冲突图标抖动）、`src/ui/room-board.js`（位置规则分区地块+排线）、`src/ui/scenes.js`（新增 `seatFeatureKeys`）、`src/ui/preference-panel.js`（行首图标）。

**Interfaces:**
- `drawRuleIcon(ctx, glyph, {x, y, size, status, level})`；`drawStatusMark(ctx, status, x, y, size)`；`seatFeatureKeys(seat) → string[]`（含 screen）。
- `regionsForLevel(level) → [{seatIds,color}]`（去重，仅被位置规则引用的集合）放在 rule-glyph.js。

- [ ] **Step 1: 测试**：对每种 icon + negated + 三种 status 在 64×64 canvas 上绘制不抛错且画布非空（`getImageData` 有非透明像素）；`seatFeatureKeys({tags:['window','row1','screen']})` 为 `['window','screen']`；`regionsForLevel` 对影院关只返回一个前排集合；pages 渲染 390×844 bus-001 后，候场区不存在名字以外的心愿文字（用 ctx.fillText spy 收集文本，断言不含任何规则 `text`/`dialogue`）；320×568 渲染候场卡 hit 高度 ≥44。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 实现（100 单位坐标系缩放；负向斜杠线宽 ≥size*0.12；状态角标 ✓圆/!三角/…空心圆）。
- [ ] **Step 4:** 更新文本快照类 UI 测试（hearts-ui、wish-copy、scene-dialogue、deduction-dialogue-ui、ui-v1 等）的断言到新文案/图标。全量 PASS；提交 `feat: draw wishes, seat features and zones as icons`。

### Task 6: 进关不弹故事 + 头部 intro + 结算精简 + toast 缩短

**Files:** Modify `src/app.js`（startLevel/startPlayground storyOpen=false、写 storyDismissedRevision、levelUpdated toast、message 折叠）、`src/ui/pages.js`（头部 intro 行 hit `story`）、`src/ui/keepsake-settlement.js`（可选 `{captionRows,paw}`）、`src/ui/overlays.js`（ratedSettlement 精简、toast「了解详情」）。Create `tests/story-entry.test.js`。

**Interfaces:**
- `drawKeepsakeResult(p, bounds, opts)` 新增 `opts.captionRows`（1 时只画 `story.ending` 一行）与 `opts.paw={earned, showIntro}`（缺省维持原布局）。
- `app.message(text,{persistent, detail})`：`detail` 存在时 toast 显示 text，点「了解详情」弹出 detail。

- [ ] **Step 1: 测试**：126 关进关首帧 `storyOpen===false && modal===null`；`action('story')` 打开故事；`levelUpdated` 草稿进关 toast==='这关换了新安排' 且 `persist` 后草稿无 `needsTaskReview`；前两关 `tutorialText` 在不关故事时仍非空；首帧 fillText 收集的叙述文字只有标题与 intro；所有 `this.message(` 字面文本：玩法类 ≤14 字、带 detail 的首行 ≤20 字（扫描 app.js 源码的字符串字面量做静态断言）。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 实现；toast 改写清单按设计 §6。
- [ ] **Step 4:** 更新故事自动弹出组与结算组测试。全量 PASS；提交 `feat: open levels straight to the board with a one-line intro`。

### Task 7: 爪印 + 首次学习标签

**Files:** Modify `src/progress/schema.js`（validSnapshot 的 cleanRun、根字段 paws/iconsSeen/pawIntroSeen 校验）、`src/features/playground.js`（serialize/validateSnapshot 支持 `cleanRun:true`）、`src/app.js`（cleanRun 生命周期、markPaw、pawIntroSeen、iconsSeen）、`src/ui/pages.js`（关卡列表爪印位、章节「爪印 N/M」、每日卡、首次学习标签行）、`src/ui/keepsake-settlement.js`/`overlays.js`（结算爪印+一次性说明）。Create `tests/paw.test.js`、`tests/first-icons.test.js`。

**Interfaces:**
- `progress.paws: {[performanceKey]: revision}`；`progress.iconsSeen: string[]`；`progress.pawIntroSeen: true`。
- `app.cleanRun: boolean`；`app.markPaw(next)`；`app.pawEarned` getter（`!!this.progress.paws?.[this.performanceKey]`）；`app.newIcons: string[]`（进关时计算，首步 place 后清空）。

- [ ] **Step 1: 测试** `tests/paw.test.js`：无提示无 conflict 通关 → `paws['campaign:bus-001']===1`；先摆出 conflict 再修好 → 无爪印；只移动 pending 动物 → 有；用方向提示 → 无；已有 `first` 记录的关（旧通关）重玩 → 无；conflict 后 reset → 仍无；草稿 `cleanRun:true` 往返后继续 → 有；旧草稿无该字段 → 无；schema：`cleanRun:false`/`'yes'` 拒绝，`paws:{k:0}`/`paws:[]` 拒绝，`iconsSeen:[1]` 拒绝；小剧场 `normalizePlayground` 保留 `cleanRun:true`，`cleanRun:false` 的 session 被丢弃；音箱移动不扣资格；每日 key 为 `daily:<dayKey>:<id>`。
  `tests/first-icons.test.js`：新档进 bus-001 → `newIcons` 为该关图标集合，`progress.iconsSeen` 已含它们；第二次进关 → `newIcons` 为空；place 一步后 `newIcons` 为空。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 实现。cleanRun 进关规则：`getRecord(...).first===null && (新开局 || snapshot.cleanRun===true) && current.assistance==='none'`，再对进关评估有 conflict 则 false；`recordAssistance` 成功后 false；`retryAttempt`/reset 不恢复。`markPaw(next)`：`if(this.cleanRun&&performance.getRecord(next.performance,key,rev).current.result.assistance==='none')next.paws={...next.paws,[key]:this.level.revision||1}`；首次看到爪印位时在同一事务写 `pawIntroSeen:true`，内存 `this.showPawIntro=true`。
- [ ] **Step 4:** UI：列表格子星星右侧 10px 爪（`scenes.paw`），获得实心、未获得灰；章节标题右侧「爪印 N/M」；结算星星右侧爪印位 + 一次性说明「一次都没让伙伴皱眉，就能留下爪印。」；候场区下方首次学习标签「图标 短标签」一行，最多 3 个。
- [ ] **Step 5:** 全量 PASS；提交 `feat: paw prints for clean first clears and first-time icon labels`。

### Task 8: 内容改写

**Files:** Create `scripts/draft-intros.js`、`content/authoring/intro-rewrite-2026-09-28.json`（`{id: {intro, ending}}` 映射，Claude 逐条撰写）、`scripts/apply-intro-rewrite.js`。Modify `content/authoring/reconstruction/*.json`、`src/content/outing-stories.js`、`content/authoring/levels.json`、`content/manifest.json`（contentVersion 小版本）、`src/content/runtime/*`（由 build 生成）、`scripts/validate-content.js`（intro≤20、ending≤24、旧用语）、`src/app.js`/`src/ui/*`/`src/features/*` 旧用语。Create `tests/legacy-wording.test.js`、`tests/outing-glyph.test.js`。

- [ ] **Step 1: 测试**：`legacy-wording.test.js` 递归扫描 `src/`（排除 `src/challenge/`）与 `content/` 的 .js/.json，三个旧用语出现 0 次；runtime + 小剧场每关 `[...intro].length<=20`、`[...story.ending].length<=24`；`outing-glyph.test.js` 小剧场 left/right 两个 materialize 版本全部规则 covers 且无 labelConflicts。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** `draft-intros.js` 输出超长清单 → 撰写映射（保留人物与事件、不含规则信息）→ apply 脚本写回 reconstruction（`intro`、`story.ending`）与 outing-stories → `node content/authoring/compose.js` → `npm run content:build`。
- [ ] **Step 4:** 更新内容快照测试基线（只允许 intro/ending/旧用语相关差异；规则 deepEqual 不得变化；content-reconstruction 的 ending≤42 改 24）。
- [ ] **Step 5:** `npm run content:validate` 与全量测试 PASS；提交 `content: shorten intros and endings, retire legacy flow wording`。

### Task 9: 验收

- [ ] 全量测试、`npm run content:validate`、`npm run build` 全部通过，记录输出。
- [ ] 浏览器截图 320×568 / 390×844 / 430×932：进关首帧、候场满员、首次学习标签、气泡、完成定格、结算（含爪印），存 `docs/v1/glanceable-qa-2026-09-28/`。
- [ ] 交付记录 `docs/v1/glanceable-delivery-2026-09-28.md`：AC1–AC12 逐条证据、已知代价、报告位置、建议的 3–5 人试玩记录表。提交。
