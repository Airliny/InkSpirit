# v0.9.3 Stable Release — 发布前人工验收清单

> 定位：**v0.9.2 Stability Release（稳定性修复版）· 正式版**
>
> 目标：「任何用户下载安装后，第一次启动都必须看到砚灵，并且所有失败都有可恢复路径。」
>
> 本清单用于发布前在真实 Windows 机器上执行（**不在开发环境测**）。标注 [自动] 的项已有自动化覆盖；其余为必须人工执行的验收点。

## RC1 必测环境矩阵

| 环境 | 至少 | 必测项 |
| --- | --- | --- |
| Windows 10 | 一台普通办公电脑（无独显 · 8GB 内存） | 启动 / 桌宠显示 / 设置 / AI 对话 |
| Windows 11 | 一台 | 多显示器 / DPI 125% 与 150% / 睡眠唤醒 |

## RC1 重点观察指标

不只测 bug，记录以下指标：

| 指标 | 目标 | 记录方式 |
| --- | --- | --- |
| 首次启动时间 | 双击 → **<3 秒**看到砚灵（不算完整初始化，只算「看到生命」） | 秒表 |
| 启动结果 | 统计 `startup_success` / `startup_recovery` / `startup_failed` 出现次数 | 日志 grep：`userData/logs/startup.log` |
| 崩溃率 | 3 台机器 × 连续 10 次启停，记录渲染进程崩溃次数 | `logs/renderer.log` |

## 恢复能力人工制造（3 项必测）

| 制造故障 | 预期 |
| --- | --- |
| 1. AI Key 填错 | 砚灵正常出现；聊天提示「连接失败」（不是软件卡死） |
| 2. Avatar 异常（删模型文件 / 改 `resources/avatar`） | 身体加载失败 → 内置「砚」 |
| 3. 数据库异常（破坏 `database.sqlite`） | 发现灵魂档案异常 → 恢复 / 新建（绝不「任务栏存在但无窗口」） |

## 版本流程

```
v0.9.3（正式版）
   ↓ 环境矩阵全过 + 恢复能力 3 项全过 + 重点指标达标
v0.9.2 Stable（发布）
```

RC 与 Stable 之间**不再加功能**，只允许修复验收发现的问题。RC 阶段冻结 Soul · Brain · Avatar SDK · Relationship · Memory（任何结构改动都会影响灵魂连续性 / 备份 / 迁移 / 升级）。

---

## 1. Windows 首次安装测试（最高优先）

前提：卸载旧版，并清理以下目录后安装 v0.9.3：

```
%APPDATA%\InkSpirit      ← 灵魂/配置/数据库
%LOCALAPPDATA%\InkSpirit ← 缓存
```

安装到默认路径（**C:\Program Files\InkSpirit，不要开发目录**），双击启动。

测试机器额外覆盖：

- **中文用户名路径**（如 `C:\Users\小明`）
- **非管理员权限**运行
- 无独显 · 8GB 内存

目标（5 秒内）：

| 检查项 | 预期 |
| --- | --- |
| 窗口出现 | ✅ 桌面出现桌宠窗口（透明、无边框） |
| 砚灵出现 | ✅ 看到「砚」或所选身体，不空白 |
| 托盘存在 | ✅ 系统托盘有砚灵图标 |
| 新用户引导 | ✅ 首次见面向导「你好，我是砚灵」 |
| 无 API Key / 无模型 / 无网络 | ✅ 向导能完成，砚灵可交互（本地模式） |
| 无开发感文字 | ✅ 任何界面都不出现「正在初始化，请等待」类文字 |

启动顺序硬性要求：**砚灵出现 → 后台初始化数据库 → 后台检查 AI**（低配机器顺序反了会觉得坏了）。

[自动] 身体列表恒含内置「砚」、当前身体解析必为内置：`src/core/firstLaunch.test.ts`

## 2. 设置链路压力测试（重点：设置打不开/桌宠状态丢失）

桌宠 → 右键 → 设置 → AI大脑 → 返回，循环 10 次，检查：

- 桌宠还在（没有消失）
- 位置没有变化
- 气泡状态没有卡死
- 对话窗口滚动正常（回到底部）

然后：设置 → 切换主题（浅/深）→ 关闭设置 → 重开，确认：

- 深浅色保存（重启后仍在）
- 切换不闪白
- 不重新加载整个窗口（不重新走启动动画）

启动期快速操作竞态：首次打开时快速点击 设置 / 对话 / 换身体，预期**无** `Cannot read undefined soul`、无 `avatar not initialized`、无白屏。

[自动] 视图层全部 IPC 调用均有 `.catch` 兜底；`currentBody` 恒有内置描述符兜底（IPC 挂死 4s 超时按失败处理）→ `src/renderer/App.tsx`

## 3. Safe Mode / 资源缺失触发测试

模拟损坏环境（逐项独立执行）：

| 模拟 | 预期 |
| --- | --- |
| `resources/avatar` 改名 `resources/avatar_backup` 后启动 | ✅ 看到内置「砚」，**不**弹修复窗口；`startup.log` 无异常（内置身体零资源依赖） |
| 删除/损坏 `userData/avatars/` 下 Live2D 模型文件夹 | ✅ 内置「砚」，`logs/avatar.log` 有失败原因 |
| 删除精灵图文件后启动 | ✅ 内置「砚」，不白屏 |
| 导入坏 Live2D 模型（缺文件/路径错误） | ✅ 自动回退内置「砚」，**不是**白屏 |
| 连续触发渲染进程崩溃（测试用） | 第 1 次自动重载 → 第 2 次 safe mode → 第 3 次修复对话框（打开诊断页/重启/退出） |

关键规则：**修复窗口是最后一级**。单次资源缺失只允许走「回退链」，不允许直接弹修复窗口。

[自动] 渲染崩溃升级链：`src/core/rendererCrashPolicy.test.ts`（reload → safe-mode-reload → repair-dialog）；safe mode 主进程持久化：`src/main/safeMode.test.ts`；精灵图缺图回退：`src/renderer/components/avatar/modelTypes.test.ts`

## 4. 数据库损坏测试

```
1. 备份 userData/database.sqlite
2. 随机破坏文件内容（用编辑器改几个字节）
3. 启动
```

预期：

| 场景 | 预期 |
| --- | --- |
| 启动时检测到损坏 | ✅ 弹恢复对话框「修复并重新启动 / 退出」，**绝无**「任务栏有图标但无窗口」 |
| 点「修复」 | ✅ 备份损坏文件 → 重新初始化 → 重启 → 砚灵出现 |
| 恢复后仍失败 | ✅ 再次明确报错，不静默退出 |

[自动] 恢复逻辑在 `src/core/database.ts`（`recoverDatabase`）；启动失败路径 `src/main/index.ts`（`handleStartupDbFailure`）

## 5. Windows Defender / SmartScreen 兼容

- 安装包 `InkSpirit-Setup-0.9.3.exe` 在干净机器上安装时不被拦截（或拦截时有明确引导）
- 首次启动 Electron 不被实时保护误杀
- 建议：正式发布前将安装包提交微软 SmartScreen 声誉审核（若有条件）

## 6. AI 失败体验（用户感受不是错误码）

填错 API Key / 断网后发起聊天，用户看到的是**人话**，不是 `Error 401`：

- Key 错误 → 「大脑的钥匙好像不对…请到设置里检查一下 API Key」
- 网络失败 → 「当前大脑暂时无法连接，我可以等一会儿…」
- 有本地模型 → 自动切换本地（无感知）
- 都没有 → 保持聊天面板可用（聊天能力降级，不卡死）

## 7. 更新失败恢复（安装中途断电模拟）

- 下载完成后杀进程 / 断电，重新打开应用：
  - ✅ 灵魂数据没丢（`soul_id`、记忆、关系仍在）
  - ✅ 应用可以正常启动（不进入损坏状态）
  - ✅ 日志能看到更新中断原因（`logs/updater.log`）

## 8. 日志完整性 + 隐私检查

打开 `userData/logs/startup.log`，正常启动应看到完整生命周期：

```
01 app ready
02 database ok
03 agent ok
04 ipc handlers registered
05 window created
06 renderer ready-to-show — showing window
07 did-finish-load
startup_success
avatar ready type=builtin          ← 实际渲染结果（builtin/sprite/live2d/vrm）
```

异常启动应看到恢复/失败标记与 `[ERROR]` 行：

```
startup_recovery database corrupted: ...      ← 数据库损坏 → 恢复对话框
startup_recovery agent init failed: ...       ← 大脑初始化失败 → 清理重来
startup_failed recovery failed: ...           ← 不可恢复
[ERROR] avatar initialization failed fallback=builtin (live2d_custom: ...)
[ERROR] renderer crash loop (...) — showing repair dialog
```

结果标记汇总（用户反馈问题时直接 grep）：`startup_success` / `startup_recovery` / `startup_failed`。

隐私检查（所有 `logs/*.log`，尤其错误日志）：

- ✅ 无 API Key / token / secret / password 明文
- ✅ 无聊天内容
- ✅ 无完整用户目录路径（`C:\Users\xxx` 已被脱敏）
- [自动] 落盘前统一 `sanitizeLog()`：`src/main/logs.ts` + `src/main/logs.test.ts`（密钥/token/Bearer/用户目录 9 类用例）

检查原则：

- ✅ 正常路径记录关键事件（不只记错误）
- ✅ 失败路径有 `[ERROR]` 前缀，可直接 grep
- ✅ 绝不含聊天内容 / 记忆 / API Key

## 9. 诊断页检查

设置 → 系统 → 诊断：

- 🟢 数据库正常 / 身体正常 / 大脑（当前 Provider）/ 灵魂连续性正常 / GPU / 更新服务
- 「导出诊断报告」一键复制完整报告（版本/平台/运行时长/灵魂/数据库/大脑/身体/GPU/日志目录）——反馈 GitHub issue 时直接粘贴
- 灵魂连续性异常（数据库被破坏）时显示 ✗ 并有原因

---

## 用户旅程测试（User Journey）

> 这三条比新增 50 个单元测试更接近真实用户。每条在 3 台机器上至少跑一遍。

### 旅程 1：第一次见面

```
下载 → 安装 → 双击 → 看到砚灵 → 发送第一句话
```

通过标准：5 秒内窗口 + 砚灵 + 托盘；向导「你好，我是砚灵」可完整走完；完成后砚灵在桌面且可拖拽、可点击打开对话。

**第一次聊天（最重要的产品瞬间，不测 AI 能力，测口吻）**：

```
用户：你好
```

预期：像第一次见面的人，如「你好。今天第一次见面，我会慢慢认识你的。」
**不能**像：`你好，我是一个AI助手...`（系统提示已按「桌面伙伴」人设构建，stranger 阶段「客气、不主动」）

[自动] 首次见面人设：`src/core/brain/prompt.ts`（stranger 阶段 + 名字规则「砚灵从不索取名字」）

### 旅程 2：设置往返不丢砚灵

```
托盘 → 设置 → 改模型/换身体 → 返回桌宠
```

通过标准：设置窗口出现；桌宠位置恢复（不跳回默认位置）；对话滚动位置保留在底部；砚灵仍是同一个（名字/记忆未变）。

### 旅程 3：升级后灵魂还在

```
v0.9.1（或 v0.9.3）→ 安装 v0.9.2 Stable
```

通过标准：升级后「欢迎回来」，名字/人格/关系/记忆/身体选择全部保留；`soul_id` 不变。

[自动] 灵魂身份连续性：`src/core/soul/identity.test.ts`、`src/core/backup.test.ts`（当前沙箱环境因 better-sqlite3 原生模块无法加载而跳过，须在真实环境执行）

---

## 回归范围

- `pnpm typecheck` ✅ 通过
- `pnpm build` ✅ 通过
- `pnpm test`：271 通过；20 个失败均为沙箱 better-sqlite3 原生模块环境问题（`ERR_DLOPEN_FAILED`），与代码无关，须在真实环境重跑
- 发布前在真实环境执行本清单 + 全量测试
