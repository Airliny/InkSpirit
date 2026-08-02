import { VRM_CAPABILITIES } from '../../../core/avatar/bodies'
import { VRMView } from '../../components/avatar/VRMView'
import type { AvatarAdapter } from '../engine'
import { renderBuiltin } from './builtinAdapter'

/**
 * 3D 身体（VRM）Adapter —— 不是"支持 VRM 模型"，是新的身体类型。
 * 只负责 BodyState → BlendShape/骨骼 → three-vrm，自身没有任何灵魂逻辑；
 * 表情由状态映射（happy→happy preset），呼吸/摆动/视线由 BodyState 驱动。
 * 加载失败 → onLoadError，父级落到内置身体（绝不隐形）。
 */
export const vrmAdapter: AvatarAdapter = {
  type: 'vrm',
  capabilities: VRM_CAPABILITIES,
  render({ source, state, bodyState, size, held, onClick, onLoadError }) {
    if (source.kind !== 'vrm') return renderBuiltin(source, size, onClick)
    return (
      <div onClick={onClick} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <VRMView modelPath={source.modelPath} state={state} bodyState={bodyState} size={size} held={held} onLoadError={onLoadError} />
      </div>
    )
  }
}
