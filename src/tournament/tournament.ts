import { canUndo } from '../scoring'
import type { MatchHistory, Score, TeamId } from '../scoring'

/**
 * Tournament mode: a round robin of fixed-length "points" matches, a league table, and a final.
 *
 * Like the scoring engine this is plain data and pure functions (no React), so it can be saved
 * as JSON and tested on its own. A match is just the list of who won each point: the score, the
 * result and undo are all derived from that list.
 *
 * Rules:
 *  - League match: exactly `pointsPerMatch` points are played. A level score is a draw.
 *  - Table: win 3, draw 1, loss 0. Ties are split by points difference, then points scored,
 *    then the team's position in the setup list (so the order never jumps around).
 *  - Final: the top two teams play either a points match to `finalPoints` (no draws: if it is
 *    level at the target, the next point wins) or a regular padel match (`finalMatch`), which
 *    is scored by the normal scoring engine.
 */

export const WIN_POINTS = 3
export const DRAW_POINTS = 1
export const MIN_TEAMS = 3
export const MAX_TEAMS = 8
export const MIN_POINTS = 2
export const MAX_POINTS = 50
export const DEFAULT_POINTS = 16

export interface Fixture {
  /** Team indexes (positions in Tournament.teams). Side A is `a`, side B is `b`. */
  a: number
  b: number
  /** Round number, starting at 1. Matches in the same round involve different teams. */
  round: number
  /** Who won each point, in order. */
  log: TeamId[]
}

export interface Tournament {
  teams: string[]
  pointsPerMatch: number
  /** Every pairing once, in round order. */
  fixtures: Fixture[]
  /** The final, once it has been started. */
  final: Fixture | null
  /** Points target for the final (fixed when the final starts). Unused for a regular-match final. */
  finalPoints: number
  /**
   * Set when the final is a regular padel match instead of a points match. `final` still says
   * who plays (side A and B); its `log` stays empty because the match keeps its own score.
   */
  finalMatch?: MatchHistory | null
  /**
   * The match on the scoring screen: an index into `fixtures`, 'final', or null for the
   * tournament overview.
   */
  active: number | 'final' | null
}

export interface Standing {
  team: number
  name: string
  played: number
  won: number
  drawn: number
  lost: number
  pointsFor: number
  pointsAgainst: number
  diff: number
  /** League points (3 / 1 / 0). */
  points: number
}

// --- Setting up -------------------------------------------------------------------------

/** "Team 1", "Team 2"... for an empty name. */
export function defaultTeamName(index: number): string {
  return `Team ${index + 1}`
}

/**
 * Every pairing once, grouped in rounds so nobody plays twice in a round (the "circle method").
 * With an odd number of teams one team sits out each round.
 */
export function roundRobin(teamCount: number): { a: number; b: number; round: number }[] {
  const slots: (number | null)[] = Array.from({ length: teamCount }, (_, i) => i)
  if (slots.length % 2 === 1) slots.push(null) // the "bye"
  const n = slots.length
  const out: { a: number; b: number; round: number }[] = []

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const x = slots[i]
      const y = slots[n - 1 - i]
      if (x !== null && y !== null) out.push({ a: x, b: y, round: round + 1 })
    }
    // Keep the first slot fixed and rotate the rest by one.
    slots.splice(1, 0, slots.pop() as number | null)
  }
  return out
}

export function validateTournament(teamNames: string[], pointsPerMatch: number): string[] {
  const errors: string[] = []
  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS) {
    errors.push(`Use between ${MIN_TEAMS} and ${MAX_TEAMS} teams`)
  }
  if (!Number.isInteger(pointsPerMatch) || pointsPerMatch < MIN_POINTS || pointsPerMatch > MAX_POINTS) {
    errors.push(`Points per match must be between ${MIN_POINTS} and ${MAX_POINTS}`)
  }
  const names = teamNames.map((n, i) => (n.trim() || defaultTeamName(i)).toLowerCase())
  if (new Set(names).size !== names.length) errors.push('Give every team a different name')
  return errors
}

export function createTournament(teamNames: string[], pointsPerMatch: number): Tournament {
  return {
    teams: teamNames.map((n, i) => n.trim() || defaultTeamName(i)),
    pointsPerMatch,
    fixtures: roundRobin(teamNames.length).map((f) => ({ ...f, log: [] })),
    final: null,
    finalPoints: pointsPerMatch,
    active: null,
  }
}

/** The number of league matches for a number of teams (each pair meets once). */
export function matchCount(teamCount: number): number {
  return (teamCount * (teamCount - 1)) / 2
}

// --- Reading a match --------------------------------------------------------------------

export function fixtureScore(f: Fixture): Score {
  const score: Score = { A: 0, B: 0 }
  for (const p of f.log) score[p]++
  return score
}

/** League matches end after exactly `target` points. Finals end at the target once not level. */
export function isFixtureDone(f: Fixture, target: number, isFinal: boolean): boolean {
  if (!isFinal) return f.log.length >= target
  const s = fixtureScore(f)
  return f.log.length >= target && s.A !== s.B
}

/** null while unfinished, 'draw' for a level league match. */
export function fixtureWinner(f: Fixture, target: number, isFinal: boolean): TeamId | 'draw' | null {
  if (!isFixtureDone(f, target, isFinal)) return null
  const s = fixtureScore(f)
  return s.A === s.B ? 'draw' : s.A > s.B ? 'A' : 'B'
}

// --- Playing ----------------------------------------------------------------------------

/** Returns the fixture with one more point, or the same object if the match is already over. */
export function addPoint(f: Fixture, team: TeamId, target: number, isFinal: boolean): Fixture {
  if (isFixtureDone(f, target, isFinal)) return f
  return { ...f, log: [...f.log, team] }
}

/** Takes back the last point. Works on finished matches too, which reopens them. */
export function removeLastPoint(f: Fixture): Fixture {
  return f.log.length === 0 ? f : { ...f, log: f.log.slice(0, -1) }
}

/** Replace the fixture being played (a league match or the final). */
export function updateActive(t: Tournament, next: Fixture): Tournament {
  if (t.active === 'final') return { ...t, final: next }
  if (t.active === null) return t
  return { ...t, fixtures: t.fixtures.map((f, i) => (i === t.active ? next : f)) }
}

export function activeFixture(t: Tournament): Fixture | null {
  if (t.active === 'final') return t.final
  if (t.active === null) return null
  return t.fixtures[t.active] ?? null
}

// --- The table --------------------------------------------------------------------------

export function standings(t: Tournament): Standing[] {
  const rows: Standing[] = t.teams.map((name, team) => ({
    team,
    name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    points: 0,
  }))

  for (const f of t.fixtures) {
    const winner = fixtureWinner(f, t.pointsPerMatch, false)
    if (winner === null) continue
    const s = fixtureScore(f)
    const a = rows[f.a]
    const b = rows[f.b]
    a.played++
    b.played++
    a.pointsFor += s.A
    a.pointsAgainst += s.B
    b.pointsFor += s.B
    b.pointsAgainst += s.A
    if (winner === 'draw') {
      a.drawn++
      b.drawn++
      a.points += DRAW_POINTS
      b.points += DRAW_POINTS
    } else {
      const [won, lost] = winner === 'A' ? [a, b] : [b, a]
      won.won++
      won.points += WIN_POINTS
      lost.lost++
    }
  }

  for (const r of rows) r.diff = r.pointsFor - r.pointsAgainst
  return rows.sort(
    (x, y) =>
      y.points - x.points || y.diff - x.diff || y.pointsFor - x.pointsFor || x.team - y.team,
  )
}

export function leagueDone(t: Tournament): boolean {
  return t.fixtures.every((f) => isFixtureDone(f, t.pointsPerMatch, false))
}

export function playedCount(t: Tournament): number {
  return t.fixtures.filter((f) => isFixtureDone(f, t.pointsPerMatch, false)).length
}

/**
 * True when the table cannot say who is 2nd and 3rd: they are level on points, difference and
 * points scored. The app then lets you pick the finalists yourself.
 */
export function finalistsTied(t: Tournament): boolean {
  const table = standings(t)
  if (table.length < 3) return false
  const [, second, third] = table
  return (
    second.points === third.points &&
    second.diff === third.diff &&
    second.pointsFor === third.pointsFor
  )
}

// --- The final --------------------------------------------------------------------------

/** Starts the final between two teams (by default the top two). Returns the same tournament if it is not allowed yet. */
export function startFinal(
  t: Tournament,
  finalPoints: number,
  finalists?: [number, number],
  /** Pass a fresh match to play the final as a regular padel match. */
  match?: MatchHistory,
): Tournament {
  if (!leagueDone(t) || t.final) return t
  const [x, y] = finalists ?? [standings(t)[0].team, standings(t)[1].team]
  if (x === y) return t
  return {
    ...t,
    finalPoints,
    final: { a: x, b: y, round: t.fixtures.length + 1, log: [] },
    finalMatch: match ?? null,
    active: 'final',
  }
}

/** True once any point has been played in the final. */
export function finalStarted(t: Tournament): boolean {
  if (!t.final) return false
  return t.finalMatch ? canUndo(t.finalMatch) : t.final.log.length > 0
}

/** The final can be dropped (for example to change its format) as long as no point is played. */
export function cancelFinal(t: Tournament): Tournament {
  if (!t.final || finalStarted(t)) return t
  return { ...t, final: null, finalMatch: null, active: null }
}

export function champion(t: Tournament): number | null {
  if (!t.final) return null
  if (t.finalMatch) {
    const w = t.finalMatch.present.winner
    if (w !== 'A' && w !== 'B') return null // unfinished, or a drawn final
    return w === 'A' ? t.final.a : t.final.b
  }
  const w = fixtureWinner(t.final, t.finalPoints, true)
  if (w === null || w === 'draw') return null
  return w === 'A' ? t.final.a : t.final.b
}

/** Plain-text summary of a score, e.g. "9-7". */
export function scoreText(f: Fixture): string {
  const s = fixtureScore(f)
  return `${s.A}-${s.B}`
}
