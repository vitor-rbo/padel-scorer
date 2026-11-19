import { describe, expect, it } from 'vitest'
import { canUndo, createHistory, recordPoint, recordTieDecision, undo } from './history'
import { games, playH, set6_0 } from './testUtils'
import { STANDARD_CONFIG } from './types'
import type { MatchConfig } from './types'

const fresh = () => createHistory(STANDARD_CONFIG)

describe('undo', () => {
  it('does nothing on a brand-new match', () => {
    const h = fresh()
    expect(canUndo(h)).toBe(false)
    expect(undo(h)).toBe(h)
  })

  it('undoes the last point mid-game', () => {
    const before = playH(fresh(), 'AA')
    const after = playH(before, 'B')
    expect(undo(after).present).toEqual(before.present)
  })

  it('can undo repeatedly back to the start', () => {
    let h = playH(fresh(), 'AABAB')
    while (canUndo(h)) h = undo(h)
    expect(h.present).toEqual(fresh().present)
  })

  it('undoes through a GAME boundary', () => {
    const justBefore = playH(fresh(), 'AAA') // 40-0
    const gameWon = playH(justBefore, 'A') // game to A, games 1-0
    expect(gameWon.present.currentSet?.games).toEqual({ A: 1, B: 0 })
    const back = undo(gameWon)
    expect(back.present).toEqual(justBefore.present)
    expect(back.present.currentSet?.games).toEqual({ A: 0, B: 0 })
  })

  it('undoes through a game won at deuce, restoring the deuce count', () => {
    const atDeuce = playH(fresh(), 'AAABBB' + 'AB') // second deuce
    const won = playH(atDeuce, 'AA')
    expect(undo(undo(won)).present).toEqual(atDeuce.present)
    expect(undo(undo(won)).present.currentSet?.game.deuces).toBe(2)
  })

  it('undoes through a SET boundary', () => {
    const lastPoint = 'A'
    const beforeSetWon = playH(fresh(), games('AAAAA') + 'AAA') // 5-0, 40-0
    const setWon = playH(beforeSetWon, lastPoint)
    expect(setWon.present.completedSets).toHaveLength(1)
    const back = undo(setWon)
    expect(back.present.completedSets).toHaveLength(0)
    expect(back.present).toEqual(beforeSetWon.present)
    expect(back.present.currentSet?.games).toEqual({ A: 5, B: 0 })
  })

  it('undoes through the start and end of a tie-break', () => {
    const before66 = playH(fresh(), games('AAAAABBBBBA') + 'BBB') // 6-5, B at 40-0
    expect(before66.present.currentSet?.tieBreak).toBeNull()
    const inTieBreak = playH(before66, 'B') // 6-6: tie-break starts
    expect(inTieBreak.present.currentSet?.tieBreak).toEqual({ A: 0, B: 0 })
    expect(undo(inTieBreak).present).toEqual(before66.present)

    // Win the set in the tie-break, then undo the winning point.
    const almost = playH(inTieBreak, 'A'.repeat(6))
    const setWon = playH(almost, 'A')
    expect(setWon.present.completedSets[0]).toMatchObject({ games: { A: 7, B: 6 } })
    const back = undo(setWon)
    expect(back.present.completedSets).toHaveLength(0)
    expect(back.present.currentSet?.tieBreak).toEqual({ A: 6, B: 0 })
  })

  it('undoes the winning point of a match, reopening it', () => {
    const almost = playH(fresh(), set6_0('A') + games('AAAAA') + 'AAA')
    const won = playH(almost, 'A')
    expect(won.present.status).toBe('complete')
    const back = undo(won)
    expect(back.present.status).toBe('inProgress')
    expect(back.present.winner).toBeNull()
    expect(back.present.completedSets).toHaveLength(1)
    // ...and you can score the correct point instead.
    expect(playH(back, 'B').present.status).toBe('inProgress')
  })

  it('undoes a tie decision (draw / extra game)', () => {
    const cfg: MatchConfig = { ...STANDARD_CONFIG, format: { kind: 'games', numberOfGames: 2 } }
    const asked = playH(createHistory(cfg), games('AB'))
    expect(asked.present.status).toBe('awaitingTieDecision')

    const drawn = recordTieDecision(asked, 'draw')
    expect(drawn.present.status).toBe('complete')
    expect(undo(drawn).present).toEqual(asked.present)

    const extra = recordTieDecision(asked, 'extra')
    expect(extra.present.status).toBe('inProgress')
    expect(undo(extra).present.status).toBe('awaitingTieDecision')
  })
})

describe('history bookkeeping', () => {
  it('does not add undo steps for ignored points (after match end)', () => {
    const done = playH(fresh(), set6_0('A') + set6_0('A'))
    expect(done.present.status).toBe('complete')
    const again = recordPoint(done, 'B')
    expect(again).toBe(done)
    expect(again.past).toHaveLength(done.past.length)
  })

  it('does not mutate earlier histories', () => {
    const h = playH(fresh(), 'AB')
    const snapshot = JSON.stringify(h)
    recordPoint(h, 'A')
    undo(h)
    expect(JSON.stringify(h)).toBe(snapshot)
  })

  it('survives a JSON round trip (what localStorage will do)', () => {
    const h = playH(fresh(), games('AAAAABBBBBAB') + 'AAAB') // mid tie-break
    const restored = JSON.parse(JSON.stringify(h))
    expect(restored).toEqual(h)
    expect(recordPoint(restored, 'A')).toEqual(recordPoint(h, 'A'))
    expect(undo(restored)).toEqual(undo(h))
  })
})
