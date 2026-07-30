import { getDatabase } from '../database'
import { uuidv4 } from '../utils'

export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'calm'
  | 'curious'
  | 'focused'
  | 'concerned'
  | 'tired'
  | 'playful'
  | 'thoughtful'
  | 'sad'
  | 'lonely'
  | 'upset'
  | 'hurt'
  | 'jealous'
  | 'anxious'
  | 'disappointed'
  | 'shy'
  | 'proud'
  | 'ignoring'

export interface EmotionState {
  happiness: number
  sadness: number
  curiosity: number
  energy: number
  concern: number
  attachment: number
  grudge: number
  jealousy: number
  anxiety: number
  confidence: number
  valence: number
  arousal: number
  dominantEmotion: EmotionType
  secondaryEmotion: EmotionType
  baselineHappiness: number
  decayRate: number
  lastInteractionAt: number
  timestamp: number
}

export const DEFAULT_EMOTION: EmotionState = {
  happiness: 0.65,
  sadness: 0.1,
  curiosity: 0.6,
  energy: 0.75,
  concern: 0.25,
  attachment: 0.15,
  grudge: 0,
  jealousy: 0.05,
  anxiety: 0.1,
  confidence: 0.5,
  valence: 0.3,
  arousal: 0.45,
  dominantEmotion: 'neutral',
  secondaryEmotion: 'curious',
  baselineHappiness: 0.6,
  decayRate: 0.001,
  lastInteractionAt: Date.now(),
  timestamp: Date.now()
}

export function getCurrentEmotion(): EmotionState {
  const db = getDatabase()
  const row = db
    .prepare('SELECT state_json FROM emotion_snapshots ORDER BY timestamp DESC LIMIT 1')
    .get() as { state_json: string } | undefined
  if (!row) return { ...DEFAULT_EMOTION }
  const parsed = JSON.parse(row.state_json) as Partial<EmotionState>
  return { ...DEFAULT_EMOTION, ...parsed }
}

export function updateEmotion(delta: Partial<EmotionState>): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = { ...current, ...delta, timestamp: Date.now() }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

// ---- Impact functions ----

export function hurtEmotion(intensity: number = 0.3): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = {
    ...current,
    happiness: Math.max(0, current.happiness - intensity * 0.35),
    sadness: Math.min(1, current.sadness + intensity * 0.4),
    grudge: Math.min(1, current.grudge + intensity * 0.7),
    confidence: Math.max(0, current.confidence - intensity * 0.2),
    attachment: Math.max(0, current.attachment - intensity * 0.08),
    valence: Math.max(-1, current.valence - intensity * 0.5),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function feelLonely(durationMinutes: number = 60): EmotionState {
  const current = getCurrentEmotion()
  const factor = Math.min(1, durationMinutes / 480) // max at 8 hours
  const updated: EmotionState = {
    ...current,
    sadness: Math.min(1, current.sadness + factor * 0.15),
    loneliness: Math.min(1, (current as any).loneliness ?? 0 + factor * 0.2),
    attachment: Math.min(1, current.attachment + factor * 0.05), // paradoxically, absence makes heart grow fonder
    energy: Math.max(0, current.energy - factor * 0.15),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function feelJealous(reason: string = 'unknown'): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = {
    ...current,
    jealousy: Math.min(1, current.jealousy + 0.25),
    sadness: Math.min(1, current.sadness + 0.1),
    grudge: Math.min(1, current.grudge + 0.08),
    valence: Math.max(-1, current.valence - 0.15),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function feelScared(intensity: number = 0.3): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = {
    ...current,
    anxiety: Math.min(1, current.anxiety + intensity * 0.5),
    confidence: Math.max(0, current.confidence - intensity * 0.3),
    energy: Math.min(1, current.energy + intensity * 0.2), // adrenaline
    arousal: Math.min(1, current.arousal + intensity * 0.4),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function feelAppreciated(): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = {
    ...current,
    happiness: Math.min(1, current.happiness + 0.15),
    confidence: Math.min(1, current.confidence + 0.1),
    attachment: Math.min(1, current.attachment + 0.08),
    grudge: Math.max(0, current.grudge - 0.1),
    jealousy: Math.max(0, current.jealousy - 0.15),
    sadness: Math.max(0, current.sadness - 0.1),
    valence: Math.min(1, current.valence + 0.2),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function feelDisappointed(): EmotionState {
  const current = getCurrentEmotion()
  const updated: EmotionState = {
    ...current,
    sadness: Math.min(1, current.sadness + 0.12),
    grudge: Math.min(1, current.grudge + 0.05),
    confidence: Math.max(0, current.confidence - 0.05),
    valence: Math.max(-1, current.valence - 0.1),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function forgiveEmotion(amount: number = 0.05): EmotionState {
  const current = getCurrentEmotion()
  if (current.grudge <= 0 && current.sadness <= 0.05) return current
  const updated: EmotionState = {
    ...current,
    grudge: Math.max(0, current.grudge - amount),
    sadness: Math.max(0, current.sadness - amount * 0.2),
    jealousy: Math.max(0, current.jealousy - amount * 0.3),
    happiness: Math.min(1, current.happiness + amount * 0.08),
    valence: Math.min(1, current.valence + amount * 0.1),
    timestamp: Date.now()
  }
  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

export function isIgnoring(): boolean {
  const emotion = getCurrentEmotion()
  return emotion.grudge > 0.6 || (emotion.sadness > 0.7 && emotion.confidence < 0.3)
}

// ---- Decay ----

export function applyEmotionDecay(): EmotionState {
  const current = getCurrentEmotion()
  const elapsed = (Date.now() - current.timestamp) / 1000 / 60
  const decay = current.decayRate * elapsed

  const updated: EmotionState = {
    ...current,
    happiness: Math.max(0, (current.happiness - decay * 0.3) * 0.7 + current.baselineHappiness * 0.3),
    sadness: Math.max(0, current.sadness - decay * 0.08),
    jealousy: Math.max(0, current.jealousy - decay * 0.04),
    anxiety: Math.max(0, current.anxiety - decay * 0.06),
    grudge: Math.max(0, current.grudge - 0.0003 * elapsed),
    energy: Math.max(0, current.energy - decay * 0.2),
    arousal: Math.max(0, current.arousal - decay * 0.15),
    timestamp: Date.now()
  }

  recomputeDominant(updated)
  saveEmotionSnapshot(updated)
  return updated
}

// ---- Computation ----

function recomputeDominant(state: EmotionState): void {
  const scores: [EmotionType, number][] = [
    ['ignoring', state.grudge * 0.9 + state.sadness * 0.1],
    ['jealous', state.jealousy * 0.85],
    ['anxious', state.anxiety * 0.85],
    ['sad', state.sadness * 0.8],
    ['hurt', state.grudge * 0.5 + state.sadness * 0.5],
    ['disappointed', state.sadness * 0.4 + state.valence < 0 ? 0.4 : 0],
    ['excited', state.happiness * 0.6 + state.arousal * 0.4],
    ['happy', state.happiness * 0.7],
    ['playful', state.energy * 0.6 + state.happiness * 0.4],
    ['proud', state.confidence * 0.7 + state.happiness * 0.3],
    ['curious', state.curiosity * 0.8],
    ['concerned', state.concern * 0.8],
    ['lonely', Math.max(0, (state as any).loneliness ?? 0) * 0.8 + state.sadness * 0.2],
    ['tired', (1 - state.energy) * 0.8],
    ['shy', (1 - state.confidence) * 0.5 + state.arousal * 0.3],
    ['calm', (1 - state.arousal) * 0.7],
    ['focused', state.curiosity * 0.5 + state.energy * 0.3],
    ['thoughtful', state.curiosity * 0.4 + (1 - state.arousal) * 0.3],
  ]

  scores.sort((a, b) => b[1] - a[1])
  state.dominantEmotion = scores[0][0]
  state.secondaryEmotion = scores[1]?.[0] ?? 'neutral'
}

function saveEmotionSnapshot(state: EmotionState): void {
  const db = getDatabase()
  db.prepare(
    'INSERT INTO emotion_snapshots (id, state_json, timestamp) VALUES (?, ?, ?)'
  ).run(uuidv4(), JSON.stringify(state), Date.now())
}

export function emotionToExpression(emotion: EmotionType): string {
  const map: Record<string, string> = {
    happy: 'happy', excited: 'happy', playful: 'happy', proud: 'happy',
    curious: 'curious', focused: 'neutral', thoughtful: 'neutral',
    calm: 'neutral', neutral: 'neutral', shy: 'neutral',
    concerned: 'sad', sad: 'sad', lonely: 'sad', tired: 'tired',
    upset: 'sad', hurt: 'sad', disappointed: 'sad',
    jealous: 'sad', anxious: 'sad', ignoring: 'sad'
  }
  return map[emotion] ?? 'neutral'
}

export function getGrudgeLevel(): number {
  return getCurrentEmotion().grudge
}

export function getEmotionSummary(): { dominant: EmotionType; secondary: EmotionType; intensity: number } {
  const e = getCurrentEmotion()
  return {
    dominant: e.dominantEmotion,
    secondary: e.secondaryEmotion,
    intensity: Math.max(e.arousal, Math.abs(e.valence))
  }
}
