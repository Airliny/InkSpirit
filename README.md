# 砚灵 InkSpirit

兼具专业生产力与情感陪伴的自适应 2D 桌宠 Agent。支持 Shimeji 物理交互、双模态人格、屏幕感知及本地/云端 AI 智能路由，轻量低耗。

它不只是聊天机器人，也不只是动画桌宠——它会长期住在你的电脑里，记得你、理解你、主动关心你，随时间成长为独一无二的存在。

## 核心组成

| 组成 | 说明 |
|---|---|
| 身体 Avatar | Live2D（Cubism 2.1/4.0 核心内置）/ 精灵图（PNG/GIF）双模式，可拖拽、可点击、带惯性物理；失败自动降级，绝不隐形 |
| 大脑 Brain | OpenAI / Anthropic (Claude) / DeepSeek / Ollama（本地）四 Provider，流式对话 |
| 世界模型 World | 本地启发式推断用户状态（深度专注/疲劳/熬夜/恢复）、个人作息节奏基线（"今天比平时晚睡"），对话自动注入世界感知；零 AI 成本、零内容留存 |
| 人格 Personality | 8 维人格参数，缓慢成长且**每次成长留痕**（为什么变成这样可回放）；行为风格由人格派生 |
| 情绪 Emotion | 20 种情绪（恩怨/原谅/嫉妒/害怕/失望/孤独），情绪基准随长期状态漂移，深夜自然安静 |
| 记忆 Memory | 分层记忆（短期→长期），定期巩固与衰减；AI 语义化提取；砚灵会"忽然想起"——且回忆被确认会变得更懂你 |
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
│   └── ipc/                     # chat / config / data / system / model / cost / update
├── preload/                 # contextBridge：window.inkAPI
└── renderer/                # React 前端
    ├── App.tsx                  # 欢迎向导 / 桌宠模式 / 面板模式（聊天+设置）+ 对话身体状态
    ├── views/                   # PetView（可拖拽桌宠）/ ChatView / SettingsView / WizardView
    ├── components/
    │   ├── avatar/              # Avatar（精灵图）/ Live2DView / SpriteAnimCanvas（context 恢复）
    │   └── chat/                # ChatBubble / ChatInput
    ├── stores/                  # zustand：chatStore / avatarStore
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

## 更新记录

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
- [ ] 触觉反馈（被摸/被拖身体反应）
- [ ] 情绪身体表达（走路轻快/呼吸节奏）
- [ ] 低功耗存在感（空闲降帧呼吸）
- [ ] Identity 身份系统（跨身体/跨模型/跨设备"同一个砚灵"）
- [ ] 社区桌宠资源生态（统一 Avatar 接口）
