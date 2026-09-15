# v1.0 开发架构与接口

日期：2026-09-15。状态：设计合同，路径和接口为计划新增，非已实现。
权威需求：06-v1-release-requirements.md。

## 1. 从现状演进

| 现有文件/问题 | 决定 |
|---|---|
| src/core/engine.js | 保留evaluate/solve基础，增加解释性提示与有界搜索，不重写规则 |
| src/core/session.js | 保留移动/撤销；将存档移至独立progress模块，做v1→v2迁移 |
| src/content/levels.js | 由函数内嵌30关改为作者数据→验证→运行清单；保留稳定旧关身份 |
| src/app.js | 目前有30上限、id±1、日期/服务无边界；拆成导航、玩法控制、进度与服务注入 |
| src/ui/renderer.js | 单体画面与390×844缩放改为布局计算＋7页绘制＋语义命中目标 |
| src/platform/* | 继续双平台，补广告、音频、身份和云接口；平台对象不暴露给纯规则层 |
| scripts/build.js | 自制打包暂保留；增加内容预处理、资产复制、prod/dev过滤和产物清单测试 |
| 现有65测试 | 作为原型回归基线；正式版用目录清单长度代替硬编码30，不为了通过而删除行为断言 |

客户端继续CommonJS JavaScript＋Canvas 2D；用JSDoc和JSON schema记录契约，不在此次同时迁移TypeScript/Cocos。服务端定义提供商无关接口，部署目标先待用户账号/预算确认；本地假服务只用于联调开发，不冒充线上服务。

## 2. 计划目录

```text
src/
  app.js                         装配与启动，不再承担所有业务分支
  content/catalog.js             稳定ID、排序、前置、章节查询
  content/runtime/               构建生成的已发布内容
  core/engine.js                 规则/求解
  core/hints.js                  解释性提示、有界计算
  core/session.js                纯移动与撤销
  progress/schema.js             v2校验
  progress/migrate.js            demo迁移
  progress/repository.js         本地原子快照/云队列
  progress/merge.js              云冲突处理
  features/tutorial.js           引导状态机
  features/campaign.js           主线解锁和继续
  features/daily.js              日期/轮换/跨日
  features/album.js              里程碑
  features/hint-access.js        免费权益/广告权益账本
  features/settings.js           用户设置
  services/ads.js                广告状态机
  services/config.js             配置白名单/缓存
  services/telemetry.js           同意门控/队列/去重
  services/cloud.js              云同步客户端
  services/audio.js              音频生命周期
  services/contracts.js          服务接口JSDoc
  platform/browser.js
  platform/wechat.js             唯一持有wx对象
  ui/layout.js                   真屏幕布局/滚动
  ui/input.js                    语义目标/拖放
  ui/pages/*.js                  7页
  ui/components/*.js             需求卡/角色/棋盘/弹层
content/authoring/               124关作者源、reference、人工验收记录
content/manifest.json            90主线/14每日/20reserve分组
assets/                         3场景/人物/声音/纪念卡
tools/editor/                   本地编辑器（不进微信包）
scripts/validate-content.js
scripts/build-content.js
scripts/check-release.js
server/contracts/               OpenAPI或等效JSON接口约定
server/                         选定提供商后的真实实现
tests/fixtures/                 旧存档、冲突、日期、广告回调样例
```

## 3. 稳定关卡身份与目录

```js
// 作者数据，沿用已有seats/adjacency/people规则结构
{
  id: 'bus-001', revision: 1, chapterId: 'bus',
  kind: 'campaign', difficulty: 'easy',
  title: '车窗里的云', intro: '…',
  seats: [], adjacency: [], people: [],
  reference: {}, designIntent: '用窗边标签定位'
}
// manifest控制顺序，不从ID计算下一关
{
  schemaVersion: 1, contentVersion: '1.0.0',
  campaign: ['bus-001', 'bus-002'],
  daily: ['daily-001'],
  reserve: ['reserve-001'],
  dailyCycleAnchorDay: '2026-09-15'
}
```

例子中的短数组用于展示结构，正式清单强校验90/14/20数量。日题锚点是开发测试值，T29发布配置会固定生产值，后续更新不隐式改变。

开发清单允许当前30题及测试小目录；只有发行验证使用90/14/20数量门槛。不能让正式数量检查阻断M1迁移，也不能让开发模式绕过发行门槛。

接口：
```js
createCatalog(manifest, authoringLevels)
// -> { get(id), campaignIds, dailyIds, chapters, next(id), displayNumber(id) }
canEnter(catalog, progress, levelId) // -> boolean
getContinueLevelId(catalog, progress) // -> string|null
```

生产构建只输出campaign/daily，去除reference/designIntent等作者字段；储备关文件不复制。引擎运行时求解，不依赖reference。

## 4. v2存档与迁移

```js
{
  version: 2, contentVersion: '1.0.0', localRevision: 1,
  completed: ['bus-001'], currentLevelId: 'bus-002',
  chapterAccess: ['bus'],
  placements: { 'bus-002': { contentRevision: 1, sessionId:'local-session',
    moveSequence: 2, placement:{p1:'s1'}, savedAt:0 } },
  tutorial: { completedSteps:[] },
  daily: { lastSeenDay:null, completedDays:[] },
  album: { claimedIds:[] },
  hintAccess: { grants:[], consumedIds:[], fallbackClaimed:[] },
  settings: { music:true, effects:true, vibration:true, reducedMotion:false },
  sync: { enabled:false, serverRevision:null, pending:false }
}
```

- 旧1—10→bus-001…010；11—20→garden-001…010；21—30→cinema-001…010。不是将旧第11关强制变成新主线第11关。
- 保存旧key原始快照、迁移校验、写新key、读回验证，最后标记迁移成功。再次运行幂等。
- 完成记录不是连续前缀：旧关可能在新90关里形成离散集合，须保留。解锁用chapterAccess＋章内前置；已完成关始终允许重玩。
- 旧章已进入或其第一关已解锁时保留该章访问资格；例如旧1—10全完成，迁移后仍可进入garden-001，不要求补完新增bus-011…030。
- 正在玩的旧关映射到同一题的稳定ID。未改题时恢复布局；revision变化且几何/人物不兼容时，只重置该局并解释，保留历史完成。
- 发布前原型存档降级：原key不覆盖，旧demo仍能读自己的历史快照；不宣称旧版本能读新格式。

接口：
```js
migrateV1(raw, catalog) // -> {progress, warnings}; 纯函数
validateProgress(raw, catalog) // -> {ok,value,issues}
loadLocal(storage,catalog) // -> {progress,recovered,migrationWarnings}
saveLocal(storage,progress) // -> {ok,reason:null|'quota'|'invalid'|'unavailable'}
mergeProgress(local,remote,catalog) // -> {merged,placementConflicts}
```

云完成集合取合法ID并集，收藏去重，设置默认本机优先。无法比较的两份当前局面保留双快照并让玩家选择；不用设备时间大小自动覆盖。清除云数据时先阻止上行并清空待传队列，删除成功再清云token/修订标记；失败显示待重试，不伪报删除。

## 5. 广告、提示与时间

```js
ads.request({requestId, levelId, placementRevision})
// Promise<{status:'earned'|'cancelled'|'unavailable'|'error',requestId,levelId}>
hintAccess.grant({grantId,levelId,source:'initial'|'rewarded'|'fallback'})
hintAccess.consume({grantId,levelId,hintReceipt}) // 原子快照内记消费和可恢复提示回执
getAdvancedHint(level,placement,{nodeBudget})
// -> {status:'ready'|'complete'|'budgetExceeded'|'unsolvable',hint}
daily.resolve({serverDay,deviceNow,lastSeenDay,anchorDay,ids})
// -> {dayKey,levelId,isReplay,timeSource}
```

广告完成与提示展示解耦：授予原关卡权益；晚到回调不能直接修改当前关。计算超预算要让出主线程，显示可重试，不在一次触摸中无限同步搜索。L1永远不要求权益。

消费顺序：先算出建议，再将消费记录和hintReceipt一起持久化，成功后展示；写失败则不扣额度。持久化成功后应用退出，重进可恢复该回执，无需再次消费。若布局已改变，标明回执对应旧局面，允许使用原权益重新计算一次当前建议，避免扣了额度却无法使用。

基于六类规则输出可解释建议：先用标签定位、关系排除；不能推出唯一下一步时写“一个可行安排是…”，避免把多解误称唯一逻辑结论。

## 6. 云和遥测协议（产品内部设计，不声称平台自带）

身份由服务端验证平台凭证后确定，服务端不接受客户端传一个userId就授权访问。微信密钥只在服务端。浏览器开发采用本地测试身份，不进入生产环境。

| 操作 | 输入 | 输出/失败 |
|---|---|---|
| openSession | 平台临时登录凭证 | 短期会话、serverDay；失败保留离线 |
| getProgress | 会话 | progress、serverRevision |
| putProgress | expectedRevision、operationId、progress | 新revision；冲突返回409及最新revision，重新拉取合并 |
| deleteProgress | operationId、会话 | 删除回执；幂等，同步暂停 |
| postEvents | batchId、≤50 events、同意版本 | acceptedIds，重试按eventId去重 |
| getConfig | buildId、cachedVersion | 白名单配置、版本、过期时间 |
| sendFeedback | 用户主动输入、buildId、可选诊断同意 | ticketId或可重试失败 |

本地队列：遥测≤200条或256KB，错误优先，满时丢最旧普通事件；云重试退避且最多前台一轮3次，后台不无限循环。保留周期见需求文档。日志不记录临时凭证或完整答案。

后端提供商选择由T02输出ADR，候选实现要满足身份、按用户隔离、事务/修订控制、删除和成本上限；没有确认账号/费用前不部署收费资源。本地协议和测试可先完成。

## 7. 真屏幕布局与资产

```js
computeLayout({width,height,insets,expandedRules,waitingCount})
// -> {header,board,rules,waiting,toolbar,scrollRanges}
hitTest(layout,point,scrollOffsets) // -> semantic target|null
```

从可用CSS像素布局，DPR仅用于栅格清晰度。短屏规则卡展开成有明确关闭入口的面板，棋盘暂时变小但触控仍达标；必要时棋盘平移/滚动，不缩到目标小于44。条件全量可访问。

命中区使用稳定targetId，不比较每帧新建对象。动画位置与命中位置一致；弹层只允许最上层响应。候场滚动与人物拖动使用方向/距离阈值区分，测试误触。

资产清单带path/type/hash/license/source/scene。章节资源按需加载；重要规则图标失败时用清晰矢量后备，不显示没有意义的空白。

## 8. 构建与环境

- dev：浏览器、本地假服务、作者工具独立端口/目录；明显开发标识，不能上传生产事件。
- release：只有已发布内容、正式素材、真实适配；无秘密、作者解、储备题和工具。
- 真实广告模式不允许touristappid或空adUnitId通过release preflight；离线验证构建与可发布构建使用不同状态报告。
- `validate-content`、`check-release`、测试命令是计划新增，当前package.json尚不存在这些命令；任务完成后再提供运行承诺。

## 9. 技术风险优先级

首先解决身份迁移和解锁；其次解决短屏、长条件、候场滚动；再解决提示耗时和广告幂等；最后扩内容与真实后台联调。
用户账号/资格只阻塞生产联调和发布，不阻塞本地需求、布局、规则、内容工具与协议测试。
