# 砚灵产品稳定性审计报告（Product Stability Audit）

> 审计日期：2026-08-01 ｜ 阶段：Feature Freeze
> 视角：**用户从首次安装到每天使用，会不会炸**。不评架构先进性，只找用户会碰到的问题。
> 方法：renderer/main 全链路人工核对 + 关键指控代码级复验（本次报告的每个发现都已定位到文件:行）。

---

## A. Critical — 用户阻断问题

### A1. Live2D 模式完全不可用（双因） — ✅ 已修复（Phase S2）
- Cubism 核心运行时：已 vendor 到 `resources/cubism/`（live2dcubismcore.min.js 官方 CDN + live2d.min.js），新增 `cubism://` 协议由 main 进程从打包资源提供；`Live2DView.tryLoadCubism()` 先加载核心再 import 库，核心缺失 → 优雅回退（不崩、不白屏）
- 文件路径：`toLocalUrl()` 把绝对路径转 `local://` URL（反斜杠转正斜杠），模型与相对纹理经现有 local 协议正确加载
- 失败兜底：`onLoadError` → PetView 回退内置兜底圆，绝不隐形
- 不改变 Avatar 抽象：Live2D 与 Sprite 仍走同一 ModelSource 分支

### A2. 启动失败零反馈 —— 隐形进程 — ✅ 已修复（Phase S1）
- `database.ts`：`openDatabase()` 永不抛错，返回 `DatabaseState{status,lastError,backupAvailable}`
- `main/index.ts`：DB 失败 → `handleStartupDbFailure()` 原生修复对话框（**不读业务表，无死锁可能**）：修复（备份损坏文件→重建→relaunch）或退出；再失败也有二次提示
- Agent 构造失败（配置/人格数据损坏）→ 清理灵魂表并重启，不再中断启动

### A3. 数据库迁移非幂等 — ✅ 已修复（Phase S1）
- v4 ALTER 全部加 `hasColumn()` 守卫；所有迁移的 up 与版本记录同事务提交（中断回滚，重启续跑）
- 新增 `migrations.test.ts` 5 用例：全新库完整迁移 / 重复执行 / v4 中断重跑 / v1 中断重跑 / 版本一致性

---

## B. High — 严重体验问题

### B1. 重新导入 Live2D 先删旧模型
- **位置**：`src/main/ipc/data.ts:32-47`
- **原因**：`rmSync(oldDir)` 在 `copyFolderRecursive` 之前；复制失败时旧模型已删、新模型没拷成，且 handler 无 try/catch → 宠物失去模型 + 设置页"导入中…"卡死（renderer 无 finally）。
- **复现**：源文件夹含被占用/无权限文件时重新导入。
- **修复**：先复制到临时目录，成功后原子替换；复制包 try/catch 并返回错误文案。
- **测试**：用只读源目录导入 → 断言旧模型仍在、UI 复位。

### B2. 备份恢复非原子 — ✅ 已修复（Phase S3）
- 恢复流程为**四阶段原子替换**：校验 manifest+checksum → staging 临时库恢复（事务）→ 旧库改名保留（`.pre-restore-<ts>`，可人工找回）→ staging 换入 → 重启生效
- 任何一步失败：staging 删除、旧库分毫未动、返回错误
- 核心逻辑在 `src/core/backup.ts`（纯 better-sqlite3，可单测）

### B3. 备份导出缺失 3 张灵魂表 — ✅ 已修复（Phase S3）
- 备份 = 完整生命快照（目录格式）：
  ```
  inkspirit-backup-<ts>/
  ├── manifest.json   {format, formatVersion, appVersion, schemaVersion, soulVersion, createdAt, checksum}
  ├── soul.json       全部灵魂表（personality + evolution_log、relationship + change_log、
  │                    memories、daily_patterns、behavior_logs、conversations、emotion_snapshots）+ config
  └── avatars/        （可选形象资源）
  ```
- checksum = soul.json 的 sha256；结构校验先于 checksum（篡改暴露真实问题）
- 密钥（sec_*）永不导出；恢复时本机密钥自动保留
- 恢复报告：重启后设置页显示"砚灵恢复成功：人格✓ 关系✓ 记忆 N 条…"（`restore_report`）
- 兼容：新目录格式 / 旧单文件 backup.json / 远古 {app,version,data} 三种备份均可读取恢复

### B4. 聊天流式结束被安全审查阻塞
- **位置**：`src/core/agent.ts` wrappedStream（recordExchange 后 `await detectUnsafe` 在 generator 内）+ `src/main/ipc/chat.ts:87`
- **原因**：chat-done 要等 generator 完全结束，而 generator 结束前有一次完整 LLM 安全审查（每次回复都调）。回复已 100% 显示，但输入框保持禁用数秒~数十秒。
- **复现**：任意长回复，观察回复显示完后输入框仍锁定。
- **修复**：审查改为 fire-and-forget（不阻塞 chat-done）；或先发 chat-done 再异步审查。
- **测试**：mock detectUnsafe 延迟 5s → 断言 chat-done 立即到达。

### B5. 聊天全链路无超时
- **位置**：`src/main/ipc/chat.ts` + OpenAI SDK 默认 600s 超时 + renderer `App.tsx:100-116` 无 finally 复位
- **原因**：网络黑洞（请求发出无响应）时输入框锁死最长 10 分钟，无取消按钮。
- **修复**：流式请求挂 60s 超时；UI 增加"停止生成"；handleSend 用 finally 兜底复位。
- **测试**：mock 永不返回的流 → 断言 60s 后超时并复位输入框。

### B6. API Key 跨机器恢复静默失效
- **位置**：`src/core/secureStore.ts:29-40` + `data.ts` 导出含 sec_* 密文
- **原因**：DPAPI/Keychain 绑定本机；换机器恢复备份 → decrypt 返回 null → 聊天报"API Key 无效"，无"密钥不可解密，请重新输入"提示。
- **修复**：恢复备份时检测 sec_* 无法解密 → 设置页显式提示重新配置。
- **测试**：换机器导入 → 断言出现密钥重配引导。

---

## C. Medium — 体验问题

| # | 位置 | 问题 | 影响 |
|---|---|---|---|
| C1 | SpriteAnimCanvas.tsx:157-159 | WebGL 分支无 img.onerror | 精灵图丢失后宠物隐形（空白），无回退圆 |
| C2 | main/index.ts:77-79 | render-process-gone 只写日志 | 渲染崩溃后宠物无声消失，托盘点不动，需手动重启 |
| C3 | SettingsView.tsx:166-170,83-100 | 保存不检查结果；getAgentState/cost 无 catch | API Key 无效也显示"已保存"；成本/灵魂区块永久空白 |
| C4 | SettingsView.tsx:74-80,144-153 | 模型下载进度无 error 复位 | Ollama 下载失败后按钮永久"下载中…" |
| C5 | SettingsView/WizardView + data.ts:83 | 导入无 finally、主进程复制无 try/catch | 文件复制失败"导入中…"卡死 |
| C6 | core/cost/usage.ts:57,76 | JSON.parse 无 catch | 配置损坏时成本统计抛错，甚至一次完整回复被误判失败 |
| C7 | updater.ts:17 | autoInstallOnAppQuit=true | 更新下载完成后点托盘"退出"=被强制安装重启（用户失去控制） |
| C8 | data.ts:158-200 | 逐表 SELECT 无事务快照 | 导出期间写入 → 恢复后记忆/关系互相矛盾 |
| C9 | data.ts:277-288 | 备份目标选在 avatars 内 | copyFolderRecursive 递归自复制 → 栈溢出/主进程异常 |
| C10 | main/index.ts:61-66 | local:// 无路径白名单 | 被攻破的渲染进程可读任意本地文件（含 DB） |
| C11 | main/index.ts 各循环 | heartbeat/sceneWatcher/moodSync/patternRecording 无 try/catch | DB 异常后每 8-90s 刷一条异常日志，带病运行且掩盖故障 |
| C12 | windowManager.ts:124-142 | physicalRectToDip 无 try/catch | 显示器热拔插瞬间挂窗/全屏判定偶发失效 |

---

## D. 与产品理念冲突的功能

### D1. 产品事实上是"精灵图桌宠"，Live2D 是死代码
- **位置**：全链（A1 证实 Live2D 双因不可用）
- **冲突**：理念是 `Core → Avatar Interface → Live2D(高端)/Sprite(低配 fallback)`。现状：Live2D 路径从未跑通，**精灵图是事实上的唯一形态**，且是"高端变低配"而非主动降级。
- **判定**：不是 sprite 被拔高成平级产品，而是 live2d 名存实亡。**修复 A1 即回归理念**；短期若不能修，应明确 UI 文案为"实验性"而非让用户以为 Live2D 是可用卖点。

### D2. 死 API 残留
- **位置**：`preload:126-130`（onPetUserReturned，主进程从不 emit）；`hooks/useInkAPI.ts:59`（onPetSoul 声明无实现）；`ipc/cost.ts:15`（cost:getBudget 已注册未暴露）
- **冲突**：理念"生命信号全部走导演"——`onPetUserReturned` 正是 P1 删除的旧"欢迎回家"直发路径的残留信号。建议删除或接入导演。

### D3. 托盘退出被更新劫持
- **位置**：updater.ts:17（autoInstallOnAppQuit）
- **冲突**：用户对"自己的砚灵"有终止权；"退出"被强制变成"安装+重启"违反直觉。
- **修复**：退出不自动安装，更新留到下次启动提示。

---

## 无问题区域（已核实）

- 设置页 IPC 链路：50 个 channel 与 preload 全匹配，无断点，"设置打不开"当前代码不存在 IPC 原因
- 精灵图绿边：`UNPACK_PREMULTIPLY_ALPHA_WEBGL` + premultipliedAlpha:true 实现正确（0.2.3 已修），残余风险是"对改动敏感"
- 空状态兜底：无模型回退圆、空消息列表、加载中态均完整
- API Key 错误的聊天反馈：友好文案完整
- 模型管理（Ollama）：降级路径良好
- renderer 无 localStorage/JSON.parse 风险

---

## 修复优先级建议

1. **A1+A2+A3**（Critical 三件套）—— Live2D 真死因、启动永不隐形失败、迁移幂等
2. **B1+B2+B3**（数据安全三件套）—— 导入导出原子性与灵魂表完整性
3. **B4+B5**（聊天体验）—— chat-done 不被审查阻塞、全链路超时
4. **B6+C7+D3**（密钥与退出控制）
5. 其余 Medium/Low 随迭代
