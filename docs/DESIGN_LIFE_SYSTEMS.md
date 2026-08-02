# 砚灵生命感增强系统 — 设计文档

> 本文档定义下一阶段的三大核心系统，用于回答一个问题：
> **砚灵如何从「会动的桌宠」变成「住在桌面里的 AI 伙伴」。**
>
> 对应代码现状：`src/main/perception/`（原始感知）、`src/core/soul/`（灵魂）、
> `src/core/autonomy/drives.ts`（驱动）、`src/main/index.ts`（行为执行，当前行为逻辑散落于此）。

---

## 0. 现状诊断（为什么需要这三个系统）

| 现有能力 | 缺什么 |
| --- | --- |
| 场景识别（meeting/game/video/code） | 只输出"是否勿扰"，不推断**用户状态**（疲劳？深度专注？） |
| 驱动系统（6 drives → 最强触发） | 单驱动竞争，无情境输入，行为像"随机卖萌" |
| 关系（trust/familiarity/affection + stage） | 等级制视角，维度不够；互动只计数、不分类 |
| 主动行为（greet/ritual/hang/recollect） | 散落在 main 里各自掷骰子，无统一决策、无预算控制 |

**目标**：感知 → 理解 → 决策 → 执行 一条完整的生命回路，且每一步可追溯。

---

## 1. 世界模型（World Model / Situation Understanding）

> 让砚灵从「知道电脑发生了什么」升级为「理解用户当前状态」。
> 核心原则：**全部本地启发式推断，零 AI 调用，零内容留存。**

### 1.1 输入（复用现有感知）

| 信号 | 来源 | 频率 |
| --- | --- | --- |
| 前台窗口标题 / 场景分类 | `perception/sceneDetector.ts` + `windowScanner.ts` | 90s |
| 系统空闲时间 | `powerMonitor`（main heartbeat） | 10s |
| 连续工作分钟数 | `perception/timeTracker.ts` + Guardian streak | 30s |
| 当前时间 / 星期 | `Date` | 实时 |

### 1.2 输出：SituationSnapshot（versioned）

```ts
// src/core/world/situation.ts — 已实现
export interface SituationSnapshot {
  version: 1                    // 结构变更时升级，消费方按版本迁移
  timestamp: number
  scene: ForegroundScene
  userState: UserState          // away/deep_work/active_light/playing/meeting/fatigued/recovering
  fatigue: number               // 0-1，疲劳度推断
  focusDepth: number            // 0-1，专注深度
  hourContext: HourContext
  streakMin: number             // 当前连续工作分钟数
  idleMs: number
  inferredNeed: string | null   // 简短自然语言结论（prompt 用）
  patterns: SituationPatterns | null  // 见 1.3，只含聚合统计
}

export type SituationPatterns = {
  sleepLate: boolean
  unusualSchedule: boolean
  busyDeviation: number
  quietDeviation: number
}
```

### 1.3 推断规则（纯函数，可单测）

**疲劳度 `fatigue`（0-1）**：多信号加权，取最高分项不叠加以免失控

- 深夜（22:00–6:00）活跃 → +0.6
- 连续工作 > 2h → +0.4；> 4h → +0.8
- 比个人基线晚睡超过 2h（`daily_patterns` 比对）→ +0.3

**专注深度 `focusDepth`**：连续工作时长 ×（场景为 code/work 时 ×1.2）÷ 疲劳抑制

**userState 判定顺序**（优先级从高到低）：

```
meeting → playing → away(>2min) → fatigued → deep_work → recovering → active_light
```

**个人节奏 `daily_patterns`**：新表，按 `(日期, 小时桶)` 累计活跃分钟数。
维护 14 天滚动基线。`patternContext` 只回答：
"今天是否比平时晚睡 / 比平时活跃 / 比平时安静"——不保存任何窗口标题或内容。

### 1.4 消费方

1. **行为导演**（第 3 节）：`fatigue` / `userState` / `hourContext` 直接参与决策。
2. **对话上下文**：`buildSystemPrompt` 增加一行世界感知（token 极省）：
   ```
   世界感知：凌晨 1 点，你已连续工作约 3 小时，用户可能比较疲劳。
   ```
   聊天时砚灵能自然说出"你该休息了"而不再只是通用话术。

### 1.5 隐私边界

- 窗口标题仅用于场景关键词匹配，**不落盘、不进记忆、不进 prompt**。
- `daily_patterns` 只存 `(date, hour_bucket, active_minutes)` 聚合值。
- 所有推断在本地完成，可随时关闭（`world_enabled` 配置）。

---

## 2. 关系模型 v2（Relationship Model）

> 关系不是等级，而是多维状态。
> 一个用户天天聊天但不分享私事（熟悉度高、亲密低）；另一个聊天少但信任深。
> stage 只是多维关系的**投影**，用于叙事，不能作为唯一决策依据。

### 2.1 维度设计

| 维度 | 含义 | 增长来源 | 衰减/回落来源 |
| --- | --- | --- | --- |
| `trust` 信任（已有） | 是否值得托付 | 被善待、冲突后和解、分享私事 | 敌意互动、被忽视 |
| `familiarity` 熟悉（已有） | 相处频次 | 任何互动 | 长期离开 |
| `affection` 好感（已有） | 情感偏好 | 关怀、赞美、陪伴 | 冲突 |
| `intimacy` 亲密（新增） | 深入程度 | **私事分享**、脆弱时刻、情感表达 | 缓慢，几乎不落 |
| `dependency` 依赖（新增） | 被需要程度 | 用户依赖提醒/守护、回归频率 | 用户长时间忽视 |
| `understanding` 理解（新增） | 懂用户程度 | 记忆被正确引用、深度对话、陪伴观察 | 记忆错误/遗忘重要事 |

### 2.2 关键升级：Interaction Event 层（已实现）

现状 `recordInteraction()` 只 `+1`。升级为**事件分类驱动维度变化**——
互动次数不再直接影响关系，所有关系变化都来自事件：

```ts
// src/core/soul/relationshipEvents.ts（纯函数引擎，可单测）
export interface RelationshipEvent {
  type: 'daily_chat' | 'deep_share' | 'care' | 'conflict' | 'reconcile'
      | 'rely' | 'achievement' | 'correction'
  intensity: number        // 0-1，缩放效果
  timestamp: number
  source: 'conversation' | 'memory' | 'behavior'
  metadata?: Record<string, unknown>
}

// 配置驱动权重（默认值，可在 config 里 JSON 覆盖，调参不改代码）：
export const DEFAULT_EVENT_WEIGHTS = {
  daily_chat: { familiarity: 0.4, affection: 0.05 },
  deep_share: { intimacy: 0.8, understanding: 0.5, trust: 0.3, familiarity: 0.1 },
  care:       { affection: 0.7, intimacy: 0.3, trust: 0.2 },
  rely:       { trust: 0.6, dependency: 0.8, understanding: 0.2 },
  conflict:   { trust: -0.6, affection: -0.4, intimacy: -0.1 },
  reconcile:  { trust: 0.9, understanding: 0.7, affection: 0.3 },
  achievement:{ affection: 0.4, trust: 0.3, familiarity: 0.2 },
  correction: { understanding: -0.5 }
}
// 步长 = 权重 × 强度 × 0.05；正向趋近 1，负向乘法衰减（不过度惩罚）
```

分类链路：`agent.ts` 的 `analyzeSentiment` → `classifyInteraction(userMsg, sentiment)` →
`recordRelationshipEvent(event)`（优先级：纠正 > 道歉 > 冲突 > 深聊 > 依赖 > 成就 > 关心 > 日常）。

### 2.3 理解度 ↔ 记忆系统联动（已实现）

**闭环一：纠正 → 记忆 → 修复**
- `correction` 事件 → `understanding −`，同时打开一个 6 小时的记忆反馈窗口
- 窗口内语义记忆成功落库（`trySemanticMemory` → `acknowledgeMemoryFeedback`）→ `understanding +0.35` 回升
- 24 小时未反馈 → 窗口过期清除，不误奖励

**闭环二：回忆 → 关系（Memory → Recall → Relationship）**
- `startRecollection`（导演选中 recollect）或对话中提到记忆（"我记得你之前说…"）→ 打开确认窗口
- 回忆质量门槛：`shouldRewardRecall`（retention+importance ≥ 0.5 才奖励，防刷回忆）
- 事件权重（配置驱动）：
  - `memory_recall_success`：understanding 0.25 / trust 0.1（自然回忆被认可）
  - `memory_recall_confirmed`：understanding 0.35 / intimacy 0.15（用户明确确认，最高价值）
  - 确认权重 ≤ correction 修复增益（0.35）——"被纠正后改变"永远重于"记得一次"
- 错误回忆：零奖励，走 correction 流程（understanding −）
- 数据流严格单向：记忆系统产生 `recallEvent` → RelationshipEngine 消费，不直接改状态

### 2.4 stage 仅作展示投影（已实现）

`computeStage` 是多维关系的加权投影（trust 0.3 / familiarity 0.25 / intimacy 0.2 /
affection 0.15 / dependency 0.05 / understanding 0.05），**不参与任何 AI 决策**，
只用于 UI 展示、剧情描述、欢迎语气参考（prompt 里的关系描述、`STAGE_UP_MESSAGES`）。

### 2.5 迁移（已实现）

Migration v4：
- `relationships` 表新增 3 列：`intimacy REAL DEFAULT 0.05`、`dependency REAL DEFAULT 0.05`、`understanding REAL DEFAULT 0.1`。
- 老用户从 `affection` 派生初始 `intimacy = max(0.05, affection × 0.5)`。

---

## 3. 行为导演（Behavior Director）

> 现在：6 个驱动各自竞争，main 里 4 处独立掷骰子。
> 目标：**一个统一的决策层**，像导演一样看完整场戏再决定动作。
> 每个决策都必须能回答"为什么"，写入 `behavior_logs.reason`。

### 3.1 决策输入与输出（已实现）

```ts
// src/core/autonomy/ 五文件结构
//   behaviorTypes.ts     — BehaviorAction/BehaviorIntent/DirectorInput/GateResult
//   behaviorBudget.ts    — 反打扰预算状态机（rollover/spend）
//   behaviorScorer.ts    — Soul/Relationship 调制 + situation 修正 + interrupt cost
//   behaviorRules.ts     — 意图目录（situation/ritual/recollect/social/hang/drive）+ 关系感知消息
//   behaviorDirector.ts  — decide() 五层管线（纯函数，可注入 rng）

export interface DirectorInput {
  situation: SituationSnapshot | null
  relationship: RelationshipState     // 六维向量（P2）
  personality: PersonalityTraits
  emotion: EmotionState
  driveImpulse: BehaviorImpulse       // drives.tick() 的冲动，仅作为候选之一
  budget: BudgetState                 // decide() 说话时自动 spend
  flags: { returnedAfterMs, greetingDoneToday, nightDoneToday,
           recallableMemory, recollectSnippet, canHang }
}

export interface BehaviorAction {
  id: string            // 'welcome_home' | 'rest_support' | 'morning_greeting' …
  kind: BehaviorKind    // social | care | recollect | ritual | hang | watch | move …
  interruptLevel: 0|1|2|3
  urgency: number
  message? / thought? / behavior? / expression?
  reason: string        // 'ok → rest_support (score 0.68)'，写 behavior_logs
}
```

### 3.2 决策管线（分层，按序）

```
┌─ 0. Gate 层（安全，无条件优先）─────────────────────────┐
│   DND（会议/游戏/视频）→ 只允许安静动作                   │
│   用户离开 > 2min → 待机/趴窗，不说话                     │
│   冷却中 / 说话预算耗尽 → 降到 idle                      │
└──────────────────────────────────────────────────────┘
┌─ 1. Situation 层（世界模型 → 候选意图）─────────────────┐
│   fatigued        → remind（低强度，温柔）               │
│   深夜            → quiet/rest，禁用 play               │
│   用户回归         → react_return（关系决定亲密度）        │
│   deep_work       → watch / 极低频 remind               │
│   playing/meeting → 不产生社交意图                       │
│   recovering      → 安静陪伴，不提醒                     │
└──────────────────────────────────────────────────────┘
┌─ 2. Soul 层（情绪+驱动 → 加权）────────────────────────┐
│   驱动值作为基础权重；情绪修正（sad→social+，playful→move+）│
└──────────────────────────────────────────────────────┘
┌─ 3. Relationship 层（关系 → 调制频率与方式）────────────┐
│   intimacy 高 → 允许更深度的社交/回忆/贴近动作            │
│   dependency 高 → 更积极回应"被需要"                    │
│   trust 低 → 减少主动说话，更多安静观察                  │
│   stage 只用于筛选"允许说多亲密的台词"                   │
└──────────────────────────────────────────────────────┘
┌─ 4. Selection 层（加权采样 + 预算）─────────────────────┐
│   按权重随机 + 主意图保底（保证不长时间无事可做）          │
│   说话类动作共享全局预算（每小时 N 次，N ∝ proactiveness） │
│   输出 DirectedAction 及 reason                         │
└──────────────────────────────────────────────────────┘
```

### 3.3 与现有代码的衔接（已完成）

| 现在 | 之后 |
| --- | --- |
| `drives.tick()` 直接返回 impulse | `tick()` 只更新驱动；冲动降级为 Director 的候选之一 |
| `actOnImpulse()` + `emitIdleBehavior()` | 统一为 `actOn(action)`；idle 动画仅作无候选时的兜底 |
| `maybeProactiveAction()`（随机） | 并入 Director 的 socialize/watch 意图 |
| `maybeDailyRitual()` | 并入 ritual 意图（once-per-day 由 flags 控制） |
| `maybeHangOnWindow()` | hang 意图选中后执行（保留 5min 冷却 + 尺寸/全屏校验） |
| `startRecollection()`（独立定时器） | 并入 recollect 意图（3h 冷却由 flags 传入） |
| Guardian `remind()` | 保留独立（streak 驱动），rest_support 意图由情境驱动，两者互补 |

### 3.4 反打扰设计（已实现）

- **全局说话预算**：`maxHourly = 1 + round(proactiveness × 5)`（低主动 2 次/时，高主动 5 次/时）。
  只统计主动说话（interruptLevel ≥ 2），动画/思绪不占预算。
- **重要事件豁免**：welcome_home / morning_greeting / good_night 带 `budgetExempt`，可突破预算（长期未见回归必须欢迎）。
- **每类动作冷却**：recollect ≥ 3h、hang ≥ 5min、ritual 1 次/天。
- **DND 无条件优先**：Gate 层把 interruptLevel 压到 0（会议/游戏/离开），任何意图不得绕过。

### 3.5 追溯

每次决策写 `behavior_logs`：
```sql
INSERT INTO behavior_logs (id, behavior_id, triggered_by, outcome, timestamp)
VALUES (?, ?, 'director', ?, ?)
-- outcome = JSON { kind, urgency, reason, userState, fatigue, intimacy, ... }
```
开发期可据此回放"砚灵今天为什么这么做"。

---

## 4. 数据层变更汇总

Migration v3（一次性）：

```sql
ALTER TABLE relationships ADD COLUMN intimacy REAL NOT NULL DEFAULT 0.05;
ALTER TABLE relationships ADD COLUMN dependency REAL NOT NULL DEFAULT 0.05;
ALTER TABLE relationships ADD COLUMN understanding REAL NOT NULL DEFAULT 0.1;

CREATE TABLE IF NOT EXISTS daily_patterns (
  date TEXT NOT NULL,          -- 'YYYY-MM-DD'
  hour_bucket INTEGER NOT NULL,-- 0-23
  active_minutes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, hour_bucket)
);
```

`daily_patterns` 维护：写（每 5 分钟心跳汇总一次）、滚动清理（> 21 天删除）、基线 = 前 14 天同小时桶均值。

---

## 5. 对话上下文扩展（prompt 感知）

`PromptContext` 增加可选 `situation`：

```ts
situation?: string  // 如 "凌晨1点，已连续工作3小时，可能疲劳；今天比平时晚睡2小时"
```

token 预算 < 60 字，在 `buildSystemPrompt` 末尾拼接。
仅当 `situation.inferredNeed !== null` 时注入，避免日常无意义噪音。

---

## 6. 里程碑与验收标准

### P1 — 世界模型（核心：world/situation.ts + patterns + prompt 注入）✅ 已完成
- [x] `synthesizeSituation()` 纯函数 + 单元测试（疲劳/深夜/回归/恢复 各用例）
- [x] `daily_patterns` 写入与基线计算
- [x] main heartbeat 每 30s 合成并缓存 SituationSnapshot
- [x] `buildSystemPrompt` 注入世界感知行（≤60 字）

### P2 — 关系 v2（核心：relationshipEvents.ts 纯引擎 + relationship.ts 持久化）✅ 已完成
- [x] Migration v4（新库 + 老库升级，intimacy 从 affection 平滑派生）
- [x] `classifyInteraction()` 词表分类（8 类事件，优先级链）
- [x] `applyRelationshipEvent()` 配置驱动权重 & 维度上限封顶
- [x] 理解度 ↔ 记忆反馈闭环（correction → 记忆窗口 → understanding 回升）
- [x] `computeStage` 多维投影（仅展示，不参与决策）

### P3 — 行为导演（核心：autonomy/ 五文件 + main 收敛）✅ 已完成
- [x] `decide()` 纯函数五层管线：Gate → Situation → Soul → Relationship → Selection（可注入 rng 单测）
- [x] main heartbeat 收敛 proactive/ritual/hang/recollect 到 `actOn()`
- [x] 每个动作写 reason 日志（behavior_logs, triggered_by=director）
- [x] 反打扰预算可观测：maxHourly 随 proactiveness 变化，重要事件豁免

### 整体验收
- 连续 2h 深度工作 → 至多 1 次提醒，且 DND 期间 0 打扰 ✅
- 关系日志可回放：任意行为都能回答"为什么" ✅
- 所有规则本地确定性执行，无新增 AI 调用成本 ✅
- 记忆闭环：回忆成功/被确认 → understanding 成长；回忆错误 → 纠正流程 ✅

---

## 生命核心架构（最终形态）

```
              World Model (P1)
                  │
                  ↓
              Situation
                  │
    Memory ←→ Relationship ←→ Personality   (P2)
                  │
                  ↓
            Behavior Director (P3)
                  │
                  ↓
               Avatar
```

---

## 7. 设计原则（评审时对照）

1. **导演必须能解释自己** — 每个动作带 reason。
2. **预算优先于权值** — 再想做也不能打扰。
3. **DND 是硬门** — 不是软权重。
4. **世界模型零 AI 成本、零内容留存** — 全部本地启发式。
5. **stage 只是投影** — 决策永远看维度，不看标签。
6. **纯函数可测** — situation/director/classify 全部无副作用，main 只做执行。
