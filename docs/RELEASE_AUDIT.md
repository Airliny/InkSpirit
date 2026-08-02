# Release Candidate 审计清单（v0.9.1-preview）

v1.0 前的稳定性验证。每项标注：✅ 已代码验证 / ⚠️ 需真机测试 / ❌ 未通过（已修）。

## 第一阶段：代码级稳定性审计

### 启动链 ✅

| 场景 | 结果 |
|---|---|
| 数据库损坏启动 | ✅ Recovery Mode：原生对话框提示 + 备份损坏文件（不删除）+ 修复重启，绝不静默退出 |
| migration 中断恢复 | ✅ 事务化迁移：中断回滚，下次启动重跑（幂等，测试锁定） |
| v0.3 用户升级 v1.0 | ✅ 迁移链 v1→v8 顺序执行；老配置（model_type/sprite_*）推导当前身体，不丢 |
| 空数据库首次启动 | ✅ 自动建表 → wizard 先建立关系（你好我是砚灵→身体可选→大脑以后再定） |
| 双开 | ✅ **新增单实例锁**：第二次启动聚焦已有窗口，绝不出现两个砚灵 |
| 渲染进程崩溃 | ✅ **新增自动重载**：render-process-gone → 重载（2 分钟内最多 3 次，防崩溃循环） |
| 静默后台进程 | ✅ uncaughtException/unhandledRejection 写日志；启动失败必弹窗或退出 |

### 灵魂数据安全 ✅

| 场景 | 锁定方式 |
|---|---|
| 换大脑（GPT→DeepSeek→Ollama→Custom） | ✅ agentSwitch.test.ts：人格/关系/记忆/身份分毫不动 |
| 换身体（Sprite→Live2D→VRM） | ✅ bodies.test.ts：只写 current_avatar_id/model_type |
| Soul Archive 恢复 | ✅ 原子替换 + checksum + 连续性校验（soul_id + 指纹）→「欢迎回来」 |
| Body Memory 越界 | ✅ 只写 body_touch_quality，测试断言不碰灵魂键 |
| 记忆纠正 | ✅ **新增**：被说"不对/记错了"的记忆 importance 减半 + corrected 标记，提示词摘要过滤——不再被反复提起 |

### 模型加载回退 ✅（代码验证）

- 损坏 .vrm / .model3.json / 损坏 PNG / 路径不存在 → 内置「砚」兜底（BodyAvatar onLoadError / Avatar onError）
- 本地协议 local:// 缺失文件 → fetch 失败 → 图片错误 → 砚兜底，绝不空白窗口

## 第二阶段：用户操作流程（⚠️ 需真实用户）

- 第一次启动：30 秒内应理解「这是桌宠、可以聊天、属于自己」——界面无 API/Provider/Token/Model 字样（wizard 已重构，需真人验证）
- 第一次聊天：气泡 / 桌宠动作 / 输入框 / 流式回复 / 滚动到底部
- 设置往返：窗口位置 / 聊天滚动恢复 / 桌宠继续运行

## 第三阶段：高风险 Bug 区

| 区域 | 状态 |
|---|---|
| Electron 生命周期（最小化/睡眠唤醒/多显示器/DPI 125%/150%） | ⚠️ 需真机：Windows 睡眠唤醒后 GPU 恢复（Sprite/Live2D 有 webglcontextlost 处理，VRM 已加监听） |
| AI 请求异常（断网/超时 5s/30s/60s） | ✅ 代码验证：withTimeout + 云端失败降级本地 + 人话错误 + thinking 超时恢复，绝不永久转圈 |
| 模型加载（错误文件） | ✅ 见第一阶段 |

## 第四阶段：体验

| 项 | 状态 |
|---|---|
| 桌宠是否太吵（1 小时连续使用） | ⚠️ 需真人：反打扰预算 + Presence Budget（注视 300/散步 30）+ guardian 冷却已三重限频 |
| 情绪是否突兀（"今天好累"→不要马上开心跳舞） | ⚠️ 需真人调参：情绪映射 + 世界疲劳调制已存在，dominant 判定阈值需真实反馈 |
| 记忆是否尴尬（"不对，我没说过"） | ✅ 本轮修复：关系层 correction + 记忆层削弱 + 摘要过滤 |

## 第五阶段：性能目标（⚠️ 需 24h 实测）

| 指标 | 目标 |
|---|---|
| 闲置 CPU | < 3%（Sprite 纸涟漪 GPU、Live2D/VRM 懒加载、隐藏时 rAF 暂停已实现） |
| 内存 | 无持续增长（情绪快照 7 天上限、对话 10 条、行为日志 500、成长经历分级清理） |
| GPU | Sprite / Live2D / VRM 分别实测 |

## 已知问题（发布时声明）

- VRM 兼容性因模型而异（BlendShape 命名/骨骼结构差异）
- 部分第三方 Live2D 模型可能不响应情绪动作切换
- 错误记忆削弱依赖"回忆-确认"窗口（awaitingRecallConfirmation），主动闲聊中纠正不触发削弱
