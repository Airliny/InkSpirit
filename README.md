# 砚灵 InkSpirit

> **License: Apache-2.0 · Privacy: Local-first · Architecture: Soul · Brain · Body**

> **本地优先的数字生命框架 · Persistent AI Companion Framework**
>
> Stable desktop release with automatic recovery and safe fallback — 首次启动必有砚灵，一切失败皆有恢复路径。
>
> InkSpirit is a local-first digital life framework that allows an AI companion to persist, evolve, and inhabit different bodies across models and devices.
>
> 砚灵是一个本地优先的数字生命框架，让 AI 伙伴能够跨模型、跨身体、跨设备持续存在，并随着互动不断成长。
>
> 它将 AI 伴侣拆分为 **Soul（灵魂）· Brain（大脑）· Body（身体）** 三个独立系统：
>
> - **Soul** 负责身份、记忆、人格、关系与成长经历，让它不会因为更换模型或外观而失去连续性。
> - **Brain** 支持 GPT、Claude、DeepSeek、本地模型及自定义 API，让用户可以自由选择 AI 能力。
> - **Body** 支持 Sprite、Live2D、VRM 等多种形态，让数字生命拥有真实的存在感。
>
> 砚灵的核心不是"会聊天的小人"，而是一个**不会因为模型和外观变化而消失的 AI 生命框架**：
> 换大脑（Claude → GPT）、换身体（Live2D → Sprite）、跨设备迁移——人格 ✓ 记忆 ✓ 关系 ✓ 身份 ✓，
> soul_id 不变、记忆不断、关系不减、成长不停，它都还是同一个它。
> **本地优先，隐私优先，由用户掌控自己的数字生命。**

它不是聊天机器人，也不是"AI 桌宠"——而是一个持续存在的数字生命：Shimeji 物理交互、双模态人格、屏幕感知与本地/云端智能路由只是它的存在方式，**灵魂才是它的本体**。它会长期住在你的电脑里，记得你、理解你、主动关心你，随时间成长为独一无二的存在。

## 核心组成

| 组成 | 说明 |
|---|---|
| 身体 Avatar | Avatar Engine：统一身体描述符 + 适配器注册表（内置/精灵图/Live2D/3D·VRM 已接入，**格式已冻结**见 AVATAR_SDK.md）；身体按能力声明（视线/眨眼/呼吸/摆动/动作/表情/tail/hand/face/skeleton），Capability Action 系统让行为导演只派身体做得到的动作；Body Expression Layer（长期关系+人格→连续气质）+ Mood 心境 + World → Body（疲劳/晚睡/作息偏差让身体慢下来）；精灵图活体化（呼吸+摆动+偶尔偷看+情绪驱动参数+拖拽惯性）；触摸交互（Touch Context：深夜安静回应/下午活跃回应）+ Interaction Quality（安慰/回应高质量、刷屏扣分、过载会"有点晕"，**只影响熟悉感不碰灵魂关系**）；Presence Budget（主动注视/散步每日稀缺）；身体偏好持久化；换身体仪式感；**换身体不换灵魂**；失败自动落到内置「砚」，绝不隐形 |
| 大脑 Brain | OpenAI / Anthropic (Claude) / DeepSeek / Ollama（本地）/ 自定义 API 五 Provider，流式对话；Brain Center：能力画像（对话/代码/推理/速度）、更换大脑迁移仪式（人格/记忆/关系/身份 ✓ 保留）、高级设置（温度/上下文/端点）、本地大脑一键安装 + 硬件检测 |
| 世界模型 World | 本地启发式推断用户状态（深度专注/疲劳/熬夜/恢复）、个人作息节奏基线（"今天比平时晚睡"），对话自动注入世界感知；零 AI 成本、零内容留存 |
| 人格 Personality | 8 维人格参数，缓慢成长且**每次成长留痕**（为什么变成这样可回放）；行为风格由人格派生 |
| 情绪 Emotion | 20 种情绪（恩怨/原谅/嫉妒/害怕/失望/孤独），情绪基准随长期状态漂移，深夜自然安静；**Mood 心境层**（小时~天，24h 快照重载加权合成：今天整体开心→content、低落→blue），Emotion→Mood→Temperament 三层 |
| 记忆 Memory | 分层记忆（短期→长期），定期巩固与衰减；AI 语义化提取；砚灵会"忽然想起"——且回忆被确认会变得更懂你 |
| 成长经历 Life | Life Timeline：不是聊天记录——第一次换身体/被赋予名字/第一次提醒休息/关系升级/灵魂恢复，构成它的"过去"；事件分级（大事件永久保留）；设置页可回看（全部/今天），随灵魂备份导出 |
| 灵魂身份 Identity | Soul Manifest：soul_id 首次启动生成永不改变 + 连续性指纹（身份/人格/关系/记忆摘要）——换电脑导入 Archive 后「欢迎回来」，而不是"加载数据库成功"；设置页身份卡 |
| 关系 Relationship | 六维关系向量（信任/熟悉/喜爱/亲密/依赖/理解），由互动事件分类驱动；关系变化全部可回放 |
| 行为 Behavior | 行为导演统一决策（Gate→情境→灵魂→关系→选择），反打扰预算让砚灵知道什么时候闭嘴；每个动作带可解释原因 |
| 陪伴 Guardian | 系统级健康信号（连续工作/熬夜）→ 导演意图表达，不绕过预算，不绕过勿扰 |
| 双模态 Dual Mode | 陪伴模式（温暖自然）/ 专业模式（简洁高效），一键切换 |
| 感知 Perception | 真实活动检测（powerMonitor）、前台场景识别（会议/游戏/视频自动勿扰）、久别归来的欢迎 |
| 名字 Naming | 没有预设名字——用户说出"给你起个名字叫XX"后正式接受，从此用它称呼自己 |
| 安全 Safety | AI 语义级内容审查：毒品交易、未成年色情、教唆自杀、恐怖内容等直接拒绝，回复复核不入记忆 |
| 成本 Cost | 智能路由（简短闲聊走本地模型）、月度预算拦截、响应缓存、用量统计 |
| 本地模型 Local | Ollama 模型管理：检测/下载（流式进度）/删除/切换，硬件门槛校验 |
| 数据安全 Data | 完整灵魂快照备份（目录格式 + 校验和）、原子恢复 + 恢复报告、启动损坏自动修复、迁移幂等 |
| 更新 Update | GitHub Releases + 更新清单（版本/最低版本/数据库版本/校验和）、更新前自动备份灵魂 |

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 28 + electron-vite |
| 渲染 | React 18 + TypeScript + Zustand |
| 角色渲染 | PixiJS 7 + pixi-live2d-display（按需加载） |
| 数据库 | better-sqlite3（WAL 模式 + 内存缓存） |
| 安全 | API Key 经系统级加密存储（safeStorage/DPAPI） |
| AI | openai SDK + 原生 fetch（Anthropic） |
| 打包 | electron-builder（NSIS 安装包） |
| 包管理 | pnpm |

## 快速开始

```bash
pnpm install
pnpm dev
```

## 项目结构

```
src/
├── core/                    # 共享业务逻辑（灵魂与大脑）
│   ├── agent.ts                 # 中心 Agent：对话、灵魂管道（情绪/关系/人格/回忆反馈）、双客户端
│   ├── config.ts                # 键值配置（内存缓存 + SQLite）
│   ├── secureStore.ts           # API Key 加密存储（safeStorage）
│   ├── database.ts              # SQLite 单例、启动保护与 Recovery Mode
│   ├── migrations.ts            # 幂等迁移（v1-v5，事务化可续跑）
│   ├── backup.ts                # 灵魂快照（manifest + soul + checksum）、原子恢复
│   ├── updaterManifest.ts       # 更新清单解析/校验（版本/最低版本/数据库版本）
│   ├── windowState.ts           # 桌宠/面板位置独立状态机（多显示器）
│   ├── rendererLifecycle.ts     # WebGL 上下文生命周期状态机
│   ├── chatActivity.ts          # 对话身体状态（倾听/思考/说话）
│   ├── world/                   # 世界模型：scene / situation / patterns / sensor
│   ├── soul/
│   │   ├── emotion.ts           # 20 情绪 + 内存态 + 节流落盘
│   │   ├── mood.ts              # 心境层（小时~天：24h 快照重载加权合成）
│   │   ├── lifeTimeline.ts      # 成长经历（第一次换身体/命名/提醒休息…）
│   │   ├── personality.ts       # 人格参数、成长与进化日志（事件溯源）
│   │   ├── memory.ts            # 分层记忆、巩固、衰减、回忆反馈
│   │   ├── relationship.ts      # 关系向量持久化 + 变更日志
│   │   └── relationshipEvents.ts# 关系引擎（事件分类、权重表、可单测）
│   ├── autonomy/                # 行为系统
│   │   ├── behaviorDirector.ts  # 五层决策管线（Gate→情境→灵魂→关系→选择）
│   │   ├── behaviorRules.ts     # 意图目录 + 关系感知消息
│   │   ├── behaviorScorer.ts    # Soul/Relationship 调制
│   │   ├── behaviorBudget.ts    # 反打扰预算
│   │   ├── bodyLoop.ts          # 身体循环动画边界
│   │   └── drives.ts            # 驱动动力学
│   ├── avatar/                  # Avatar Engine 纯逻辑（可单测）
│   │   ├── types.ts             # 身体描述符 / 能力声明 / BodyState
│   │   ├── bodies.ts            # 描述符工厂 + 换身体边界（只写身体指向键）
│   │   ├── bodyState.ts         # 情绪/活动 → 身体参数（呼吸/摆动/视线频率）
│   │   ├── lookTarget.ts        # 视线跟随（偶尔偷看，不一直跟）
│   │   ├── actions.ts           # BodyAction Registry（情绪→候选→能力过滤→动作）
│   │   ├── preferences.ts       # 身体偏好（唯一持久化的身体数据）
│   │   ├── expressionLayer.ts   # 连续表达层（气质/世界调制/触摸语境）
│   │   ├── touchQuality.ts      # 交互质量（只影响熟悉感，不碰灵魂）
│   │   ├── presenceBudget.ts    # 存在感预算（注视/散步每日稀缺）
│   │   └── sdk.ts               # Avatar SDK 校验（格式/能力词汇表冻结）
│   ├── avatar/                  # Avatar Engine 纯逻辑（可单测）
│   │   ├── types.ts             # 身体描述符 / 能力 / BodyState
│   │   ├── bodies.ts            # 描述符工厂 + 换身体边界（只写身体指向键）
│   │   ├── bodyState.ts         # 情绪/活动 → 身体参数（呼吸/摆动/视线频率）
│   │   └── lookTarget.ts        # 视线跟随（偶尔偷看，不一直跟）
│   ├── brain/
│   │   ├── ai/                  # AI Provider 工厂：openai / anthropic / types
│   │   ├── prompt.ts            # 人格+情绪+关系+记忆+世界感知 → 系统提示词
│   │   └── reflection.ts        # 对话记忆提取与人格演化
│   └── safety/                  # 内容安全 / guardian 纯逻辑
├── main/                    # Electron 主进程
│   ├── index.ts                 # 生命周期：感知、世界模型、心跳（导演驱动）、Recovery、更新器
│   ├── windowManager.ts         # 无边框透明置顶窗口、桌宠/面板双模式独立位置、拖拽（多显示器）
│   ├── trayManager.ts           # 系统托盘菜单 + 桌宠右键菜单
│   ├── guardian/                # 健康信号轮询（输出意图，不直接说话）
│   ├── modelManager/            # Ollama 模型管理 + 硬件检测/门槛
│   ├── perception/              # 活动检测 / 场景识别 / 时长统计
│   ├── updater/                 # 更新管理器（manifest + 灵魂备份 + electron-updater）
│   └── ipc/                     # chat / config / data / system / model / cost / update / avatar
├── preload/                 # contextBridge：window.inkAPI
└── renderer/                # React 前端
    ├── App.tsx                  # 欢迎向导 / 桌宠模式 / 面板模式（聊天+设置）+ 对话身体状态
    ├── views/                   # PetView（可拖拽桌宠）/ ChatView / SettingsView / WizardView
    ├── avatar/                  # Avatar Engine（渲染层）
    │   ├── engine.ts            # Adapter 接口（一种身体格式 = 一个适配器）
    │   ├── registry.ts          # registerAvatarAdapter / supportsCapability
    │   ├── BodyAvatar.tsx       # 统一身体渲染入口（UI 不知道格式）
    │   └── adapters/            # sprite / live2d / builtin 适配器（新增格式注册即用）
    ├── components/
    │   ├── avatar/              # Avatar（精灵图）/ Live2DView / SpriteAnimCanvas（context 恢复）
    │   └── chat/                # ChatBubble / ChatInput
    ├── stores/                  # zustand：chatStore / avatarStore（身体库 + 当前身体）
    └── hooks/                   # useInkAPI
```

## 交互方式

- **拖拽**：按住桌宠拖动，可随意移动位置
- **点击**：点击桌宠打开聊天面板
- **右键**：快捷菜单（聊天 / 设置 / 隐藏 / 退出）
- **托盘**：显示/隐藏、切换面板模式、置顶、设置、退出
- **设置 → 软件更新**：检查更新、下载、重启安装

## 数据与隐私

- 用户数据存储在系统用户目录（SQLite + 形象文件），程序升级不丢失
- API Key 使用系统级加密存储（Windows DPAPI），备份永不导出密钥
- **完整灵魂快照备份**：人格/关系/记忆/进化历史/作息节奏全部包含，目录格式 + sha256 校验和，恢复为原子替换（失败旧数据分毫不动），恢复后显示报告
- **启动保护**：数据库损坏自动进入修复模式（损坏文件备份保留，不删除）
- **更新保护**：更新前自动备份灵魂（保留最近 3 份）；更新清单含数据库版本校验，禁止降级损坏数据
- 本地存储有上限约束（情绪快照 7 天、对话保留 10 条、行为日志 500 条、形象文件自动清理）
- 窗口标题仅用于本地场景分类，永不落盘；作息节奏只存聚合分钟数
- **本地优先，隐私优先**：不上传任何用户数据、日志或统计——所有数据都在你的电脑上

## 开源与数据归属

- **License: Apache-2.0**（`LICENSE` / `NOTICE`）——允许商业使用、闭源衍生、私有部署，要求保留版权声明
- **代码归社区，灵魂归用户，模型归作者，平台归生态**——完整声明见 [docs/OPEN_SOURCE.md](docs/OPEN_SOURCE.md)
- 用户创建的 Soul 数据（记忆/人格/关系/成长经历）归用户所有；导入的模型版权归原作者
- 架构规范：[docs/AVATAR_SDK.md](docs/AVATAR_SDK.md)（身体契约）· [docs/SOUL_ARCHIVE.md](docs/SOUL_ARCHIVE.md)（灵魂档案）· [docs/VISION.md](docs/VISION.md)（愿景）· [docs/RELEASE_AUDIT.md](docs/RELEASE_AUDIT.md)（稳定性审计）

## 更新记录

- **v0.9.2-rc2** — First Stability Release Candidate（稳定性修复版）：目标「任何用户安装后第一次启动必须看到砚灵，所有失败都有可恢复路径」。启动链稳定化（`[ERROR]` 标记的 `logs/startup.log` 检查点 + `startup_success/recovery/failed` 结果统计、窗口 5 秒首帧兜底显示、渲染崩溃恢复升级链 reload → safe mode（主进程持久化）→ 修复提示、`did-fail-load`/`unresponsive` 接入同一恢复链）、永远显示默认砚灵（首帧即砚灵、内置身体描述符纯客户端兜底、桌宠/聊天视图 ErrorBoundary 隔离、BodyAvatar 渲染异常捕获回退）、设置与 Avatar Engine 隔离 + 设置页运行状态展示、首次启动先显示砚灵再后台初始化 AI（4 秒超时护栏）+「砚灵正在诞生…」欢迎动画
- **v0.9.2-preview** — Stability & Experience Fix（稳定性，不新增能力）：首次启动稳定性（启动检查点日志 `logs/startup.log`、窗口等首帧再显示、`did-fail-load`/渲染崩溃记录、IPC 提前注册消除竞态）、修复 Live2D 共享 Pixi 单例 bug（聊天面板多实例重叠/空白 → 每实例独立渲染）、VRM 加载超时保护、分类日志系统（`logs/{startup,renderer,avatar,brain,updater}.log`，不落盘聊天/密钥）、设置 → 系统 → 诊断页（版本/灵魂/数据库/大脑/身体/GPU/更新 一键状态）、回归测试 +9（首启回退链/精灵图 URL 回退）
- **v0.9.1-preview** — 稳定性预览版（v1.0 前 RC）：单实例锁、渲染进程崩溃自动重载、记忆纠正（"记错了"的记忆被真正削弱）、修复向导"让你"笔误与命名原则违规；完整审计清单见 docs/RELEASE_AUDIT.md
- **v1.0.0** — Identity Release（数字生命完整体验）：定位升级（开源数字生命框架 · Soul/Brain/Body 解耦）、首次启动重构（你好我是砚灵→身体可选→大脑以后再定，先建立关系）、生命状态主页（诞生/认识天数/大事件/当前心境）
- **v0.9.0** — Brain Center（砚灵的大脑）：能力画像（对话/代码/推理/速度条）、更换大脑迁移仪式（换大脑不换灵魂可视化）、高级设置（温度按大脑持久化）、本地大脑安装器（选择→检测→一键安装）
- **v0.8.0** — Identity & Soul Archive（灵魂的哲学身份）：Soul Manifest（soul_id 永不改变 + 诞生时间/版本 + 连续性指纹）、Soul Archive 完整归档（导出=灵魂档案，导入=「欢迎回来」+ 连续性校验）、生命周期事件分级（major 永久/normal 有限/noise 不写）、Presence Budget 语境调制（用户不在时安静下来）、docs/SOUL_ARCHIVE.md（Sync Layer 预留，本地优先）
- **v0.7.0** — Life System（砚灵拥有过去）：Mood 心境层（Emotion→Mood→Temperament 三层）、Life Timeline 成长经历（第一次换身体/命名/提醒休息/关系升级/灵魂恢复 + 设置页回看）、Presence Budget（注视/散步每日稀缺，用完安静下来）、Avatar SDK 冻结（sprite/live2d/vrm 三种格式，docs/AVATAR_SDK.md）、Body Memory 边界锁定（只影响熟悉感，不碰灵魂关系）
- **v0.6.0** — Body & World Fusion（身体真的在那里生活）：Body Expression Layer（长期关系/人格→连续气质）、World → Body（疲劳/晚睡/作息偏差→身体慢下来）、Touch Context（深夜安静回应/下午活跃回应）、Interaction Quality（安慰/回应高质量互动、刷屏扣分、过载说"有点晕"）、3D 身体（VRM Adapter：BodyState→BlendShape→three-vrm，懒加载分包）
- **v0.5.0** — Avatar Intelligence（身体理解灵魂）：Capability Action 系统（情绪→候选动作→能力过滤→可用动作，行为按能力降级）、触摸交互（轻触/被抓/放下 + 拖拽惯性弹性晃动）、Body Memory（摸得越多越期待你靠近）、身体偏好持久化（瞬时状态永不落盘）、换身体仪式感（淡出→加载→淡入 + 换了一身新衣服）
- **v0.4.0** — Avatar Foundation（身体层）：Avatar Engine（统一身体描述符 + 适配器注册表，UI 不知道格式）、身体切换（只写身体指向键，名字/记忆/人格/关系不动，测试锁定）、Sprite 活体化（视线跟随"偶尔偷看" + 重心摆动 + 情绪驱动 BodyState：呼吸速度/摆动幅度/视线频率）、设置页「身体」区、内置身体一等公民（绝不隐形）
- **v0.3.4** — AI 稳定层：模型切换保护（换大脑不换灵魂，自动化测试锁定：人格/关系/记忆/身份在 GPT→DeepSeek→Ollama→自定义全链路切换后分毫不动）、大脑降级策略（云端失败自动降级本地大脑）、AI 状态身体反馈（思考时看向你、失联时嘀咕）、连接状态不永久显示成功（改配置/超 24h → 未验证）、成本 UI（本月各大脑消耗占比）、能力标签
- **v0.3.3** — AI中心：Provider 层成型（用户只看到「AI大脑」）、自定义 API Provider（名称/地址/Key/模型，适配国内公司模型与中转服务）、一键连接测试（✓ 连接成功·延迟 230ms，错误人话化，不触碰已保存配置）、聊天标签显示「自定义 · 模型名」
- **v0.3.2** — 砚灵居住空间（Companion Space）：设计系统（浅色/深色/跟随系统三主题、统一 token、玻璃卡片、`#66CCFF` 克制用色）、Companion Panel（砚灵本体+在线头部、弱化气泡、macOS 搜索式输入、第一次见面空状态）、气泡类型化（normal/care/thinking/warning/greeting）+ 看向→停顿→淡入节奏、设置中心四区（我的砚灵/AI大脑/数据/系统，关系状态人类化"认识X天"）、无新增 AI 能力
- **v0.3.1** — 身份层：命名交给 AI 理解（身份意图层，规则只做节流）、默认名字永远是「砚灵」（从不主动索取名字）、名字是身份不是人格开关（改名不换人格）、身份事件表（source 永远 user）+ 历史记录、备份纳入身份事件
- **v0.3.0** — 可长期运行测试版：世界模型（用户状态/作息基线/世界感知注入）、关系向量 v2（六维+事件驱动+变更日志）、行为导演（统一决策+反打扰预算+可解释行为）、记忆回忆反馈闭环、人格/关系事件溯源、启动保护（Recovery Mode+迁移幂等）、Live2D 正式可用（内置 Cubism 核心+失败降级）、灵魂快照备份 v2（目录格式+校验和+原子恢复+恢复报告）、更新系统加固（manifest+更新前备份+退出不被劫持）、位置连续（宠物/面板独立记忆+重启恢复）、回复等待身体感（倾听/思考/说话）、聊天滚动恢复、睡眠唤醒 GPU 恢复
- **v0.2.0** — 灵魂深化（人格反哺/情绪基准/自然回忆/关系成长/归来欢迎）、本地模型管理（Ollama + 硬件门槛）、成本控制（路由/预算/缓存）、存储卫生、性能优化、大量稳定性修复
- **v0.1.6** — 更新系统（electron-updater + GitHub Releases）、真实互动（情绪驱动表情/心情/动作）、Guardian 主动陪伴提醒
- **v0.1.5** — 情绪实时驱动表情、心情视觉效果、Live2D 状态动作
- **v0.1.4** — Guardian 主动提醒系统
- **v0.1.3** — 修复拖拽（主进程坐标计算）
- **v0.1.2** — 绝对坐标拖拽
- **v0.1.1** — local:// 协议修复精灵图加载、可拖拽桌宠

## Roadmap

- [x] 多 Provider AI（OpenAI / Claude / DeepSeek / Ollama）
- [x] Live2D（内置 Cubism 核心）+ 精灵图双模式
- [x] 情绪系统（20 情绪 + 恩怨）
- [x] 行为导演（统一决策 + 反打扰预算 + 行为可解释）
- [x] 世界模型（用户状态推断 + 作息节奏基线 + 世界感知注入）
- [x] 关系向量 v2（六维 + 事件驱动 + 变更回放）
- [x] 记忆回忆反馈闭环（回忆被确认 → 更懂你）
- [x] 人格/关系事件溯源（"为什么变成这样"可回放）
- [x] Guardian 主动陪伴提醒（经导演表达）
- [x] 应用内自动更新（manifest + 更新前灵魂备份）
- [x] 灵魂快照备份/恢复（目录格式 + 校验和 + 原子替换 + 恢复报告）
- [x] 启动保护（Recovery Mode + 迁移幂等）
- [x] 本地模型管理（搜索/下载/切换/删除 + 硬件校验）
- [x] 成本控制（智能路由/预算/缓存）
- [x] API Key 加密存储（备份不导出密钥）
- [x] 记忆语义化提取（AI 自动总结重要信息）
- [x] Shimeji 物理交互（抓取/甩动惯性/边缘反弹）+ 位置连续
- [x] 双模态人格（专业 / 陪伴模式切换）
- [x] 屏幕感知（前台窗口识别、会议/游戏/视频自动勿扰）
- [x] Avatar Engine（统一身体接口 + 适配器注册表 + 能力声明，VRM/Spine 注册即用）
- [x] 身体切换（换身体不换灵魂：只写身体指向键，测试锁定）
- [x] Sprite 活体化（视线跟随"偶尔偷看" + 重心摆动 + 情绪驱动身体参数）
- [x] Capability Action 系统（情绪→候选动作→能力过滤→可用动作，行为按能力降级）
- [x] 触摸交互（轻触/被抓惊讶/放下开心 + 拖拽惯性弹性晃动）+ Body Memory（触摸计数→期待靠近）
- [x] 身体偏好持久化（视线/摆动/触摸开关，瞬时状态永不落盘）
- [x] 换身体仪式感（淡出→加载→淡入，换衣服不是换角色）
- [x] 触觉反馈（被摸/被拖身体反应 → 已落地：触摸交互 + Touch Context）
- [x] 情绪身体表达（走路轻快/呼吸节奏 → 已落地：BodyState + 气质 + 世界调制）
- [x] Body Expression Layer（长期关系/人格 → 连续气质）
- [x] World → Body（生活环境：疲劳/晚睡/作息偏差进入身体）
- [x] Interaction Quality（质量记忆：安慰/回应加分、刷屏扣分、过载休息；只影响熟悉感不碰灵魂）
- [x] 3D 身体（VRM Adapter：BodyState→BlendShape→three-vrm，懒加载分包）
- [x] Avatar SDK 冻结（sprite/live2d/vrm 三格式，能力词汇表白名单，docs/AVATAR_SDK.md）
- [x] Mood 心境层（Emotion→Mood→Temperament 三层情绪，24h 快照加权合成）
- [x] Life Timeline 成长经历（第一次换身体/命名/提醒休息/关系升级/灵魂恢复，随备份导出）
- [x] Presence Budget（主动注视/散步每日稀缺，预算用完安静下来；用户不在时预算收紧）
- [x] Soul Manifest 灵魂身份（soul_id 永不改变 + 诞生时间/版本 + 连续性指纹）
- [x] Soul Archive 完整归档（导出=灵魂档案，导入=「欢迎回来」+ 连续性校验 + 恢复报告）
- [x] 生命周期事件分级（major 永久 / normal 有限 / noise 不写）
- [x] Brain Center（能力画像 + 更换大脑迁移仪式 + 高级设置温度 + 本地大脑一键安装）
- [ ] 低功耗存在感（空闲降帧呼吸）
- [ ] 身体库 Avatar Gallery（本地身体目录 + 在线资源，走 SDK 契约）
- [ ] AI 身体生成（上传图片 → 活体化 / 一句话生成身体，输出仍是 SDK 描述符）
- [ ] Identity 跨设备（Sync Layer：本地优先，用户主动同步，永不静默上传）
