# v1.4「看图就能玩」开发设计

版本：v0.2 评审稿（吸收工程评审 14 条、产品评审 12 条）· 日期：2026-09-28 · 状态：已批准（2026-09-28）
需求：[PRD v0.2](2026-09-28-glanceable-play-prd.md) · [评审回应](2026-09-28-glanceable-play-review-response.md)（下文 R/AC 指 PRD 编号）

## 1. 总体思路

不新建玩法系统，只做三件事：
1. **呈现层换成图标**；
2. **去掉正式关的盲摆分支**，改为即时反馈；
3. **内容只改文案**（intro/ending/旧流程用语），规则不删，另出两份只读报告。

评分账本结构不变。存档加三个可选字段：`paws`、`iconsSeen`、草稿里的 `cleanRun`。**本轮不升任何关卡的 `revision`**，这样旧星级、旧草稿都保持有效。

```
content/authoring/reconstruction/*.json（主线/每日唯一权威源）──compose.js──▶ levels.json ──build-content──▶ runtime
src/content/outing-stories.js / playground.js（小剧场源）
scripts/（新）rule-report.js：冗余规则 + 深度体检，只读

src/features/rule-glyph.js（新，纯数据）  rule → {icon,label,negated,peerId,region}
src/ui/rule-icons.js（新，绘制）          glyph → Canvas 简笔
src/app.js  afterChange 去盲摆 → evaluate → settleIfComplete()（新，统一完成出口）
pages.js / animal-bubble.js / room-board.js / keepsake-settlement.js / overlays.js 接入上面两个模块
```

## 2. 共享代码隔离（AC8）

以下函数被挑战模式或伙伴样板共用，**不改默认行为**，只新增函数或可选参数：

| 共享点 | 使用方 | 处理 |
|---|---|---|
| `performance.describe` | `challenge/view.js:300` | 不改；新增 `describeAssistance(result)` 给正式关用 |
| `performance.fail` | `challenge/controller.js:222` | 保留；正式关不再调用 |
| `drawKeepsakeResult` | `challenge/view.js:336` | 新增可选项 `{captionRows, paw}`，缺省时维持原布局 |
| `seatFeatures` | `episodes/view.js` | 不改；新增 `seatFeatureKeys(seat)` 返回 tag key，并补上 `screen` |

## 3. 模块设计

### 3.1 `src/features/rule-glyph.js`（新）
纯函数，无 Canvas 依赖，内容校验和测试都复用它。

```js
glyph(rule, level) → { icon, label, negated, peerId|null, region|null }
// icon ∈ window|door|shade|serving|lantern|speaker|checkout|quiet|position|heart|cross|empty-side
// region（icon==='position'）：{ seatIds:[...], color }，按 level.seats 实际命中的座位计算
covers(rule, level) → boolean
labelConflicts(level) → [[ruleA, ruleB]]   // R2.9：短标签只差一字
```
- 位置类统一**按命中座位集合**表达：先算出这条规则命中的 seatIds，再把命中集合相同的规则归为同一图标。影院 `screen/front/row1` 就是这样合并的。
- 分区名按场景从映射表 `zoneLabels[sceneId][zone]` 取（≤4 字），不再用 `scenes.js:139 zoneNames`。

### 3.2 `src/ui/rule-icons.js`（新）
```js
drawRuleIcon(ctx, glyph, {x, y, size, status, level})
// status ∈ satisfied|conflict|pending|null → 角标形状：✓ 圆 / ! 三角 / … 空心圆（不只靠颜色）
// heart/cross：对方头像缩略 + 名字首字 + 符号
// position：level.seats 迷你网格，命中座位用 region.color 填充
// empty-side：三格一排，中间是自己，一侧留白
// negated：红色斜杠，线宽 ≥ size*0.12
```
- 按 100 单位坐标系绘制后缩放，和 `drawRoomProp` 约定相同。图形是**独立的简笔**，不直接缩小道具画，保证 12px 下能看清。
- 配色取 `room-props.js` 对应道具的主色；position 的颜色与 §3.5 的地面分区色一致。
- 迷你网格按 `level.id` 缓存。

### 3.3 进关不弹故事（R1）
- `app.js:202`、`:301`：正式关 `storyOpen=false`。
- `storyDismissedRevision` 原本只在 `closeStory` 写入。改为进关时直接写成当前 revision，保证存档语义不变（等于"已看过开场"）。
- `levelUpdated` 为真时弹一次 toast「这关换了新安排」，随即清除 `levelUpdated` 和草稿的 `needsTaskReview`（R1.6；原来只在 closeStory 里清）。
- 头部副标题区（`pages.js:126-127`）画 `level.intro`，整行 hit 到 action `story`（已有 `explain()`）。
- 回归：前两关教学引导 `getFocus`、`tutorial.getIntro` 以前默认玩家读过故事，新增测试确认它们在故事不弹出时仍然正常出现。

### 3.4 心愿图标（R2）
| 位置 | 改动 |
|---|---|
| 候场区（dialogueMode 分支 `pages.js:213-230`；单元宽 52、高 60/短屏 48，见 `layout.js:20-30`） | 头像缩到约 30px，下方 2×2 画 12px 图标，超出画「+N」；`layout.js` 的 dialogueMode `waiting.h` +8（短屏头像再缩，不增高）。首次学习标签（R2.8）临时占用候场区下方的提示行 |
| 气泡 `animal-bubble.js` + `ui/scene-dialogue.js` | `kind:'clues'` 改为每行「20px 图标 + 短标签 + 状态」；`kind:'response'` 删除，改为表情 + 冲突图标抖动 1 次（减少动效模式下不抖） |
| `features/scene-dialogue.js` | 保留给规则阅读器用，气泡不再调用 |
| 偏好面板 `preference-panel.js` | 行首加图标，文字保留（这是展开后的阅读器） |

`iconsSeen`：根字段，类型为 string[]，缺省为 `[]`；保存 icon key，用于 R2.8。

### 3.5 座位与地面（R3）
- `pages.js:184-189`：删除名字行和 caption 行；右上角画 `seatFeatureKeys` 的 ≤2 个 14px 图标，超出画「+」。`pages.js:179` 的 `portraitSize` 上限从 44 提到 50。
- `room-board.js:101-125` 已按 tag 画地面色。扩展为：对当前关里**被位置类规则引用**的每个命中集合，画淡色地块；排与排之间画细线。颜色来自 `rule-glyph` 的 region.color。没被规则引用的分区不画，避免视觉噪声。
- 座位编号只在规则阅读器 `overlays.js:109 rulesBlocks` 中出现。

### 3.6 即时反馈与统一完成出口（R4）
**afterChange（`app.js:381`）**
- 删除 385 行的盲摆分支；正式关和教程走同一套 `evaluate → createReactions`。
- 评估后，若任一动物状态为 `conflict`，置 `this.cleanRun=false`（爪印条件 3）。
- `result.complete && !won` 时：设置 `won`、完成演出时间（沿用原逻辑），保留 `level_complete`/`daily_complete` 事件，然后调用 `settleIfComplete()`。原来往 `this.progress` 直接 push `completed` 的代码删除，统一由 settle 负责。

**settleIfComplete()（新）**，由 afterChange、startLevel、startPlayground 共同调用：
```js
async settleIfComplete(){
  if(this.isTutorial||!this.result.complete||this.performanceRecord?.current?.result)return;
  if(this.readOnly){ this.markCompleted(this.progress); this.refreshDaily(); return; } // 只改内存，不落盘
  const next=clone(this.progress);
  next.performance=performance.complete(next.performance,this.performanceKey).ledger;
  this.markCompleted(next); this.markPaw(next);
  this.settlePending=true;
  if(await this.commitProgress(next)){ this.settlePending=false; this.refreshDaily(); }
}
```
- **同步调用异步是安全的**（工程评审已核实）：`commitProgress` 在第一个 await 之前同步置 `transactionBusy`，所以 afterChange 随后的 `persist()` 会跳过；提交快照已经包含棋盘；place/pointer 被 won 或 busy 挡住；`current.result` 已存在时直接返回，防止重复完成。
- **保存失败**：`settlePending` 保持为真，结算页显示「没保存成功」和按钮「重试保存」（action `settleRetry` → 再次调用 settleIfComplete）。
- **只读档**：只在内存里 markCompleted，确保「下一关」（`getContinueLevelId`，`app.js:620`）能前进。
- **恢复草稿**（R4.6）：`startLevel:201`、`startPlayground:300` 从 `neutralResult` 改为 `evaluate`。结果已经 complete 但还没结算时，直接 `won=true` 并调用 settleIfComplete（不播演出）。

**删除/改动**
- `submitArrangement` 删除；footer「安排好啦」按钮（`pages.js:257`）删除。`checkHelp` 删除（R6.3）。
- 完成条（`pages.js:198-206`）改为「都坐舒服啦！」；`completionUntil` 到期后自动进入结算，点任意处可提前进入。`reducedMotion` 下 `completionUntil=frameNow+800` 且不播演出。

**防直白（R4.4）**
- `ruleFocus(level,placement,selection,{blind})`（`rule-focus.js:4`）的调用处在 `pages.js:129`，改为 `{blind: app.ratedPlay}`。
- 正式关里 action `focusRule` 直接忽略，由 `overlays` 和偏好面板触发的也一样，并加测试锁定。
- 拖动只画落点框（`pages.js:176-177`），不做评估预览，加测试锁定。
- pending 语义不改（`engine.js:41-57`），加测试锁定：相邻类在对方入座前为 pending，emptyNeighbor 在全员入座前为 pending。

### 3.7 提示（R6）
- **方向提示**：`directionHint`（`manual-play.js:12`）已经能选出一只动物和相关的对方。改为返回 `{personId, peerId, ruleIndex}`，不再返回文字；画面上让该动物的心愿图标和对方头像闪 2 次（`hintFlashUntil`）。
- **一步提示**：`advancedHint` 的权益和配额流程不动。`getAdvancedHint` 已经返回 `{personId, seatId, text}`。画面改为高亮 personId（候场卡或已坐位置）和 seatId 座位（`hintSeatId`），`text` 不再显示，只保留给规则阅读器。`seatId===null`（先移出）时只高亮动物，并显示图标「↩ 回候场」。
- 广告/权益类 toast 按 §6 清单缩短并折叠。

### 3.8 星级（R5）
- `grade(failures, assistance)` 公式不改。新一轮不调用 `fail`，所以 failures=0，结果为 none→3 / direction→2 / answer→1。
- 升级前已在进行中、带 `failedSignatures` 的那一轮，完成时照旧计入失败（R5.3）。`describeAssistance(result)` 在 `result.failures>0` 时追加一句「按旧版规则计」。
- `overlays.js:17-35` 的 `HELP`/`RATING_RULES` 文案改写。

### 3.9 结算（R7）
- 正式关调用 `drawKeepsakeResult(..., {captionRows:1, paw:{earned, showIntro}})`；爪印画在星星右侧，实心或灰色。
- `ratedSettlement`（`overlays.js:175-215`，没有纪念画面时的兜底）：删去四个文字块，只保留星、爪印、结尾一句和按钮；明细放进 ⓘ。
- `settlePending` 时，主按钮替换为「重试保存」。

### 3.10 爪印（R8）
**运行时状态** `this.cleanRun`：
- 进关时：该关 `getRecord(...).first===null`（首次通关判定；`first` 不按 revision 过滤）**并且**草稿带 `cleanRun:true`（新开局视同带有）时为 true，否则为 false。
- 以下情况置 false：afterChange 评估出现任一 conflict；`recordAssistance` 成功（direction 和 answer 都算）；`retryAttempt`/reset **不恢复**资格（R8.2）。
- 草稿**只写正向标记**：`cleanRun:true`。字段缺失就视为不合格，所以没有这个字段的旧草稿不会误拿爪印。

**存档**
- 主线/每日草稿：`snapshotPlacement`（`app.js:340`）在 cleanRun 为真时写 `cleanRun:true`。`schema.js validSnapshot` 增加 `(!own(s,'cleanRun')||s.cleanRun===true)`。每日的 savedSessions 和 `placementConflicts` 复用 validSnapshot，自动兼容。
- 小剧场：`snapshotPlacement` 在 `app.js:325-328` 走 `playground.serialize` 提前返回。把 `cleanRun` 作为可选字段加入 serialize 和 `validateSnapshot`（`playground.js:54-59`）。**移动音箱本身不影响爪印**，只看是否出现 conflict。
- `progress.paws = {[performanceKey]: revision}`：可选根字段。存在时必须是 plain object，键用 performance 的 `keyValid`，值为正整数，否则走现有无效存档路径。`schema.js validateProgress` 不校验根级键集（已核实 :55-117），属于纯增量改动。
- `markPaw(next)`：`this.cleanRun && assistance==='none'` 时写入 `next.paws[key]=level.revision`。

**展示**：关卡列表 `pages.js:109-110`（实心或灰色 10px）；每日卡 `pages.js:294-295`；章节标题「爪印 N/M」；结算见 §3.9；`progress.pawIntroSeen:true` 控制 R8.4 的一次性说明。

### 3.11 内容处理（只改文案）
- **权威源**：主线和每日是 `content/authoring/reconstruction/*.json`，`story-overlays.js:21-22` 对这些记录直接返回原对象，所以 `stories/*.json` 对它们不起作用。compose 会重新生成 levels.json（`compose.js:252-259`）。小剧场的源是 `src/content/outing-stories.js`。
- **开工前先对齐**：工作区里已有 25 关的 levels.json 与 reconstruction 在 people 和 intro 上不一致。第一步先确认哪边为准（默认以 reconstruction 为准），重跑 compose 后对比差异，由用户确认。
- `scripts/draft-intros.js`：列出超长的 intro/ending 和旧流程用语，输出 CSV（id、原文、长度、建议稿）。**建议稿由 Claude 逐条撰写，用户抽检**，不做自动截断。改好后写回 reconstruction 和 outing-stories，再跑 compose 和 content:build。
- 修改后**不升 revision**（只改文案，不改语义），`contentVersion` 升一个小版本。
- 校验：`validate-content.js:139` 对 **manifest 中的 campaign 和 daily**（不含 reserve）增加 `intro≤20`、`ending≤24`、glyph 覆盖、R2.9 冲突检查。小剧场不经过 validate-content，另写 `tests/outing-glyph.test.js` 做同样的检查。

### 3.12 报告脚本 `scripts/rule-report.js`（只读，R10）
- 穷举复用 `tests/content-deduction-samples.helpers.js` 的 `solutions()`。`hints.js` 的 solve 只返回第一个解，而且没有导出，不能用。实测 114 关单删检查约 0.5 秒。
- 小剧场按（摆法, 音箱位置）联合比较解集。
- 输出 `docs/v1/rule-report-2026-09-28.{json,md}`：
  - 冗余规则：id、规则、是否被 clueMap/story 引用、是否为该动物唯一规则。
  - 深度指标：单条件定位率、解集大小、规则数/动物数、随机修补步数中位数（固定种子，200 次）、随机图标摆放一次成功率（固定种子，1000 次）。
  - 偏浅标记（R10.2 阈值）。
- 顺带列出数据异常，例如 bus-001 的 s1 同时带有 front 和 back，只报告，不修改。

## 4. 数据兼容

| 数据 | 处理 |
|---|---|
| 评分账本 `performance` | 结构不变；旧 failures 保留；旧进行中轮按旧规则结算一次 |
| 关卡 `revision` | 本轮不升；星级与草稿完全保留 |
| 草稿 | 新增可选 `cleanRun:true`；缺失视为不合格 |
| 根字段 `paws` / `iconsSeen` / `pawIntroSeen` | 可选，缺省为空；存在时做类型校验 |
| 存档 `version` | 保持 2 |

## 5. 测试计划

**新增**
- `rule-glyph.test.js`：遍历 runtime 与小剧场全部规则的覆盖；label ≤6 字；影院合并；R2.9。
- `instant-feedback.test.js`：即时状态；pending 时机；自动完成写入 completed 和 performance；保存失败后 settlePending 可以重试；只读档 next 能前进；恢复已摆满的草稿会自动结算；refreshDaily 时机；统计事件；rule-focus 与 focusRule 在正式关被屏蔽；没有拖动预览。
- `paw.test.js`：首次通关、未提示、未出现 conflict 三个条件；「…」状态下的移动不扣资格；点错进 ✓ 座位不扣；重置不恢复资格；旧草稿缺字段视为不合格；小剧场 serialize 往返；音箱移动不扣；schema 接受和拒绝。
- `hint-visual.test.js`：方向提示返回结构中没有 text；一步提示高亮 personId 和 seatId；seatId=null 分支。
- `legacy-wording.test.js`：内容和 src 中旧流程用语出现 0 次（AC7）。
- `rule-report.test.js`：用 3 个构造关验证冗余判定和指标。

**需改为新行为断言**（逐文件修改，不删测试）
- 盲摆：hearts-feedback、hearts-app、hearts-independent、hearts-ui、emotion-lifecycle、app.test、story-experience-state、story-rollout-ui、side-related-dialogue、related-clues-round3。
- `submitArrangement` 调用方：app-continuity、app-v1、app-async、completion-pause、hearts-hints、keepsake-pilot、playground-app、library-app、pm-overlays、rating-storage-status、simplified-controls、storage-app-realistic、wechat-storage-wrappers。
- 故事自动弹出：story-flow、review-app-regressions、story-experience、story-experience-state、story-rollout-ui、guided-tutorial-app、deduction-dialogue-ui、scene-dialogue、preference-panel、wish-copy、story-character-recognition、story-reading、pm-hint-reading。
- 结算：keepsake-pilot、settlement-destinations、pm-overlays、hearts-ui、completion-pause。
- 内容快照（intro/ending 改写后更新基线）：content-reconstruction（ending≤42 → 24）、audit-v1-bus-daily、audit-v1-garden、audit-v1-cinema、audit-v1-library-outings、content-deduction-samples、content-pm-refinement、story-experience-content、outing-stories、story-rollout。**规则和机制的 deepEqual 断言不应变化**，因为本轮不改规则；如果变了，说明误改了规则。
- 挑战（challenge-*）和伙伴样板（episode-*）的测试**不修改**，作为 AC8 的护栏。

**截图**：扩展 `docs/full-qa-2026-09-17/browser-qa.cjs`，覆盖 320×568、390、430 三种宽度，每种截 6 个状态：进关首帧、候场满员、首次学习标签、气泡、完成定格、结算（含爪印）。

## 6. 文字界面清单（R9）

| 界面 | 现状 | 处理 |
|---|---|---|
| 开场故事面板 | 自动弹出，约 180 字 | 不自动弹出；点 intro 打开，内容保留 |
| 头部副标题 | 「第1-03关 · 已入座 0/2」 | 改为 intro（≤20 字）；关号移到标题左侧的小徽标 |
| 候场区提示行 | 「点动物听心愿…」两行 | 删除；只在首次学习时显示图标名 |
| 候场卡 | 头像 + 名字 | 头像 + 图标（名字保留，≤3 字） |
| 座位 | 编号 + 名字 + 标签 | 只保留图标 |
| 气泡 | 整句台词 + 反馈句 | 图标 + 短标签 + 状态 |
| 完成条 | 「都找到喜欢的位置啦！」+「查看结算」 | 「都坐舒服啦！」 |
| 结算 | 标题、星、画、多行结尾，ⓘ 里是长文 | 结尾 1 行；ⓘ 保留（可接受长文） |
| 规则阅读器 / 偏好面板 / 帮助 | 长文 | 保留（玩家主动打开）；帮助文案按新规则改写 |
| 玩法 toast（`app.js` 中 32 处 `this.message`，最长约 42 字） | 长句 | 玩法类（放不下、撤销、换位等）≤14 字；存档、广告、权益类露出一行 ≤20 字 + 「了解详情」展开原文 |
| 关卡列表 | 标题 + 星 | 加爪印位；不加文字 |

## 7. 实施顺序（交给 writing-plans 细化）

1. 内容源对齐（§3.11 开工前对齐），由用户确认差异。
2. `rule-glyph` + 内容校验 + 测试（不影响 UI，可以单独合入）。
3. `rule-report` 报告，产出后交给用户。
4. 即时反馈 + settleIfComplete + 星级文案 + 防直白锁定（app.js 与相关测试）。
5. 提示改为无文字（方向闪烁 / 一步高亮）。
6. `rule-icons` + 候场区、气泡、座位、地面分区。
7. 进关不弹故事 + 头部 intro + 结算精简 + toast 缩短。
8. 爪印（schema、app、小剧场 serialize、列表、结算）+ 首次学习标签。
9. 内容：intro/ending/旧用语改写 → compose → content:build。
10. 全量测试、截图、交付记录。

每一步结束运行 `npm test`；第 9 步之后运行 `content:validate`、`build`。

## 8. 仍待开发中确认

1. 候场区在 320×568 下缩小头像后能否保持 44px 点击区域。若不行，改为「点候场卡后在气泡里看图标」，只对短屏生效。
2. 地面分区色块和现有 tag 地面色叠加后的可辨识度，第 6 步截图时确认。
