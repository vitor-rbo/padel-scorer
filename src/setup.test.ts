import { describe, expect, it } from 'vitest'
import { validateConfig } from './scoring'
import { DEFAULT_SETUP, buildConfig, teamName } from './setup'
import type { SetupState } from './setup'

const setup = (over: Partial<SetupState>): SetupState => ({ ...DEFAULT_SETUP, ...over })

describe('buildConfig', () => {
  it('standard = best of 3 sets, advantage with golden on the 3rd deuce', () => {
    const c = buildConfig(setup({ mode: 'standard', deuce: 'advantage' }))
    expect(c.format).toEqual({
      kind: 'sets',
      numberOfSets: 3,
      playAll: false,
      superTieBreakDecider: false,
    })
    expect(c.deuce).toEqual({ kind: 'advantage', goldenAfter: 3 })
    expect(c.gamesPerSet).toBe(6)
    expect(c.tieBreakPoints).toBe(7)
  })

  it('standard can use a super tie-break decider', () => {
    const c = buildConfig(setup({ mode: 'standard', superTieBreak: true }))
    expect(c.format).toMatchObject({ kind: 'sets', superTieBreakDecider: true })
  })

  it('the default setup is Standard; Custom starts on 3 games, no sets', () => {
    expect(DEFAULT_SETUP.mode).toBe('standard')
    expect(buildConfig({ ...DEFAULT_SETUP, mode: 'custom' }).format).toEqual({
      kind: 'games',
      numberOfGames: 3,
    })
  })

  it('maps the three deuce choices', () => {
    expect(buildConfig(setup({ deuce: 'golden' })).deuce).toEqual({ kind: 'golden' })
    expect(buildConfig(setup({ deuce: 'advantage' })).deuce).toEqual({
      kind: 'advantage',
      goldenAfter: 3,
    })
    expect(buildConfig(setup({ deuce: 'traditional' })).deuce).toEqual({
      kind: 'advantage',
      goldenAfter: null,
    })
  })

  it('custom games and custom sets', () => {
    const games = buildConfig(
      setup({ mode: 'custom', custom: { ...DEFAULT_SETUP.custom, format: 'games', numberOfGames: 7 } }),
    )
    expect(games.format).toEqual({ kind: 'games', numberOfGames: 7 })

    const sets = buildConfig(
      setup({
        mode: 'custom',
        superTieBreak: true,
        custom: { ...DEFAULT_SETUP.custom, format: 'sets', numberOfSets: 5, playAll: false },
      }),
    )
    expect(sets.format).toEqual({
      kind: 'sets',
      numberOfSets: 5,
      playAll: false,
      superTieBreakDecider: true,
    })
  })

  it('a super tie-break makes no sense when every set is played', () => {
    const c = buildConfig(
      setup({
        mode: 'custom',
        superTieBreak: true,
        custom: { ...DEFAULT_SETUP.custom, format: 'sets', numberOfSets: 2, playAll: true },
      }),
    )
    expect(c.format).toMatchObject({ superTieBreakDecider: false })
    expect(validateConfig(c)).toEqual([])
  })

  it('the default setup is a valid config', () => {
    expect(validateConfig(buildConfig(DEFAULT_SETUP))).toEqual([])
  })
})

describe('teamName', () => {
  it('falls back to Team A / Team B', () => {
    expect(teamName('A', { A: '', B: 'Ana & Rui' })).toBe('Team A')
    expect(teamName('A', { A: '   ', B: '' })).toBe('Team A')
    expect(teamName('B', { A: '', B: ' Ana & Rui ' })).toBe('Ana & Rui')
  })
})
