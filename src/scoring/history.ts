import { createMatch, resolveTie, scorePoint } from './match'
import type { MatchConfig, MatchState, TeamId, TieDecision } from './types'

/**
 * Undo support.
 *
 * Because match states are immutable, undo needs no clever "reverse the last
 * point" logic (which is error-prone across game/set boundaries). We simply
 * remember every previous state and step back to the last one.
 *
 * The whole thing is plain JSON, so it can be saved to localStorage as-is.
 */
export interface MatchHistory {
  past: MatchState[]
  present: MatchState
}

export function createHistory(config: MatchConfig): MatchHistory {
  return { past: [], present: createMatch(config) }
}

function push(history: MatchHistory, next: MatchState): MatchHistory {
  // If nothing changed (e.g. match already over), don't create an undo step.
  if (next === history.present) return history
  return { past: [...history.past, history.present], present: next }
}

export function recordPoint(history: MatchHistory, team: TeamId): MatchHistory {
  return push(history, scorePoint(history.present, team))
}

export function recordTieDecision(history: MatchHistory, decision: TieDecision): MatchHistory {
  return push(history, resolveTie(history.present, decision))
}

export function canUndo(history: MatchHistory): boolean {
  return history.past.length > 0
}

export function undo(history: MatchHistory): MatchHistory {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
  }
}
