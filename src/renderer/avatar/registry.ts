import type { AvatarCapabilities, AvatarType } from '../../core/avatar/types'
import type { AvatarAdapter } from './engine'

const adapters = new Map<AvatarType, AvatarAdapter>()

export function registerAvatarAdapter(adapter: AvatarAdapter): void {
  adapters.set(adapter.type, adapter)
}

export function getAvatarAdapter(type: AvatarType): AvatarAdapter | undefined {
  return adapters.get(type)
}

export function registeredAdapterTypes(): AvatarType[] {
  return [...adapters.keys()]
}

/** 某身体格式是否具备某种能力（行为导演选动作时用它） */
export function supportsCapability(type: AvatarType | undefined, cap: keyof AvatarCapabilities): boolean {
  const adapter = type ? adapters.get(type) : undefined
  return !!adapter?.capabilities[cap]
}
