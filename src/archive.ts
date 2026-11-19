import type { MatchConfig, MatchState, Score, SetResult, TeamId } from './scoring'
import { setsWon } from './scoring'
import type { Teams } from './setup'
import { teamName } from './setup'

/**
 * Match history: a record of each finished match. Pure data and helpers, no React and no storage,
 * so it can be tested on its own.
 */

export interface FinishedMatch {
  id: string
  /** When the match ended, as milliseconds since 1970 (what Date.now() returns). */
  finishedAt: number
  teams: Teams
  config: MatchConfig
  completedSets: SetResult[]
  winner: TeamId | 'draw'
}

/** History is kept on the device only; this stops it growing forever. */
export const MAX_FINISHED = 200

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to the simple version
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Returns null unless the match really is finished. */
export function finishedFromState(input: {
  id: string
  finishedAt: number
  teams: Teams
  state: MatchState
}): FinishedMatch | null {
  const { state } = input
  if (state.status !== 'complete' || state.winner === null) return null
  return {
    id: input.id,
    finishedAt: input.finishedAt,
    teams: input.teams,
    config: state.config,
    completedSets: state.completedSets,
    winner: state.winner,
  }
}

/** Newest first. Replaces an entry with the same id, and drops the oldest beyond the cap. */
export function addFinished(list: FinishedMatch[], entry: FinishedMatch): FinishedMatch[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_FINISHED)
}

/** Short description of the rules, e.g. "Best of 3 sets" or "3 games". */
export function formatLabel(config: MatchConfig): string {
  const f = config.format
  if (f.kind === 'games') return f.numberOfGames === 1 ? '1 game' : `${f.numberOfGames} games`
  if (f.numberOfSets === 1) return 'Single set'
  if (f.playAll) return `${f.numberOfSets} sets, all played`
  const base = `Best of ${f.numberOfSets} sets`
  return f.superTieBreakDecider ? `${base}, super tie-break` : base
}

/** The big number for each team: sets won, or games won in the games-only format. */
export function headlineScore(entry: FinishedMatch): Score {
  if (entry.config.format.kind === 'games') {
    const games = entry.completedSets[0]?.games
    return games ? { A: games.A, B: games.B } : { A: 0, B: 0 }
  }
  return setsWon(entry.completedSets)
}

/** Each set as text, e.g. ["6-3", "7-6(4)", "10-8 TB"]. Empty in the games-only format. */
export function setScoreLines(entry: FinishedMatch): string[] {
  if (entry.config.format.kind === 'games') return []
  return entry.completedSets.map((r) => {
    if (r.kind === 'superTieBreak') return `${r.tieBreak?.A ?? 0}-${r.tieBreak?.B ?? 0} TB`
    const base = `${r.games.A}-${r.games.B}`
    // Convention: show the loser's tie-break points in brackets, as in 7-6(4).
    if (r.tieBreak && r.winner) {
      const loser: TeamId = r.winner === 'A' ? 'B' : 'A'
      return `${base}(${r.tieBreak[loser]})`
    }
    return base
  })
}

export function resultTitle(entry: FinishedMatch): string {
  return entry.winner === 'draw' ? 'Draw' : `${teamName(entry.winner, entry.teams)} won`
}
