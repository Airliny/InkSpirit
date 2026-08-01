export type ForegroundScene =
  | 'meeting'   // video calls — never disturb
  | 'game'      // fullscreen games — never disturb
  | 'video'     // media playback — avoid disturbing
  | 'code'      // coding — fine to remind about breaks
  | 'work'      // generic work — fine
  | 'other'

const MEETING_KEYWORDS = [
  'zoom', 'teams', 'meeting', '会议', '腾讯会议', '钉钉', '飞书', 'webex', 'goto meeting', 'google meet'
]
const GAME_KEYWORDS = ['steam', 'epic games', 'valorant', 'lol', 'league of legends', 'apex', 'csgo', 'cs:go', 'counter-strike', 'minecraft', 'dota', 'genshin', '原神', '王者荣耀', '英雄联盟', '绝地求生', '荒野', '崩坏', '星穹', '最终幻想', 'gta', 'elden ring', 'black myth', '黑神话', 'cyberpunk']
const VIDEO_KEYWORDS = ['播放器', 'mpv', 'vlc', 'potplayer', 'youtube', 'bilibili', '哔哩哔哩', '爱奇艺', '优酷', '腾讯视频', 'netflix', 'disney', 'plex', 'kmplayer']
const CODE_KEYWORDS = ['visual studio', 'vscode', 'code', 'intellij', 'webstorm', 'pycharm', 'goland', 'terminal', 'cmd', 'powershell', 'notepad++', 'sublime', '编辑器', '终端']

export function classifyForeground(title: string): ForegroundScene {
  const t = title.toLowerCase()
  if (MEETING_KEYWORDS.some(k => t.includes(k))) return 'meeting'
  if (GAME_KEYWORDS.some(k => t.includes(k))) return 'game'
  if (VIDEO_KEYWORDS.some(k => t.includes(k))) return 'video'
  if (CODE_KEYWORDS.some(k => t.includes(k))) return 'code'
  return 'work'
}

/** Scenes where the pet should stay quiet */
export function isDoNotDisturb(scene: ForegroundScene): boolean {
  return scene === 'meeting' || scene === 'game' || scene === 'video'
}
