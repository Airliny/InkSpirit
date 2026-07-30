export interface WindowContext {
  title: string
  isFullscreen: boolean
  appName: string | null
}

const fullscreenApps = new Set<string>()

const knownApps: Record<string, string> = {
  'zoom': 'meeting',
  'teams': 'meeting',
  'discord': 'communication',
  'slack': 'communication',
  'obs': 'streaming',
  'premiere': 'video_editing',
  'davinci': 'video_editing',
  'photoshop': 'creative',
  'blender': 'creative',
  'vscode': 'coding',
  'code': 'coding',
  'intellij': 'coding',
  'terminal': 'coding',
  'steam': 'gaming',
  'league': 'gaming',
  'valorant': 'gaming'
}

export function classifyWindow(title: string): WindowContext {
  const titleLower = title.toLowerCase()
  const isFullscreen = fullscreenApps.has(titleLower)

  let appName: string | null = null
  for (const [key, name] of Object.entries(knownApps)) {
    if (titleLower.includes(key)) {
      appName = name
      break
    }
  }

  return { title, isFullscreen, appName }
}

export function isDisturbable(context: WindowContext): boolean {
  if (context.isFullscreen) return false
  const noDisturb = ['meeting', 'video_editing', 'gaming', 'streaming']
  if (context.appName && noDisturb.includes(context.appName)) return false
  return true
}
