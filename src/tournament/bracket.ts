import { canUndo, createHistory, getScoreboard } from '../scoring'
import type { MatchConfig, MatchHistory, TeamId } from '../scoring'
import { addPoint, fixtureScore, fixtureWinner, removeLastPoint } from './tournament'
import type { Fixture } from './tournament'
import { looksLikeConfig, looksLikeMatchHistory } from './validate'

/**
 * Double elimination for 4 or 8 teams. A team is out after its second loss. Matches are numbered
 * M1, M2... in the order they are listed in STRUCTURES, and a later match names its teams as
 * "winner of M3" or "loser of M3", so who plays whom is worked out from earlier results.
 *
 *   4 teams (6 matches)
 *     Winners   M1: seed 1 v 2   M2: seed 3 v 4   M3: W M1 v W M2
 *     Losers    M4: L M1 v L M2  M5: W M4 v L M3
 *     Final     M6: W M3 v W M5
 *
 *   8 teams (14 matches)
 *     Winners   M1-M4: round one   M5, M6: semi-finals   M7: winners' final
 *     Losers    M8, M9: losers of round one play each other
 *               M10, M11: winners of those meet the semi-final losers
 *               M12: losers' semi-final   M13: W M12 v L M7
 *     Final     M14: W M7 v W M13
 *
 * The grand final is a single match (no reset). Every match needs a winner. A points match plays
 * on if level at the target; a regular match can't end as a draw.
 *
 * The whole bracket is played one of two ways, chosen when it is created: points matches (each
 * match's `log` is the list of who won each point) or regular padel matches with one set of rules
 * (`config`; each match then keeps its own score in `match`, scored by the normal engine).
 */

export const BRACKET_SIZES = [4, 8] as const
export type BracketSize = (typeof BRACKET_SIZES)[number]

export interface BracketMatch {
  /** Who won each point of a points match, in order. Side A is the first slot of the match. */
  log: TeamId[]
  /** The score of a regular match. Created when the match is opened; unused for points matches. */
  match?: MatchHistory | null
}

export interface Bracket {
  teams: string[]
  /** Points target for points matches. */
  points: number
  /** Rules for regular matches. Left out (or null) = every match is a points match. */
  config?: MatchConfig | null
  matches: BracketMatch[]
  /** The match on the scoring screen (index into `matches`), or null for the overview. */
  active: number | null
}

type Slot = { seed: number } | { winner: number } | { loser: number }
export type Section = 'Winners bracket' | 'Losers bracket' | 'Grand final'
export interface MatchSpec {
  section: Section
  a: Slot
  b: Slot
}

const W: Section = 'Winners bracket'
const L: Section = 'Losers bracket'
const G: Section = 'Grand final'

export const STRUCTURES: Record<BracketSize, MatchSpec[]> = {
  4: [
    { section: W, a: { seed: 0 }, b: { seed: 1 } },
    { section: W, a: { seed: 2 }, b: { seed: 3 } },
    { section: W, a: { winner: 0 }, b: { winner: 1 } },
    { section: L, a: { loser: 0 }, b: { loser: 1 } },
    { section: L, a: { winner: 3 }, b: { loser: 2 } },
    { section: G, a: { winner: 2 }, b: { winner: 4 } },
  ],
  8: [
    { section: W, a: { seed: 0 }, b: { seed: 1 } }, // M1
    { section: W, a: { seed: 2 }, b: { seed: 3 } }, // M2
    { section: W, a: { seed: 4 }, b: { seed: 5 } }, // M3
    { section: W, a: { seed: 6 }, b: { seed: 7 } }, // M4
    { section: W, a: { winner: 0 }, b: { winner: 1 } }, // M5
    { section: W, a: { winner: 2 }, b: { winner: 3 } }, // M6
    { section: W, a: { winner: 4 }, b: { winner: 5 } }, // M7
    { section: L, a: { loser: 0 }, b: { loser: 1 } }, // M8
    { section: L, a: { loser: 2 }, b: { loser: 3 } }, // M9
    { section: L, a: { winner: 7 }, b: { loser: 5 } }, // M10
    { section: L, a: { winner: 8 }, b: { loser: 4 } }, // M11
    { section: L, a: { winner: 9 }, b: { winner: 10 } }, // M12
    { section: L, a: { winner: 11 }, b: { loser: 6 } }, // M13
    { section: G, a: { winner: 6 }, b: { winner: 12 } }, // M14
  ],
}

export function structureFor(b: Bracket): MatchSpec[] {
  return STRUCTURES[b.teams.length as BracketSize]
}

export function createBracket(
  teamNames: string[],
  points: number,
  config: MatchConfig | null = null,
): Bracket {
  const size = teamNames.length as BracketSize
  return {
    teams: teamNames.map((n, i) => n.trim() || `Team ${i + 1}`),
    points,
    config,
    matches: STRUCTURES[size].map(() => ({ log: [] })),
    active: null,
  }
}

/** The points of match i as a Fixture, so the points scorer and score helpers can be reused. */
export function matchFixture(b: Bracket, i: number): Fixture {
  return { a: 0, b: 1, round: i + 1, log: b.matches[i].log }
}

/** True once any point has been played in match i, whichever kind it is. */
export function matchStarted(b: Bracket, i: number): boolean {
  const m = b.matches[i]
  return m.log.length > 0 || (m.match ? canUndo(m.match) : false)
}

/** 'A' or 'B' once the match is over (never a draw), else null. */
export function matchResult(b: Bracket, i: number): TeamId | null {
  const m = b.matches[i]
  if (m.match) {
    const w = m.match.present.winner
    return w === 'A' || w === 'B' ? w : null
  }
  const w = fixtureWinner(matchFixture(b, i), b.points, true)
  return w === 'A' || w === 'B' ? w : null
}

/** The score as text, e.g. "9-7" for points, or sets (or games) for a regular match. */
export function matchScoreText(b: Bracket, i: number): string {
  const m = b.matches[i]
  if (!m.match) {
    const s = fixtureScore(matchFixture(b, i))
    return `${s.A}-${s.B}`
  }
  const board = getScoreboard(m.match.present)
  if (m.match.present.config.format.kind === 'games') {
    const g = board.current?.games ?? board.completedSets[0]?.games ?? { A: 0, B: 0 }
    return `${g.A}-${g.B}`
  }
  return `${board.setsWon.A}-${board.setsWon.B}`
}

function slotTeam(b: Bracket, slot: Slot): number | null {
  if ('seed' in slot) return slot.seed
  const m = 'winner' in slot ? slot.winner : slot.loser
  const result = matchResult(b, m)
  if (result === null) return null
  const [a, c] = participants(b, m)
  const won = result === 'A' ? a : c
  const lost = result === 'A' ? c : a
  return 'winner' in slot ? won : lost
}

/** The team that won match i, or null until it is over. */
export function winnerOf(b: Bracket, i: number): number | null {
  return slotTeam(b, { winner: i })
}

/** The team that lost match i, or null until it is over. */
export function loserOf(b: Bracket, i: number): number | null {
  return slotTeam(b, { loser: i })
}

/** Team indexes playing match i (side A, side B). null = not known yet. */
export function participants(b: Bracket, i: number): [number | null, number | null] {
  const spec = structureFor(b)[i]
  return [slotTeam(b, spec.a), slotTeam(b, spec.b)]
}

/** What to show for an empty slot, e.g. "Winner of M1". */
export function slotLabel(b: Bracket, i: number, side: 'a' | 'b'): string {
  const slot = structureFor(b)[i][side]
  if ('seed' in slot) return ''
  return 'winner' in slot ? `Winner of M${slot.winner + 1}` : `Loser of M${slot.loser + 1}`
}

export function canPlay(b: Bracket, i: number): boolean {
  const [x, y] = participants(b, i)
  return x !== null && y !== null
}

export function isDone(b: Bracket, i: number): boolean {
  return matchResult(b, i) !== null
}

/** Which later matches use this match's result. */
function dependents(b: Bracket, i: number): number[] {
  return structureFor(b).flatMap((s, j) =>
    [s.a, s.b].some(
      (slot) => ('winner' in slot && slot.winner === i) || ('loser' in slot && slot.loser === i),
    )
      ? [j]
      : [],
  )
}

/** A result can't be changed once a match that depends on it has started: the bracket would no longer add up. */
export function isLocked(b: Bracket, i: number): boolean {
  return dependents(b, i).some((j) => matchStarted(b, j))
}

function setMatch(b: Bracket, i: number, next: BracketMatch): Bracket {
  return { ...b, matches: b.matches.map((m, j) => (j === i ? next : m)) }
}

/** One more point in a points match. Ignored if it is over, a regular match, or not ready. */
export function bracketPoint(b: Bracket, i: number, team: TeamId): Bracket {
  const m = b.matches[i]
  if (m.match || !canPlay(b, i)) return b
  const next = addPoint(matchFixture(b, i), team, b.points, true)
  return next.log === m.log ? b : setMatch(b, i, { ...m, log: next.log })
}

/** Takes back the last point of a points match, unless a later match already depends on it. */
export function bracketUndo(b: Bracket, i: number): Bracket {
  const m = b.matches[i]
  if (m.match || isLocked(b, i)) return b
  const next = removeLastPoint(matchFixture(b, i))
  return next.log === m.log ? b : setMatch(b, i, { ...m, log: next.log })
}

/** Opens match i on the scoring screen. In a regular-match bracket this sets up its fresh score. */
export function openMatch(b: Bracket, i: number): Bracket {
  const m = b.matches[i]
  const ready = b.config && !m.match && !matchStarted(b, i)
  return { ...(ready ? setMatch(b, i, { log: [], match: createHistory(b.config as MatchConfig) }) : b), active: i }
}

/** Closes the scoring screen. A regular match nobody has scored yet is dropped, so it starts fresh next time. */
export function closeMatch(b: Bracket): Bracket {
  const i = b.active
  if (i === null) return b
  const next = !matchStarted(b, i) && b.matches[i].match ? setMatch(b, i, { log: [] }) : b
  return { ...next, active: null }
}

/** Store a new score for a regular match (from the normal scorer). */
export function updateRegularMatch(b: Bracket, i: number, history: MatchHistory): Bracket {
  const m = b.matches[i]
  if (!m.match || !canPlay(b, i)) return b
  return setMatch(b, i, { ...m, match: history })
}

export function bracketChampion(b: Bracket): number | null {
  const last = structureFor(b).length - 1
  return winnerOf(b, last)
}

export function bracketPlayed(b: Bracket): number {
  return b.matches.filter((_, i) => isDone(b, i)).length
}

export function looksLikeBracket(v: unknown): v is Bracket {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.teams) || !o.teams.every((t) => typeof t === 'string')) return false
  const structure = STRUCTURES[o.teams.length as BracketSize]
  if (!structure) return false
  const pts = o.points
  if (typeof pts !== 'number' || !Number.isInteger(pts) || pts < 2 || pts > 50) return false
  const cfg = o.config
  if (cfg !== undefined && cfg !== null && !looksLikeConfig(cfg)) return false
  if (!Array.isArray(o.matches) || o.matches.length !== structure.length) return false
  const goodMatch = (m: unknown) => {
    if (typeof m !== 'object' || m === null) return false
    const { log, match } = m as { log?: unknown; match?: unknown }
    if (!Array.isArray(log) || !log.every((p) => p === 'A' || p === 'B')) return false
    return match === undefined || match === null || looksLikeMatchHistory(match)
  }
  if (!o.matches.every(goodMatch)) return false
  const a = o.active
  return a === null || (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < structure.length)
}
