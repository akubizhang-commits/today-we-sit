# 给喵挪个窝 · 技术架构

日期：2026-09-15。依据：01-requirements.md。

## ADR-001：首版使用原生 Canvas 2D

研究阶段曾建议 Cocos Creator + TypeScript。当前首版没有复杂动画资源和编辑器协作需求，因此选择原生 Canvas 2D + CommonJS JavaScript + JSDoc/接口文档，Node 内置测试，零第三方运行时依赖。用户已授权直接开发，技术选择在此记录。

收益：源码同时用于微信与浏览器，启动无需安装引擎。代价：布局、绘制和命中测试自行维护；Canvas 的屏幕阅读器支持有限。若后续多人美术协作、骨骼动画或复杂场景增加，可迁移渲染层至 Cocos，纯逻辑/关卡数据保持独立。

## 模块

```
game.js ── wx 平台适配 ─┐
                       ├─ app.js 状态/导航 ─ ui/renderer.js 绘制和命中
web/entry.js ─ web 适配 ┘         │
                         core/engine.js 规则、求解、提示
                         core/session.js 移动、撤销、存档
                         content/levels.js 30关
```

脚本 `scripts/build.js` 将受控的 CommonJS 源文件打包为浏览器文件；微信直接 require 源文件，无 npm 或 DOM。`scripts/serve.js` 只暴露 web 构建产物，绑定 127.0.0.1，不暴露整个用户目录。

## 关卡契约

```js
{
  id: 1, chapter: 0, title: '靠窗的早晨', intro: '先照顾好两位乘客',
  seats: [{ id: 's1', x: 0, y: 0, tags: ['window'], zone: 'front' }],
  adjacency: [['s1','s2']],
  people: [{ id: 'p1', name: '小禾', color: '#E8AC72',
    rules: [{type:'tag', value:'window', text:'想坐靠窗的位置'}] }],
  // reference 是开发校验/内容作者使用，不用于直接比对通关。
  reference: { p1:'s1' }
}
```

规则类型：
- `tag` / `notTag`: 当前座位具备/不具备 value。
- `zone`: 当前座位 zone 等于 value。
- `adjacent` / `apart`: 与 person 指定人物相邻/不相邻。
- `emptyNeighbor`: 至少有一个相邻座位空着；未坐齐时仅显示待确认。

座位 x/y 为离散网格，渲染转换为屏幕坐标。邻接为显式无向边，不根据视觉猜测。每关人物 id 唯一，座位可以比人物多。

## 逻辑接口（CommonJS exports）

`evaluate(level, placement)` 返回 `{complete, satisfied, total, people}`；people 是以 personId 为键的对象，值为 `{status:'satisfied'|'pending'|'conflict', rules:[{status,text}]}`。

`solve(level, fixed={})` 返回合法 placement 或 null。fixed 是必须保留的部分布局。剪枝回溯，禁止重复座位，先验证固定项，按人物候选数选择搜索顺序。内容规模限制 ≤8 人，以验证脚本监测耗时。

`getHint(level, placement)` 返回 `{personId, seatId, text}` 或 null；先尝试扩展当前布局，否则从保留最多现有安排的可解局部布局给出下一次移动。seatId 可以为 null，表示先退回候场区；多个错误安排无法通过一次移动修复时，提示明确说明分步修复。text 使用玩家可见的“1号座位”等编号，不暴露内部 s1 标识。

`movePerson(level, placement, personId, seatIdOrNull)` 返回新的 placement；座位占用时交换，原人物在候场时把被替换者退回候场；非法输入抛出 Error。

`createSession(level, placement={})` 返回 `{placement,history:[]}`；`applyMove(level,session,personId,seatId)` / `undo(session)` / `reset(session)` 返回新 session。

`loadProgress(storage, levels)` / `saveProgress(storage, progress)`，storage 为 `{get(key),set(key,value)}`；progress `{version:1,currentLevel:1,completed:[],placements:{}}`。读入时过滤未知关卡/人物/座位/重复占用；完成列表只接受连续的已知关卡编号。完成列表与当前重玩布局独立，重玩不得抹掉历史进度。客户端原型没有防作弊承诺。写入返回 boolean，不抛异常到游戏循环。

## 渲染和平台契约

`new GameApp(platform)`；平台 `{canvas, width,height,dpr,storage,onPointer, onResize,onHide, requestFrame}`。

Canvas 使用逻辑坐标与独立 DPR 缩放，输入用 CSS 坐标反变换，画面遵循微信安全区/胶囊避让；页面隐藏时保存。浏览器使用 Pointer Events；微信使用 onTouchStart/Move/End/Cancel。

渲染器每帧返回命中区 `{x,y,w,h,action,payload}`。应用只在指针抬起时执行动作；拖放使用人物和座位命中区，取消不提交。

## 商业化和数据

首版没有真实 SDK 广告位、支付或网络请求。`app.js` 的 `action('hint')` 是后续广告接入点，当前直接提供免费提示，没有声称已实现真实广告适配器。真实激励广告接入时须区分关闭与完整观看，拉取失败需有可继续游玩的路径。真实广告功能在凭据/资格和平台验证完备后开启。

事件 level_start / move / hint / level_complete 只记录到本地有限队列，服务端统计未实现，不宣称已经有商业分析后台。

## 测试

Node 内置测试：手工规则反例、重复位置、pending、替代解、无解、提示、移动交换、撤销、损坏存档。
内容验证：30 关结构合法，每关 reference 满足约束，每关求解有解。
集成：通过浏览器真实输入完成关卡、刷新恢复、切章、拖放、截图、多分辨率；微信模拟器/真机验证单独列清。

官方技术依据（调研日期 2026-09-15）：微信 createCanvas / Touch 事件 / 同步存储 / 激励视频接口与项目配置文档，均以发布前当前平台文档为准。
