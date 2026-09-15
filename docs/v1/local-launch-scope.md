# 首发范围：本地存档、无广告变现

用户已选择首版本仅使用本机存档，云服务留待后续。当前没有广告位 ID 或运营反馈联系方式。本说明记录发布范围，不代表已发布、取得平台许可或完成任何认证。

## 配置契约

`src/config.js` 中显式指定：

```js
storageMode: 'local',
adsMode: 'disabled',
adUnitId: '',
backendUrl: '',
feedbackContact: '',
environment: 'development',
```

- `storageMode` 仅接受 `local` 或 `cloud`；缺失、拼写错误及其他类型均阻塞发布。
- `local` 使用现有本机存档，不提供跨设备恢复、云同步或云端删除。清理本机数据会失去对应进度。`backendUrl` 在本地模式不参与云服务验收，可省略或留空。
- `cloud` 要求有效、无 URL 登录凭据的 HTTPS 地址及真实云验收；当前应用尚未接入云身份、同步和删除，即使清单全通过仍阻塞。
- `adsMode` 仅接受 `disabled` 或 `rewarded`，不根据是否填了广告 ID 自动推断。
- 平台适配器仅在 `adsMode === 'rewarded'` 且存在广告 ID 时提供广告能力；`disabled` 即使残留 ID 也不会创建广告。发布清单仍要求禁用模式省略或清空 `adUnitId`，用于保持配置与首发范围一致。此模式不属于广告变现候选。
- `rewarded` 必须填写真实广告位并完成广告完成、取消、失败的实际验收，`adsLive` 才能设为 `true`。配置开关不授予广告权限或代替平台审核。
- 可选 `adUnitId`、`backendUrl` 可省略；一旦提供必须为字符串。`feedbackContact` 必须是实际非空反馈渠道，不能用占位信息通过正式验收。

## 发布门槛

`node scripts/check-release.js` 按实际配置选择适用项。本地、禁用广告模式下，报告 `notApplicable: ['cloudLive', 'adsLive']`；对应证据保持 `false`，不会写成已验证。

以下条件仍全部必需：

| 条件 | 配置或证据项 |
| --- | --- |
| 正式小游戏 AppID | 保留用户提供的 `project.config.json` AppID；格式检查不代表获准发布 |
| 生产环境配置 | `environment: 'production'` |
| 实际运营反馈渠道且已验证可用 | `feedbackContact` 非空、`feedbackLive: true` |
| 平台主体与资格 | `platformEligibility: true` |
| 微信 iOS / Android 真机验收 | `wechatDevices: true` |
| 124 关人工体验验收 | `manualContentQA: true` |
| 素材权利记录 | `rights: true` |
| 实际隐私告知与服务渠道验收 | `privacyReview: true` |
| 发布版本回归 | `releaseRegression: true` |

适用的证据值必须是布尔 `true`；字符串 `"true"`、缺失、`null` 等都不通过。只能在真实验收完成且记录可追溯证据后更新 `release-evidence.json`，不能用测试 fixture 或自动测试通过替代。

`checklistPassed` 仅表示配置及适用人工证据清单通过。`ready` 还要求不存在当前云集成开发阻塞；仅在这些条件满足时退出码为 0。它不是平台发布批准或联网验证。脚本不连接外部服务，`serviceConnectivityVerified` 始终为 `false`；`monetizationCandidate` 仅在 `ready` 且显式 `rewarded` 时为 `true`。

当前实际配置仍为开发环境、反馈联系方式为空，所有人工验收证据仍为 `false`，因此报告必须保持 **not ready**。现有本地测试、离线截图和构建成功不能解除上述门槛。
