# 砚灵架构审计报告

> 审计日期：2026-08-01
> 范围：src/core（世界/灵魂/自主/大脑/安全/成本）、src/main（进程编排/感知/守护）、src/preload（IPC）、src/renderer（表现层）
> 方法：依赖图静态分析 + 数据流追踪 + 行为出口盘点 + 持久化边界检查
> 结论：**无 Critical 问题**，循环依赖为零；存在 2 项 High、7 项 Medium、6 项 Low 技术债。

---

## 1. 完整技术架构图

```
┌─ Renderer 进程（表现层，无业务逻辑）─────────────────────────┐
│  PixiJS / Live2D 渲染 ← pet:behavior/expression/thought/speak │
│  chatStore / avatarStore（纯 UI 状态，无灵魂副本）             │
└──────────────────────────────┬─────────────────────────────┘
                               │ IPC (preload 白名单)
┌─ Main 进程（编排层）────────────────────────────────────────┐
│  ipc/chat.ts → cost/router(路由+预算) → Agent.chat           │
│                                                             │
│  startPerception(10s)  startSceneWatcher(90s)  startGuardian(30s)│
│  startWorldSensor(30s)  startPatternRecording(60s)          │
│  startHeartbeat(8-12s)  startMoodSync(15s)  startMemoryMaintenance(1h)│
│  actOn()  ←── 唯一行为执行器                                 │
└──────────────┬─────────────────────────────────────────────┘
┌─ Core（纯领域层，无 electron 依赖的纯函数模块可单测）──────────┐
│  world/     scene → situation(纯) → patterns(纯) → sensor    │
│  soul/      personality / emotion / relationship(+Events 纯) │
│             memory（DB）                                     │
│  autonomy/  drives(状态) → behaviorDirector(纯五层管线)       │
│  brain/     ai providers / prompt / reflection(启发式)       │
│  safety/ cost/ config/ database/ secureStore                 │
└─────────────────────────────────────────────────────────────┘
```

进程边界正确：**renderer 不 import core**（零跨层依赖），数据库仅 main 进程访问（better-sqlite3 同步、WAL），AI 网络请求在 main，不阻塞渲染。

## 2. 核心数据流

**对话链路（用户主动）：**
```
renderer 输入 → preload → ipc/chat.ts（路由/预算/缓存判断）
  → agent.streamWith → classifyInteraction → recordRelationshipEvent(关系)
  → sentiment → emotion 更新 / tryEvolvePersonality(人格)
  → buildAgentContext(人格+情绪+关系stage+世界感知行) → LLM 流式回复
  → analyzeConversationForMemories / trySemanticMemory(记忆)
  → 保存对话 → recordUsage(成本)
```

**自主链路（砚灵主动）：**
```
heartbeat(8-12s)
  → drives.tick()（驱动动力学，仅状态）
  → buildDirectorInput（situation + relationship + personality + emotion + 预算 + flags）
  → decide()（Gate→Situation→Soul→Relationship→Selection，纯函数）
  → actOn()（emit 到 renderer + behavior_logs 记录 reason）
```

**记忆反馈环：**
```
回忆(recollect 动作 / 对话提及) → 质量门槛(shouldRewardRecall)
  → recallEvent(success/confirmed/wrong) → recordRelationshipEvent → 维度变化
纠正 → correction 事件(understanding−) → 记忆窗口(6h) → 语义记忆落库 → 理解回升(+0.35)
```

## 3. 模块依赖关系

依赖方向全部单向（82 条边，逐条核对）：

```
agent → {brain, soul, world, safety, cost, config, secureStore, database}   （编排者，无人反向依赖）
autonomy → {world/situation, soul/emotion|relationshipEvents|personality, drives}
soul/relationship → soul/relationshipEvents（单向）
world/situation → world/{patterns,scene}（单向）
brain/ai/anthropic → brain/ai/types（单向）
main → core（单向，唯一方向）
```

- **循环依赖：0**（`brain/ai/types` 无任何 import；soul 内无互引；类型导入全部单向）
- **反向依赖：0**
- **模块间越权写状态：0**（emotion/relationship/personality/memory 的表各自由其 soul 模块独占写入）

## 4. 灵魂数据归属

| 数据 | 归属 | 状态 |
| --- | --- | --- |
| 人格 | `soul/personality.ts`（版本化快照 + 进化曲线） | ✅ 正确 |
| 情绪 | `soul/emotion.ts`（20 情绪 + 快照持久化） | ✅ 正确 |
| 关系 | `soul/relationship.ts`(DB) + `relationshipEvents.ts`(纯引擎) | ✅ 正确 |
| 记忆 | `soul/memory.ts`（存储/检索/衰减/召回/反馈） | ✅ 正确 |
| 世界状态 | `core/world/`（内存态，不落库） | ✅ 正确（短期状态不混入长期） |
| 对话历史 | agent 私有（聊天域自持，30 条界内） | ✅ 可接受 |
| 身份 | **无显式实体**——identity 隐含为 userData 下的 DB 文件 + pet_name 配置 | ⚠️ 隐式成立，无身份版本号，跨设备无故事 |

**身份结论**：换模型（DeepSeek→Claude）后人格/情绪/关系/记忆全保留 ✅；换 Avatar 后灵魂全保留 ✅；备份导出/导入存在且重置缓存 ✅。但"同一个砚灵"没有显式身份记录（无 id/诞生时间/代数），未来做多设备或迁移时缺锚点。

## 5. AI 调用边界

LLM 调用点共 6 处，全部在边界内：

| 调用点 | 用途 | 判定 |
| --- | --- | --- |
| agent.streamWith | 对话生成 | ✅ 允许 |
| agent.trySemanticMemory | 记忆提炼 | ✅ 允许 |
| soul/mode.decideMode | 模式判定（陪伴/专业） | ✅ 复杂理解 |
| safety/policy.detectUnsafe | 安全审查 | ✅ 允许 |
| brain/reflection.ts | **纯启发式，无 LLM** | ✅ 更优 |
| openai/anthropic provider | 传输层 | ✅ |

**禁止域全部干净**：行为选择、情绪计算、世界状态判断、关系数值修改——全部本地确定性规则，零 LLM。世界模型零 AI 成本 ✓。

## 6. BehaviorDirector 是否唯一行为出口

**自主说话出口盘点：**

| 出口 | 是否经过 Director | 判定 |
| --- | --- | --- |
| actOn(action) 全部 4 通道 | ✅ | 唯一正规出口 |
| maybeHangOnWindow 内 sit/thought | ✅（导演选中后执行） | 执行细节，OK |
| **guardian.remind() 直接 speak** | ❌ | 绕过（streak 强制提醒，预算外第二说话源） |
| **startMoodSync STAGE_UP_MESSAGES speak** | ❌ | 绕过（stage 升级台词，预算外） |
| emitIdleBehavior 动画兜底 | ⚠️ 动画级 | 非说话，但为第二行为源（无 reason 日志） |
| 对话回复（用户主动） | N/A | 非自主，正确 |

结论：说话类自主行为 3 个出口（Director + Guardian + MoodSync）。Director 是主出口且带预算+reason，两个旁路均为低频、固定文案、有意保留，但违反"唯一出口"原则，应登记或收编。

## 7. 数据库表结构与迁移历史

迁移链：v1 initial → v2 seed → v3 daily_patterns → v4 relationship_v2（`LATEST=4`）

| 表 | 内容 | 生命周期 | 审计 |
| --- | --- | --- | --- |
| conversations | 对话原文(messages_json) | 保留 10 条最近会话 × 30 条 | ⚠️ 用户全文本地留存（有界） |
| emotion_snapshots | 情绪快照全文 | 7 天滚动清理 | ✅ |
| personalities | 人格版本快照 | 永久累积（每次进化一条） | ✅ 天然历史 |
| relationships | 关系向量单行 | 常驻 | ✅ |
| memories | 记忆（tier 短期/长期分层） | 衰减/巩固/清理 | ✅ 设计正确 |
| behavior_logs | 行为+reason | 500 条滚动 | ✅ 可回放 |
| daily_patterns | (date,hour_bucket,minutes) 聚合 | 21 天清理 | ✅ 隐私合规 |

**短期/长期分离正确**：situation/情绪瞬时态不进 memories；memories 无环境/场景字段；情绪有独立快照表。✅

**缺失**：`related_memory_ids` 列从未被写入（dead schema，Low）；无关系事件审计表（关系变化不可回放，High）。

## 8. 长时间运行稳定性

| 风险点 | 分析 | 等级 |
| --- | --- | --- |
| 心跳定时器 | 8 个 setInterval 全部固定间隔，无泄漏增长 | ✅ |
| 会话历史 | 内存 50 条 + DB 30 条双界 | ✅ |
| 情绪/人格/关系缓存 | 5s TTL + 失效策略 | ✅ |
| 对话缓存 | MAX_ENTRIES=50 淘汰 | ✅ |
| AI 请求 | main 进程 node-fetch，renderer 独立进程不受阻 | ✅ |
| 数据库写入频率 | 情绪 5min 节流、patterns 1/min、日志按行为 | ✅ |
| getMemorableMemory | **每次 heartbeat（~8s）SQL 随机查询**，非必需 | Low |
| windowScanner | 每次 spawn PowerShell（90s 间隔）；无 in-flight 防重入保护（execFile 4s 超时兜底，重叠窗口 ≤4s） | Low |
| 崩溃恢复 | uncaughtException 落盘日志 + before-quit flush 情绪 | ✅ |

## 9. 隐私

| 数据 | 状态 |
| --- | --- |
| 窗口标题 | 仅内存关键词分类，**永不落盘** ✅ |
| 屏幕截图 | 无 ✅ |
| API Key | secureStore 加密 + 明文迁移脚本 ✅ |
| 用户输入全文 | conversations 表本地留存（有界 10×30 条），无任何网络外发 ✅/⚠️ |
| 行为日志 | 含自主说话文案，本地 500 条滚动 ✅ |
| 节奏模型 | 纯聚合分钟数 ✅ |
| 遥测/上报 | **零**（仅 electron-updater 检查更新，autoDownload=false）✅ |

符合"用户拥有数据"理念：全部本地，可导出可清空（chat:clear / data:export）。

## 10. 技术债列表（按严重程度）

> 状态：✅ 已修复（Life Core Stabilization Phase A）｜⬜ 待处理

### High

**H1. 人格进化无来源记录** — ✅ 已修复
`personality.ts:90` tryEvolvePersonality 只存 traits+版本，不记录"为什么变"。现已：
- 新增 `personality_evolution_log` 表（migration v5）：每条 trait 变化一行（before/after/delta/reason/source/version）
- 纯函数 `computeEvolutionLogEntries()`（可单测）+ `getPersonalityEvolutionHistory(trait)` 查询
- 三个进化触发点全部带原因：善意/敌意驱动（agent.ts）+ 对话风格驱动（reflection.ts）

**H2. 关系事件无审计日志** — ✅ 已修复
新增 `relationship_change_log` 表（migration v5）+ 纯函数 `computeChangeEntry()`：
- 每次 `recordRelationshipEvent` 落一条（event/intensity/source/metadata + before/after/affected + weights_version）
- 记忆反馈闭环（acknowledgeMemoryFeedback）同样可回放
- `getRelationshipEventLog()` 支持诊断"亲密为什么掉了"；表按 1 万条滚动
- 权重表版本号 `WEIGHTS_VERSION` 保证未来调权重后回放语义正确

### Medium

**M1. 对话缓存命中绕过整个灵魂管道** — ✅ 已修复
`ipc/chat.ts` cache hit 现在先跑 `agent.runPipeline()`（与正常聊天完全同一条灵魂管道：安全/命名/情绪/关系/人格进化/回忆反馈/模式判定），再做三件事之一：
- 短路（拒绝/起名/冷处理）→ 转交 agent 重新处理
- 正常 → 返回缓存文本 + `agent.recordExchange()` 落会话历史与用量
**原则落地：缓存回答，不缓存经历。** 相同消息 10 分钟内重复发送，灵魂照样感知。

**M2. guardian.remind 绕过 Director 与预算** — ✅ 已修复（Phase B）
Guardian 保留独立检测逻辑（系统级健康信号，非人格行为），但不再直接说话：
- 纯逻辑下沉 `core/safety/guardian.ts`（`checkGuardian()` 纯函数，可单测：触发/冷却/DND/离开/关闭）
- 输出改为 `GuardianSignal` → Director 的 `guardian_remind` 意图（care，走预算，DND 被 gate 拦截）
- `main/guardian/guardian.ts` 只剩 electron 薄壳（pollGuardian），由 heartbeat 轮询

**M3. startMoodSync 的 stage 升级台词绕过 Director** — ✅ 已修复（Phase B）
stage 变化不再直接说话：`Relationship → stage 变化检测(main) → flags.stageGrowTo → stage_grow 意图(预算豁免) → Director → 表达`。DND 中挂起等待，解除后表达。

**M7. emitIdleBehavior 为第二行为出口（动画级）** — ✅ 已修复（Phase B）
边界正式化：`core/autonomy/bodyLoop.ts` 纯函数（`pickIdleAnimation`/`pickAmbientThought`）只产身体循环动画与氛围独白（呼吸/眨眼/坐姿/发呆——用户感知不到"主动决定"），零说话。所有可感知的主动行为（靠近/观察/寻找）全在 Director。

**行为出口图（Phase B 完成后）：**

```
                    Guardian 检测(独立逻辑)
                          │ GuardianSignal
                          ▼
 Relationship stage 变化 ──┤
                          │ stageGrowTo
  世界模型/驱动/仪式/回忆 ──┤
                          ▼
                    BehaviorDirector.decide()
                          │
                          ▼
                       actOn() ── pet:speak（唯一说话出口）
                          │
                          ▼
                       Avatar
                          ▲
        Avatar Life Loop（bodyLoop：动画+氛围独白，非决定）
```

**M4. main 持有 memory 域清理逻辑** — ⬜ 待处理（Phase C：下沉 soul/memory.ts）
**M5. 无身份实体** — ⬜ 待处理（Phase C：Identity 表）
**M6. prompt 的 currentTime 参数未被使用** — ⬜ 待处理（Phase C）

### Low

**L1.** `related_memory_ids` 列从未写入（dead schema，或实现记忆关联）
**L2.** `getMemorableMemory()` 每心跳 SQL 查询，可缓存 30-60s
**L3.** windowScanner 无 in-flight 防重入（当前 4s 超时兜底可接受）
**L4.** renderer 可经 IPC setConfig 任意 key（本地可信内容，风险极低；建议 key 白名单）
**L5.** `emotion_snapshots` 用 id 作主键但每次写新行（7 天清理兜底，可改 upsert）
**L6.** ipc/data.ts 用 `${table}` 拼接导出查询（表名来自白名单，无注入面，仍建议显式枚举）

---

## 审计结论

1. **根基健康**：无循环依赖、无越权写、AI 边界干净、短期/长期状态分离正确、世界模型零 AI 成本、隐私合规。P1-P3 的"纯函数 + 单出口"纪律有效落地。
2. **两类系统性缺口**：(a) **可追溯性**——人格进化、关系变化都没有源头记录，这是"长期生命"产品的叙事债；(b) **出口唯一性**——两个说话旁路（Guardian/MoodSync）应登记或收编。
3. **下一步建议顺序**：先清 H1/H2（补事件溯源），再收 M1-M3（出口与感知一致性），M4-M6 随手修，L 级随迭代消化。之后进入生命感打磨（时机自然度/情绪表达/动作同步/成长曲线）会站在干净的地基上。
