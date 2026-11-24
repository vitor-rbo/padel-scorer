import { describe, expect, it } from 'vitest'
import { STANDARD_CONFIG } from '../scoring'
import type { TeamId } from '../scoring'
import { playH } from '../scoring/testUtils'
import {
  STRUCTURES,
  bracketChampion,
  bracketPlayed,
  bracketPoint,
  bracketUndo,
  canPlay,
  closeMatch,
  createBracket,
  isDone,
  isLocked,
  looksLikeBracket,
  loserOf,
  matchResult,
  matchScoreText,
  matchStarted,
  openMatch,
  participants,
  updateRegularMatch,
  winnerOf,
} from './bracket'
import type { Bracket } from './bracket'

/** Open a regular-match bracket's match i and give it a score, the way the scorer does. */
function score(b: Bracket, i: number, seq: string): Bracket {
  const opened = openMatch(b, i)
  return updateRegularMatch(opened, i, playH(opened.matches[i].match!, seq))
}

const fresh = () => createBracket(['Ana', 'Bia', 'Caio', 'Dina'], 4)

/** Play match i until side `side` has won it 4-0 (the target is 4). */
function win(b: Bracket, i: number, side: TeamId): Bracket {
  let next = b
  for (let k = 0; k < 4; k++) next = bracketPoint(next, i, side)
  return next
}

describe('double elimination bracket', () => {
  it('starts with the two first-round matches ready and the rest waiting', () => {
    const b = fresh()
    expect([0, 1].map((i) => canPlay(b, i))).toEqual([true, true])
    expect([2, 3, 4, 5].map((i) => canPlay(b, i))).toEqual([false, false, false, false])
    expect(participants(b, 0)).toEqual([0, 1])
    expect(participants(b, 1)).toEqual([2, 3])
  })

  it('ignores points for a match whose teams are not known yet', () => {
    const b = fresh()
    expect(bracketPoint(b, 2, 'A')).toBe(b)
  })

  it('sends winners and losers on to the right places', () => {
    let b = fresh()
    b = win(b, 0, 'A') // Ana beats Bia
    b = win(b, 1, 'B') // Dina beats Caio
    expect(participants(b, 2)).toEqual([0, 3]) // winners
    expect(participants(b, 3)).toEqual([1, 2]) // losers
    b = win(b, 2, 'B') // Dina beats Ana: Ana drops to the losers bracket
    b = win(b, 3, 'A') // Bia beats Caio: Caio is out
    expect(participants(b, 4)).toEqual([1, 0]) // Bia v Ana
    b = win(b, 4, 'B') // Ana beats Bia: Bia is out
    expect(participants(b, 5)).toEqual([3, 0]) // Dina v Ana
    expect(bracketChampion(b)).toBeNull()
    b = win(b, 5, 'B')
    expect(bracketChampion(b)).toBe(0) // Ana came back from the losers bracket
    expect(bracketPlayed(b)).toBe(6)
  })

  it('a level match plays on: no draws', () => {
    let b = fresh()
    for (const p of ['A', 'B', 'A', 'B'] as TeamId[]) b = bracketPoint(b, 0, p)
    expect(isDone(b, 0)).toBe(false)
    b = bracketPoint(b, 0, 'B')
    expect(isDone(b, 0)).toBe(true)
  })

  it('locks a result once a match that depends on it has started', () => {
    let b = win(fresh(), 0, 'A')
    expect(isLocked(b, 0)).toBe(false)
    b = win(b, 1, 'A')
    b = bracketPoint(b, 2, 'A') // M3 has started, M1 and M2 feed it
    expect(isLocked(b, 0)).toBe(true)
    expect(bracketUndo(b, 0)).toBe(b)
    expect(bracketUndo(b, 2).matches[2].log).toEqual([])
  })

  it('undo reopens a match that nothing depends on yet', () => {
    const b = win(fresh(), 0, 'A')
    const back = bracketUndo(b, 0)
    expect(isDone(back, 0)).toBe(false)
    expect(participants(back, 2)).toEqual([null, null])
  })
})

describe('looksLikeBracket', () => {
  it('accepts a saved bracket and rejects broken ones', () => {
    const good = JSON.parse(JSON.stringify(fresh()))
    expect(looksLikeBracket(good)).toBe(true)
    expect(looksLikeBracket({ ...good, teams: ['a', 'b'] })).toBe(false)
    expect(looksLikeBracket({ ...good, matches: [] })).toBe(false)
    expect(looksLikeBracket({ ...good, active: 9 })).toBe(false)
    expect(looksLikeBracket({ ...good, points: 'x' })).toBe(false)
    expect(
      looksLikeBracket({ ...good, matches: good.matches.map(() => ({ log: ['Z'] })) }),
    ).toBe(false)
    expect(looksLikeBracket(null)).toBe(false)
  })
})

const eight = () => createBracket(['1', '2', '3', '4', '5', '6', '7', '8'], 4)

describe('8 team double elimination', () => {
  it('has 14 matches: four first-round matches ready, the rest waiting', () => {
    const b = eight()
    expect(b.matches).toHaveLength(14)
    expect([0, 1, 2, 3].every((i) => canPlay(b, i))).toBe(true)
    expect([4, 5, 6, 7, 8, 9, 10, 11, 12, 13].some((i) => canPlay(b, i))).toBe(false)
    expect(participants(b, 3)).toEqual([6, 7])
  })

  it('every structure only refers to earlier matches', () => {
    for (const structure of Object.values(STRUCTURES)) {
      structure.forEach((spec, i) => {
        for (const slot of [spec.a, spec.b]) {
          if ('winner' in slot) expect(slot.winner).toBeLessThan(i)
          if ('loser' in slot) expect(slot.loser).toBeLessThan(i)
        }
      })
    }
  })

  it('plays through with the top seed always winning: 14 matches, nobody out before two losses', () => {
    let b = eight()
    const losses = Array<number>(8).fill(0)
    for (let i = 0; i < 14; i++) {
      const [x, y] = participants(b, i)
      expect(x).not.toBeNull()
      expect(y).not.toBeNull()
      // The lower-numbered team wins.
      const side: TeamId = (x as number) < (y as number) ? 'A' : 'B'
      b = win(b, i, side)
      losses[loserOf(b, i) as number]++
    }
    expect(bracketChampion(b)).toBe(0)
    expect(losses[0]).toBe(0)
    expect(losses.every((n) => n <= 2)).toBe(true)
    expect(losses.filter((n) => n === 2)).toHaveLength(7) // all seven others are out on exactly two losses
    expect(bracketPlayed(b)).toBe(14)
  })

  it('sends the semi-final and final losers to the right losers-bracket matches', () => {
    let b = eight()
    for (let i = 0; i < 4; i++) b = win(b, i, 'A') // teams 0, 2, 4, 6 advance
    b = win(b, 4, 'A') // M5: 0 beats 2
    b = win(b, 5, 'A') // M6: 4 beats 6
    expect(participants(b, 6)).toEqual([0, 4])
    b = win(b, 7, 'A') // M8: 1 beats 3
    b = win(b, 8, 'A') // M9: 5 beats 7
    expect(participants(b, 9)).toEqual([1, 6]) // winner M8 v loser M6
    expect(participants(b, 10)).toEqual([5, 2]) // winner M9 v loser M5
  })

  it('a team that loses a second time is not placed again', () => {
    let b = eight()
    for (let i = 0; i < 4; i++) b = win(b, i, 'A')
    expect(winnerOf(b, 0)).toBe(0)
    expect(loserOf(b, 0)).toBe(1)
  })
})

describe('regular matches inside a bracket', () => {
  const oneGame = { ...STANDARD_CONFIG, format: { kind: 'games', numberOfGames: 1 } } as const
  const regular = () => createBracket(['a', 'b', 'c', 'd'], 4, oneGame)
  it('a points bracket has no rules; a regular one keeps them', () => {
    expect(fresh().config ?? null).toBeNull()
    expect(regular().config).toEqual(oneGame)
  })

  it('opening a match gives it a fresh score from the rules; points matches get none', () => {
    const opened = openMatch(regular(), 0)
    expect(opened.active).toBe(0)
    expect(opened.matches[0].match).not.toBeNull()
    expect(opened.matches[0].match?.present.config).toEqual(oneGame)
    expect(openMatch(fresh(), 0).matches[0].match).toBeUndefined()
  })

  it('reopening a started match keeps its score', () => {
    const started = score(regular(), 0, 'A')
    expect(openMatch(started, 0).matches[0].match).toBe(started.matches[0].match)
  })

  it('closing a match nobody scored drops it; a scored one is kept', () => {
    const untouched = closeMatch(openMatch(regular(), 0))
    expect(untouched.active).toBeNull()
    expect(untouched.matches[0].match).toBeUndefined()
    const started = closeMatch({ ...score(regular(), 0, 'A'), active: 0 })
    expect(started.matches[0].match).toBeDefined()
  })

  it('the winner of the regular match moves on', () => {
    let b = openMatch(regular(), 0)
    expect(matchResult(b, 0)).toBeNull()
    b = score(b, 0, 'BBBB')
    expect(matchResult(b, 0)).toBe('B')
    expect(isDone(b, 0)).toBe(true)
    expect(winnerOf(b, 0)).toBe(1)
    expect(loserOf(b, 0)).toBe(0)
    expect(matchScoreText(b, 0)).toBe('0-1')
  })

  it('points are ignored in a regular match, and undo does not touch it', () => {
    const b = openMatch(regular(), 0)
    expect(bracketPoint(b, 0, 'A')).toBe(b)
    expect(bracketUndo(b, 0)).toBe(b)
  })

  it('a started regular match locks the results it depends on', () => {
    let b = score(score(regular(), 0, 'AAAA'), 1, 'AAAA')
    expect(isLocked(b, 0)).toBe(false)
    b = score(b, 2, 'A')
    expect(matchStarted(b, 2)).toBe(true)
    expect(isLocked(b, 0)).toBe(true)
  })

  it('works for 8 teams too', () => {
    const b = createBracket(['1', '2', '3', '4', '5', '6', '7', '8'], 16, oneGame)
    expect(openMatch(b, 3).matches[3].match).not.toBeNull()
  })

  it('points matches still show a score', () => {
    expect(matchScoreText(bracketPoint(fresh(), 0, 'A'), 0)).toBe('1-0')
  })
})

describe('looksLikeBracket with regular matches', () => {
  it('accepts 8 teams and saved rules; rejects bad ones', () => {
    const b = score(createBracket(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 16, STANDARD_CONFIG), 0, 'A')
    const saved = JSON.parse(JSON.stringify(b))
    expect(looksLikeBracket(saved)).toBe(true)
    expect(looksLikeBracket({ ...saved, teams: saved.teams.slice(0, 6) })).toBe(false)
    expect(looksLikeBracket({ ...saved, config: { gamesPerSet: 1 } })).toBe(false)
    const bad = JSON.parse(JSON.stringify(saved))
    bad.matches[0].match = { past: 1 }
    expect(looksLikeBracket(bad)).toBe(false)
  })

  it('a bracket saved before regular matches existed (no config) still loads', () => {
    const old = JSON.parse(JSON.stringify(fresh()))
    delete old.config
    expect(looksLikeBracket(old)).toBe(true)
  })
})
