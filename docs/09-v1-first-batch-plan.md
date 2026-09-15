# v1.0 第一批 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute disjoint tasks, or executing-plans inline. 实施仅从本计划开始，先保住原型，再迁移。

**Goal:** 将30关demo的身份、进度和导航改成可安全扩展到正式版的结构，不丢老玩家数据。

**Architecture:** 保留纯规则；新增稳定ID目录和v2存档；导航依赖目录，不用关号算术。M1结束时仍只有经过验收的30关，不伪称90关已完成。

**Tech Stack:** CommonJS JavaScript、Node内置测试、Canvas 2D。

**Spec:** docs/06-v1-release-requirements.md、docs/07-v1-development-architecture.md；任务T01/T03/T04/T05/T17。

## Global Constraints

- 主线最终90关，但M1不通过复制题目凑数。
- 所有完成/重玩/存档语义保留；旧关身份按bus/garden/cinema映射。
- 保留原存档key备份，不自动清空用户数据。
- 所有对外发布/真实云部署不在M1。
- 不迁移游戏引擎，不引入无关第三方依赖。

## 执行前

- [ ] `npm test`、`npm run build`，记录基线，不把历史65项结果当本次新结果。
- [ ] 保存匿名手工fixture：全新、完成10关、完成12关且正在旧13关、全30完成、损坏存档。
- [ ] 为本项目建立独立版本控制边界，确认不误操作用户其他目录；新分支用于正式版基础改造。
- [ ] 记录T01状态，后台能力未具备不阻塞纯本地任务。

## Task A / T03：稳定目录

文件：src/content/catalog.js、content/manifest.json、tests/catalog.test.js。

接口：`createCatalog(manifest, levels)`、catalog.get(id)/next(id)/displayNumber(id)。

先写行为测试：
```js
const manifest = {campaign:['bus-001','garden-001'],daily:[],reserve:[]};
const catalog = createCatalog(manifest,[
  {id:'bus-001',chapterId:'bus'}, {id:'garden-001',chapterId:'garden'}
]);
assert.equal(catalog.next('bus-001'),'garden-001');
assert.equal(catalog.next('garden-001'),null);
assert.equal(catalog.displayNumber('garden-001'),2);
assert.equal(catalog.get('garden-001').chapterId,'garden');
```

- [ ] 测试缺失/重复ID、顺序与ID不相关、末关next=null；执行`node --test tests/catalog.test.js`确认预期失败。
- [ ] 最小实现Map查询和显式序列索引，遇缺引用抛可读错误。
- [ ] 将旧内容封装为稳定ID视图，映射表保持显式；M1内容不修改谜题语义。
- [ ] 复跑目录测试，提交单独变更并记录旧30关身份表。

## Task B / T04：纯迁移

文件：src/progress/schema.js、src/progress/migrate.js、tests/progress-migration.test.js。

接口：`migrateV1(raw,catalog) -> {progress,warnings}`；无I/O，方便独立校验。

手工旧存档：
```js
const old = {
  version:1,currentLevel:13,
  completed:Array.from({length:12},(_,i)=>i+1),
  placements:{13:{p1:'s4'}}
};
const {progress}=migrateV1(old,catalog);
assert.equal(progress.currentLevelId,'garden-003');
assert.ok(progress.completed.includes('garden-002'));
assert.ok(progress.chapterAccess.includes('garden'));
assert.deepEqual(progress.placements['garden-003'].placement,{p1:'s4'});
```

此catalog应来自已映射的真实30题，旧13关的p1/s4有效；fixture需验证引用而非硬塞假的生产内容。

- [ ] 测试旧11不会变bus-011、已有花园章访问保留、离散完成保留、未知ID过滤、无效座位清洗。
- [ ] 测试version:2再次处理不重发卡/提示权益；迁移时未存在的功能状态只设安全默认。
- [ ] 实现迁移与schema校验，不在失败分支静默覆盖旧数据。
- [ ] 执行`node --test tests/progress-migration.test.js`并留结果。

## Task C / T17：本地存储

文件：src/progress/repository.js、tests/progress-local.test.js。

接口：`loadLocal(storage,catalog)`、`saveLocal(storage,progress)`，storage沿用get/set。

操作协议：写临时候选→读回校验→更新有效快照→保留上一份。存储API没有多key事务，加载时必须能判别每一步中断后的候选，不能把“多次set”叫作数据库原子事务。

```js
const failSecondWrite = makeFailingStorage({failAtWrite:2});
const result = saveLocal(failSecondWrite, validProgress);
assert.equal(result.ok,false);
const recovered = loadLocal(failSecondWrite,catalog);
assert.deepEqual(recovered.progress.completed,previousValidProgress.completed);
```

`makeFailingStorage`只放在tests/helpers/storage.js，用Map和写入计数模拟边界，不向生产类添加测试专用方法。

边界替身可用以下实现，传入已有合法快照作为seed，确保断言对比的是旧数据：
```js
function makeFailingStorage({failAtWrite,seed={}}) {
  const data=new Map(Object.entries(seed));let writes=0;
  return {
    get:key=>data.has(key)?JSON.parse(JSON.stringify(data.get(key))):undefined,
    set(key,value) {
      if(++writes===failAtWrite) throw new Error('quota');
      data.set(key,JSON.parse(JSON.stringify(value)));
    }
  };
}
```

- [ ] 先写配额不足、JSON损坏、写一半退出、迁移重入测试。
- [ ] 实现备份/校验/恢复；新key写入成功前保留旧key。
- [ ] 区分未存入与已恢复，让UI能提示而不是崩溃。
- [ ] 执行本地存储测试及旧会话交换/撤销测试。

## Task D / T05：主线与应用集成

文件：src/features/campaign.js、src/app.js、src/ui/renderer.js、tests/campaign.test.js、tests/app.test.js。

接口：`canEnter(catalog,progress,id)`、`getContinueLevelId(catalog,progress)`。

- [ ] 先测旧完成12关玩家可继续garden-003；新增bus-011不覆盖其旧13关。
- [ ] 测全新玩家不能直接进garden-001，旧chapterAccess玩家可进入；已完成的任何关可重玩。
- [ ] 将完成数、总关数、下一关、章节分组全部改读catalog；不再写`id-1`/`id+1`/`Math.min(30,...)`。
- [ ] 应用加载repository结果，保留旧core/session中的纯会话函数。
- [ ] 主线UI显示catalog展示编号；提示仍使用关内1号座位，不混入levelId。
- [ ] 复跑所有测试，浏览器实际完成首关、恢复旧花园关、重玩和刷新。

## 第一批完成条件

1. 原型规则及输入行为无退化；新增目录/迁移/存储/导航测试全部通过。
2. 存档fixture迁移结果可审核，真实demo测试存档刷新后能恢复。
3. 30关身份稳定，代码可加载非30长度测试目录，但不冒称完成90关内容。
4. 目录与存档接口记录，M2布局可独立并行开发。
5. 写 docs/v1/m1-verification.md，列命令、实际测试数量、浏览器结果和未完成项。

## 后续执行顺序

M1完成后，M2正式UI和M3内容编辑器可并行；服务协议可并行但不阻塞画面。完整依赖与功能对应见08。

每项保持“小范围测试失败→最小实现→回归→浏览器/平台所需验证→审查”的节奏。无需每完成一项让用户重新批准已授权的本地工作；真实对外发布和账号敏感操作另行处理。
