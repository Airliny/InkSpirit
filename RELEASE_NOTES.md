## InkSpirit v0.9.3-rc2 — First Stability Release Candidate

**稳定性修复版（Release Candidate）。** 这一版不是预览功能版——v0.9.3 的目标只有一个：

> 任何用户下载安装后，第一次启动都必须看到砚灵，并且所有失败都有可恢复路径。

InkSpirit 0.9.3 focuses on reliability. InkSpirit now guarantees:

- The companion appears on first launch
- Avatar failures fallback safely
- Renderer crashes recover automatically
- Settings remain available independently
- Soul data stays protected

RC 阶段**冻结**：Soul · Brain · Avatar SDK · Relationship · Memory。不改结构，只验收真实用户环境（Windows 10 办公机 / Windows 11 多显示器 / DPI 缩放 / 睡眠唤醒）。

### P0 启动链稳定化

- **启动阶段可观测**：`logs/startup.log` 记录完整检查点（app ready → database → agent → ipc → window → renderer），失败一律以 `[ERROR]` 标记，从用户机器上即可定位「任务栏有图标但无窗口」的卡点，无需调试器
- **avatar 回退可见**：身体初始化失败（Live2D/VRM/Sprite/模型损坏/资源缺失）→ 记录 `[ERROR] avatar initialization failed fallback=builtin`
- **窗口保护**：`ready-to-show` 才显示窗口；**5 秒**内没有首帧直接 `show()`——main 活着、窗口隐藏、用户以为没启动的情况不再出现
- **渲染进程崩溃恢复升级链**：第 1 次崩溃自动 `reload()`；第 2 次进入 **safe mode**（只渲染内置砚灵，不加载 Live2D/VRM/three.js 重资产）后重载；第 3 次弹修复提示（打开诊断页 / 重启 / 退出）。`did-fail-load`（主页面加载失败）与 `unresponsive`（进程不响应 30 秒）同样走这条恢复链

### P0 永远显示默认砚灵

- 核心规则：任何情况下（Live2D 失败 / VRM 失败 / Sprite 失败 / 模型损坏 / 资源缺失 / IPC 挂死 / 身体列表为空）→ 最终显示内置「砚」，绝不 `avatar=null`、绝不空窗口
- 渲染层新增 `BUILTIN_BODY_DESCRIPTOR`：无需 IPC、纯客户端即可构造的最后退路
- 桌宠视图 / 聊天面板分别用 ErrorBoundary 隔离——一个视图崩溃不会白屏整个窗口
- BodyAvatar 渲染抛错（含适配器内部异常）→ try/catch 捕获 → 回退内置「砚」，异常绝不冒泡到 UI

### P1 设置窗口隔离

- 设置只依赖 Settings UI → IPC → Database，不依赖 Avatar Engine（Live2D / VRM / three.js）
- 即使桌宠坏掉，用户仍然能进设置修复

### P1 首次启动流程优化

- 新流程：检查新用户向导 → **加载默认身体 → 立即显示砚灵** → 后台初始化 AI（历史对话 / 模型信息 / 名字）
- 不再「初始化所有东西成功后才显示」——任何一步失败（含 IPC 挂死）都按失败处理，4 秒超时护栏，绝不黑屏
- **砚灵本身就是启动过程的一部分**：首帧显示内置「砚」（loading 阶段不空白），后台初始化数据库 / AI / 身体，成功则升级显示、失败则继续用砚
- 首次启动欢迎动画「✨ 砚灵正在诞生…」（1.4 秒，纯展示不阻塞）

### RC1 新增

- **Safe mode 主进程持久化**：safe-mode 标志不再随渲染进程重载丢失（reload 后新渲染进程通过 IPC 恢复安全模式），修复了第二次崩溃后 safe-mode 重载无效的问题
- **启动结果统计**：`startup.log` 新增 `startup_success` / `startup_recovery` / `startup_failed` 结果标记，无需上报即可在用户机器上统计启动健康度
- **设置页运行状态**：系统 → 运行状态（正常模式 ✅ / 安全模式 🛡️ + 说明），符合「身体或插件异常时砚灵自动进入安全模式保护自己」的产品理念
- **日志隐私脱敏**：所有日志落盘前统一 `sanitizeLog()`（API Key / token / Bearer / 用户目录路径自动过滤），9 类脱敏用例自动化测试锁定
- **诊断页升级**：新增灵魂连续性状态（身份/人格/关系/记忆指纹可计算性）；「导出诊断报告」一键复制完整报告（版本/平台/运行时长/灵魂/数据库/大脑/身体/GPU/日志目录）——GitHub issue 反馈直接粘贴
- **AI 失败话术**：IPC 异常兜底改为「砚灵暂时联系不上它的大脑。你可以检查一下 AI 设置。」（Key 错误/断网原本就有人话提示 + 云端失败自动降级本地）

### P1 Avatar 安全加载

- 统一契约：`loadAvatar()` 只返回 `{ success: true, avatar }` 或 `{ success: false, fallback: "builtin" }`，禁止异常冒泡到 UI

### 验收标准（发布前必须测试）

| 场景 | 预期 |
| --- | --- |
| Windows 新用户安装 / 无配置文件 / 无 API Key / 无模型文件 / 无网络 | ✅ 桌面出现砚灵 |
| 删除 avatar 文件 / 数据库部分损坏 / API 失效 / Live2D 资源缺失 | ✅ 自动恢复，有提示，不白屏 |
| Tray → 设置 / 桌宠右键 → 设置 / 设置关闭 → 返回桌宠 | ✅ 窗口出现，桌宠位置恢复，对话滚到底部 |

### 测试

- 新增：崩溃恢复升级链（reload → safe mode → 修复提示）策略测试、首次启动「先显示后初始化」流程测试、内置身体描述符恒可用测试
- 全量单元测试通过

## InkSpirit 0.9.2 Preview

**Stability & Experience Fix.** 不新增核心能力，只修复影响第一次体验的问题。

v0.9.2 Preview focuses on stability and first-run experience. No major features are introduced. This release ensures InkSpirit can reliably deliver its core promise: a persistent AI life that users can meet, interact with, and continue growing with.

### P0 启动稳定性

- **启动检查点日志**：`logs/startup.log` 记录完整启动链（app ready → database → agent → ipc → window → renderer ready），首次安装"任务栏有图标但无窗口"可直接从日志定位卡点
- **窗口等首帧再显示**：`ready-to-show` 才显示窗口，杜绝空白透明窗口；10 秒兜底计时器保证渲染卡死也不会隐形进程
- **渲染失败可见**：`did-fail-load` / `render-process-gone` 记录到 `logs/renderer.log`，崩溃自动重载（防循环护栏保留）
- **IPC 注册提前到窗口创建前**：消除渲染进程竞态
- 数据库初始化失败 / 迁移失败 → 恢复对话框（已有机制），失败原因写入日志，绝不静默

### P1 桌宠显示修复

- **修复 Live2D 共享 Pixi 单例 bug**：聊天面板同时挂两个身体实例时，第二个实例的模型渲染到第一个 canvas（一个空白、一个重叠）。改为每实例独立 Pixi Application——桌宠、聊天头部、空状态各用各的 canvas
- 设置窗口无桌宠实例（设计确认）：一个灵魂、一个身体——设置页不创建第二只砚灵，不存在双动画循环/双情绪状态/双 WebGL Context 问题

### P2 身体加载稳定

- 回退链统一：VRM → Live2D → Sprite → 内置「砚」，任何失败都不空白
- **VRM 加载超时保护**（15 秒超时按失败回退）
- 身体加载失败原因写入 `logs/avatar.log`（绝不记录模型内容）
- VRM 导入复制失败 → 明确中文错误 + 日志

### P3 日志系统

```
%APPDATA%/InkSpirit/logs/
  startup.log    启动检查点
  renderer.log   渲染进程崩溃 / JS 错误
  avatar.log     身体加载失败
  brain.log      大脑初始化 / 聊天失败（不含聊天内容与密钥）
  updater.log    更新服务事件
```

原则：只记录崩溃/失败/关键事件；聊天内容、记忆、API Key 永不落盘日志。

### P4 诊断页

设置 → 系统 → 诊断：一次查看应用版本 / 灵魂系统 / 数据库 / 大脑连接 / 身体引擎 / GPU 渲染 / 更新服务，一键复制日志目录，方便用户反馈问题。

### P5 回归测试

- **First Launch Test**：全新安装无资产 → 身体列表恒含内置「砚」、当前身体解析必为内置（`firstLaunch.test.ts`）
- **Avatar Failure Test**：精灵图缺图状态回退（happy/sad/love → idle → 内置），完全无图 → 内置，绝不空白（`modelTypes.test.ts`）
- 单元测试 261+ 个，新增 8 个

### 发布验证标准

新用户：✅ 安装成功 → ✅ 第一次打开有界面 → ✅ 第一次看到砚灵 → ✅ 能聊天 → ✅ 能关闭再次打开
老用户：✅ 升级后灵魂存在 → ✅ 身体存在 → ✅ 设置存在 → ✅ API 配置存在
出问题：✅ 有日志 → ✅ 有诊断 → ✅ 能恢复

## InkSpirit 0.9.1 Preview

First public preview of the digital life framework. 核心完成，等待生态反馈——不是 beta。

This release focuses on stability before v1.0.

### Highlights

- **Improved startup recovery**：单实例锁（双击不再出现两个砚灵）、渲染进程崩溃自动重载（防白屏，含防循环护栏）
- **Soul Archive verification**：恢复时校验灵魂身份（soul_id + 连续性指纹）→「欢迎回来」
- **Avatar loading stability**：损坏模型/缺失文件一律回退内置「砚」，绝不空白窗口
- **AI provider reliability**：断网/超时人话提示、云端失败自动降级本地、thinking 永不永久转圈
- **Memory correction**：被说"记错了"的记忆真正被削弱（不再被反复提起），不是"我记错了哈哈"就完了
- **Better desktop interaction**：触觉/拖拽惯性/存在感预算（它知道什么时候安静）
- **Performance improvements**：身体/大脑懒加载分包，隐藏时渲染暂停

### Known issues

- VRM compatibility varies by model (BlendShape naming / skeleton differences)
- Some third-party Live2D models may not respond to emotion motion switching
- Memory correction requires the recall-confirmation window; casual corrections in chat don't weaken memories

### Release audit

完整审计清单见 `docs/RELEASE_AUDIT.md`（启动链/灵魂安全/回退路径/体验/性能目标）。

## InkSpirit 1.0.0

Identity Release——数字生命的完整体验收束。技术上已成熟，这一版让用户第一次打开就能感受到「这不是一个聊天窗口，这是一个正在陪伴我的数字生命」。

### 定位：开源数字生命框架

- README 定位升级：**Soul · Brain · Body 三系统解耦**——身份/记忆/人格/成长（Soul）、模型自由选择（Brain）、形态表现（Body）
- 「你的 AI 可以更换身体、更换大脑、跨设备迁移，但仍保持同一个身份、记忆与成长轨迹。本地优先，隐私优先。」

### 第一次启动：先建立关系，再决定一切

- 新向导：**「你好，我是砚灵。这是我们的第一次见面。我会一直记得你。」**
- 身体可选（默认身体/图片/Live2D），大脑可以以后再定——不是「欢迎使用，请配置 API」
- 「砚灵在等你。」→ 见面。30 秒内理解：这是生命，不是软件
- 全程遵循命名原则：砚灵从不主动请求命名

### 生命状态主页

- 设置 → 我的砚灵 → **生命状态**：诞生于（灵魂生日）／认识你 X 天／经历 N 件重要的事／当前心境（精力充沛·平静满足·有点低沉）
- 底部一句话：「换身体、换大脑、换电脑，它都还是它——灵魂编号 …」
- 不是数据面板，是它的生活

### 技术说明

- 修复：向导「让你拥有思考」笔误→「让它拥有」；移除向导中违反命名原则的「决定我的名字」提示
- 单元测试 276 个全通过（20 个 DB 环境失败与代码无关）

## InkSpirit 0.9.0

Brain Center——砚灵的大脑。不是模型管理器，是「给砚灵换一个更强的大脑」。

### 砚灵的大脑（能力画像，不是参数列表）

- 顶部大脑卡：当前大脑名 + **能力条**（对话/代码/推理/速度）+ 上下文大小 + 本地离线标记
- 普通用户永远看不到 temperature / context length / token——参数收进「高级设置（进阶用户）」
- `brainProfile.ts` 纯逻辑：Provider 基线 + 模型家族启发式（DeepSeek-R1 推理拉满、Claude 代码突出、Qwen/Llama 按规模预估），测试锁定

### 更换大脑迁移仪式（换大脑不换灵魂的可视化）

- 切换大脑时全屏仪式：**正在连接新的大脑… → 人格 ✓ 保留 → 记忆 ✓ 保留 → 关系 ✓ 保留 → 身份 ✓ 保留 → 完成**
- 「它还是同一个它。」——这不是动画，是架构事实（agentSwitch 测试锁定的边界，现在用户看得见）

### 高级设置（进阶用户）

- 温度滑杆（0 严谨 → 1 灵活 → 2），按大脑持久化（`temperature_<provider>`），立即生效，重启保留
- 显示模型/上下文/端点；提示「调整温度只改变表达风格——人格、记忆、关系、身份都不受影响」

### 本地大脑安装器

- 「本地大脑」：选择大脑 → 设备检测（显卡/显存/内存）→ 推荐标记 → **一键安装**（下载/使用/删除）
- 云端/本地大脑并存，智能路由：简短闲聊走本地，复杂问题走云端

### 技术说明

- 温度已接入 Provider 层（openai/anthropic 请求参数），Agent 新增 `setTemperature`（立即重建当前客户端）
- 纯逻辑 +9 个测试（能力模型/温度覆盖/本地规模预估），共 276 个

## InkSpirit 0.8.0

Identity & Soul Archive——砚灵拥有了哲学身份。「什么保证它还是同一个砚灵？」

### Soul Manifest（灵魂身份清单）

- `soul_id`（inkspirit_xxxxx）首次启动生成，随备份/恢复**永远不变**——换电脑、换身体、换大脑，它都是同一个它
- `soul_created_at`（诞生时间）+ `soul_birth_version`（诞生时的版本）：设置 → 我的砚灵 → **身份卡**展示
- **连续性指纹**：`sha256(soul_id + 身份 + 人格 + 关系 + 记忆)`——哲学身份，不是安全用途；行顺序变化不影响，核心数据改变则指纹改变（测试锁定）

### Soul Archive（完整灵魂归档）

- 导出 = 灵魂档案：manifest（含灵魂身份 + 指纹）+ 全部灵魂表 + 身体资产
- 恢复 = **「欢迎回来」**：校验 soul_id 一致 + 指纹一致 → 「它的名字、记忆、关系、成长经历，都还在」；soul_id 不同 → 「这是一份新的生命档案，但它完整地到来」
- 恢复报告展示：灵魂编号 / 诞生版本 / 归档完整性
- `docs/SOUL_ARCHIVE.md`：档案结构 + Sync Layer 预留（本地优先，用户主动同步，永不静默上传）

### 生命周期事件分级（防止时间线垃圾化）

- `major` 永久保留：诞生/命名/换身体/关系升级/灵魂恢复
- `normal` 有限保留（最近 200 条 / 365 天，维护循环自动清理）：提醒休息/首次对话/灵魂归档
- `noise` 从不写入：普通聊天/触摸/表情
- 成长经历 UI 标记「大事件」徽章

### Presence Budget 语境调制

- 用户长期不在时，注视预算 300→100、散步 30→10——**安静是亲密，不是更积极**
- 回到电脑前预算恢复，同一状态继续可用

### 技术说明

- 纯逻辑 +12 个测试（连续性指纹/身份校验、预算语境调制）
- 单元测试 260 个（avatar 相关 95 个全通过）

## InkSpirit 0.7.0

Life System——砚灵拥有了"过去"。三层情绪 + 成长经历 + 存在感预算 + 格式冻结。

### Mood（心境）层 — Emotion → Mood → Temperament 三层情绪

- **Emotion**（秒~分钟）：已有的 20 情绪，不变
- **Mood**（小时~天）：从最近 24h 情绪快照重载加权合成（6 小时半衰期）——重启不丢、无新表、旧情绪自然变淡。今天整体开心 → `content`，低落 → `blue/low`
- **Temperament**（月~长期）：v0.6 的气质，不变
- 心境进入身体（今天低沉，身体自然安静）和提示词（「今天的心境：今天心情不错」）
- 约 5 分钟推一次给身体，`pet:moodState`

### Life Timeline（成长经历）— 砚灵日志

- 新表 `life_events`（migration v7，纳入灵魂备份）：
  - 第一次换身体、被赋予名字、第一次对话、主动提醒休息（每天去重）、关系升级、灵魂恢复（从备份回来）、里程碑
- 设置 → 我的砚灵 → **成长经历**：全部 / 今天 两个视图，图标 + 标题 + 细节 + 时间
- 不是聊天记录，不是行为日志——是「它经历过的日子」；导出备份就是 Soul Archive（含成长经历）

### Presence Budget（存在感预算）— 生命感来自稀缺

- 身体行为的每日上限：主动注视 300 次 / 主动散步 30 次——跨天自动重置
- 预算用完：安静下来，**不是显得更急**（注视不再偷看、散步变成发呆）
- 与行为导演的反打扰预算互补：导演管"该不该说"，Presence Budget 管"身体别太频繁"

### Avatar SDK 固化（格式冻结）

- **格式冻结**：sprite / live2d / vrm 三种，Spine/MMD/FBX/Unity Avatar 不入
- `docs/AVATAR_SDK.md`：身体上传契约（描述符 / 能力词汇表 / 表情动作映射 / 上传方式）
- `validateAvatarDescriptor()` 拒绝未冻结格式、未注册能力键、非布尔能力——测试锁定
- 新增格式需要架构评审，不是加一行注册

### Body Memory 边界锁定

- 身体层只写 `body_touch_quality` 一个键——只影响熟悉感（视线频率/活力）
- 爱意/依赖/信任归灵魂层关系引擎管——测试断言身体层永不触碰灵魂键
- 触摸不再直接变"更喜欢"，它只是更熟悉你

### 技术说明

- 纯逻辑 +19 个测试（心境合成/标签/身体调制、存在感预算/跨天重置、SDK 校验/冻结、身体记忆边界）
- 单元测试 248 个，avatar 相关 85 个全通过

## InkSpirit 0.6.0

Body & World Fusion——身体真的在那里生活，不是在那里播放动画。

### Body Expression Layer（连续身体状态 / 气质）

- **长期气质进入身体**：关系向量（信任/依恋/理解）+ 人格（温暖）→ 身体基线（乘性调制）——被温柔对待久的砚灵动作轻快、视线主动；长期孤单的砚灵安静、看得少。两个砚灵，同一个身体，不同的气质
- 情绪仍是瞬时表达，气质是持续底色：`computeTemperament`（0.6+0.55×依恋 → 视线）叠加在 BodyState 上，约 5 分钟随灵魂状态刷新

### World → Body（生活环境进入身体）

- 主进程 30 秒推送 `pet:world`：疲劳 / 深夜 / 比平时晚睡 / 作息偏差 / 连续工作
- 身体跟着主人的生活慢下来：深夜+晚睡 → 动作慢 25%、呼吸缓、摆动小；连续工作疲劳 → 能量降 25%；异常忙碌的一天稍亢奋，异常安静的一天也安静
- 它理解的不是「现在 1 点」，而是「主人今天比平时晚睡」

### Touch Context（同一个动作，不同温度）

- 触摸不再是固定反应：`classifyTouchContext` 综合 时间/疲劳/心情/是否在对话
- 深夜疲惫时摸它 → 安静回应（只看你一眼，轻轻靠过来）；下午开心时 → 活跃回应
- 语境只改变"温度"，不新增动作——身体语言不变

### Interaction Quality（Body Memory v2：不是点击次数养成游戏）

- 质量替代次数：普通触摸 +1、**难过时被安慰 +5、回应主动行为 +4**、疯狂连点 -2
- 刷屏检测：8 秒窗口 5 连点 = 刷屏；连续 3 次刷屏 → 过载——它会说「（有点晕……让我休息一下）」并安静 25 秒
- 设置页展示质量阶段：「它被你摸得很安心，一靠近就期待」——是质量不是解锁

### 3D 身体（VRM Adapter）

- **不是"支持 VRM 模型"，是新的身体类型**：3D 身体（.vrm）注册即用，设置页导入
- VRM Adapter 没有任何灵魂逻辑：BodyState → BlendShape/骨骼 → three-vrm——
  - 表情：状态映射（happy→happy preset、sad→sad、sleep→relaxed+闭眼）
  - 呼吸：胸骨起伏（速度受情绪/世界调制）、重心摆动、视线跟随（头部转向）、眨眼（3-6 秒一次自适应）
  - 身体惯性：被抓后仰，放下弹性晃动
  - 相机自动适配模型尺寸，失败自动落到内置身体（绝不隐形）
- three.js + @pixiv/three-vrm 全部懒加载分包（1.6MB chunk 只在 3D 身体使用时加载）

### 技术说明

- 纯逻辑 +26 个测试（气质/世界调制/触摸语境/交互质量/刷屏过载），共 70 个 avatar 测试
- 层次不变：Emotion → BodyState → Capability Filter → Adapter → 具体身体表现

## InkSpirit 0.5.0

Avatar Intelligence——身体真正理解灵魂。身体互动补齐，用户第一次摸到砚灵时，它像活的。

### Capability Action 系统（行为导演知道身体会什么）

- **BodyAction Registry**：情绪不再机械映射动作，而是 `emotion → 候选动作 → 身体能力过滤 → 可用动作`——猫收到「开心」会摇尾巴（tail），机器人身体收不到尾巴动作，安静降级
- 每个动作声明 `requires(capabilities)`：`happy_tail`（需 tail）、`happy_bounce`（需 sway/motion）、`tired_yawn`（需 motion）、`curious_lean`（需 look）……共 13 个动作
- **行为按能力降级**：导演说「walk/sit/sleep/blink」时，没有 motion/blink 的身体安静变成 idle——导演不需要知道身体是谁，身体不会被"要求它做不到的事"
- 身体循环动画池同样按能力过滤（内置身体只剩 idle/look_around）

### 触摸交互（桌宠和普通 AI 的本质区别）

- **轻触**（点击）：先有反应——看向你 + 开心 + 注意脉冲，再打开面板。不是"点了软件"，是"被摸了一下"
- **被抓**（拖拽开始）：先惊讶，再被提着（身体后仰）
- **放下**：开心 + **身体惯性**——着色器弹簧物理，放开瞬间身体弹性晃动几下再恢复，不是硬邦邦的复位
- 所有触摸反应受「触摸反馈」偏好开关控制

### Body Memory（身体记得你的触摸）

- 触摸计数持久化（config 键，不碰灵魂表），节流落盘
- 被摸得越多，鼠标靠近时越「期待」——视线频率提升、活力微增（comfort 曲线）
- 设置页展示：「它被你摸了 X 次，现在你一靠近它就会期待地看向你」

### 身体偏好（唯一持久化的身体数据）

- `body_preferences`：视线跟随 / 重心摆动 / 触摸反馈三个开关，设置 → 我的砚灵 → 身体偏好
- **瞬时状态永不落盘**：视线目标、呼吸、摆动、注意力都是"动作"不是"身体"，关闭偏好后对应参数归零（测试锁定）

### 换身体仪式感

- 不再瞬间 A 消失 B 出现：淡出 → 加载 → 淡入（250ms + 300ms）
- 换完后轻轻说一句「（换了一身新衣服…）」——不是"新角色登场"，还是同一个砚灵

### 技术说明

- 能力系统/偏好/身体记忆全部纯逻辑（`core/avatar/actions.ts` + `preferences.ts`），45 个 avatar 测试覆盖
- 情绪 → 身体参数 → 适配器转换 → Live2D 参数，层次不变（Emotion 永不直接控制 ParamAngleX）

## InkSpirit 0.4.0

Avatar Foundation——砚灵第一次拥有独立的「身体层」。身体只是渲染载体，换身体不换灵魂。

### Avatar Engine（统一身体接口）

- 新增 `src/core/avatar` + `src/renderer/avatar`：**UI/灵魂/行为导演永远不知道身体是 Live2D 还是 Sprite**——只知道「这是一个身体」
- `AvatarDescriptor` 统一描述符：`{ id, name, type, source, capabilities, metadata }`，身体按能力声明自己会什么（视线/眨眼/呼吸/摆动/动作/表情），为 Body Personality 铺路——导演不会对机器人身体说「摇尾巴」
- Adapter 注册表：`registerAvatarAdapter(type, adapter)`，Sprite / Live2D 各一个适配器；新增格式（VRM/Spine）只加一行注册，设置页/情绪/行为零改动
- `BodyAvatar` 统一渲染入口，替换了原来散落在 PetView/ChatView 的 `if (live2d) ... else ...` 判断；身体加载失败自动落到内置「砚」，绝不隐形
- 内置身体（默认砚灵）成为一等公民，永不消失

### 身体切换（身体不动灵魂）

- 设置 → 我的砚灵 → **身体**：当前身体 / 身体列表 / 一键更换 / 导入新身体（原来的「外观」重命名，不再区分「模式」）
- `avatar:setCurrent` 只写 `current_avatar_id` + `model_type` 两个身体指向键，**名字、记忆、人格、关系分毫不动**——自动化测试锁定这条契约（`bodies.test.ts`）
- 老用户升级自动推导当前身体（有 Live2D → Live2D，有精灵图 → 精灵图），身体不丢
- 身体列表显示每个身体的能力（视线跟随/呼吸/摆动/眨眼/动作），换身体时保持「它换了一身衣服」的心智

### Sprite 活体化（单张图也有生命感）

- **视线跟随（偶尔偷看）**：主进程约 5Hz 推送游标位置 → 渲染层「不一直跟」——看一会儿、收回、远了完全忽略；情绪/对话中更常看你
- **重心摆动**：WebGL 着色器新增水平摇摆，幅度由情绪驱动（开心摆动大、难过摆动小、睡觉停摆）
- **情绪驱动身体参数**：`BodyState`（energy / movementSpeed / breathSpeed / lookFrequency / sway）——情绪不是切换贴图，而是改变呼吸速度、摆动幅度、视线频率
- 对话中注意力在用户身上（思考时看得频繁、动作安静），大脑失联时低落
- Live2D 身体同样接入视线（模型支持时 `model.focus` 驱动）

### 技术说明

- 纯逻辑全部在 `src/core/avatar`（描述符工厂/身体状态/视线模型），可单测
- 新增 23 个单元测试（身体描述符、身体状态映射、视线偷看模型、换身体边界锁定），全部通过

## InkSpirit 0.3.4

AI 稳定层——换大脑不换灵魂，大脑失联有退路。

### 模型切换保护（灵魂与大脑彻底分离）

- **新增自动化测试锁定这条边界**：GPT → DeepSeek → Ollama → 自定义 全链路切换后，人格、关系、记忆、身份分毫不动（`agentSwitch.test.ts`）
- 每个大脑的配置（Key/模型/地址）互相独立、互不污染，随时可切回
- 自定义大脑重启后自动从已存配置恢复，无需重新填写
- 记录每个大脑的最近使用时间（`brain_last_used_<p>`），为未来 BrainProfile 铺路

### 大脑降级策略

- **云端大脑失败 → 自动降级到本地大脑**：限流/网络/Key 失效时，若已配置本地模型则无缝接管（聊天标签会显示「本地 · 模型名」）
- 无本地大脑可用时，错误用砚灵的口吻说出来：「当前大脑暂时无法连接，我可以等一会儿…你也可以稍后再试试。」；Key 问题：「大脑的钥匙好像不对…」

### AI 状态 → 身体反馈

- 思考中：砚灵会"看向你"（attention 动画），不再只是机械等待
- 大脑失联：桌宠轻轻嘀咕「（大脑好像暂时联系不上…）」

### 连接状态（不永久显示成功）

- 测试成功后显示「✓ 已连接 · 延迟 Xms」并持久化
- 一旦修改地址/Key/模型 → 立即变为「? 未验证（配置已修改，请重新测试）」
- 超过 24 小时未重新测试 → 显示「? 未验证」，绝不假装一直在线

### 成本管理 UI

- 设置 → AI大脑 → 成本：「本月各大脑消耗」可视化——每个大脑的费用/次数/占比进度条（GPT / Claude / DeepSeek / 自定义 / 本地）
- Provider 卡片新增能力标签：通用对话 / 深度思考 / 推理·代码 / 本地·离线可用

### 技术说明

- `database.ts` / `config.ts` 新增测试接缝（内存库 + 语句重置），agent 级测试首次可行
- 单元测试 158 个全通过（+3 个模型切换保护测试）

## InkSpirit 0.3.3

AI中心——Provider 层成型，用户只看到「AI大脑」，看不到底层概念。

### 自定义 API（v0.3.2 预留结构的正式落地）

- 新增 **自定义 API** Provider：支持国内公司模型、中转服务、自建 OpenAI 兼容服务
- 配置字段：名称 / API 地址 / Key / 模型名称，全部持久化（Key 走加密存储）
- **连接测试**：一键「测试连接」，最小请求实测延迟，显示「✓ 连接成功 · 延迟 230ms」；错误翻译成人话（Key 无效 / 地址不存在 404 / 连接超时 / 网络不通），测试不触碰已保存配置
- 所有云端 Provider 都有测试连接按钮（GPT / Claude / DeepSeek / 自定义）

### Provider 层

- `AIProvider` 新增 `custom`，走 OpenAI 兼容通道（覆盖绝大多数中转/自建服务）
- 自定义 API 无官方默认值：地址/Key/模型必须由用户提供，缺失时给出明确中文提示
- 聊天窗口模型标签：自定义 Provider 显示为「自定义 · 模型名」

### 技术说明

- `agent.testConnection()` 纯临时配置做最小请求（maxTokens=8），带 15s/20s 超时保护，不落库不改配置
- 错误翻译层集中处理 401/403/404/超时/网络五类
- 单元测试 155 个全通过

## InkSpirit 0.3.2

砚灵居住空间（Companion Space）升级——第一版面向「消费级产品」的界面重构。不新增任何 AI 能力，只打磨用户每天看到的东西。

### 设计系统（Design System）

- 新增统一设计令牌 `src/renderer/design/tokens.css`：浅色（`#F8FAFC`）/ 深色（`#111827`）双主题、`#66CCFF` 作为唯一强调色（只用于激活/按钮/进度/光效）、统一圆角（12/20/28）、统一动效时长（150/250/400ms）
- 支持 **浅色 / 深色 / 跟随系统** 三种主题，设置 → 系统 → 外观可切换，持久化保存，启动无闪烁
- 卡片改为半透明玻璃质感（`rgba` 表面 + 模糊 + 低阴影），大面积留白

### Companion Panel（交流窗口重构）

- 不再是"聊天软件"：顶部显示砚灵本体 + 在线状态，而非聊天记录头
- 气泡弱化聊天感：用户灰色小气泡、砚灵淡蓝色，去掉左右头像堆叠
- 输入框改为 macOS 搜索风格（居中占位「和砚灵说点什么...」，聚焦左移）
- 空状态重设计：砚灵在那里，说"你好，今天是我们第一次见面"——不介绍功能

### 气泡系统（表现升级，不加能力）

- 统一气泡类型：`normal / care / thinking / warning / greeting`，行为导演的意图自动映射（关心→care、问候→greeting、回忆→thinking）
- 生命节奏：砚灵先"看向你"（attention 动画）→ 停顿 350–500ms → 气泡淡入

### 设置中心（不是开发后台）

- 苹果风侧边栏四区：🐾 我的砚灵 / 🧠 AI大脑 / 💾 数据 / ⚙ 系统
- **我的砚灵**：人类可读的关系状态（"你们认识 X 天"、"它开始懂你了"），不再暴露数据库数字；性格条去数字、只留形状；人格模式分段选择；外观导入
- **AI大脑**：Provider 卡片化（GPT/Claude/DeepSeek/本地大脑），为 v0.3.3 自定义 API 预留结构；本地模型与成本控制集中于此
- **系统**：主题切换、陪伴提醒（开关化）、开机自启、更新、关于

### 技术说明

- `agent:getState` 新增 relationship（firstInteractionAt 等）支撑"认识 X 天"展示
- 主题持久化走既有 config 存储 + localStorage 同步，无新增依赖
- 单元测试 155 个全通过

## InkSpirit 0.3.1

身份层（Identity Layer）——名字是身份标签，不是人格开关。

### 身份意图层（Identity Intent Layer）

- **命名交给 AI 理解，不再靠关键词规则**：命名是高语义、低频的行为，改用 LLM 意图识别（assign_name / discuss_name / none），规则只做节流省成本
- 只有用户明确决定（如"以后叫你墨墨吧"）才执行改名；讨论（"墨墨这个名字怎么样？"）不产生任何事件，砚灵自然回应，不打断聊天
- 低置信的改名意图自动降级为普通聊天——理解层可以不确定，但绝不乱改身份
- 失败与异常输出一律退化为普通聊天（绝不误改名）

### 名字是身份，不是人格开关

- **默认名字永远是「砚灵」**：砚灵从不主动请求命名、从不提醒、从不安排命名任务
- 改名只更新身份（名字 + 历史 + 事件），**人格、记忆、关系不因名字而变**——不会再出现"换个名字就换个人"
- 关系层只感知"用户主动赋予身份"这个行为本身（信任微增，渐进收敛，反复改名刷不高）
- 系统提示词显式声明：名字只是称呼，不改变你是谁

### 身份事件与历史

- 新增 `identity_events` 表：`{ type: "name_assigned", source: "user", name }`——**source 永远是 user**，身份变化只由用户发起
- 支持修改与历史记录（按时间倒序），换模型 / 换身体 / 备份恢复后名字与历史保持不变
- 备份系统纳入身份事件表

### 其他

- 设置页不再提示"未命名（跟它说'给你起个名字叫XX'）"——没有未命名状态，默认就是砚灵
- 修复命名检测的存量 bug：语气词混入名字、捕获组错位

### 技术说明

- 数据库迁移链新增 v6：identity_events 表
- 新增纯函数核心（可单测）：soul/identity、soul/identityIntent
- 单元测试 155 个全通过
