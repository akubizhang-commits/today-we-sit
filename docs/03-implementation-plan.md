# 给喵挪个位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 在用户指定目录交付30关原创排座小游戏可玩原型及微信导入包。

**Architecture:** 纯逻辑和内容独立于 Canvas；微信和浏览器共用状态与渲染。零运行时依赖，Node 内置测试。

**Tech Stack:** JavaScript CommonJS、Canvas 2D、Node.js。

**Spec:** docs/01-requirements.md；接口见 docs/02-architecture.md。

## Global Constraints

- 3 个原创场景，每章 10 关，共 30 关。
- 免费撤销、重置、提示；原型提示不伪装成观看了广告。
- 不复制原作素材和关卡。不提交上线，不启用真实支付。
- 所有写入限于 /Users/zhangnu/WeChatProjects/today-we-sit。

## Task 1：规则和会话

文件：src/core/engine.js、src/core/session.js、tests/engine.test.js、tests/session.test.js。
接口：严格遵循架构文档。

- [x] 先写手工三座位 fixture，验证相邻/非相邻/空位/未入座/重复占用反例。
- [x] `node --test tests/engine.test.js` 观察缺失实现失败。
- [x] 实现 evaluate、solve、getHint；提示须兼容当前可解布局。
- [x] 实现移动/交换、撤销/重置、存档验证；保存失败不打断游戏。
- [x] `node --test tests/engine.test.js tests/session.test.js`，确保实际行为断言通过。

手工断言示例：
```js
assert.equal(evaluate(level,{p1:'s1',p2:'s3'}).complete,false);
assert.equal(evaluate(level,{p1:'s1',p2:'s2'}).complete,true);
assert.deepEqual(movePerson(level,{p1:'s1',p2:'s2'},'p1','s2'),{p1:'s2',p2:'s1'});
```

## Task 2：原创内容

文件：src/content/levels.js、tests/levels.test.js。
输出：`{levels,chapters}`，chapters 元素 `{id:0,title,subtitle,color}`；levels 为架构定义数组。

- [x] 编写数量、编号、引用、参考解和可解性测试。
- [x] 编写三章共30关，分别有引导和规则组合变化，≤8 人；不是30关仅换文案。
- [x] `node --test tests/levels.test.js`；修复全部无解关和数据错误。

## Task 3：应用和画面

文件：src/app.js、src/ui/renderer.js、src/ui/draw.js。

- [x] 根据需求定义状态 home/levels/play 与完成弹层，先验证导航/恢复行为。
- [x] 绘制原创人物、三章场景、卡片、棋盘、需求、候场、工具按钮。
- [x] 实现点选/拖动/交换/退回、撤销、重置、提示和顺序解锁。
- [x] 每次动作保存；通关只记录一次，最后一关返回选关。

## Task 4：平台、预览与构建

文件：game.js、game.json、project.config.json、src/platform/*.js、web/*、scripts/*、package.json。

- [x] 实现微信 createCanvas、onTouch* 和本地存储适配；安全区预留（真机运行另行验收）。
- [x] 浏览器指针适配、DPR 和 resize；仅本地 HTTP 服务。
- [x] `npm run build` 产出 web/game.bundle.js 和 dist/wechat 导入目录。
- [x] `npm run dev`，真实浏览器完整体验首关和存档。

## Task 5：验收与交付

文件：README.md、docs/04-verification.md。

- [x] `npm test` 和 `npm run build` 全量验证。
- [x] 浏览器多尺寸截图及拖动、交换、恢复、提示、完成验证。
- [x] 尝试微信开发者工具验证；若因 AppID 或工具授权不可验证，精确记录。
- [x] 独立代码审查，修复阻塞问题。
- [x] README 写明导入目录、命令、免费提示和真实商业化未启用的限制。

## 执行记录

2026-09-15：需求先落盘，架构随后，实施计划最后。用户已经授权在文档后开发，不增加中途确认。

2026-09-15：上述本地原型任务完成，65项测试通过，构建成功。独立审查3项问题已修复并复核。浏览器实际试玩通过；微信工具未登录且服务端口关闭，未进行真机验收。

## 发布前独立验收（未完成）

- [ ] 用户登录微信工具并配置自己的小游戏 AppID，完成模拟器与 iOS/Android 真机测试。
- [ ] 确定主体与上线资格，按需接入真实广告或支付。
