import type { DeuceRule, GameState, Score, TeamId } from './types'
import { opponent } from './types'

/**
 * Scoring inside a single game, and inside a tie-break.
 *
 * We store RAW point counts (0,1,2,3,4...) and convert to 15/30/40 only for
 * display. Raw counts make the "win by 2" maths simple.
 */

export function newGame(): GameState {
  return { points: { A: 0, B: 0 }, deuces: 0 }
}

/**
 * How many times deuce may be reached before the next point is decisive.
 *  golden            -> 1  (first deuce is already the golden point)
 *  advantage, cap 3  -> 3  (your rule)
 *  advantage, null   -> Infinity (traditional, never golden)
 */
export function maxDeuces(rule: DeuceRule): number {
  if (rule.kind === 'golden') return 1
  return rule.goldenAfter ?? Number.POSITIVE_INFINITY
}

export function isDeuce(game: GameState): boolean {
  return game.points.A === game.points.B && game.points.A >= 3
}

/** True when the next point wins the game outright. */
export function isGoldenPoint(game: GameState, rule: DeuceRule): boolean {
  return isDeuce(game) && game.deuces >= maxDeuces(rule)
}

export interface GamePointResult {
  game: GameState
  winner: TeamId | null
}

export function scoreGamePoint(
  game: GameState,
  team: TeamId,
  rule: DeuceRule,
): GamePointResult {
  const points: Score = { ...game.points, [team]: game.points[team] + 1 }
  const mine = points[team]
  const theirs = points[opponent(team)]

  const wonGoldenPoint = isGoldenPoint(game, rule)
  const wonNormally = mine >= 4 && mine - theirs >= 2
  if (wonGoldenPoint || wonNormally) {
    return { game: { points, deuces: game.deuces }, winner: team }
  }

  // Did this point bring the score level at 40-40 (or later)? Count the deuce.
  const reachedDeuce = points.A === points.B && points.A >= 3
  return {
    game: { points, deuces: reachedDeuce ? game.deuces + 1 : game.deuces },
    winner: null,
  }
}

const LABELS = ['0', '15', '30', '40']

/** What to show on screen for each team: 0 / 15 / 30 / 40 / Ad. */
export function gamePointLabels(game: GameState): Record<TeamId, string> {
  const { A, B } = game.points
  if (A >= 3 && B >= 3) {
    if (A === B) return { A: '40', B: '40' }
    return A > B ? { A: 'Ad', B: '40' } : { A: '40', B: 'Ad' }
  }
  return { A: LABELS[A], B: LABELS[B] }
}

// ---------------------------------------------------------------------------
// Tie-breaks (also used for the super tie-break, just with a different target)
// ---------------------------------------------------------------------------

export interface TieBreakPointResult {
  points: Score
  winner: TeamId | null
}

export function scoreTieBreakPoint(
  points: Score,
  team: TeamId,
  target: number,
): TieBreakPointResult {
  const next: Score = { ...points, [team]: points[team] + 1 }
  const won = next[team] >= target && next[team] - next[opponent(team)] >= 2
  return { points: next, winner: won ? team : null }
}
