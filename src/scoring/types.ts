/**
 * Core types for the padel scoring engine.
 *
 * Everything here is plain, JSON-serialisable data (no classes, no functions
 * inside state). That matters for two reasons:
 *   1. We can save/restore a match with JSON.stringify / JSON.parse.
 *   2. Undo is trivial: keep old states around and swap back to one.
 */

export type TeamId = 'A' | 'B'

/** A pair of numbers, one per team (points, games, sets...). */
export type Score = Record<TeamId, number>

export function opponent(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A'
}

// ---------------------------------------------------------------------------
// Configuration (the rules of the match)
// ---------------------------------------------------------------------------

/**
 * What happens at 40-40.
 *  - golden:    the next point wins the game.
 *  - advantage: you need two points in a row (losing "Ad" returns to deuce).
 *               `goldenAfter` caps this: when the score reaches deuce for the
 *               Nth time, the next point wins. `null` = no cap (traditional).
 *
 * Your group's rule is { kind: 'advantage', goldenAfter: 3 }: deuce can occur
 * twice with normal advantage play; at the third deuce the next point wins.
 */
export type DeuceRule =
  | { kind: 'golden' }
  | { kind: 'advantage'; goldenAfter: number | null }

export type MatchFormat =
  | {
      kind: 'sets'
      numberOfSets: number
      /**
       * false: "first to win most of the sets" (best of 3 stops at 2 wins).
       * true:  every set is always played, even if the result is decided.
       */
      playAll: boolean
      /**
       * Replace the deciding set (only when playAll is false) with a
       * first-to-10 super tie-break.
       */
      superTieBreakDecider: boolean
    }
  | {
      /** Fixed number of padel games, always all played. No sets. */
      kind: 'games'
      numberOfGames: number
    }

export interface MatchConfig {
  deuce: DeuceRule
  /** Games needed to win a set (win by 2, tie-break at gamesPerSet-all). */
  gamesPerSet: number
  /** Tie-break target (win by 2). */
  tieBreakPoints: number
  /** Super tie-break target (win by 2). */
  superTieBreakPoints: number
  format: MatchFormat
}

export const STANDARD_CONFIG: MatchConfig = {
  deuce: { kind: 'advantage', goldenAfter: 3 },
  gamesPerSet: 6,
  tieBreakPoints: 7,
  superTieBreakPoints: 10,
  format: {
    kind: 'sets',
    numberOfSets: 3,
    playAll: false,
    superTieBreakDecider: false,
  },
}

export const THREE_GAMES_CONFIG: MatchConfig = {
  ...STANDARD_CONFIG,
  format: { kind: 'games', numberOfGames: 3 },
}

/** Returns a list of human-readable problems. Empty list = valid. */
export function validateConfig(config: MatchConfig): string[] {
  const errors: string[] = []
  const isInt = (n: number) => Number.isInteger(n)

  if (config.deuce.kind === 'advantage') {
    const cap = config.deuce.goldenAfter
    if (cap !== null && (!isInt(cap) || cap < 1)) {
      errors.push('goldenAfter must be a whole number >= 1, or null')
    }
  }
  if (!isInt(config.gamesPerSet) || config.gamesPerSet < 2) {
    errors.push('gamesPerSet must be a whole number >= 2')
  }
  if (!isInt(config.tieBreakPoints) || config.tieBreakPoints < 1) {
    errors.push('tieBreakPoints must be a whole number >= 1')
  }
  if (!isInt(config.superTieBreakPoints) || config.superTieBreakPoints < 1) {
    errors.push('superTieBreakPoints must be a whole number >= 1')
  }

  const f = config.format
  if (f.kind === 'games') {
    if (!isInt(f.numberOfGames) || f.numberOfGames < 1) {
      errors.push('numberOfGames must be a whole number >= 1')
    }
  } else {
    if (!isInt(f.numberOfSets) || f.numberOfSets < 1) {
      errors.push('numberOfSets must be a whole number >= 1')
    } else if (!f.playAll && f.numberOfSets % 2 === 0) {
      // "First to win most sets" only makes sense with an odd number.
      errors.push('Use an odd number of sets (1, 3, 5...) unless every set is played')
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// State (what is happening right now)
// ---------------------------------------------------------------------------

/** Raw points in the current game (0,1,2,3,4...) plus how often we hit deuce. */
export interface GameState {
  points: Score
  deuces: number
}

/**
 *  - normal:       a regular set (games, with a tie-break at 6-6)
 *  - superTieBreak: a single first-to-10 tie-break played instead of a set
 *  - fixedGames:   the whole match in "N games" mode (no sets)
 */
export type SetKind = 'normal' | 'superTieBreak' | 'fixedGames'

export interface SetState {
  kind: SetKind
  games: Score
  game: GameState
  /** Non-null while a tie-break (or super tie-break) is being played. */
  tieBreak: Score | null
  /** Total games to play. Only used by kind === 'fixedGames'. */
  gameLimit: number | null
}

export interface SetResult {
  kind: SetKind
  games: Score
  /** Final tie-break points, if the set was decided by one. */
  tieBreak: Score | null
  /** null = drawn (only possible in fixedGames mode). */
  winner: TeamId | null
}

export type MatchStatus = 'inProgress' | 'awaitingTieDecision' | 'complete'
export type TieDecision = 'draw' | 'extra'

export interface MatchState {
  config: MatchConfig
  completedSets: SetResult[]
  currentSet: SetState | null
  /** Sets planned so far (grows by one if an "extra set" is chosen). */
  plannedSets: number
  status: MatchStatus
  winner: TeamId | 'draw' | null
}
