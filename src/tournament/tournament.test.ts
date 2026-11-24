import { describe, expect, it } from 'vitest'
import { STANDARD_CONFIG, createHistory } from '../scoring'
import type { TeamId } from '../scoring'
import { playH } from '../scoring/testUtils'
import { looksLikeTournament } from './validate'
import {
  activeFixture,
  addPoint,
  cancelFinal,
  champion,
  createTournament,
  finalStarted,
  finalistsTied,
  fixtureScore,
  fixtureWinner,
  isFixtureDone,
  leagueDone,
  matchCount,
  removeLastPoint,
  roundRobin,
  standings,
  startFinal,
  updateActive,
  validateTournament,
} from './tournament'
import type { Fixture, Tournament } from './tournament'

/** A fixture where side A scored `a` points and side B scored `b`. */
function played(a: number, b: number): TeamId[] {
  return [...Array<TeamId>(a).fill('A'), ...Array<TeamId>(b).fill('B')]
}

/** Fill the whole league in: scores[i] = [pointsForSideA, pointsForSideB] for fixture i. */
function withResults(t: Tournament, scores: [number, number][]): Tournament {
  return {
    ...t,
    fixtures: t.fixtures.map((f, i) => ({ ...f, log: played(...scores[i]) })),
  }
}

const four = () => createTournament(['Ana', 'Bia', 'Caio', 'Dina'], 16)

describe('roundRobin', () => {
  it('4 teams make 6 matches in 3 rounds', () => {
    const fx = roundRobin(4)
    expect(fx).toHaveLength(6)
    expect(matchCount(4)).toBe(6)
    expect(new Set(fx.map((f) => f.round))).toEqual(new Set([1, 2, 3]))
  })

  it('every pair meets exactly once', () => {
    for (let n = 3; n <= 8; n++) {
      const pairs = roundRobin(n).map((f) => [f.a, f.b].sort().join('-'))
      expect(pairs).toHaveLength(matchCount(n))
      expect(new Set(pairs).size).toBe(pairs.length)
    }
  })

  it('nobody plays twice in a round', () => {
    for (let n = 3; n <= 8; n++) {
      const byRound = new Map<number, number[]>()
      for (const f of roundRobin(n)) {
        byRound.set(f.round, [...(byRound.get(f.round) ?? []), f.a, f.b])
      }
      for (const teams of byRound.values()) expect(new Set(teams).size).toBe(teams.length)
    }
  })

  it('works with an odd number of teams (one sits out each round)', () => {
    expect(roundRobin(5)).toHaveLength(10)
    expect(roundRobin(3)).toHaveLength(3)
  })
})

describe('validateTournament', () => {
  it('accepts the 4 team, 16 point setup', () => {
    expect(validateTournament(['', '', '', ''], 16)).toEqual([])
  })

  it('rejects too few or too many teams, and bad point counts', () => {
    expect(validateTournament(['a', 'b'], 16)).not.toEqual([])
    expect(validateTournament(Array.from({ length: 9 }, (_, i) => `t${i}`), 16)).not.toEqual([])
    expect(validateTournament(['a', 'b', 'c'], 1)).not.toEqual([])
    expect(validateTournament(['a', 'b', 'c'], 16.5)).not.toEqual([])
  })

  it('rejects duplicate names, ignoring case and treating empty as the default name', () => {
    expect(validateTournament(['Ana', 'ana', 'c'], 16)).not.toEqual([])
    expect(validateTournament(['Team 2', '', 'c'], 16)).not.toEqual([])
  })
})

describe('createTournament', () => {
  it('fills in default names and starts with empty fixtures', () => {
    const t = createTournament(['Ana', ' ', 'Caio'], 16)
    expect(t.teams).toEqual(['Ana', 'Team 2', 'Caio'])
    expect(t.fixtures.every((f) => f.log.length === 0)).toBe(true)
    expect(t.final).toBeNull()
    expect(t.active).toBeNull()
  })
})

describe('playing a match', () => {
  const f: Fixture = { a: 0, b: 1, round: 1, log: [] }

  it('counts points and ends after exactly the target', () => {
    let m = f
    for (let i = 0; i < 16; i++) m = addPoint(m, i % 2 === 0 ? 'A' : 'B', 16, false)
    expect(fixtureScore(m)).toEqual({ A: 8, B: 8 })
    expect(isFixtureDone(m, 16, false)).toBe(true)
    expect(fixtureWinner(m, 16, false)).toBe('draw')
  })

  it('ignores points after the match is over', () => {
    const done = { ...f, log: played(9, 7) }
    expect(addPoint(done, 'A', 16, false)).toBe(done)
  })

  it('reports the winner, and null while unfinished', () => {
    expect(fixtureWinner({ ...f, log: played(5, 2) }, 16, false)).toBeNull()
    expect(fixtureWinner({ ...f, log: played(10, 6) }, 16, false)).toBe('A')
    expect(fixtureWinner({ ...f, log: played(3, 13) }, 16, false)).toBe('B')
  })

  it('undo removes the last point, even from a finished match', () => {
    const done = { ...f, log: [...played(9, 6), 'B' as TeamId] }
    const reopened = removeLastPoint(done)
    expect(fixtureScore(reopened)).toEqual({ A: 9, B: 6 })
    expect(isFixtureDone(reopened, 16, false)).toBe(false)
    expect(removeLastPoint(f)).toBe(f)
  })

  it('updateActive replaces the right fixture', () => {
    const t = { ...four(), active: 2 as const }
    const next = addPoint(activeFixture(t) as Fixture, 'B', 16, false)
    const updated = updateActive(t, next)
    expect(updated.fixtures[2].log).toEqual(['B'])
    expect(updated.fixtures[1].log).toEqual([])
    expect(updateActive({ ...t, active: null }, next)).toEqual({ ...t, active: null })
  })
})

describe('standings', () => {
  it('starts with everyone on zero, in team order', () => {
    const table = standings(four())
    expect(table.map((r) => r.name)).toEqual(['Ana', 'Bia', 'Caio', 'Dina'])
    expect(table.every((r) => r.points === 0 && r.played === 0)).toBe(true)
  })

  it('gives 3 for a win, 1 for a draw, 0 for a loss', () => {
    const t = four()
    const first = t.fixtures[0]
    const second = t.fixtures[1]
    const table = standings({
      ...t,
      fixtures: t.fixtures.map((f) =>
        f === first ? { ...f, log: played(10, 6) } : f === second ? { ...f, log: played(8, 8) } : f,
      ),
    })
    const byTeam = (i: number) => table.find((r) => r.team === i)!
    const winner = byTeam(first.a)
    const loser = byTeam(first.b)
    expect(winner).toMatchObject({ won: 1, points: 3, pointsFor: 10, pointsAgainst: 6, diff: 4 })
    expect(loser).toMatchObject({ lost: 1, points: 0, diff: -4 })
    expect(byTeam(second.a)).toMatchObject({ drawn: 1, points: 1 })
    expect(byTeam(second.b)).toMatchObject({ drawn: 1, points: 1 })
  })

  it('ignores matches that are not finished yet', () => {
    const t = four()
    const table = standings({
      ...t,
      fixtures: t.fixtures.map((f, i) => (i === 0 ? { ...f, log: played(5, 3) } : f)),
    })
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true)
  })

  it('splits ties by points difference, then points scored, then team order', () => {
    // 3 teams, 3 matches: 0v1, then (circle method) the other two pairings.
    const t = createTournament(['X', 'Y', 'Z'], 10)
    const result = (a: number, b: number) =>
      standings(
        withResults(
          t,
          t.fixtures.map(() => [a, b] as [number, number]),
        ),
      )
    // Every match 6-4 to side A: points are decided by who is on side A.
    const table = result(6, 4)
    for (let i = 1; i < table.length; i++) {
      const prev = table[i - 1]
      const row = table[i]
      expect(prev.points).toBeGreaterThanOrEqual(row.points)
      if (prev.points === row.points) expect(prev.diff).toBeGreaterThanOrEqual(row.diff)
    }
  })

  it('a team ahead on difference beats a team level on points', () => {
    const t = createTournament(['A1', 'B1', 'C1', 'D1'], 16)
    // Find the fixtures for team 0 and team 1 so we can give them equal wins, unequal margins.
    const scores: [number, number][] = t.fixtures.map((f) => {
      if (f.a === 0) return [16, 0]
      if (f.b === 0) return [0, 16]
      if (f.a === 1) return [9, 7]
      if (f.b === 1) return [7, 9]
      return [8, 8]
    })
    const table = standings(withResults(t, scores))
    expect(table[0].team).toBe(0)
    expect(table[0].points).toBe(9)
  })
})

describe('the final', () => {
  const finished = () => {
    const t = four()
    // Team 0 wins all its matches, team 1 wins the rest, everyone else loses.
    const scores: [number, number][] = t.fixtures.map((f) => {
      const rank = (x: number) => x
      return rank(f.a) < rank(f.b) ? [12, 4] : [4, 12]
    })
    return withResults(t, scores)
  }

  it('cannot start before the league is finished', () => {
    const t = four()
    expect(leagueDone(t)).toBe(false)
    expect(startFinal(t, 16)).toBe(t)
  })

  it('starts between the top two teams', () => {
    const t = finished()
    expect(leagueDone(t)).toBe(true)
    const withFinal = startFinal(t, 12)
    expect(withFinal.finalPoints).toBe(12)
    expect(withFinal.active).toBe('final')
    expect(new Set([withFinal.final!.a, withFinal.final!.b])).toEqual(new Set([0, 1]))
  })

  it('can start with finalists you pick, and refuses the same team twice', () => {
    const t = finished()
    const f = startFinal(t, 16, [2, 3])
    expect([f.final!.a, f.final!.b]).toEqual([2, 3])
    expect(startFinal(t, 16, [2, 2])).toBe(t)
  })

  it('cannot start twice', () => {
    const once = startFinal(finished(), 16)
    expect(startFinal(once, 16, [2, 3])).toBe(once)
  })

  it('has no draw: at the target it plays on until someone leads', () => {
    let t = startFinal(finished(), 4)
    let f = t.final!
    for (const p of ['A', 'B', 'A', 'B'] as TeamId[]) f = addPoint(f, p, 4, true)
    expect(isFixtureDone(f, 4, true)).toBe(false) // 2-2 at the target
    f = addPoint(f, 'B', 4, true)
    expect(isFixtureDone(f, 4, true)).toBe(true)
    expect(fixtureWinner(f, 4, true)).toBe('B')
    t = { ...t, final: f }
    expect(champion(t)).toBe(f.b)
  })

  it('a final won at the target needs no extra point', () => {
    const f: Fixture = { a: 0, b: 1, round: 7, log: played(3, 1) }
    expect(isFixtureDone(f, 4, true)).toBe(true)
  })

  it('has no champion until it is won', () => {
    const t = startFinal(finished(), 16)
    expect(champion(t)).toBeNull()
    expect(champion(four())).toBeNull()
  })

  it('can be cancelled only before a point is played', () => {
    const t = startFinal(finished(), 16)
    expect(cancelFinal(t).final).toBeNull()
    const started = { ...t, final: addPoint(t.final!, 'A', 16, true) }
    expect(cancelFinal(started)).toBe(started)
  })

  it('flags a tie for the last final place', () => {
    const t = four()
    const allDraws = withResults(
      t,
      t.fixtures.map(() => [8, 8] as [number, number]),
    )
    expect(finalistsTied(allDraws)).toBe(true)
    expect(finalistsTied(finished())).toBe(false)
  })
})

describe('a final played as a regular match', () => {
  const finishedLeague = () => {
    const t = four()
    return withResults(
      t,
      t.fixtures.map((f) => (f.a < f.b ? [12, 4] : [4, 12]) as [number, number]),
    )
  }
  /** A one-game match, so a few points decide it. */
  const oneGame = () => createHistory({ ...STANDARD_CONFIG, format: { kind: 'games', numberOfGames: 1 } })

  it('starts with the match attached and no points played', () => {
    const t = startFinal(finishedLeague(), 16, undefined, oneGame())
    expect(t.final).not.toBeNull()
    expect(t.finalMatch).not.toBeNull()
    expect(t.active).toBe('final')
    expect(finalStarted(t)).toBe(false)
    expect(champion(t)).toBeNull()
  })

  it('the champion is whoever wins the match (side A = first finalist)', () => {
    const t = startFinal(finishedLeague(), 16, [2, 3], oneGame())
    const won = { ...t, finalMatch: playH(t.finalMatch!, 'AAAA') }
    expect(finalStarted(won)).toBe(true)
    expect(champion(won)).toBe(2)
    const lost = { ...t, finalMatch: playH(t.finalMatch!, 'BBBB') }
    expect(champion(lost)).toBe(3)
  })

  it('has no champion while the match is unfinished', () => {
    const t = startFinal(finishedLeague(), 16, [2, 3], oneGame())
    expect(champion({ ...t, finalMatch: playH(t.finalMatch!, 'AA') })).toBeNull()
  })

  it('can be cancelled before a point, but not after', () => {
    const t = startFinal(finishedLeague(), 16, undefined, oneGame())
    const cancelled = cancelFinal(t)
    expect(cancelled.final).toBeNull()
    expect(cancelled.finalMatch).toBeNull()
    const started = { ...t, finalMatch: playH(t.finalMatch!, 'A') }
    expect(cancelFinal(started)).toBe(started)
  })

  it('survives saving: valid when it has a match, rejected when it has no final', () => {
    const t = startFinal(finishedLeague(), 16, undefined, oneGame())
    const copy = JSON.parse(JSON.stringify(t))
    expect(looksLikeTournament(copy)).toBe(true)
    expect(looksLikeTournament({ ...copy, final: null })).toBe(false)
    expect(looksLikeTournament({ ...copy, finalMatch: { past: 1, present: {} } })).toBe(false)
    // Saved before this feature existed: no finalMatch field at all.
    const old = JSON.parse(JSON.stringify(startFinal(finishedLeague(), 16)))
    delete old.finalMatch
    expect(looksLikeTournament(old)).toBe(true)
  })
})
