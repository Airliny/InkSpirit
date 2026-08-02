# Avatar SDK（身体上传契约 · v0.7 冻结）

砚灵的身体生态契约。**三种格式已冻结**：`builtin` / `sprite` / `live2d` / `vrm`。
Spine / MMD / FBX / Unity Avatar **不加入**——格式冻结是架构决定，不是技术限制。

> 核心思想：身体只是渲染载体。UI / 灵魂 / 行为导演永远不知道身体是哪种格式，
> 只知道「这是一个身体」。新增身体只需按本契约提供描述符 + 资产文件，零改码。

## 1. 契约总览

```
Emotion → BodyState → Capability Filter → Body Action → Adapter → 具体身体表现
```

- **灵魂层**（人格/记忆/关系/情绪）不感知身体格式
- **行为导演**只发出意图（blink/walk/sit/…、happy/sad/…），按身体能力自动降级
- **Adapter** 是唯一知道格式的地方：BodyState → 具体表现（Sprite 纸涟漪 / Live2D 参数 / VRM BlendShape）

## 2. 身体描述符（AvatarDescriptor）

```jsonc
{
  "id": "cat_01",                 // 唯一 id
  "name": "小猫",                  // 身体名
  "type": "vrm",                  // 冻结格式之一：sprite | live2d | vrm
  "capabilities": {               // 能力声明（词汇表已冻结，见 §3）
    "look": true,                 // 视线跟随（偶尔偷看）
    "blink": true,                // 眨眼
    "sway": true,                 // 重心摆动
    "breath": true,               // 呼吸
    "motion": true,               // 动作（walk/sit/sleep/stretch/yawn）
    "expression": true,           // 情绪表情
    "tail": true,                 // 尾巴（摇尾巴动作需要）
    "hand": false,                // 手
    "face": false,                // 脸
    "skeleton": true              // 骨骼
  },
  "source": {
    "kind": "vrm",                // builtin | sprites | live2d | vrm
    "modelPath": "/data/body/model.vrm"
  },
  "metadata": {
    "format": ".vrm",
    "note": "三维身体：骨骼/表情/动作完整"
  }
}
```

**校验**：`validateAvatarDescriptor()`（`src/core/avatar/sdk.ts`）拒绝：
- 未冻结的 `type` / `source.kind`
- 能力词汇表之外的键（防自定义能力悄悄膨胀）
- 非布尔 capability

## 3. 能力词汇表（冻结）

| 能力 | 含义 | 身体怎么表达 |
|---|---|---|
| `look` | 视线跟随 | 偷看你（不一直跟），频率由情绪/心境/世界调制 |
| `blink` | 眨眼 | 3-6 秒一次自适应 |
| `sway` | 重心摆动 | 情绪驱动幅度，睡觉停摆 |
| `breath` | 呼吸 | 速度由情绪/疲劳调制 |
| `motion` | 动作 | walk/sit/sleep/stretch/yawn 行为降级 |
| `expression` | 表情 | happy/sad/surprised/love 情绪表现 |
| `tail` | 尾巴 | happy → tail_wave 候选动作 |
| `hand` | 手 | 挥手等动作 |
| `face` | 脸 | 歪头等动作 |
| `skeleton` | 骨骼 | VRM 等完整骨骼 |

**降级铁律**：导演说「摇尾巴」，没有 `tail` 的身体安静变成 idle——导演不需要知道身体是谁。

## 4. 表情/动作映射（Adapter 责任）

Adapter 只做映射，不做决策：

| 状态 | Sprite | Live2D | VRM |
|---|---|---|---|
| happy | happy 图/纸涟漪 | happy motion | happy preset |
| sad | sad 图 | sad motion | sad preset |
| surprised | surprised 图 | surprised motion | surprised preset |
| sleep | sleep 图 | sleep motion | relaxed + 闭眼 |
| walk | walk 图 | walk motion | 根骨起伏 |
| blink | idle 图 | blink motion | blink preset |

## 5. 上传身体（当前支持）

| 格式 | 上传方式 | 能力 |
|---|---|---|
| 精灵图 | 设置 → 身体 → 逐动作导入 PNG/GIF | 单张也够用，自动呼吸/摆动/视线 |
| Live2D | 设置 → 身体 → 导入 .model3.json | 自带动作/表情 |
| 3D 身体 | 设置 → 身体 → 导入 .vrm | 骨骼/表情/动作完整，懒加载 |

上传后出现在身体库，点击「更换身体」即生效——换身体不换灵魂。

## 6. 未来（不破坏契约）

- **AI 身体生成**：上传图片 → 活体化（生成 sprite 描述符），或一句话生成身体——输出仍是本契约的描述符
- **身体库 Avatar Gallery**：在线身体 = 契约描述符 + 资产文件，下载即换
- 新增格式需要架构评审（改 `FROZEN_AVATAR_TYPES` + 适配器 + 能力映射表），不是加一行注册
