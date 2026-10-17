# 给喵挪个窝 · 场景排座谜题

2026-10-11 已生成千本图书馆微信原生候选。首页整理进入同一座1000本图书馆；浏览器与微信共用规则、书目、美术和存档校验，微信面板及触控使用原生 Canvas。完整重启开发者工具后，首页和千本地图已在微信模拟器启动；完整微信归架/重开及物理手机验收待补，尚未上传。详见 [本轮交付](docs/qa/library-wechat-2026-10-11/DELIVERY.md)。

## 当前公开玩法

- 主线：巴士、电影院、花园宴席三个场景，四个故事、十二幕。角色会带来噪声、帽子遮挡、零食或气味；名单和需求随下一幕变化。完成巴士后解锁冷暖番外，可以调节空调并安排条件聊天组合。
- 高难挑战：50关，分史诗／梦魇／炼狱／深渊／地狱五组，每组10关。复用已认可的场景与拖放，组合冷热、窗口、视线、零食、前后排、分桌、桌边相邻与面对面关系。
- 挑战先安排全部伙伴，再点击“检查安排”。检查前不显示逐人对错；无失败检查、无提示为三星，1—2种失败摆法或方向提示最多两星，3种失败摆法为一星。移动、交换、撤销不扣星，同一错误摆法重复检查不重复计数。
- 纪念册回看完成时的真实安排；挑战保留最好星级及其布局。新主线和新挑战共同使用根存档的 `socialSeating` 域。

旧100关主线、小剧场、旧挑战、每日与伙伴样板已退出公开导航。旧数据仍保留，不折算成新通关；小剧场的整理玩法暂未开发。旧分享会引导进入新故事列表。

范围与验收见 [当前替换设计](docs/design/social-campaign-2026-09-29/PLAN.md) 和 [本轮交付](docs/design/social-campaign-2026-09-29/DELIVERY.md)。50关均通过求解与独立规则复核，难度档位仍需真人试玩校准。本轮全量回归3656项通过；真实微信设备、分享收发和上传包体仍需另行验收。当前微信候选包约4.21MiB，仍含旧玩法兼容模块，需要发布前的包体检查。

## 本机试玩与编辑器

```sh
cd /Users/zhangnu/WeChatProjects/today-we-sit
npm ci
npm run dev
```

游戏：`http://127.0.0.1:4173/`；关卡编辑器：`http://127.0.0.1:4173/editor`。只监听本机。编辑器保留旧关卡格式的编辑能力；新版主线在 `src/social/catalog.js`、`bonus-catalog.js` 中维护，挑战由 `scripts/author-social-challenges.js` 离线生成。编辑器不会自动发布关卡。

需要 Node.js 20+；首次拉取或锁文件更新后用 `npm ci` 安装固定版本的构建依赖。修改源码后执行 `npm run build` 并刷新页面。端口占用时使用 `SEAT_GAME_PORT=4174 npm run dev`。

## 微信导入

```sh
npm run build
```

用微信开发者工具导入 `/Users/zhangnu/WeChatProjects/today-we-sit/dist/wechat`，类型为小游戏。该目录包括主入口、本地音频与 `library-world/` 普通分包；不要把分包目录单独导入。产物排除储备题、作者参考答案和编辑器。

微信主包和分包均由 Babel 转换为 ES5，再通过独立语法解析、主包4 MiB及合包30 MiB检查；构建依赖不打入游戏。本轮主包3,832,784字节、千本分包1,014,522字节。`es6` / `enhance` 均关闭，避免重复转译。请修改源码后重新构建，不要直接编辑生成的 `dist/wechat/`。浏览器预览仍使用原始语法。构建检查不能替代微信真机与上传验收。

整理沿用 `library-world-prototype-v1` 主档、备份和候选记录，每次操作确认保存；返回等待未完成写入并保存当前位置。旧八关记录保留在纪念册的旧书角。浏览器、微信及不同设备之间不自动迁移存档。适配边界见 [接入方案](docs/design/library-wechat-adaptation-2026-10-11.md)。

根目录 `project.config.json` 已配置用户提供的 AppID：`wxa6e9ec013ec322d6`，构建时同步到微信导入目录。广告位、服务地址与反馈渠道配置在 `src/config.js`，不要把AppSecret等秘密写入客户端。

## 开发与检查

```sh
npm test
npm run content:validate
npm run build
npm run release:check
```

`build` 生成本地候选包；`build:release` 会先执行发布检查。当前 `release:check` 预期失败，因为仍为开发环境，真实平台、分享、反馈及人工验收证据未完成。广告/云服务在当前首发不适用，不作为缺失联调阻塞。内容、回归和分享证据必须绑定本次buildId及源码指纹，不能仅勾选true。不能用普通构建成功替代上线验收。

音频可用 `npm run audio:generate` 从项目内合成脚本重新生成。旧运行时内容仍由 `content/authoring/` 与 `content/manifest.json` 生成，用于存档兼容。新挑战导出后运行 `node scripts/validate-social-challenges.js`；解答证据只存在于开发文档，不打入包。

## 当前限制

- 广告状态机和平台适配已写入，未完成真实广告位联调；没有模拟广告收入。
- 云备份客户端契约与进度合并可独立测试，实际后端、身份校验和云删除尚未接入应用。
- 遥测/远程配置模块尚未接通运营服务，当前不上传玩法数据。
- 仍需微信 iOS/Android 真机、性能、前后台切换、音频听感、全部题目的人工验收与运营素材。
- Canvas 暂不支持完整键盘或屏幕阅读器操作。本机存档不提供防作弊保证；卸载或清理数据可能丢失进度。

## 开发资料

- [历史首发范围（已被新主线替换）](docs/v1/local-launch-scope.md)
- [历史需求（已替代）](docs/06-v1-release-requirements.md)
- [技术架构](docs/07-v1-development-architecture.md)
- [任务拆分](docs/08-v1-task-backlog.md)
- [本轮执行与验收记录](docs/v1/progress.md)
- [关卡生产说明](docs/v1/content-production.md)
- [编辑器使用说明](docs/v1/editor-guide.md)

早期文档01—04记录30关原型，不代表当前功能或发布验收结论。代码、文本、关卡和程序绘制素材独立制作，未引入 Is This Seat Taken? 的素材或关卡。

角色图鉴预览：`http://127.0.0.1:4173/animals.html`。角色采用源码原创矢量绘制，同名角色跨关保持物种，围巾颜色保留原有角色区别。

## 独立图书馆原型

当前单图整理玩法在 `prototypes/library-world/`，使用 `node scripts/build-library-world.js` 更新浏览器产物。已运行的本机入口为 `http://127.0.0.1:4197/library-world/index.html`；`opening-preview.html` 是不读写正式存档的首次体验，刷新会重新开始。

开场体验现在包含20本分格书篮、50本小推车的场景领取：达标后书架内显示“去领取”，顶部任务卡也会直接带小猫前往叶馆长服务台或阿熊维修角，点击领取后才升级容量。`opening-preview.html?reward=20` / `?reward=50` 是已达标、未领取的独立临时体验，方便立即试领；未带参数的开场页仍从第一本开始。普通 `index.html` 的既有存档保留原自动奖励权益，本次未迁移。已打开的旧开场页不要擅自刷新，以免丢失它的临时进度。

2026-10-11 主路加入五组真实目的地方向地贴、四组猫爪印短句及入口欢迎语。场景标记由 `wayfinding.js` 绘制，置于角色和物件下方，不加入碰撞或点击目标。方向与地图复核、小屏画布验证及162项图书馆回归见 [交付记录](docs/qa/library-aisle-wayfinding-2026-10-11/DELIVERY.md)。本轮仅更新浏览器原型，未构建或发布微信包。

同日修复书篮最后一本归架后的布局跳变：空篮保留书卡横排与简介区域高度，首次归架提示也在原位更新。七档普通清空、三档首次归架的真实点击测量及164项回归见 [空篮稳定性验证](docs/qa/library-shelf-empty-stability-2026-10-11/DELIVERY.md)。
# today-we-sit
