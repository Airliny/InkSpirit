# 砚灵 InkSpirit

兼具专业生产力与情感陪伴的自适应 2D 桌宠 Agent。支持 Shimeji 物理交互、双模态人格、屏幕感知及本地/云端 AI 智能路由，轻量低耗。

它不只是聊天机器人，也不只是动画桌宠——它会长期住在你的电脑里，记得你、理解你、主动关心你，随时间成长为独一无二的存在。

## 核心组成

| 组成 | 说明 |
|---|---|
| 身体 Avatar | Live2D（Cubism 2.1 / PixiJS 7）/ 精灵图（PNG/GIF）双模式，可拖拽，可点击 |
| 大脑 Brain | OpenAI / Anthropic (Claude) / DeepSeek / Ollama（本地）四 Provider，流式对话 |
| 人格 Personality | 8 维人格参数，缓慢成长；用户对待方式会反哺人格，行为风格（主动/语气）由人格派生 |
| 情绪 Emotion | 20 种情绪（恩怨/原谅/嫉妒/害怕/失望/孤独），情绪基准随长期状态漂移，深夜自然安静 |
| 记忆 Memory | 分层记忆（短期→长期），定期巩固与衰减；关键词 + AI 语义化双重提取，砚灵会"忽然想起"你说过的事 |
| 行为 Behavior | 6 驱动自主行为，发呆念头、主动搭话随人格变化；拖拽有互动反应，甩动带 Shimeji 式惯性物理 |
| 陪伴 Guardian | 检测连续工作主动提醒（多档位、人格化措辞、可配置、绝不强制打断） |
| 关系 Relationship | 陌生人→相识→朋友→挚友→伴侣，关系升级时砚灵会自己说心里话 |
| 双模态 Dual Mode | 陪伴模式（温暖自然）/ 专业模式（简洁高效），一键切换，影响对话基调 |
| 感知 Perception | 真实用户活动检测（powerMonitor）、工作时长统计、久别归来的欢迎 |
| 成本 Cost | 智能路由（简短闲聊走本地模型）、月度预算拦截、响应缓存、用量统计 |
| 本地模型 Local | Ollama 模型管理：检测/下载（流式进度）/删除/切换，硬件门槛校验与推荐 |
| 更新 Update | electron-updater + GitHub Releases 应用内一键更新 |

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
│   ├── agent.ts                 # 中心 Agent：对话、情感反馈、记忆总结、本地/云端双客户端
│   ├── config.ts                # 键值配置（内存缓存 + SQLite）
│   ├── secureStore.ts           # API Key 加密存储（safeStorage）
│   ├── database.ts              # SQLite 单例与迁移
│   ├── cost/                    # 智能路由 / 月度用量 / 响应缓存
│   ├── brain/
│   │   ├── ai/                  # AI Provider 工厂：openai / anthropic / types
│   │   ├── prompt.ts            # 人格+情绪+关系+记忆 → 系统提示词
│   │   ├── decision.ts          # 自主行为决策
│   │   └── reflection.ts        # 对话记忆提取与人格演化
│   ├── soul/
│   │   ├── emotion.ts           # 20 情绪 + 内存态 + 节流落盘
│   │   ├── personality.ts       # 人格参数、成长与行为风格派生
│   │   ├── memory.ts            # 分层记忆、巩固、衰减、回忆
│   │   └── relationship.ts      # 用户关系阶段
│   └── autonomy/                # 驱动系统：drives / eventBus / observer / policies
├── main/                    # Electron 主进程
│   ├── index.ts                 # 生命周期：感知、心跳、Guardian、情绪同步、回忆、记忆维护、更新器
│   ├── windowManager.ts         # 无边框透明置顶窗口、桌宠/面板双模式、拖拽（多显示器感知）
│   ├── trayManager.ts           # 系统托盘菜单 + 桌宠右键菜单
│   ├── guardian/                # 主动陪伴提醒引擎（人格化措辞）
│   ├── modelManager/            # Ollama 模型管理 + 硬件检测/门槛
│   ├── perception/              # 真实活动检测 / 上下文检测 / 时长统计
│   ├── updater/                 # electron-updater 封装
│   └── ipc/                     # chat / config / data / system / model / cost / update
├── preload/                 # contextBridge：window.inkAPI
└── renderer/                # React 前端
    ├── App.tsx                  # 欢迎向导 / 桌宠模式 / 面板模式（聊天+设置）
    ├── views/                   # PetView（可拖拽桌宠）/ ChatView / SettingsView / WizardView
    ├── components/
    │   ├── avatar/              # Avatar（精灵图）/ Live2DView
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
- API Key 使用系统级加密存储（Windows DPAPI）
- 支持完整备份/恢复（含形象文件，选择文件夹）
- 本地存储有上限约束（情绪快照 7 天、对话保留 10 条、行为日志 500 条、形象文件自动清理）

## 更新记录

- **v0.2.0** — 灵魂深化（人格反哺/情绪基准/自然回忆/关系成长/归来欢迎）、本地模型管理（Ollama + 硬件门槛）、成本控制（路由/预算/缓存）、存储卫生、性能优化（缓存层/按需加载）、大量稳定性修复
- **v0.1.6** — 更新系统（electron-updater + GitHub Releases）、真实互动（情绪驱动表情/心情/动作）、Guardian 主动陪伴提醒
- **v0.1.5** — 情绪实时驱动表情、心情视觉效果、Live2D 状态动作
- **v0.1.4** — Guardian 主动提醒系统
- **v0.1.3** — 修复拖拽（主进程坐标计算）
- **v0.1.2** — 绝对坐标拖拽
- **v0.1.1** — local:// 协议修复精灵图加载、可拖拽桌宠

## Roadmap

- [x] 多 Provider AI（OpenAI / Claude / DeepSeek / Ollama）
- [x] Live2D + 精灵图双模式
- [x] 情绪系统（20 情绪 + 恩怨）
- [x] 驱动式自主行为
- [x] Guardian 主动陪伴提醒
- [x] 真实互动（情绪 → 表情/动作）
- [x] 应用内自动更新
- [x] 本地模型管理（搜索/下载/切换/删除 + 硬件校验）
- [x] 成本控制（智能路由/预算/缓存）
- [x] API Key 加密存储
- [x] 记忆语义化提取（AI 自动总结重要信息）
- [x] Shimeji 物理交互（抓取/甩动惯性/边缘反弹）
- [x] 双模态人格（专业 / 陪伴模式切换）
- [ ] 屏幕感知（活动窗口识别、勿扰判断）
- [ ] 社区桌宠资源生态（统一 Avatar 接口）
