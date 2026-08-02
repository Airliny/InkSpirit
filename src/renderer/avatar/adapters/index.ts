import { registerAvatarAdapter } from '../registry'
import { spriteAdapter } from './spriteAdapter'
import { live2dAdapter } from './live2dAdapter'
import { vrmAdapter } from './vrmAdapter'

/**
 * 注册默认身体适配器。新增格式在这里加一行即可，
 * 设置页/行为导演/情绪系统零改动。
 */
export function registerDefaultAdapters(): void {
  registerAvatarAdapter(spriteAdapter)
  registerAvatarAdapter(live2dAdapter)
  registerAvatarAdapter(vrmAdapter)
}
