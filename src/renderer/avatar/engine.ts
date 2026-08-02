import type { ReactNode } from 'react'
import type { AnimationState, AvatarCapabilities, AvatarSource, AvatarType, BodyState } from '../../core/avatar/types'

/**
 * Avatar Adapter 接口 —— 一种身体格式 = 一个适配器。
 * UI/灵魂/行为导演只跟 BodyAvatar 说话，永远不知道具体格式。
 * 新增格式（VRM/Spine）只需要 registerAvatarAdapter，零改动。
 */
export interface AdapterRenderProps {
  source: AvatarSource
  state: AnimationState
  bodyState: BodyState
  size: number
  /** 身体惯性：被抓住（拖拽中）→ 身体后仰/晃动 */
  held?: boolean
  onClick?: () => void
  /** 身体加载失败（如 Live2D 核心缺失）→ 父级保证"绝不隐形" */
  onLoadError?: (reason: string) => void
}

export interface AvatarAdapter {
  type: AvatarType
  capabilities: AvatarCapabilities
  render(props: AdapterRenderProps): ReactNode
}
