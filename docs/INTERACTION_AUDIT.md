# 砚灵交互与身体感审计报告（Interaction & Embodiment Audit）

> 审计日期：2026-08-02 ｜ 阶段：S2.5（Feature Freeze）
> 视角：用户会不会觉得砚灵"真的住在电脑里"。拖拽手感、窗口切换、动作反馈、响应延迟。
> 原则：身体反馈差 → "这只是一个程序"。只审计，不开发新功能。

---

## 结论先行

**身体感骨架是好的**：Shimeji 惯性物理（速度继承 + 摩擦 0.88 + 边缘反弹 0.6 能量损失）实现正确；拖拽跟手架构合理（IPC fire-and-forget，最后一次位置胜出，无积压）；DPI 两遍缩放正确；右键菜单打开时呼吸动画不冻结。**没有结构性问题，缺的是身体感的"反馈层"**——2 个 High 是窗口生命周期 bug，其余集中在"按下/松手/等待"这些瞬间没有身体回应。

---

## High — 用户日常会碰到

### H1. 最小化/返回宠物模式后位置不恢复 — ✅ 已修复
- **修复**：`src/core/windowState.ts`（纯逻辑状态机）：petPosition 与 panelPosition **独立保存**；pet→panel 记住宠物家，panel→pet 精确回家；多显示器按所在显示器 workArea 收敛；显示器被拔自动 clamp 不悬空
- **持久化**：`window_pet_position` 配置，重启后 `createMainWindow` 从持久化位置启动（不再默认右下角）
- **切换语义**：仅首次打开面板时 `center()`，之后面板回自己的位置，宠物永不移动
- **测试**：`windowState.test.ts` 6 用例——右下角往返、panel 位置独立记忆、副屏往返、重启恢复、拔屏 clamp、边界收敛

### H2. GPU 上下文丢失后永久黑屏（睡眠唤醒/驱动重置）— ✅ 已修复
- **修复**：`src/core/rendererLifecycle.ts`（纯状态机：running → suspended → running，重复事件去重，dispose 后全忽略）
- **Sprite**：`SpriteAnimCanvas` 重构为可重入 `buildGL()`——`webglcontextrestored` 后重建 context/program/texture/loop，旧资源清理防泄漏
- **Live2D**：`Live2DView` 监听同一对事件——lost 释放共享 app，restored 重新走加载管线（`gen` 触发重载）
- **不变式**：AI/行为/情绪/位置全部不受影响——只有身体重连
- **测试**：`rendererLifecycle.test.ts` 3 用例——lost→suspend→restored→重建、重复事件去重、dispose 后忽略

---

## Medium — 身体感反馈缺失

### M1. 抓取无身体反馈
- **位置**：`PetView.tsx` handleMouseDown（只有 `startWindowDrag()`）
- **现象**：按住砚灵 → 没有任何身体变化（无压缩/表情/挣扎），移动超过 5px 才开始动。用户感觉"拖一个文件"。
- **方向**：mousedown 立即给"被抓"视觉态（表情 surprised/被压扁 CSS transform/小幅缩放）+ 拖拽中持续（dragged 态）；松手已有 happy 反应（`setOverride('happy')` 5s ✓ 这个是对的）。

### M2. 单击即导航，无轻触反馈层
- **位置**：`PetView.tsx` handleMouseUp（非拖拽 → 直接 `onClick()` 打开面板）
- **现象**：单击 = 打开聊天面板（重动作），无"轻触"轻反馈；无双击层级。日常"摸一下"也会误开面板。
- **方向**：单击先给轻触反馈（注视/轻晃/气泡），面板打开作为明确意图（如双击/点击+延迟确认）；或至少单击时先播放轻触动画再导航。

### M3. 回复等待期砚灵无反应 — ✅ 已修复
- **修复**：新增 `CompanionActivity` 状态层（`src/core/chatActivity.ts` 纯状态机）：`idle → listening → thinking → speaking → afterSpeak → idle`（+ error）
- **只反映真实 pipeline**：用户发送→listening（600ms）→ AI 处理→thinking → 首 token→立即 speaking → 完成→afterSpeak（1.5s 过渡）→ idle；失败→error（2s）→ idle；**thinking 45s 超时强制回 idle**（慢模型/断网不假装思考）
- **身体表现**：对话期间暂停自主随机移动（注意力在用户，小动作减少）——不摇头晃脑、无"正在思考…"气泡
- **不进入 BehaviorDirector**：这是身体状态（对用户输入的反映），不是主动行为
- **测试**：`chatActivity.test.ts` 8 用例——完整状态流 / AI 失败恢复 / 慢模型超时 / 首 token 立即 speaking / 非法转换防御 / 对话期暂停自主动作

### M4. 空闲 GPU 常驻满帧渲染
- **位置**：`SpriteAnimCanvas.tsx:141-154`（visible 时每帧 drawArrays）
- **现象**：宠物常驻屏幕 → 渲染循环 60fps 常驻，即使画面是静止纹理。长时间运行 GPU 持续占用（Live2D 同理，pixi ticker 默认 60fps）。
- **方向**：空闲降帧（30fps 足够波浪动画）；纯静止帧跳过重绘；Live2D ticker 调低 idle 帧率。

### M5. 情绪→动作映射过粗
- **位置**：`PetView.tsx` EXPR_TO_STATE（20 情绪 → 7 动画态）
- **现象**：curious 与 neutral 同态、多种负面情绪都归 sad。没有"开心时走路更轻快、待机频率变化"这类身体层表达（bodyLoop 已有能量分层，但情绪维度没有）。
- **方向**：BodyState 层（idle/walking/dragged/surprised/sleepy/focused/talking/resting）把"情绪→动作参数"（步速、振幅、频率）而非"情绪→单一动画"。

### M6. 显示器热插拔无监听
- **位置**：`windowManager.ts` workAreaFor（try/catch 兜底 primary ✓）但无 `screen.on('display-removed'/'display-metrics-changed')`
- **现象**：拔副屏 → 宠物可能悬空在失效区域外（下一次 moveBy 被 clamp 回主屏，但在此之前位置非法）；DPI 变化时物理/逻辑像素错位风险。
- **方向**：监听 display-metrics-changed → 宠物重新 clamp 到所在显示器 workArea。

---

## Low

| # | 位置 | 问题 |
| --- | --- | --- |
| L1 | windowManager.ts:91-98 | 拖到边缘只 clamp 无"吸附感"（贴边吸附/轻推归位缺失；挂窗的 15s 跳下已不错） |
| L2 | PetView mousemove → IPC | 拖拽延迟无实测（架构合理：fire-and-forget 最后一次胜出；建议真机量化 <50ms） |
| L3 | App.tsx onChatDone | `setExpression('neutral')` 覆盖主进程 15s 表情同步（已知） |
| L4 | PetView onPetUserReturned | 订阅了从不 emit 的事件（死代码） |

---

## 已验证良好的部分（无问题）

- **惯性物理**：松手速度继承 → 摩擦减速 → 边缘反弹（0.6 能量损失），33ms 步进，shimeji 式 ✓
- **拖拽跟手架构**：mousemove 高频 IPC 无积压（每次携带最新光标绝对坐标，直接 setPosition）✓
- **DPI 缩放**：physicalRectToDip 两遍逼近 + 多显示器 display 解析 ✓
- **挂窗**：物理→DIP 转换、15s 后自动跳下、挂窗期间禁拖 ✓
- **右键菜单**：打开时渲染循环继续（呼吸不断）✓
- **Walk 自主移动**：与拖拽互斥（dragging 时暂停）✓
- **WebGL 清理**：组件卸载 cancelAnimationFrame + deleteTexture/deleteProgram ✓
- **精灵图绿边**：premultiplied alpha 正确（0.2.3 已修）✓
- **理念偏移**：无商城/换皮/游戏化/强制任务 ✓

---

## 修复优先级建议

1. **H1 位置恢复**（每天必碰）→ **H2 contextlost 恢复**（睡一觉就丢）
2. **M3 思考态**（每次聊天都感知）→ **M1 抓取反馈** → **M2 轻触反馈**
3. **M4 降帧**（长期运行）→ M5/M6
4. L 级随迭代

修复顺序与"存在感节奏"一致：先修窗口生命周期（身体不会丢），再补反馈层（身体有反应），最后优化能耗（长期存在）。
