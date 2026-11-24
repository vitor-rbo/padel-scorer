import { validateConfig } from '../scoring'
import type { Fixture, Tournament } from './tournament'
import { MAX_POINTS, MAX_TEAMS, MIN_POINTS, MIN_TEAMS } from './tournament'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function looksLikeFixture(v: unknown, teamCount: number): v is Fixture {
  if (!isObject(v)) return false
  const index = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < teamCount
  return (
    index(v.a) &&
    index(v.b) &&
    v.a !== v.b &&
    typeof v.round === 'number' &&
    Array.isArray(v.log) &&
    v.log.every((p) => p === 'A' || p === 'B')
  )
}

/** True for usable match rules. The engine's validator expects a complete config, so a damaged one must not crash it. */
export function looksLikeConfig(v: unknown): boolean {
  try {
    return isObject(v) && validateConfig(v as never).length === 0
  } catch {
    return false
  }
}

export function looksLikeMatchHistory(v: unknown): boolean {
  if (!isObject(v) || !Array.isArray(v.past) || !isObject(v.present)) return false
  const present = v.present
  if (!isObject(present.config) || !Array.isArray(present.completedSets)) return false
  if (typeof present.status !== 'string') return false
  return looksLikeConfig(present.config)
}

/** Checks saved data before we trust it. Anything odd means "no tournament", never a crash. */
export function looksLikeTournament(v: unknown): v is Tournament {
  if (!isObject(v) || !Array.isArray(v.teams) || !Array.isArray(v.fixtures)) return false
  const teams = v.teams
  if (teams.length < MIN_TEAMS || teams.length > MAX_TEAMS) return false
  if (!teams.every((t) => typeof t === 'string')) return false
  const inRange = (n: unknown) =>
    Number.isInteger(n) && (n as number) >= MIN_POINTS && (n as number) <= MAX_POINTS
  if (!inRange(v.pointsPerMatch) || !inRange(v.finalPoints)) return false
  if (!v.fixtures.every((f) => looksLikeFixture(f, teams.length))) return false
  if (v.final !== null && !looksLikeFixture(v.final, teams.length)) return false
  // Tournaments saved before regular-match finals existed have no finalMatch.
  const fm = v.finalMatch
  if (fm !== undefined && fm !== null && !(v.final !== null && looksLikeMatchHistory(fm))) return false
  const { active } = v
  if (active === null || active === 'final') return active !== 'final' || v.final !== null
  return Number.isInteger(active) && (active as number) >= 0 && (active as number) < v.fixtures.length
}
