import { describe, expect, it } from 'vitest'
import {
  MAX_FINISHED,
  addFinished,
  finishedFromState,
  formatLabel,
  headlineScore,
  newId,
  resultTitle,
  setScoreLines,
} from './archive'
import type { FinishedMatch } from './archive'
import { createMatch, STANDARD_CONFIG, THREE_GAMES_CONFIG } from './scoring'
import type { MatchConfig } from './scoring'
import { game, games, play, set6_0 } from './scoring/testUtils'

const teams = { A: 'Ana & Rui', B: '' }

const fromState = (state: ReturnType<typeof createMatch>, id = 'x') =>
  finishedFromState({ id, finishedAt: 1000, teams, state })

const withFormat = (format: MatchConfig['format']): MatchConfig => ({ ...STANDARD_CONFIG, format })

describe('finishedFromState', () => {
  it('records a finished match', () => {
    const state = play(createMatch(STANDARD_CONFIG), set6_0('A') + set6_0('A'))
    const entry = fromState(state)
    expect(entry).toMatchObject({ id: 'x', finishedAt: 1000, teams, winner: 'A' })
    expect(entry?.completedSets).toHaveLength(2)
  })

  it('returns null for a match still in progress', () => {
    expect(fromState(createMatch(STANDARD_CONFIG))).toBeNull()
    expect(fromState(play(createMatch(STANDARD_CONFIG), set6_0('A')))).toBeNull()
  })

  it('returns null while waiting for a tie decision', () => {
    const cfg = withFormat({ kind: 'games', numberOfGames: 2 })
    expect(fromState(play(createMatch(cfg), games('AB')))).toBeNull()
  })
})

describe('headlineScore and setScoreLines', () => {
  it('shows sets won, with each set underneath', () => {
    const state = play(createMatch(STANDARD_CONFIG), games('AAAABBBBAA') + set6_0('A'))
    const entry = fromState(state)!
    expect(headlineScore(entry)).toEqual({ A: 2, B: 0 })
    expect(setScoreLines(entry)).toEqual(['6-4', '6-0'])
  })

  it('writes a tie-break set with the loser points in brackets', () => {
    const atSixAll = games('AAAAABBBBBAB')
    // Tie-break won 7-0, then a 6-0 set.
    const sweep = play(createMatch(STANDARD_CONFIG), atSixAll + 'AAAAAAA' + set6_0('A'))
    expect(setScoreLines(fromState(sweep)!)).toEqual(['7-6(0)', '6-0'])

    // Tie-break won 7-4 (4-4 level, then three in a row), then a 6-0 set.
    const closer = play(createMatch(STANDARD_CONFIG), atSixAll + 'AB'.repeat(4) + 'AAA' + set6_0('A'))
    expect(setScoreLines(fromState(closer)!)).toEqual(['7-6(4)', '6-0'])
  })

  it('writes a super tie-break as points with TB', () => {
    const cfg = withFormat({ kind: 'sets', numberOfSets: 3, playAll: false, superTieBreakDecider: true })
    const state = play(createMatch(cfg), set6_0('A') + set6_0('B') + 'A'.repeat(10))
    const entry = fromState(state)!
    expect(setScoreLines(entry)).toEqual(['6-0', '0-6', '10-0 TB'])
    expect(headlineScore(entry)).toEqual({ A: 2, B: 1 })
  })

  it('in the games-only format the headline is games won and there are no set lines', () => {
    const entry = fromState(play(createMatch(THREE_GAMES_CONFIG), game('A') + game('B') + game('A')))!
    expect(headlineScore(entry)).toEqual({ A: 2, B: 1 })
    expect(setScoreLines(entry)).toEqual([])
  })
})

describe('resultTitle', () => {
  it('names the winner, falling back to Team B for an empty name', () => {
    const a = fromState(play(createMatch(STANDARD_CONFIG), set6_0('A') + set6_0('A')))!
    expect(resultTitle(a)).toBe('Ana & Rui won')
    const b = fromState(play(createMatch(STANDARD_CONFIG), set6_0('B') + set6_0('B')))!
    expect(resultTitle(b)).toBe('Team B won')
  })

  it('says Draw for a drawn match', () => {
    const entry: FinishedMatch = { ...fromState(play(createMatch(STANDARD_CONFIG), set6_0('A') + set6_0('A')))!, winner: 'draw' }
    expect(resultTitle(entry)).toBe('Draw')
  })
})

describe('formatLabel', () => {
  it('describes each format', () => {
    expect(formatLabel(STANDARD_CONFIG)).toBe('Best of 3 sets')
    expect(formatLabel(THREE_GAMES_CONFIG)).toBe('3 games')
    expect(formatLabel(withFormat({ kind: 'games', numberOfGames: 1 }))).toBe('1 game')
    expect(formatLabel(withFormat({ kind: 'sets', numberOfSets: 1, playAll: false, superTieBreakDecider: false }))).toBe('Single set')
    expect(formatLabel(withFormat({ kind: 'sets', numberOfSets: 4, playAll: true, superTieBreakDecider: false }))).toBe('4 sets, all played')
    expect(formatLabel(withFormat({ kind: 'sets', numberOfSets: 3, playAll: false, superTieBreakDecider: true }))).toBe('Best of 3 sets, super tie-break')
  })
})

describe('addFinished', () => {
  const entry = (id: string): FinishedMatch => ({
    id,
    finishedAt: 1,
    teams,
    config: STANDARD_CONFIG,
    completedSets: [],
    winner: 'A',
  })

  it('puts the newest first', () => {
    expect(addFinished([entry('a')], entry('b')).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('replaces an entry with the same id instead of duplicating it', () => {
    const list = addFinished([entry('a'), entry('b')], { ...entry('b'), winner: 'B' })
    expect(list.map((e) => e.id)).toEqual(['b', 'a'])
    expect(list[0].winner).toBe('B')
  })

  it('keeps at most MAX_FINISHED matches, dropping the oldest', () => {
    let list: FinishedMatch[] = []
    for (let i = 0; i < MAX_FINISHED + 5; i++) list = addFinished(list, entry(`m${i}`))
    expect(list).toHaveLength(MAX_FINISHED)
    expect(list[0].id).toBe(`m${MAX_FINISHED + 4}`)
    expect(list.some((e) => e.id === 'm0')).toBe(false)
  })
})

describe('newId', () => {
  it('gives different ids each time', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()))
    expect(ids.size).toBe(50)
  })
})
