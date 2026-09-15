# 云备份客户端契约

状态：仅实现可注入 provider 的 CommonJS 客户端与自动化契约测试。依据 `docs/06-v1-release-requirements.md` F08 和 `docs/07-v1-development-architecture.md` 第 4、6 节。没有真实后端、平台身份验证、部署、生产云存储或真实网络联调证据；不表示后台已完成。测试中的 provider 仅位于测试文件。客户端不提供默认模拟服务；缺少 provider 或能力时返回 `unavailable`。

## 客户端 API

```js
const { createCloudClient } = require('../../src/services/cloud');
const cloud = createCloudClient({ provider, catalog, persistPending });
cloud.setSession({ accountId, token }); // 来自真实 provider 已验证的登录会话
const result = await cloud.sync(progress, { operationId, resolutions, retry });
cloud.getState(); // {status,busy,authenticated}，不含凭证
cloud.setSession(null); // 撤销当前会话，忽略旧请求的晚到结果
```

- `catalog` 为实际目录接口：`get(id)`、`campaignIds`、`dailyIds`、`chapters`，不依赖数字 ID 运算。
- `provider` 可缺省。存在时须同时提供异步或同步的 `getProgress`、`putProgress`。
- `persistPending` 可选，见下文。模块自身不读写本地存储，也不修改传入对象。
- `setSession` 只接收调用方完成认证后取得的 `{accountId,token}`，不是认证机制。服务端仍须根据 token 验证身份、按账号隔离数据，不能相信客户端自报的账号。每次调用都会开启新的会话周期并清除实例内操作记录。会话切换期间旧请求仍可能已在服务端执行；客户端只能忽略晚到响应，不能声称撤销了远程写入。
- 只有 `progress.sync.enabled === true` 才调用 provider。`sync.cloudAccountId` 一旦绑定账号，不允许直接同步到其他账号；身份迁移由后续显式流程处理。`progress.readOnly === true` 时拒绝网络同步。仓库 `loadLocal` 的顶层 `readOnly` 应由调用方拦截，不能仅传入它返回的 `progress` 后忽略标志。
- `operationId` 是调用方创建、持久化的非空字符串，最大 256 字符，作用域为账号；同一已尝试写入的 ID 不能绑定不同负载。成功或明确 409 拒绝后，下一轮使用新 ID。
- 同一实例只允许一轮同步；第二次调用返回 `busy` 和第二次调用自己的进度副本，不丢弃或合并其输入。

`sync` 始终返回 Promise：

```js
{
  status, progress, serverRevision,
  placementConflicts: [], pendingUpload: null,
  readOnly: false, issues: []
}
```

`progress` 是候选本地快照，必须由调用方验证、持久化后采用。原输入不变。非法本地 JSON 返回 `progress:null`，不得据此清空本地存档。正常成功清除 `sync.pending`；失败、冲突保留待同步状态和已有本地完成记录。未开启同步时保留原状态。云完成集合、章节资格、收藏、提示权益和设置调用现有 `mergeProgress(local,remote,catalog)` 处理，不复制另一套合并逻辑。

`serverRevision` 是服务端的乐观并发版本，和 `localRevision`、内容版本相互独立。`progress.sync.serverRevision` 仅在确认上传回执后更新，冲突响应的顶层 `serverRevision` 表示重新拉取看到的修订，不表示上传成功。客户端不自动增加 `localRevision`。

## Provider 边界

### 读取

```js
provider.getProgress({ session: { accountId, token } });
// 已存在
// -> {status:'ok', accountId, progress:<V2 JSON对象>, serverRevision:7}
// 明确不存在：两个 null 缺一不可
// -> {status:'ok', accountId, progress:null, serverRevision:null}
// -> {status:'unavailable'} 或 {status:'unauthorized'}
```

存在记录必须带非负安全整数修订号及与会话相同的账号；缺字段、坏 schema、异常修订号、错误账号都不会触发上传。客户端不把 undefined、空对象、网络异常或鉴权失败解释为“没有记录”。V1 云端格式不在本契约支持范围内；本地 V1 迁移仍由 progress 模块负责。

先用 `validateProgress(raw)` 校验结构，保留布局的原始 `contentRevision`，再交给真实合并模块按目录处理。不能先把远端布局修订改成本机修订后再判断是否冲突。发现未来 `version` / `schemaVersion` 时返回 `future-schema`、`readOnly:true`，不上传、不降级。显式重试和 409 后的重新拉取同样检查。

已具有服务端修订的本地进度若读取到“不存在”，返回 `remote-missing`，避免其他设备删除后自动重建；读取到较小修订则返回 `revision-regressed`。后续真实删除服务仍须使用删除墓碑/会话失效及操作去重，客户端检查不替代服务端的删除保证。首次从未同步的设备无法仅靠缺失记录判断历史删除。

### 写入

```js
provider.putProgress({
  session: { accountId, token },
  expectedRevision: 7, // 首次创建为 null
  operationId: 'caller-persisted-id',
  progress: candidate
});
// -> {status:'ok', accountId, operationId, serverRevision:8}
// -> {status:'conflict', serverRevision:8} // HTTP 409 由适配层归一化
// -> {status:'unavailable'} 或 {status:'unauthorized'}
```

也接受返回 `status:409` 或抛出带 `status/statusCode:409` 的异常。其他 provider 异常归为 `unavailable`，不向调用方泄露原始异常中的凭证或服务内部文本。

服务端必须原子比较 `expectedRevision` 并更新，首次创建使用“仅当不存在”。回执须同时匹配账号和 `operationId`，修订号须大于该请求的 `expectedRevision`；返回 undefined、普通 truthy 值或字段不完整的对象绝不算成功。provider 返回成功必须来源于真实服务确认，不能用内存写入冒充。

重试去重须由服务端按账号与 operationId 完成：相同请求返回原回执，不同请求复用 ID 拒绝；应先检查已执行操作，再对未执行操作检查 CAS。否则已提交但丢失回执的请求会被错误当作新的并发冲突。删除后应保留足够的去重/墓碑信息，防止旧请求重建数据。

上传负载里的 `sync` 固定为 `{enabled:false,serverRevision:null,pending:false}`，不传输设备的认证信息、账号绑定、持久化待传对象或本机同步状态。会话凭证仅作为 provider 参数，不出现在返回的重试对象或 `getState()` 中。

## 布局选择

冲突返回 `status:'placement-conflict'`，不上传：

```js
placementConflicts: [{ levelId, local: completeSnapshot, remote: completeSnapshot }]
```

两份都是完整 wrapper，包含 `contentRevision/sessionId/moveSequence/placement/savedAt`，也保存在 `result.progress.placementConflicts`。调用方展示后，把原冲突对象连同选择传入下一轮：

```js
const resolutions = result.placementConflicts.map(conflict => ({
  ...conflict, choice: 'local' // 或 'remote'，每项由用户选择
}));
await cloud.sync(result.progress, { operationId: newId, resolutions });
```

客户端重新拉取；只有两份快照都和当前冲突精确匹配的选择才有效，旧选择不能覆盖新云端局面。必须解决全部冲突。同一关多条冲突的选择必须一致；已不兼容当前人物/座位的云端快照仍保留供查看，但不能选作可恢复局面。始终选整份布局，不混排人物，不靠设备时间自动决定。

## 失败、重试和持久化

每次 `sync` 最多一次 PUT；收到 409 后最多再 GET 一次，并返回重新合并的 `revision-conflict` 或 `placement-conflict`。不自动发第二次 PUT，旧选择不自动套用到重拉结果。新一轮使用新 operationId。没有定时器、后台重试或无限循环；前台重试次数、退避和网络超时由调用方/provider 控制，须遵守架构要求的每轮最多 3 次。

PUT 网络失败、回执不完整或无法确认时，返回完整、无凭证的重试对象：

```js
pendingUpload: { accountId, operationId, expectedRevision, progress }
```

必须保持该对象原样，用失败返回的 `progress` 再调用：

```js
await cloud.sync(savedProgress, {
  operationId: savedPendingUpload.operationId,
  retry: savedPendingUpload
});
```

实例内失败请求也按相同 operationId 保留，但进程重启后需调用方恢复 `retry`。重试会先读云端并检查未来版本，然后重放原始 expectedRevision、ID 和完整负载，不能重新合并后沿用旧 ID。若本地又发生新动作，不能把变更后的快照作为这个请求重试；先保留新快照、确认旧请求，再按最新本地进度开启新一轮。调用方不能把旧异步结果直接覆盖同步期间新增的本地动作，应比较 `localRevision` 后合并。

重放回执时，本轮 GET 可能已看到比该回执更新的云数据；客户端保留这些合并记录，必要时仍返回 `sync.pending:true`，即 `synced` 只确认此次操作，不保证所有后续变化已同步。

若需要进程在 PUT 中途退出后也能准确恢复，配置持久化钩子：

```js
persistPending: async ({ progress, pendingUpload }) => {
  // 将完整本地候选与重试对象作为同一可恢复快照保存。
  // 可使用 repository.saveLocal，把 pendingUpload 放入 sync 的扩展字段；
  // 恢复后显式取出作为 retry，确认成功后由调用方清除此字段。
  return { ok: true }; // 只能在实际持久化成功后返回；此处是契约示意
}
```

钩子在 PUT 前调用；只有 `true` 或 `{ok:true}` 才允许上传，false、undefined、异常均返回 `local-save-failed`。钩子收到的对象已与内部请求分离。未配置钩子时客户端不宣称跨崩溃持久化保证：只能在请求返回失败后让调用方保存重试对象。最终同步结果也必须由调用方实际保存；服务端确认与本地保存是两个独立步骤。

## 状态与未实现边界

| status | 含义/调用方动作 |
|---|---|
| synced | 收到匹配的真实写入回执；保存结果，仍检查 pending |
| disabled / read-only | 未开启或本地只读；不请求云端 |
| unauthorized / unavailable | 未认证或能力/网络不可用；保留本地，可离线游玩 |
| busy | 已有同步进行；保留本次调用方的最新进度 |
| future-schema | 云或本地未来版本；禁止上传，保留原数据 |
| invalid-local / invalid-remote / invalid-response | 数据或回执不符合契约；不得当空存档或成功 |
| identity-conflict / session-changed | 账号不符或会话已变化；不采用外账号/旧会话结果 |
| placement-conflict | 展示完整快照并等待选择 |
| revision-conflict | 已重拉合并；新 ID 开始下一次显式尝试 |
| remote-missing / revision-regressed | 云数据消失/回退；不能自动重建或覆盖 |
| invalid-operation | ID 或重试对象不符合原请求；不得静默生成替代请求 |
| local-save-failed | 上传前持久化未确认；未调用 PUT |

本模块不实现 `openSession`、云删除 API、后台队列、UI 同意流程、平台登录、网络超时策略或真实后端。删除流程未来接入时需先暂停上传并清掉持久化待传，再请求真实删除并等回执，不能用清理本地存档假装删除云数据。调用方也负责通知真实的数据用途、处理用户拒绝及选择冲突；本次不修改 app/UI。

## 验证

`node --test tests/cloud.test.js tests/progress-*.test.js`：24 项云契约测试与 42 项进度测试，合计 66 项。云测试先观察接口缺失和新增边界行为失败，再实现并转绿。覆盖缺失 provider/会话/同意、远端损坏与未来版本、真实 merge、快照选择与过期选择、CAS 409、幂等重试、持久化失败、回执校验、账号变化、并发调用以及防止已知云删除后的自动重建。测试 provider 只证明客户端行为，不能作为真实服务部署或生产同步成功证据。
