import { describe, expect, it } from 'vitest'
import { createMatch, getScoreboard, resolveTie, scorePoint } from './match'
import { game, games, play, set6_0 } from './testUtils'
import type { MatchConfig } from './types'
import { STANDARD_CONFIG, THREE_GAMES_CONFIG, validateConfig } from './types'

const standard = () => createMatch(STANDARD_CONFIG)
const threeGames = () => createMatch(THREE_GAMES_CONFIG)

/** STANDARD_CONFIG with the format replaced. */
const withFormat = (format: MatchConfig['format']): MatchConfig => ({
  ...STANDARD_CONFIG,
  format,
})

describe('config validation', () => {
  it('accepts the built-in presets', () => {
    expect(validateConfig(STANDARD_CONFIG)).toEqual([])
    expect(validateConfig(THREE_GAMES_CONFIG)).toEqual([])
  })

  it('rejects an even number of sets for first-to-win-most', () => {
    const cfg = withFormat({ kind: 'sets', numberOfSets: 2, playAll: false, superTieBreakDecider: false })
    expect(validateConfig(cfg).length).toBeGreaterThan(0)
    expect(() => createMatch(cfg)).toThrow()
  })

  it('allows an even number of sets when every set is played', () => {
    const cfg = withFormat({ kind: 'sets', numberOfSets: 2, playAll: true, superTieBreakDecider: false })
    expect(validateConfig(cfg)).toEqual([])
  })

  it('rejects nonsense values', () => {
    expect(validateConfig({ ...STANDARD_CONFIG, gamesPerSet: 1 }).length).toBeGreaterThan(0)
    expect(validateConfig(withFormat({ kind: 'games', numberOfGames: 0 })).length).toBeGreaterThan(0)
    expect(
      validateConfig({ ...STANDARD_CONFIG, deuce: { kind: 'advantage', goldenAfter: 0 } }).length,
    ).toBeGreaterThan(0)
  })
})

describe('games within a set', () => {
  it('a set is won at 6-0', () => {
    const s = play(standard(), set6_0('A'))
    expect(s.completedSets).toHaveLength(1)
    expect(s.completedSets[0]).toMatchObject({ games: { A: 6, B: 0 }, winner: 'A', tieBreak: null })
    expect(s.currentSet?.games).toEqual({ A: 0, B: 0 }) // new set started
  })

  it('a set is won at 6-4', () => {
    const s = play(standard(), games('AAAABBBBAA'))
    expect(s.completedSets[0]).toMatchObject({ games: { A: 6, B: 4 }, winner: 'A' })
  })

  it('6-5 does not end the set, 7-5 does (win by 2)', () => {
    const at65 = play(standard(), games('AAAAABBBBBA'))
    expect(at65.completedSets).toHaveLength(0)
    expect(at65.currentSet?.games).toEqual({ A: 6, B: 5 })

    const at75 = play(at65, game('A'))
    expect(at75.completedSets[0]).toMatchObject({ games: { A: 7, B: 5 }, winner: 'A' })
  })

  it('5-5 then B takes it 7-5 for B', () => {
    const s = play(standard(), games('AAAAABBBBBBB'))
    expect(s.completedSets[0]).toMatchObject({ games: { A: 5, B: 7 }, winner: 'B' })
  })
})

describe('tie-break at 6-6', () => {
  const atSixAll = () => play(standard(), games('AAAAABBBBBAB'))

  it('starts a tie-break at 6-6', () => {
    const s = atSixAll()
    expect(s.currentSet?.games).toEqual({ A: 6, B: 6 })
    expect(s.currentSet?.tieBreak).toEqual({ A: 0, B: 0 })
    expect(s.completedSets).toHaveLength(0)
  })

  it('scores tie-break points one at a time', () => {
    const s = play(atSixAll(), 'AAB')
    expect(s.currentSet?.tieBreak).toEqual({ A: 2, B: 1 })
    expect(getScoreboard(s).current?.gameLabels).toBeNull()
  })

  it('first to 7 wins the set 7-6', () => {
    const s = play(atSixAll(), 'AAAAAAA')
    expect(s.completedSets[0]).toMatchObject({
      games: { A: 7, B: 6 },
      tieBreak: { A: 7, B: 0 },
      winner: 'A',
    })
  })

  it('must win the tie-break by 2 points', () => {
    const level66 = play(atSixAll(), 'AB'.repeat(6))
    expect(level66.completedSets).toHaveLength(0)
    const at76 = play(level66, 'A')
    expect(at76.completedSets).toHaveLength(0) // 7-6 is not enough
    const at77 = play(at76, 'B')
    expect(at77.completedSets).toHaveLength(0)
    const won = play(at77, 'BB') // 7-9
    expect(won.completedSets[0]).toMatchObject({
      games: { A: 6, B: 7 },
      tieBreak: { A: 7, B: 9 },
      winner: 'B',
    })
  })

  it('goes back to normal games in the next set', () => {
    const s = play(atSixAll(), 'AAAAAAA')
    expect(s.currentSet?.tieBreak).toBeNull()
    expect(s.currentSet?.games).toEqual({ A: 0, B: 0 })
  })
})

describe('match: best of 3 sets', () => {
  it('is not over after one set', () => {
    const s = play(standard(), set6_0('A'))
    expect(s.status).toBe('inProgress')
    expect(s.winner).toBeNull()
  })

  it('ends 2-0 as soon as a team wins two sets', () => {
    const s = play(standard(), set6_0('A') + set6_0('A'))
    expect(s.status).toBe('complete')
    expect(s.winner).toBe('A')
    expect(s.completedSets).toHaveLength(2)
    expect(s.currentSet).toBeNull()
    expect(getScoreboard(s).setsWon).toEqual({ A: 2, B: 0 })
  })

  it('goes to a third set at 1-1 and ends 2-1', () => {
    const afterTwo = play(standard(), set6_0('A') + set6_0('B'))
    expect(afterTwo.status).toBe('inProgress')
    expect(afterTwo.currentSet?.kind).toBe('normal')
    const s = play(afterTwo, set6_0('B'))
    expect(s.status).toBe('complete')
    expect(s.winner).toBe('B')
    expect(s.completedSets).toHaveLength(3)
  })

  it('ignores points once the match is complete (same object returned)', () => {
    const done = play(standard(), set6_0('A') + set6_0('A'))
    expect(scorePoint(done, 'B')).toBe(done)
  })

  it('does not mutate the previous state', () => {
    const before = standard()
    const snapshot = JSON.stringify(before)
    scorePoint(before, 'A')
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('best of 5 needs three sets', () => {
    const cfg = withFormat({ kind: 'sets', numberOfSets: 5, playAll: false, superTieBreakDecider: false })
    const afterTwo = play(createMatch(cfg), set6_0('A') + set6_0('A'))
    expect(afterTwo.status).toBe('inProgress')
    expect(play(afterTwo, set6_0('A')).winner).toBe('A')
  })

  it('a single-set match ends after one set', () => {
    const cfg = withFormat({ kind: 'sets', numberOfSets: 1, playAll: false, superTieBreakDecider: false })
    expect(play(createMatch(cfg), set6_0('B')).winner).toBe('B')
  })
})

describe('super tie-break instead of the deciding set', () => {
  const cfg = withFormat({
    kind: 'sets',
    numberOfSets: 3,
    playAll: false,
    superTieBreakDecider: true,
  })

  it('is played at 1-1 in sets', () => {
    const s = play(createMatch(cfg), set6_0('A') + set6_0('B'))
    expect(s.currentSet?.kind).toBe('superTieBreak')
    expect(s.currentSet?.tieBreak).toEqual({ A: 0, B: 0 })
  })

  it('is NOT played if the match is already decided 2-0', () => {
    const s = play(createMatch(cfg), set6_0('A') + set6_0('A'))
    expect(s.status).toBe('complete')
    expect(s.completedSets.map((r) => r.kind)).toEqual(['normal', 'normal'])
  })

  it('first to 10 wins, by 2', () => {
    const atDecider = play(createMatch(cfg), set6_0('A') + set6_0('B'))
    expect(play(atDecider, 'B'.repeat(9)).status).toBe('inProgress')

    const done = play(atDecider, 'B'.repeat(10))
    expect(done.status).toBe('complete')
    expect(done.winner).toBe('B')
    expect(done.completedSets[2]).toMatchObject({
      kind: 'superTieBreak',
      games: { A: 0, B: 1 },
      tieBreak: { A: 0, B: 10 },
      winner: 'B',
    })

    // 9-9 needs two more points in a row
    const nineAll = play(atDecider, 'AB'.repeat(9))
    expect(play(nineAll, 'A').status).toBe('inProgress') // 10-9
    expect(play(nineAll, 'AA').winner).toBe('A') // 11-9
  })

  it('does not apply to a one-set match', () => {
    const one = withFormat({ kind: 'sets', numberOfSets: 1, playAll: false, superTieBreakDecider: true })
    expect(createMatch(one).currentSet?.kind).toBe('normal')
  })
})

describe('"3 games" mode (your group): always play all games', () => {
  it('keeps playing after 2-0', () => {
    const s = play(threeGames(), games('AA'))
    expect(s.status).toBe('inProgress')
    expect(s.currentSet?.games).toEqual({ A: 2, B: 0 })
  })

  it('3-0: ends after the third game', () => {
    const s = play(threeGames(), games('AAA'))
    expect(s.status).toBe('complete')
    expect(s.winner).toBe('A')
    expect(s.completedSets[0]).toMatchObject({ kind: 'fixedGames', games: { A: 3, B: 0 }, winner: 'A' })
  })

  it('2-1 either way round', () => {
    expect(play(threeGames(), games('ABA')).winner).toBe('A')
    expect(play(threeGames(), games('BAA')).winner).toBe('A')
    expect(play(threeGames(), games('ABB')).winner).toBe('B')
  })

  it('never starts a tie-break; games are just counted', () => {
    const s = play(threeGames(), games('A'))
    expect(s.currentSet?.tieBreak).toBeNull()
  })

  it('scoreboard shows the game limit', () => {
    expect(getScoreboard(threeGames()).current?.gameLimit).toBe(3)
  })
})

describe('even number of games: draw or extra game', () => {
  const four = () => createMatch(withFormat({ kind: 'games', numberOfGames: 4 }))

  it('plays all 4 games even at 3-0', () => {
    expect(play(four(), games('AAA')).status).toBe('inProgress')
  })

  it('a decided even match (3-1) just ends', () => {
    const s = play(four(), games('AAAB'))
    expect(s.status).toBe('complete')
    expect(s.winner).toBe('A')
  })

  it('2-2 asks what to do and ignores further points meanwhile', () => {
    const s = play(four(), games('ABAB'))
    expect(s.status).toBe('awaitingTieDecision')
    expect(s.winner).toBeNull()
    expect(scorePoint(s, 'A')).toBe(s)
  })

  it('draw ends the match with no winner', () => {
    const s = resolveTie(play(four(), games('ABAB')), 'draw')
    expect(s.status).toBe('complete')
    expect(s.winner).toBe('draw')
    expect(s.completedSets[0]).toMatchObject({ games: { A: 2, B: 2 }, winner: null })
  })

  it('extra game: play a 5th game to decide', () => {
    const asked = play(four(), games('ABAB'))
    const extra = resolveTie(asked, 'extra')
    expect(extra.status).toBe('inProgress')
    expect(extra.currentSet?.gameLimit).toBe(5)
    const done = play(extra, games('B'))
    expect(done.status).toBe('complete')
    expect(done.winner).toBe('B')
    expect(done.completedSets[0].games).toEqual({ A: 2, B: 3 })
  })

  it('resolveTie does nothing unless a decision is pending', () => {
    const s = four()
    expect(resolveTie(s, 'draw')).toBe(s)
  })
})

describe('play-all sets', () => {
  const playAll3 = () =>
    createMatch(withFormat({ kind: 'sets', numberOfSets: 3, playAll: true, superTieBreakDecider: false }))

  it('still plays the third set at 2-0', () => {
    const s = play(playAll3(), set6_0('A') + set6_0('A'))
    expect(s.status).toBe('inProgress')
    const done = play(s, set6_0('B'))
    expect(done.status).toBe('complete')
    expect(done.winner).toBe('A') // won 2 of 3 sets
  })

  it('level on sets with an even count: draw or extra set', () => {
    const two = createMatch(withFormat({ kind: 'sets', numberOfSets: 2, playAll: true, superTieBreakDecider: false }))
    const asked = play(two, set6_0('A') + set6_0('B'))
    expect(asked.status).toBe('awaitingTieDecision')

    expect(resolveTie(asked, 'draw')).toMatchObject({ status: 'complete', winner: 'draw' })

    const extra = resolveTie(asked, 'extra')
    expect(extra.status).toBe('inProgress')
    expect(extra.plannedSets).toBe(3)
    expect(play(extra, set6_0('A'))).toMatchObject({ status: 'complete', winner: 'A' })
  })
})

describe('scoreboard', () => {
  it('shows labels and flags the golden point', () => {
    // deuce three times: 40-40, Ad, 40-40, Ad, 40-40 (third deuce)
    const s = play(standard(), 'AAABBB' + 'AB' + 'AB')
    const board = getScoreboard(s)
    expect(board.current?.gameLabels).toEqual({ A: '40', B: '40' })
    expect(board.current?.isGoldenPoint).toBe(true)
  })

  it('is not golden at the first deuce under the advantage rule', () => {
    const board = getScoreboard(play(standard(), 'AAABBB'))
    expect(board.current?.isGoldenPoint).toBe(false)
  })

  it('shows 0-0 at the start', () => {
    expect(getScoreboard(standard()).current?.gameLabels).toEqual({ A: '0', B: '0' })
  })
})
