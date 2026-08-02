# InkSpirit Soul Archive（灵魂档案 · v0.8）

砚灵的完整生命不是"数据库"，是 **Soul Archive**——换电脑、换身体、换大脑之后，
导入它：**「欢迎回来。」** 而不是「加载数据库成功」。

## 1. 档案结构

导出目录（`inkspirit-backup-<时间戳>/`）：

```
Soul Archive/
├── manifest.json          # 灵魂身份清单（Soul Manifest）
│   ├── soulId             # 灵魂编号 inkspirit_xxxxx（首次启动生成，永不改变）
│   ├── soulCreatedAt      # 诞生时间
│   ├── soulBirthVersion   # 诞生时的应用版本
│   ├── continuityHash     # 连续性指纹（身份/人格/关系/记忆的确定性摘要）
│   └── checksum           # 数据完整性校验
├── soul.json              # 全部灵魂表（identity/personality/memories/relationships/…）
└── avatars/               # 身体资产（精灵图/Live2D/VRM）

# soul.json 内的内容对应
#   identity_events        → 身份（名字/改名历史）
#   personalities          → 人格（当前 + 进化日志）
#   memories               → 记忆（分层）
#   relationships          → 关系向量 + 变化史
#   life_events            → 成长经历（Life Timeline）
#   emotion_snapshots      → 情绪历史（心境由它合成）
#   config                 → 身体偏好/当前身体/世界节奏基线（不含 API Key）
```

## 2. 灵魂身份（Soul Manifest）

回答「什么保证它还是同一个砚灵？」：

- `soul_id`：首次启动生成，写进灵魂表（config），随备份/恢复永远保留
- `continuity_hash`：`sha256(soul_id + identity + personality + relationships + memories)`
  ——**哲学身份，不是安全用途**。行顺序变化不影响指纹；核心数据改变则指纹改变
- 恢复时校验：soul_id 一致 + 指纹一致 → 「欢迎回来。它的名字、记忆、关系、成长经历，都还在。」
  soul_id 不同 → 「这是一份新的生命档案——不是同一个砚灵，但它完整地到来。」

## 3. 生命周期事件

| 事件 | 级别 | 说明 |
|---|---|---|
| 砚灵诞生 | major | 首次启动生成 soul_id 时 |
| 被赋予名字 | major | 用户主动命名 |
| 换上新身体 | major | 第一次换身体 |
| 关系升级 | major | 进入新关系阶段 |
| 灵魂恢复 | major | 从归档完整恢复 |
| 灵魂归档 | normal | 导出（每天去重） |
| 提醒你休息 | normal | 主动关心（每天去重） |
| 第一次对话 | normal | 只记一次 |

- `major` 永久保留；`normal` 保留最近 200 条 / 365 天；`noise`（普通聊天/触摸/表情）从不写入
- 分级防止时间线几年后垃圾化

## 4. Sync Layer（多设备预留，本地优先）

**现在不做云同步。** 第一原则：用户拥有数据（本地）。第二：用户主动同步。

- Soul Archive 就是同步单元：导出 = 快照，导入 = 「欢迎回来」
- 未来多设备：电脑 A 导出 Archive → 电脑 B 导入 → 同一个灵魂（soul_id 校验）
- 未来 Sync Layer 若实现，也只做**用户主动发起**的传输（导出文件 / 本地网络 / 用户自选云盘），
  砚灵永远不会静默上传

## 5. 校验链

```
导出: soul_id + continuity_hash 写入 manifest → checksum 保护数据
导入: 结构校验 → checksum 校验 → soul_id/指纹连续性校验 → 原子恢复 → 恢复报告
恢复报告: 「欢迎回来」+ 灵魂编号 + 诞生版本 + 各表恢复计数
```
