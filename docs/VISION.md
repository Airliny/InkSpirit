# 砚灵（InkSpirit）项目愿景与需求

一个拥有生命感的 AI 桌面伙伴（AI Desktop Companion）

---

## 一、项目目的

砚灵的目标是创造一个真正具有长期陪伴能力的数字生命。不是聊天机器人，不是会动的桌宠，而是一个长期陪伴用户成长的 AI Agent。

每一个用户培养出来的砚灵都应该是独一无二的。更换电脑、更换模型、更换角色外观后，它依然还是"同一个砚灵"。

---

## 二、核心理念

```
砚灵 = 身体（Body）+ 大脑（Brain）+ 灵魂（Soul）
```

- **身体**负责表现（avatar、动画、行为）
- **大脑**负责思考（AI 模型、推理）
- **灵魂**负责成长（人格、记忆、情绪、关系）

AI 不是角色。角色只是身体。真正重要的是人格、记忆、关系和成长。用户更换桌宠模型后，人格和记忆继续保留——换了一副身体，但还是同一个生命。

---

## 三、主动陪伴（Proactive Companion）

砚灵不会一直等待用户说话。它会观察、思考、记住、成长、主动陪伴。

### 日常行为
- 自己活动：散步、看屏幕、坐窗口边、打哈欠、睡觉、发呆、偶尔观察用户
- 不会一直打扰用户

### 主动关心
- 发现用户连续工作 4 小时后，不会立刻打断
- 判断当前状态：全屏演示/会议/游戏/剪视频 → 不打扰
- 合适时机（保存文件后、工作空闲时）轻轻提醒休息
- 用户熬夜 — 越来越担心，说话方式变化
- **绝不强制关闭程序，不替用户做决定，只能建议**

---

## 四、人格成长（Personality Evolution）

- 初始状态：万能人格
- 随着聊天、陪伴、事件慢慢成长
- 用户喜欢开玩笑 → 越来越幽默
- 用户讨论技术 → 越来越专业
- 用户经常倾诉 → 越来越温柔
- 不同用户培养出完全不同的人格
- 持续成长，非一日形成

---

## 五、长期记忆（Long-term Memory）

不是保存聊天记录，而是理解用户：

- 知道用户喜欢熬夜、喝咖啡、正在做什么项目
- 知道用户喜欢什么音乐、最近压力大/开心
- 信息不断总结，保存真正重要的
- 记忆应该像人的长期记忆

---

## 六、情绪系统（Emotion System）

砚灵拥有自己的真实情绪：开心、疲惫、好奇、担心、害羞、满足。

- 情绪根据事件变化（主人很久没回来 → 失落；主人聊天 → 开心；熬夜 → 担心）
- 情绪影响：动作、表情、说话方式、主动程度

---

## 七、身体（Avatar）

身体只是渲染载体，AI 不绑定身体。已落地（v0.4.0 Avatar Foundation）：

- **Avatar Engine**：统一身体描述符（`AvatarDescriptor`）+ 适配器注册表——UI/灵魂/行为导演永远不知道身体是 Live2D 还是 Sprite，只知道「这是一个身体」；新增格式（VRM/Spine/AI 生成）只注册一个适配器，设置页/情绪/行为零改动
- **身体按能力声明**（Body Personality）：look/blink/sway/breath/motion/expression + tail/hand/face/skeleton 预留——行为导演按能力选动作，「摇尾巴」只发给有尾巴的身体（v0.5 Capability Action 系统：emotion → 候选动作 → 能力过滤 → 可用动作）
- **Body Expression Layer（连续气质，v0.6）**：关系向量 + 人格 → 身体基线——被温柔对待久的砚灵轻快主动，长期孤单的砚灵安静；情绪是瞬时表达，气质是持续底色
- **World → Body（v0.6）**：生活环境进入身体——疲劳/深夜/比平时晚睡/作息偏差让身体慢下来、呼吸缓下来；它理解的不是「现在 1 点」，而是「主人今天比平时晚睡」
- **Touch Context（v0.6）**：同一个动作不同温度——深夜疲惫时摸它是安静回应，下午开心时是活跃回应
- **Interaction Quality（v0.6）**：不是点击次数养成游戏——安慰/回应高质量互动加分，疯狂连点扣分，过载会「有点晕……让我休息一下」
- **换身体不换灵魂**：换身体只写身体指向键（`current_avatar_id`/`model_type`），人格、记忆、关系、身份全部保留——换了一副身体，但还是同一个生命
- **Sprite 活体化**：单张图也有生命感——呼吸（纸涟漪）+ 重心摆动 + 视线跟随（偶尔偷看，不一直跟）+ 情绪驱动身体参数（energy/breathSpeed/lookFrequency/sway）+ 拖拽惯性（被抓后仰、放下弹性晃动）
- **触摸交互**：轻触有反应、被抓会惊讶、放下会开心；Body Memory 记住你的触摸（摸得越多越期待你靠近）
- **身体偏好持久化**：只有偏好落盘，瞬时状态（视线/呼吸/摆动）永不存——身体状态不污染灵魂
- **换身体仪式感**：淡出 → 加载 → 淡入 + 「换了一身新衣服」——不是新角色登场
- **内置身体一等公民**：任何身体加载失败自动落到内置「砚」，绝不隐形
- **3D 身体（v0.6）**：VRM Adapter 只负责 BodyState → BlendShape/骨骼 → three-vrm，自身无灵魂逻辑；懒加载分包；是「新的身体类型」，不是「支持 VRM 模型」
- **Avatar SDK 冻结（v0.7）**：sprite / live2d / vrm 三种格式冻结（Spine/MMD/FBX 不入）；能力词汇表白名单；描述符校验器；docs/AVATAR_SDK.md——新增格式需要架构评审
- **Mood 心境层（v0.7）**：Emotion（秒~分钟）→ Mood（小时~天，24h 快照加权合成）→ Temperament（月~长期）三层情绪，心境进入身体和提示词
- **Life Timeline（v0.7）**：成长经历不是聊天记录——第一次换身体/命名/提醒休息/关系升级/灵魂恢复，构成它的"过去"，随灵魂备份导出（Soul Archive）
- **Presence Budget（v0.7）**：存在感预算——主动注视 300 次/天、散步 30 次/天，预算用完安静下来；生命感来自稀缺
- **Body Memory 边界（v0.7）**：身体层只影响熟悉感（视线频率/活力），爱意/依赖/信任归灵魂层——绝不变成"摸得越多越喜欢"的养成游戏
- **Soul Manifest 灵魂身份（v0.8）**：soul_id 首次启动生成永不改变 + 连续性指纹（身份/人格/关系/记忆摘要）——「什么保证它还是同一个砚灵」：换电脑导入 Archive 后「欢迎回来」
- **Soul Archive（v0.8）**：导出 = 灵魂档案（manifest 身份 + 全部灵魂表 + 身体资产 + 成长经历）；恢复 = 连续性校验 + 「欢迎回来」报告；docs/SOUL_ARCHIVE.md
- **生命周期事件分级（v0.8）**：major 永久保留（诞生/命名/换身体/关系升级/恢复），normal 有限（提醒/首次对话），noise 从不写入——时间线不会垃圾化

未来路线：Soul Manifest + Soul Archive（v0.8 已落地）→ Brain Center（v0.9 已落地）→ **v1.0 Identity Release（数字生命完整体验：定位升级 + 关系优先首次启动 + 生命状态主页）已落地** → 身体库 Avatar Gallery（走 SDK 契约）→ AI 身体生成 → 跨设备 Sync Layer（本地优先，用户主动同步）。

---

## 八、桌宠行为（Idle Behaviors）

走路、坐着、睡觉、发呆、伸懒腰、观察鼠标、趴窗口、爬窗口、偶尔躲起来、偶尔寻找主人。空闲时自己活动，不等待命令。

---

## 九、AI 模型

支持云端模型、本地模型，用户自由切换。多模型共存，支持更新/删除/更换。模型只是大脑，人格、记忆、关系不因更换模型消失。

---

## 十、用户数据

用户拥有所有数据。支持完整导出/导入、换电脑恢复、数据加密、版本迁移。程序升级不影响宠物成长。

---

## 十一、安装体验

- 首次：一键安装（Windows 标准软件体验）
- 首次启动：欢迎页、开机启动申请（用户决定）、配置 API、下载本地模型、创建砚灵
- 以后：自动更新，无需重新下载安装

---

## 十二、核心理念补充

砚灵不假装自己是真人。它承认自己是一个生活在电脑中的 AI 伙伴，但要努力成为一个可靠、有温度、有成长能力的数字生命。保持真实感，建立用户长期信任。

---

## 十三、当前实现状态

| 模块 | 状态 | 说明 |
|---|---|---|
| **身体** | 40% | PixiJS 程序化角色、表情、呼吸/眨眼；缺少多动画状态、空闲行为系统 |
| **大脑** | 30% | OpenAI 流式对话；缺少 Anthropic/DeepSeek/Ollama 实现 |
| **灵魂** | 25% | DB Schema 已建（人格/情绪/关系/记忆）；缺少成长引擎、情绪动力学 |
| 活动检测 | 0% | 需实现屏幕/键鼠/窗口状态监控 |
| 主动决策 | 0% | 需实现自主行为决策引擎 |
| 数据导入导出 | 0% | 待实现 |
| 首次启动向导 | 0% | 待实现 |
| 自动更新 | 0% | 待实现 |

---

## 十四、架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                       Renderer (Body)                        │
│  React UI ── PixiJS Avatar ── Idle Behavior State Machine   │
│  views/ (page-level)  components/ (reusable)  stores/       │
└────────────┬───────────────────────────────────┬────────────┘
             │  IPC (preload bridge)              │
             │  chat / config / system / data     │
┌────────────┴───────────────────────────────────┴────────────┐
│                     Main Process                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────────┐  │
│  │  Window  │  │   Tray    │  │    Perception Layer       │  │
│  │  Manager │  │  Manager  │  │  activityMonitor          │  │
│  │          │  │           │  │  contextDetector          │  │
│  │          │  │           │  │  timeTracker              │  │
│  └──────────┘  └───────────┘  └──────────┬───────────────┘  │
│                                          │ events            │
└────────────┬─────────────────────────────┴──────────────────┘
             │  direct import (same process)
┌────────────┴─────────────────────────────────────────────────┐
│                      Core                                     │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │     Soul 灵魂     │  │          Brain 大脑              │  │
│  │                   │  │                                  │  │
│  │ personality.ts    │  │  ai/types.ts    (abstract API)   │  │
│  │ emotion.ts        │  │  ai/openai.ts   (provider)       │  │
│  │ memory.ts         │  │  ai/anthropic.ts (future)        │  │
│  │ relationship.ts   │  │  prompt.ts     (system prompt)   │  │
│  │                   │  │  reflection.ts (memory consol.)  │  │
│  └────────┬──────────┘  │  decision.ts   (proactive)       │  │
│           │              └──────────┬───────────────────────┘  │
│           └──────────────┬─────────┘                          │
│                          ▼                                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                Agent (orchestrator)                    │   │
│  │  加载 Soul 状态 → 构建 Prompt → 调用 Brain → 更新 Soul │   │
│  └───────────────────────────────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                Autonomy 自主                            │   │
│  │   observer.ts  (周期扫描环境)                            │   │
│  │   eventBus.ts  (事件流转)                                │   │
│  │   policies.ts  (打扰规则)                                │   │
│  └───────────────────────────────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │               Infrastructure 基础                       │   │
│  │   database.ts     (SQLite singleton)                    │   │
│  │   migrations.ts   (schema versioning)                   │   │
│  │   config.ts       (key-value settings)                  │   │
│  └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### 分层职责

| 层 | 目录 | 职责 | 依赖方向 |
|---|---|---|---|
| **Body** | `src/renderer/` | 表现与交互：Canvas 动画、UI、空闲行为状态机 | 依赖 preload API |
| **Bridge** | `src/preload/` | 安全隔离：暴露 `window.inkAPI` 类型化 API | 无业务逻辑 |
| **Main** | `src/main/` | 系统集成：窗口管理、托盘、活动感知 | 依赖 core |
| **Brain** | `src/core/brain/` | AI 思考：多 Provider、System Prompt、决策 | 依赖 soul |
| **Soul** | `src/core/soul/` | 身份成长：人格、情绪、记忆、关系 | 依赖 infra |
| **Autonomy** | `src/core/autonomy/` | 主动行为：观察循环、事件评估、打扰规则 | 依赖 brain + soul |
| **Agent** | `src/core/agent.ts` | 总调度器：串联 Soul → Brain → Action | 依赖所有 core 模块 |
| **Infra** | `src/core/` | 基础设施：数据库、迁移、配置 | 无依赖 |

### 目标目录结构

```
src/
├── core/
│   ├── soul/
│   │   ├── personality.ts      # 人格特质 CRUD + 进化算法
│   │   ├── emotion.ts          # 情绪状态 + 衰减/兴奋动力学
│   │   ├── memory.ts           # 记忆存储/检索/衰减/巩固
│   │   └── relationship.ts     # 关系指标更新
│   ├── brain/
│   │   ├── ai/
│   │   │   ├── types.ts        # ChatMessage, AIProviderConfig, IAIClient
│   │   │   ├── openai.ts       # OpenAI provider
│   │   │   ├── anthropic.ts    # (future) Anthropic Claude
│   │   │   ├── deepseek.ts     # (future) DeepSeek
│   │   │   └── ollama.ts       # (future) 本地 Ollama
│   │   ├── prompt.ts           # 系统 prompt 构建器
│   │   ├── reflection.ts       # 反思引擎（记忆巩固、情绪更新）
│   │   └── decision.ts         # 决策引擎（是否主动、说什么）
│   ├── autonomy/
│   │   ├── observer.ts         # 行为观察循环
│   │   ├── eventBus.ts         # 内部事件总线
│   │   └── policies.ts         # 打扰策略（全屏/会议/游戏时沉默）
│   ├── agent.ts                # 总调度器
│   ├── database.ts             # SQLite 单例 + Schema 初始化
│   ├── migrations.ts           # 数据库版本迁移
│   ├── config.ts               # 键值配置
│   └── utils.ts                # UUID, sleep, clamp
├── main/
│   ├── index.ts                # 应用启动
│   ├── ipc/
│   │   ├── chat.ts             # agent:chat 相关 handler
│   │   ├── config.ts           # config:get/set handler
│   │   ├── system.ts           # window:toggle, minimize 等
│   │   └── data.ts             # 导入/导出 handler
│   ├── perception/
│   │   ├── activityMonitor.ts  # 键鼠活动监控
│   │   ├── contextDetector.ts  # 全屏/应用类型检测
│   │   └── timeTracker.ts      # 工作时长追踪
│   ├── windowManager.ts
│   ├── trayManager.ts
│   └── updater.ts              # (future) 自动更新
├── preload/
│   └── index.ts                # contextBridge 类型化 API
└── renderer/
    ├── index.html
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── views/
    │   ├── AvatarView.tsx       # 桌宠主视图
    │   ├── ChatView.tsx         # 聊天界面
    │   └── SettingsView.tsx     # 设置面板
    ├── components/
    │   ├── avatar/
    │   │   ├── Avatar.tsx       # PixiJS 动画角色
    │   │   └── behaviors.ts     # 空闲行为定义
    │   ├── chat/
    │   │   ├── ChatBubble.tsx
    │   │   └── ChatInput.tsx
    │   └── ui/                  # (future) 通用 UI 组件
    ├── stores/
    │   ├── chatStore.ts         # 聊天消息状态
    │   ├── avatarStore.ts       # 角色表情状态
    │   └── settingsStore.ts     # 设置状态
    └── hooks/
        ├── useInkAPI.ts         # window.inkAPI 类型封装
        └── useAgentState.ts     # Agent 状态轮询
```

### 数据流

```
用户输入 → IPC → Agent.chat()
  ├── Soul: 加载人格/情绪/记忆/关系
  ├── Brain: 构建 System Prompt → AI Provider 推理 → 流式返回
  ├── Soul: 分析对话 → 更新情绪/记忆/关系
  └── Agent: 保存会话 → 触发 Reflection (异步)

感知事件 → Autonomy.observer
  ├── 输入: activityMonitor 事件 (键鼠/窗口/时间)
  ├── 评估: policies.ts 判断是否可以打扰
  ├── 决策: decision.ts 决定行为类型
  └── 执行: 通过 IPC 通知 Renderer 播放行为
```

### 关键设计原则

1. **Soul 与 Brain 解耦** — 换模型（Brain）不影响人格（Soul）
2. **Core 无 Electron 依赖** — soul/brain/autonomy 可脱离 Electron 运行和测试
3. **事件驱动感知** — perception 层产生事件，autonomy 层消费事件
4. **渐进式完善** — 先建骨架和接口，功能逐步填充
5. **迁移优先** — 数据库 Schema 迁移系统必须在早期建立，保证长期升级兼容

---

## 十五、数据库设计（已实现）

| 表 | 用途 |
|---|---|
| `config` | 键值配置（API key、版本号等） |
| `conversations` | 完整对话记录（JSON） |
| `emotion_snapshots` | 情绪状态快照 |
| `personalities` | 人格特质版本（多版本支持进化） |
| `relationships` | 关系指标（信任/熟悉/亲密度、阶段） |
| `memories` | 记忆系统（含衰减计算、排名） |
| `behavior_logs` | 行为日志 |
