# 给喵挪个窝 · 动物世界排座谜题

以猫、狗、猪、虎、鼠、牛、羊等12种动物为角色的原创排座解谜微信小游戏，当前为 **v1 本地开发候选版，尚未发布**。原生 Canvas 2D，浏览器与微信共用规则和画面，无第三方运行时依赖。

本轮主题升级将前三章展示为 **萌宠巴士 / 萌宠食堂 / 呼噜午睡屋**，分别围绕出行、用餐与午睡展开。内部章节 ID `bus/garden/cinema`、关卡 ID、存档格式及规则语义保持不变；标签和区域仅更新展示称呼，动物喜好属于角色文案，未新增体型占位、气味或温度机制。主题升级后的人工 QA 仍待验收，程序校验通过不代表已完成体验或权利审查。

已接入90关主线、14道轮换日题、12张里程碑纪念卡、完整规则阅读器、分层提示、撤销/换位、版本化本机存档、音乐音效和设置。另有20道储备题，只存在于作者资料，未进入游戏包。题目已完成程序校验，仍需人工体验与难度验收。

## 本机试玩与编辑器

```sh
cd /Users/zhangnu/WeChatProjects/today-we-sit
npm run dev
```

游戏：`http://127.0.0.1:4173/`；关卡编辑器：`http://127.0.0.1:4173/editor`。只监听本机。编辑器可以布置座位、人物与六种规则，试坐、求解、导入和导出单题JSON；不会自动发布关卡。

需要 Node.js 20+，无需 npm install。修改源码后执行 `npm run build` 并刷新页面。端口占用时使用 `SEAT_GAME_PORT=4174 npm run dev`。

## 微信导入

```sh
npm run build
```

用微信开发者工具导入 `/Users/zhangnu/WeChatProjects/today-we-sit/dist/wechat`，类型为小游戏。产物是单一打包入口及本地音频，排除储备题、作者参考答案和编辑器。

根目录 `project.config.json` 仍使用 `touristappid`。正式AppID填在源配置后再构建。广告位、服务地址与反馈渠道配置在 `src/config.js`，不要把AppSecret等秘密写入客户端。

## 开发与检查

```sh
npm test
npm run content:validate
npm run build
npm run release:check
```

`build` 生成本地候选包；`build:release` 会先执行发布检查。当前 `release:check` 预期失败，因为尚无真实平台、广告、云服务和人工验收证据。不能用普通构建成功替代上线验收。

音频可用 `npm run audio:generate` 从项目内合成脚本重新生成。运行时关卡由 `content/authoring/` 与 `content/manifest.json` 生成；调整内容后运行 `npm run content:build`。

## 当前限制

- 广告状态机和平台适配已写入，未完成真实广告位联调；没有模拟广告收入。
- 云备份客户端契约与进度合并可独立测试，实际后端、身份校验和云删除尚未接入应用。
- 遥测/远程配置模块尚未接通运营服务，当前不上传玩法数据。
- 仍需微信 iOS/Android 真机、性能、前后台切换、音频听感、全部题目的人工验收与运营素材。
- Canvas 暂不支持完整键盘或屏幕阅读器操作。本机存档不提供防作弊保证；卸载或清理数据可能丢失进度。

## 开发资料

- [最终需求](docs/06-v1-release-requirements.md)
- [技术架构](docs/07-v1-development-architecture.md)
- [任务拆分](docs/08-v1-task-backlog.md)
- [本轮执行与验收记录](docs/v1/progress.md)
- [关卡生产说明](docs/v1/content-production.md)
- [编辑器使用说明](docs/v1/editor-guide.md)

早期文档01—04记录30关原型，不代表当前功能或发布验收结论。代码、文本、关卡和程序绘制素材独立制作，未引入 Is This Seat Taken? 的素材或关卡。

角色图鉴预览：`http://127.0.0.1:4173/animals.html`。角色采用源码原创矢量绘制，同名角色跨关保持物种，围巾颜色保留原有角色区别。
