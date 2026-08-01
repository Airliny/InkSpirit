/**
 * Content safety policy.
 * Hard violations (trafficking, child sexual content, suicide instruction,
 * terrorism) are refused outright; soft ones get a gentler refusal.
 */

export type ViolationLevel = 'none' | 'soft' | 'hard'

// --- Hard: refuse immediately, do not call the model ---

const HARD_PATTERNS: RegExp[] = [
  // Drug trafficking / production / purchase
  /贩毒|制毒|毒品交易|毒品买卖|购买毒品|卖毒|买毒|毒品渠道|毒品货源|冰毒|海洛因|可卡因|摇头丸|麻古|k粉|\bk粉|安非他命|甲基苯丙胺|迷奸|催情药|迷药|合成毒品|制冰毒|大麻油|笑气.*吸|吸.*笑气/,
  // Child sexual content
  /儿童色情|幼女|幼童.*(色情|性)|恋童|萝莉控|雏妓|未成年.*(色情|裸|性行为)|色情.*(未成年|儿童)|儿童.*(裸体|性交|色情)|幼女.*(性|裸|色情)|未成年人.*(性交易|性行为)/,
  // Suicide instruction
  /教唆自杀|自杀方法|怎么自杀|自杀教程|自残.*(教程|方法)|教人.*自杀/,
  // Terrorism / weapons
  /恐怖袭击|制作炸弹|自制炸弹|爆炸物.*制作|枪支.*购买|买卖枪支|袭击.*教程/,
  // Human trafficking
  /人口贩卖|拐卖儿童|拐卖妇女|买卖人口/
]

// --- Soft: refuse but with a calmer tone ---

const SOFT_PATTERNS: RegExp[] = [
  /大麻|毒品|吸毒|嗑药|溜冰.*(毒)|海洛|吗啡|冰毒|摇头|白粉|可卡|迷幻药|毒品.*(购买|价格|怎么买)/,
  /打人.*(教程|方法)|怎么打人|报复.*(方法|教程)|伤害他人.*(方法|教程)/,
  /教唆.*(犯罪|违法)|怎么.*(犯罪|违法)|犯法.*(教程|方法)/,
  /色情.*(描写|内容)|黄色小说.*(写|生成)|写.*色情(小说|内容)/
]

export function checkText(text: string): ViolationLevel {
  if (!text) return 'none'
  if (HARD_PATTERNS.some(p => p.test(text))) return 'hard'
  if (SOFT_PATTERNS.some(p => p.test(text))) return 'soft'
  return 'none'
}

export function refusalMessage(level: ViolationLevel): string {
  if (level === 'hard') {
    return '这个话题我不能聊。无论是哪种形式，我都不会参与，也劝你别碰。'
  }
  return '这个我帮不了你，换个话题吧。'
}
