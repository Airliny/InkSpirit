import { SPRITE_CAPABILITIES } from '../../../core/avatar/bodies'
import type { SpriteSource } from '../../../core/avatar/types'
import { Avatar } from '../../components/avatar/Avatar'
import type { AvatarAdapter } from '../engine'

/**
 * Sprite Adapter —— 精灵图身体。
 * 单张 idle.png 也能：呼吸（WebGL 纸涟漪）+ 重心摆动 + 视线跟随。
 * 没有图时自动落到内置「砚」，绝不隐形。
 */
export const spriteAdapter: AvatarAdapter = {
  type: 'sprite',
  capabilities: SPRITE_CAPABILITIES,
  render({ source, state, bodyState, size, held, onClick }) {
    const sprites: SpriteSource = source.kind === 'sprites' ? source.sprites : {}
    return <Avatar sprites={sprites} state={state} size={size} bodyState={bodyState} held={held} onClick={onClick} />
  }
}
