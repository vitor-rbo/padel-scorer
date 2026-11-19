import {
  gamePointLabels,
  isGoldenPoint,
  newGame,
  scoreGamePoint,
  scoreTieBreakPoint,
} from './game'
import type {
  MatchConfig,
  MatchState,
  Score,
  SetKind,
  SetResult,
  SetState,
  TeamId,
  TieDecision,
} from './types'
import { opponent, validateConfig } from './types'

/**
 * The match state machine. Every function here is PURE: it takes a state and
 * returns a NEW state, never modifying the old one. That is what makes undo
 * and persistence easy.
 */

function newSet(kind: SetKind, gameLimit: number | null): SetState {
  return {
    kind,
    games: { A: 0, B: 0 },
    game: newGame(),
    tieBreak: kind === 'superTieBreak' ? { A: 0, B: 0 } : null,
    gameLimit,
  }
}

export function createMatch(config: MatchConfig): MatchState {
  const errors = validateConfig(config)
  if (errors.length > 0) {
    throw new Error(`Invalid match config: ${errors.join('; ')}`)
  }
  const f = config.format
  return {
    config,
    completedSets: [],
    currentSet:
      f.kind === 'games' ? newSet('fixedGames', f.numberOfGames) : newSet('normal', null),
    plannedSets: f.kind === 'sets' ? f.numberOfSets : 0,
    status: 'inProgress',
    winner: null,
  }
}

export function setsWon(results: SetResult[]): Score {
  const won: Score = { A: 0, B: 0 }
  for (const r of results) {
    if (r.winner) won[r.winner] += 1
  }
  return won
}

/** Record a finished set and work out what happens next. */
function finishSet(state: MatchState, result: SetResult): MatchState {
  const completedSets = [...state.completedSets, result]
  const base: MatchState = { ...state, completedSets, currentSet: null }
  const format = state.config.format

  if (format.kind === 'games') {
    return { ...base, status: 'complete', winner: result.winner }
  }

  const won = setsWon(completedSets)

  if (!format.playAll) {
    const toWin = Math.ceil(format.numberOfSets / 2)
    if (won.A >= toWin) return { ...base, status: 'complete', winner: 'A' }
    if (won.B >= toWin) return { ...base, status: 'complete', winner: 'B' }
    // Deciding set: both teams one set away from winning.
    const isDecider =
      format.superTieBreakDecider && toWin >= 2 && won.A === toWin - 1 && won.B === toWin - 1
    return { ...base, currentSet: newSet(isDecider ? 'superTieBreak' : 'normal', null) }
  }

  // Play-all: keep going until the planned number of sets is done.
  if (completedSets.length < state.plannedSets) {
    return { ...base, currentSet: newSet('normal', null) }
  }
  if (won.A !== won.B) {
    return { ...base, status: 'complete', winner: won.A > won.B ? 'A' : 'B' }
  }
  return { ...base, status: 'awaitingTieDecision' }
}

/** Record one point for `team`. Does nothing if the match isn't in progress. */
export function scorePoint(state: MatchState, team: TeamId): MatchState {
  if (state.status !== 'inProgress' || state.currentSet === null) return state
  const set = state.currentSet
  const { config } = state

  // --- Tie-break or super tie-break --------------------------------------
  if (set.tieBreak) {
    const target =
      set.kind === 'superTieBreak' ? config.superTieBreakPoints : config.tieBreakPoints
    const r = scoreTieBreakPoint(set.tieBreak, team, target)
    if (!r.winner) {
      return { ...state, currentSet: { ...set, tieBreak: r.points } }
    }
    // A normal set won by tie-break finishes 7-6. A super tie-break counts as 1-0.
    const games: Score =
      set.kind === 'superTieBreak'
        ? { A: 0, B: 0, [r.winner]: 1 }
        : { ...set.games, [r.winner]: set.games[r.winner] + 1 }
    return finishSet(state, { kind: set.kind, games, tieBreak: r.points, winner: r.winner })
  }

  // --- Regular game ------------------------------------------------------
  const r = scoreGamePoint(set.game, team, config.deuce)
  if (!r.winner) {
    return { ...state, currentSet: { ...set, game: r.game } }
  }

  const gameWinner = r.winner
  const games: Score = { ...set.games, [gameWinner]: set.games[gameWinner] + 1 }
  const next: SetState = { ...set, games, game: newGame() }

  if (set.kind === 'fixedGames') {
    const limit = set.gameLimit ?? 0
    if (games.A + games.B < limit) return { ...state, currentSet: next }
    if (games.A === games.B) {
      // All games played and level: ask the user what to do.
      return { ...state, currentSet: next, status: 'awaitingTieDecision' }
    }
    return finishSet(state, {
      kind: 'fixedGames',
      games,
      tieBreak: null,
      winner: games.A > games.B ? 'A' : 'B',
    })
  }

  // Normal set: first to gamesPerSet, win by 2, tie-break when level.
  const mine = games[gameWinner]
  const theirs = games[opponent(gameWinner)]
  const target = config.gamesPerSet
  if (mine >= target && mine - theirs >= 2) {
    return finishSet(state, { kind: 'normal', games, tieBreak: null, winner: gameWinner })
  }
  if (games.A === target && games.B === target) {
    return { ...state, currentSet: { ...next, tieBreak: { A: 0, B: 0 } } }
  }
  return { ...state, currentSet: next }
}

/**
 * Called when status === 'awaitingTieDecision' (an even number of games/sets
 * ended level). Either end the match as a draw, or play one extra game/set.
 */
export function resolveTie(state: MatchState, decision: TieDecision): MatchState {
  if (state.status !== 'awaitingTieDecision') return state
  const format = state.config.format

  if (decision === 'draw') {
    if (state.currentSet) {
      // Games mode: archive the level set so the final score stays visible.
      const result: SetResult = {
        kind: 'fixedGames',
        games: state.currentSet.games,
        tieBreak: null,
        winner: null,
      }
      return {
        ...state,
        completedSets: [...state.completedSets, result],
        currentSet: null,
        status: 'complete',
        winner: 'draw',
      }
    }
    return { ...state, status: 'complete', winner: 'draw' }
  }

  // decision === 'extra'
  if (format.kind === 'games' && state.currentSet) {
    const limit = (state.currentSet.gameLimit ?? 0) + 1
    return {
      ...state,
      currentSet: { ...state.currentSet, gameLimit: limit },
      status: 'inProgress',
    }
  }
  return {
    ...state,
    plannedSets: state.plannedSets + 1,
    currentSet: newSet('normal', null),
    status: 'inProgress',
  }
}

// ---------------------------------------------------------------------------
// Display helper: turns state into what the UI needs, so the UI has no rules.
// ---------------------------------------------------------------------------

export interface Scoreboard {
  status: MatchState['status']
  winner: MatchState['winner']
  completedSets: SetResult[]
  setsWon: Score
  current: null | {
    kind: SetKind
    games: Score
    /** 0/15/30/40/Ad labels, or null while in a tie-break. */
    gameLabels: Record<TeamId, string> | null
    /** Tie-break points, or null when playing a normal game. */
    tieBreak: Score | null
    isGoldenPoint: boolean
    gameLimit: number | null
  }
}

export function getScoreboard(state: MatchState): Scoreboard {
  const set = state.currentSet
  return {
    status: state.status,
    winner: state.winner,
    completedSets: state.completedSets,
    setsWon: setsWon(state.completedSets),
    current: set && {
      kind: set.kind,
      games: set.games,
      gameLabels: set.tieBreak ? null : gamePointLabels(set.game),
      tieBreak: set.tieBreak,
      isGoldenPoint: !set.tieBreak && isGoldenPoint(set.game, state.config.deuce),
      gameLimit: set.gameLimit,
    },
  }
}
