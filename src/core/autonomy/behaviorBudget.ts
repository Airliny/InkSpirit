/**
 * Anti-interruption budget: bounds how often the pet proactively speaks.
 * Movement/visual actions are free; speech spends budget.
 */

export interface BudgetState {
  /** Epoch ms of the current hourly window */
  hourWindowStart: number
  interactionsThisHour: number
  maxHourlyInteractions: number
  lastInterruptAt: number
}

export const HOUR_MS = 60 * 60 * 1000

/** Personality-driven allowance: proactive pets may speak more often */
export function maxForPersonality(proactiveness: number): number {
  return 1 + Math.round(Math.max(0, Math.min(1, proactiveness)) * 5)
}

export function createBudget(maxHourlyInteractions: number, now: number = Date.now()): BudgetState {
  return {
    hourWindowStart: now,
    interactionsThisHour: 0,
    maxHourlyInteractions,
    lastInterruptAt: 0
  }
}

/** Roll the hourly window over if an hour has passed since it opened */
export function rolloverBudget(budget: BudgetState, now: number = Date.now()): BudgetState {
  if (now - budget.hourWindowStart < HOUR_MS) return budget
  return {
    ...budget,
    hourWindowStart: now,
    interactionsThisHour: 0
  }
}

export function canSpend(budget: BudgetState, now: number = Date.now()): boolean {
  const current = rolloverBudget(budget, now)
  return current.interactionsThisHour < current.maxHourlyInteractions
}

/** Record a spent interaction (call once per emitted speaking action) */
export function spendBudget(budget: BudgetState, now: number = Date.now()): BudgetState {
  const current = rolloverBudget(budget, now)
  return {
    ...current,
    interactionsThisHour: current.interactionsThisHour + 1,
    lastInterruptAt: now
  }
}
