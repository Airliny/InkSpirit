import { LIVE2D_CAPABILITIES } from '../../../core/avatar/bodies'
import { Live2DView } from '../../components/avatar/Live2DView'
import type { AvatarAdapter } from '../engine'
import { renderBuiltin } from './builtinAdapter'

/**
 * Live2D Adapter —— Live2D 身体（Cubism 2.1/4.0）。
 * 支持表情/动作/眨眼；视线通过 model.focus 驱动（模型支持时）。
 * 核心缺失或模型损坏 → onLoadError，父级落到内置身体。
 */
export const live2dAdapter: AvatarAdapter = {
  type: 'live2d',
  capabilities: LIVE2D_CAPABILITIES,
  render({ source, state, bodyState, size, onClick, onLoadError }) {
    if (source.kind !== 'live2d') return renderBuiltin(source, size, onClick)
    return (
      <Live2DView
        modelPath={source.modelPath}
        state={state}
        width={Math.round(size * 1.3)}
        height={Math.round(size * 1.4)}
        look={{ x: bodyState.lookX, y: bodyState.lookY }}
        onClick={onClick}
        onLoadError={(reason) => onLoadError?.(reason)}
      />
    )
  }
}
