# v1.0 · 30项开发任务与验收

日期：2026-09-15。需求：06-v1-release-requirements.md。接口：07-v1-development-architecture.md。
当前状态：本文所有正式版任务均未开始；原型已有实现仅作复用基础。不要将任务清单存在视为代码完成。

## 1. 执行约定

- 状态：待开始、进行中、本地完成、真实联调完成、验收完成；外部条件待满足单独标记。
- 一个任务有独立分支/提交和验收记录；只修改拥有的文件，跨任务接口先更新07。
- 先测试高风险行为，再实现，检查真实用户路径；不为静态文案写镜像测试。
- 任务完成记录：修改文件、验证命令/输出、截图或实际服务证据、遗留风险。
- 下列测试路径为计划新增，文件尚不存在；现有测试继续保留或做有理由的等价迁移。
- 不自动提交线上审核、部署收费资源或修改账号安全设置。

## 2. 任务清单

| ID | 交付物/具体范围 | 主要代码/文档路径 | 依赖 | 验收与关键测试 | 主责 |
|---|---|---|---|---|---|
| T01 | 原型基线与开发规则：65项回归、浏览器/微信产物记录、dev/release约定、代码版本跟踪 | docs/v1/baseline.md、package.json、tests/fixtures/ | 无 | 跑现有npm test/build并留证；历史存档fixture不含用户秘密 | 程序 |
| T02 | 真实平台条件清单、后端提供商ADR、预算及测试设备表 | docs/v1/platform-readiness.md、docs/v1/backend-adr.md | 无 | AppID/主体状态/广告位/云环境/授权素材来源记录真实，未知明确标记；不填假凭据 | 产品＋用户 |
| T03 | 稳定关卡ID、作者manifest、目录查询、主线顺序/展示编号分离 | src/content/catalog.js、content/manifest.json、content/authoring/、tests/catalog.test.js | T01 | 重排不换身份；ID重复/缺失引用失败；next不使用数字加1 | 程序 |
| T04 | demo v1→v2纯迁移与验证 | src/progress/schema.js、migrate.js、tests/progress-migration.test.js | T03 | 旧11→garden-001；离散完成不丢；chapterAccess保留；重复迁移幂等；异常字段不崩溃 | 程序 |
| T05 | 拆分游戏控制器与主线导航，去除30关硬编码 | src/app.js、features/campaign.js、tests/campaign.test.js | T03,T04 | 新/老玩家解锁、继续、插入关、末关、重玩；可用目录长度驱动 | 程序 |
| T06 | 真实尺寸布局系统、页面组件规范 | src/ui/layout.js、components/、docs/v1/ui-spec.md、tests/layout.test.js | T01 | 320/375/390/430宽，正文/触控不缩小；完整条件可读；安全区/展开卡不遮关键出口 | UI＋程序 |
| T07 | 独立输入与滚动、弹层层级、拖放反馈 | src/ui/input.js、components/board.js、tests/input.test.js | T05,T06 | 候场滚动不误拖、弹层不穿透、指针取消、动画与命中一致；真浏览器操作 | 程序 |
| T08 | 美术规格与资产清单：12角色×5态、约24道具/22图标、来源记录 | assets/manifest.json、docs/v1/art-spec.md、assets/characters/ | T06 | 先1场景＋3角色样板；同屏8人可辨；每个资产授权/原创记录、hash与尺寸完整 | 美术＋UI |
| T09 | 三套正式场景及各4变体、7页正式UI、角色表现与纪念卡画面 | src/ui/pages/、assets/scenes/、assets/album/ | T07,T08 | 首章10关样板先验收再扩三场景；规则环境高亮一致；无装饰暗示不存在规则 | 美术＋程序 |
| T10 | 设置仓库、音频生命周期、8组共享动画、减弱动效 | services/audio.js、features/settings.js、assets/audio/、tests/audio.test.js | T07,T08 | 3音乐/约10音效，首次交互、静音、前后台、资源失败、低端设备声音不叠爆 | 程序＋音频 |
| T11 | 本地可视化关卡编辑器 | tools/editor/、tests/editor.test.js | T03,T06 | 拖座位、加人物和规则、预览真实引擎、导入导出；无运行目录意外覆盖 | 工具程序 |
| T12 | 内容检验与生产导出工具 | scripts/validate-content.js、build-content.js、tests/content-build.test.js | T03 | 校验6类规则、无解/多解、缺素材、数量；prod无reference/reserve；故意坏数据构建失败 | 程序 |
| T13 | 前5关交互引导、规则帮助 | features/tutorial.js、ui/components/tutorial.js、tests/tutorial.test.js | T07,T09,T17 | 真动作推进；中断恢复；已学不重复；帮助可重看；首次游玩观察 | 程序＋设计 |
| T14 | 分层可解释提示、预算上限和非阻塞计算 | core/hints.js、tests/hints-v1.test.js | T03,T07 | 单步可行/多解语气/分步修复/无循环/预算超限出口；主线程不持续冻结 | 算法程序 |
| T15 | 提示额度与权益账本 | features/hint-access.js、tests/hint-access.test.js | T14,T17 | 前10关保护；初始免费与失败救济去重；重玩不重置；grant跨关不丢；持久化失败不扣权 | 程序 |
| T16 | 激励视频真实适配与状态机 | services/ads.js、platform/wechat.js、tests/ads.test.js | T15,T02的广告条件 | 一次一个请求；取消/失败/重复/晚到回调；真实完成/取消/无填充证据；未配置入口隐藏 | 平台程序 |
| T17 | 本地双快照存档、版本化功能状态、恢复与删除 | progress/repository.js、tests/progress-local.test.js | T04 | quota/损坏/中断写入恢复；教程/提示/设置存档；旧版本备份；删除与队列互斥 | 程序 |
| T18 | 云协议、真实服务实现和隔离环境 | server/contracts/、server/、tests/server-contracts.test.js | 协议依赖T04；部署依赖T02 | 身份验证、按用户隔离、修订号CAS、操作幂等、删除；错误身份无法读他人数据 | 后端 |
| T19 | 云同步客户端与冲突恢复界面 | services/cloud.js、progress/merge.js、tests/cloud-sync.test.js | T17,T18 | 完成并集、局面不混排、修订冲突重试、两设备离线、身份变化、删除后不复活 | 程序 |
| T20 | 15类事件、同意门控、错误监控和基础报表 | services/telemetry.js、server/reports/、docs/v1/metrics.md、tests/telemetry.test.js | T05,T18,T24告知接口 | 未同意不传、batch去重/上限、保留删除、开发数据隔离；真实结算才报净收入 | 数据＋程序 |
| T21 | 配置白名单、缓存与故障开关 | services/config.js、server/config/、tests/config.test.js | T18 | 过期/断网/未知字段回退；只能关闭/降频；不加载代码或未发布题 | 程序 |
| T22 | 每日挑战界面与14日轮换 | features/daily.js、ui/pages/daily.js、tests/daily.test.js | T03,T07,T17；时间校准联调T18 | 第5关后入口；跨零点旧题可完成；日期回退/离线/第15日明确重播；奖励日去重 | 程序 |
| T23 | 纪念册12卡与里程碑 | features/album.js、ui/pages/album.js、tests/album.test.js | T05,T09,T17 | 固定12阈值；重复过关不重复发卡；未领取状态、迁移/云合并不丢卡 | 程序＋美术 |
| T24 | 帮助、设置服务入口、隐私与反馈/删除页面 | ui/pages/settings.js、ui/pages/help.js、docs/v1/data-inventory.md | T06,T17；真实联系方式T02 | 实际行为与文案一致；拒绝仍离线可玩；反馈失败可重试；删除云数据需回执 | 产品＋程序 |
| T25 | 主线60关正式内容，旧30关复审 | content/authoring/campaign/、docs/v1/content-qa.csv | T09,T11,T12,T13,T14 | 不是仅新增30道后保留旧题原样；60道全部自动+人工验收，设计意图与难度记录齐全 | 关卡设计 |
| T26 | 扩至90主线＋14独立日题 | content/authoring/campaign/、daily/、content/manifest.json | T25,T22,T23 | 90/14数量正确；36/40/14主线难度目标；独立日题无改名复制；完整主线与日题流程 | 关卡设计 |
| T27 | 20道储备＋素材/推广交付 | content/authoring/reserve/、assets/marketing/、docs/v1/rights-register.csv | T25,T09 | 储备全部验收但不在release包；展示图5/视频3真实玩法；所有权记录可追溯 | 设计＋美术 |
| T28 | 全量回归、性能、真机、异常与用户体验验证 | tests/release/、docs/v1/device-matrix.md、docs/v1/qa-report.md | T16,T19,T20,T21,T24,T26,T27 | 2 iOS/3 Android；无P0丢档/阻断/错奖；弱网、冷启动、帧率、90主线/日题/纪念册；真实数据窗口 | QA＋程序 |
| T29 | 发行构建、资格资料、回退演练和提审包 | scripts/check-release.js、scripts/build.js、docs/v1/release-checklist.md | T28,T02 | 无测试内容/秘密/储备/reference；配置实际AppID；资料真实；审核/公开发布须最后单独执行 | 发布负责人 |
| T30 | 首发观察与第一轮维护计划 | docs/v1/launch-operations.md、docs/v1/known-issues.md | T29并实际发布 | 24/72小时及7日人工观察安排、故障响应、数据来源；每周10—15关只是初始产能目标 | 产品＋程序 |

T30这里只交付观察SOP和负责人计划，不创建自动化、不承诺未来主动监控。实际值班与发布后数据由运行中的团队落实。

## 3. 首轮可并行启动与依赖

现在可做：T01原型基线、T02外部清单、T06布局规范。
T01后立刻做T03，然后T04/T12并行；T04后做T05/T17。
UI线：T06→T07→T08→T09/T10；T07也依赖T05完成接入。
内容线：T03→T11/T12→T25→T26/T27。
服务线：T04→T18协议；后端提供商明确后→真实T18→T19/T20/T21。
商业化线：T17＋T14→T15→T16。
发布汇合：T28→T29→T30。

不要让任务互相等待：T20先做独立同意状态接口与本地事件测试，T24消费同一接口；T18不依赖T24页面。真正联调完成需页面和服务一并验证。

## 4. 功能覆盖矩阵

| 需求 | 对应任务 |
|---|---|
| F01 核心 | T05,T07,T28 |
| F02 教学 | T13,T25 |
| F03 提示 | T14,T15,T16 |
| F04 主线 | T03,T04,T05,T25,T26 |
| F05 每日 | T22,T26 |
| F06 收藏 | T09,T23 |
| F07 设置声音 | T10,T24 |
| F08 存档 | T04,T17,T18,T19 |
| F09 广告 | T02,T15,T16,T21 |
| F10 数据 | T18,T20,T24 |
| F11 内容工具 | T11,T12 |
| F12 运营配置 | T18,T21,T29 |
| F13 服务 | T02,T24,T27 |
| F14 发布保障 | T01,T02,T06,T08,T12,T28,T29,T30 |

## 5. 6个里程碑

| 里程碑 | 包含任务/交付 | 放行条件 |
|---|---|---|
| M1 稳定基础 | T01,T03,T04,T05,T17；T02同步推进 | 老demo进度不丢，目录可扩，回归通过 |
| M2 正式交互与画风 | T06—T10,T13；首章10关视觉样板 | 手机上完整可读、操控清楚、样板盲测 |
| M3 内容生产与服务 | T11,T12,T14—T21,T24,T25 | 60关内部节点，核心服务与广告真实联调 |
| M4 首发全部内容 | T22,T23,T26,T27 | 90＋14＋20验收，收藏与循环入口完整 |
| M5 发布候选 | T28,T29 | 质量、实际资格、真实环境全部通过 |
| M6 首发维护 | T30 | 观察SOP、责任人和已知问题处置明确 |

8—10周仅沿用“1名熟练程序＋1名持续投入设计＋兼职美术音频”的初估，不是30项任务已排定工时。M2完成后根据10关样板耗时和T18工作量更新估算；外部审批不计入有效开发时间。未分配的角色由主负责人兼任时排期顺延。

## 6. 谁需要提供什么

可由开发直接完成：本地代码、测试、原创关卡、协议、原型美术、需求与发布资料草案。
需要用户/运营确认：实际主体/AppID及权限、广告位和能力状态、云提供商/预算、真实客服联系、素材商用授权、测试设备与测试者。
密码、AppSecret、支付信息不写到任务卡；需要秘密时使用选定平台的受控配置。未提供上述条件仍可推进本地任务，但不能替真实联调/发布盖章。
