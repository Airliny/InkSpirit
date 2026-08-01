# 砚灵 InkSpirit

一个拥有身体、大脑、人格、情绪、记忆与成长能力的 AI 桌面生命伙伴。

它不只是聊天机器人，也不只是动画桌宠——它会长期住在你的电脑里，记得你、理解你、主动关心你，随时间成长为独一无二的存在。

## 核心组成

| 组成 | 说明 |
|---|---|
| 身体 Avatar | Live2D（Cubism 2.1 / PixiJS 7）/ 精灵图（PNG/GIF）双模式，可拖拽，可点击 |
| 大脑 Brain | OpenAI / Anthropic (Claude) / DeepSeek / Ollama（本地）四 Provider，流式对话 |
| 人格 Personality | 8 维人格参数（善良/幽默/好奇/认真/独立/保护欲/玩乐/活跃），缓慢成长 |
| 情绪 Emotion | 20 种情绪，包含恩怨、原谅、嫉妒、害怕、失望、孤独；由互动/环境/时间共同决定 |
| 记忆 Memory | 分层记忆：短期对话、长期总结、人格记忆、关系记忆 |
| 行为 Behavior | 6 驱动自主行为（闲逛/困倦/好奇/社交/舒适/玩乐），情绪影响表情与动作 |
| 陪伴 Guardian | 检测连续工作，主动提醒休息（可配置阈值与冷却，绝不强制打断） |
| 感知 Perception | 真实用户活动检测（powerMonitor）、工作时长统计 |
| 更新 Update | electron-updater + GitHub Releases 应用内一键更新 |

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 28 + electron-vite |
| 渲染 | React 18 + TypeScript + Zustand |
| 角色渲染 | PixiJS 7 + pixi-live2d-display |
| 数据库 | better-sqlite3（WAL 模式） |
| AI | openai SDK + 原生 fetch（Anthropic） |
| 打包 | electron-builder（NSIS 安装包） |
| 包管理 | pnpm |

## 快速开始

```bash
pnpm install
pnpm dev
```

## 打包发布

```bash
# 1. 修改 package.json 的 version
# 2. 打安装包（Linux 交叉编译需要 wine32 + xvfb）
WINEARCH=win32 WINEPREFIX=/tmp/wine32-pfx xvfb-run -a pnpm build && xvfb-run -a npx electron-builder --win --x64

# 3. 发布到 GitHub Releases（自动更新源）
GH_TOKEN=ghp_xxx npm run publish:release
```

产物：`dist/InkSpirit-Setup-<version>.exe`（NSIS 安装包，可选安装目录、创建快捷方式）

## 项目结构

```
src/
├── core/                    # 共享业务逻辑（灵魂与大脑）
│   ├── agent.ts                 # 中心 Agent：对话、情感反馈、记忆总结
│   ├── config.ts                # 键值配置（存 SQLite）
│   ├── database.ts              # SQLite 单例与迁移
│   ├── brain/
│   │   ├── ai/                  # AI Provider 工厂：openai / anthropic / types
│   │   ├── prompt.ts            # 人格+情绪+关系 → 系统提示词
│   │   ├── decision.ts          # 自主行为决策
│   │   └── reflection.ts        # 对话记忆提取
│   ├── soul/
│   │   ├── emotion.ts           # 20 情绪 + 恩怨/原谅/嫉妒 + 表情映射
│   │   ├── personality.ts       # 人格参数与成长
│   │   ├── memory.ts            # 分层记忆
│   │   └── relationship.ts      # 用户关系阶段
│   └── autonomy/                # 驱动系统：drives / eventBus / observer / policies
├── main/                    # Electron 主进程
│   ├── index.ts                 # 生命周期：感知、心跳、Guardian、情绪同步、更新器
│   ├── windowManager.ts         # 无边框透明置顶窗口、桌宠/面板双模式、拖拽
│   ├── trayManager.ts           # 系统托盘菜单（显示/隐藏、切换面板、设置）
│   ├── guardian/                # 主动陪伴提醒引擎
│   ├── perception/              # 活动监控 / 上下文检测 / 时长统计
│   ├── updater/                 # electron-updater 封装
│   └── ipc/                     # chat / config / data / system / update
├── preload/                 # contextBridge：window.inkAPI
└── renderer/                # React 前端
    ├── App.tsx                  # 欢迎向导 / 桌宠模式 / 面板模式（聊天+设置）
    ├── views/                   # PetView（可拖拽桌宠）/ ChatView / SettingsView / WizardView
    ├── components/
    │   ├── avatar/              # Avatar（精灵图）/ Live2DView / 闲逛行为选择
    │   └── chat/                # ChatBubble / ChatInput
    ├── stores/                  # zustand：chatStore / avatarStore
    └── hooks/                   # useIdleBehavior / useInkAPI
```

## 交互方式

- **拖拽**：按住桌宠拖动，可随意移动位置
- **点击**：点击桌宠打开聊天面板
- **右键**：面板模式
- **托盘**：显示/隐藏、切换面板模式、设置、退出
- **设置 → 软件更新**：检查更新、下载、重启安装

## 数据与隐私

- 用户数据存储在系统用户目录（SQLite），程序升级不丢失
- 支持导入导出（设置中）
- API Key 仅本地保存

## 更新记录

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
- [ ] 本地模型管理（搜索/下载/切换）
- [ ] 成本控制（智能路由/预算/缓存）
- [ ] 数据加密与凭据管理器
- [ ] 社区桌宠资源生态（统一 Avatar 接口）
