import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Agent } from './agent'
import { useInMemoryDatabaseForTest, closeDatabase } from './database'
import { getConfig, resetConfigStatementsForTest } from './config'
import { clearPersonalityCache } from './soul/personality'
import { clearRelationshipCache, recordRelationshipEvent, getRelationship } from './soul/relationship'
import { addMemory, countMemories } from './soul/memory'
import { recordIdentityEvent } from './soul/identity'

/**
 * v0.3.4 模型切换保护：
 * 砚灵的「灵魂」（人格/关系/记忆/身份）与「大脑」（推理能力）必须彻底分离。
 * 切换大脑 = 换一个更聪明的头脑，绝不是换一个人。
 */
describe('A4 — 模型切换保护：换大脑不换灵魂', () => {
  let agent: Agent

  beforeEach(() => {
    useInMemoryDatabaseForTest()
    resetConfigStatementsForTest()
    clearPersonalityCache()
    clearRelationshipCache()
    agent = new Agent()
  })

  afterEach(() => {
    closeDatabase()
  })

  /** 造一个"有灵魂的砚灵"：命名、记忆、关系都真实存在 */
  function growSoul(): void {
    recordIdentityEvent({ type: 'name_assigned', name: '墨墨' }, undefined as any)
    addMemory('用户喜欢黑咖啡', { type: 'semantic', tier: 'long_term', importance: 0.8 })
    recordRelationshipEvent({ type: 'deep_share', intensity: 0.8, timestamp: Date.now(), source: 'conversation' })
  }

  it('GPT → DeepSeek → Ollama → 自定义 全链路切换：人格/关系/记忆分毫不动', () => {
    growSoul()
    const before = {
      personality: { ...agent.getPersonality() },
      stage: agent.getRelationshipStage(),
      memories: countMemories()
    }

    // 依次切换四种大脑
    agent.configureProvider('openai', 'sk-openai', 'gpt-4o-mini')
    agent.configureProvider('deepseek', 'sk-deepseek', 'deepseek-chat')
    agent.configureProvider('ollama', '', 'qwen3:8b')
    agent.configureProvider('custom', 'sk-custom', 'my-model', 'https://my-service.example/v1')

    expect(agent.getPersonality()).toEqual(before.personality)
    expect(agent.getRelationshipStage()).toBe(before.stage)
    expect(getRelationship().trust).toBeGreaterThan(0)
    expect(countMemories()).toEqual(before.memories)
  })

  it('切换后当前大脑正确持久化，且各大脑的密钥/模型配置互不污染', () => {
    growSoul()
    agent.configureProvider('openai', 'sk-openai', 'gpt-4o-mini')
    agent.configureProvider('deepseek', 'sk-deepseek', 'deepseek-chat')

    // 当前是 DeepSeek
    expect(getConfig('provider')).toBe('deepseek')
    expect(getConfig('deepseek_model')).toBe('deepseek-chat')

    // 切回 OpenAI：DeepSeek 的配置仍在，OpenAI 的记忆也在
    agent.configureProvider('openai', 'sk-openai-2', 'gpt-4o-mini')
    expect(getConfig('provider')).toBe('openai')
    expect(getConfig('deepseek_model')).toBe('deepseek-chat')

    // 自定义大脑：地址/模型全部持久化
    agent.configureProvider('custom', 'sk-custom', 'my-model', 'https://my-service.example/v1')
    expect(getConfig('provider')).toBe('custom')
    expect(getConfig('custom_base_url')).toBe('https://my-service.example/v1')
    expect(getConfig('custom_model')).toBe('my-model')
  })

  it('自定义大脑重启后能从已存配置恢复（不需要用户重新填写）', () => {
    agent.configureProvider('custom', 'sk-custom', 'my-model', 'https://my-service.example/v1')

    // 模拟重启：重新构造 Agent，用保存的 Key 重新配置（地址/模型从配置回退）
    const restarted = new Agent()
    restarted.configureProvider('custom', '', undefined, undefined)

    expect(restarted.getActiveClientInfo().model).toBe('my-model')
  })
})
