import { describe, expect, it } from 'vitest'
import type { DeuceRule } from './types'
import {
  gamePointLabels,
  isGoldenPoint,
  newGame,
  scoreGamePoint,
  scoreTieBreakPoint,
} from './game'

const YOUR_RULE: DeuceRule = { kind: 'advantage', goldenAfter: 3 }
const GOLDEN: DeuceRule = { kind: 'golden' }
const TRADITIONAL: DeuceRule = { kind: 'advantage', goldenAfter: null }

/** Play points in one game; returns the final state and the winner (if any). */
function playGame(seq: string, rule: DeuceRule) {
  let game = newGame()
  let winner: 'A' | 'B' | null = null
  for (const ch of seq) {
    expect(winner, 'points were played after the game ended').toBeNull()
    const r = scoreGamePoint(game, ch as 'A' | 'B', rule)
    game = r.game
    winner = r.winner
  }
  return { game, winner }
}

describe('points within a game', () => {
  it('shows 0, 15, 30, 40', () => {
    const labels = (seq: string) => gamePointLabels(playGame(seq, YOUR_RULE).game)
    expect(labels('')).toEqual({ A: '0', B: '0' })
    expect(labels('A')).toEqual({ A: '15', B: '0' })
    expect(labels('AA')).toEqual({ A: '30', B: '0' })
    expect(labels('AAB')).toEqual({ A: '30', B: '15' })
    expect(labels('AAA')).toEqual({ A: '40', B: '0' })
  })

  it('a team wins a game with 4 points to 0, 1 or 2', () => {
    expect(playGame('AAAA', YOUR_RULE).winner).toBe('A') // 4-0
    expect(playGame('BAAAA', YOUR_RULE).winner).toBe('A') // 4-1
    expect(playGame('ABABAA', YOUR_RULE).winner).toBe('A') // 4-2
    expect(playGame('BBBB', YOUR_RULE).winner).toBe('B') // 0-4
  })

  it('40-30 is not yet a win, but one more point is', () => {
    expect(playGame('AAABB', YOUR_RULE).winner).toBeNull() // 40-30
    expect(playGame('AAABBA', YOUR_RULE).winner).toBe('A') // 4-2
  })
})

describe('deuce with advantage (your rule: golden on the 3rd deuce)', () => {
  it('40-40 is deuce', () => {
    const { game, winner } = playGame('AAABBB', YOUR_RULE)
    expect(winner).toBeNull()
    expect(gamePointLabels(game)).toEqual({ A: '40', B: '40' })
    expect(game.deuces).toBe(1)
  })

  it('winning one point at deuce gives advantage, not the game', () => {
    const { game, winner } = playGame('AAABBBA', YOUR_RULE)
    expect(winner).toBeNull()
    expect(gamePointLabels(game)).toEqual({ A: 'Ad', B: '40' })
  })

  it('advantage then another point wins the game', () => {
    expect(playGame('AAABBBAA', YOUR_RULE).winner).toBe('A')
    expect(playGame('AAABBBBB', YOUR_RULE).winner).toBe('B')
  })

  it('losing the advantage goes back to deuce (second deuce)', () => {
    const { game, winner } = playGame('AAABBB' + 'AB', YOUR_RULE)
    expect(winner).toBeNull()
    expect(gamePointLabels(game)).toEqual({ A: '40', B: '40' })
    expect(game.deuces).toBe(2)
    expect(isGoldenPoint(game, YOUR_RULE)).toBe(false)
  })

  it('advantage still works at the second deuce', () => {
    // deuce(1), A ad, back to deuce(2), A ad, A wins
    expect(playGame('AAABBB' + 'AB' + 'AA', YOUR_RULE).winner).toBe('A')
  })

  it('the third deuce is a golden point: next point wins', () => {
    // deuce(1) A/B -> deuce(2) A/B -> deuce(3)
    const { game, winner } = playGame('AAABBB' + 'AB' + 'AB', YOUR_RULE)
    expect(winner).toBeNull()
    expect(game.deuces).toBe(3)
    expect(isGoldenPoint(game, YOUR_RULE)).toBe(true)

    // Whoever wins the next point wins the game, no advantage.
    expect(playGame('AAABBB' + 'AB' + 'AB' + 'A', YOUR_RULE).winner).toBe('A')
    expect(playGame('AAABBB' + 'AB' + 'AB' + 'B', YOUR_RULE).winner).toBe('B')
  })

  it('different team order still counts deuces correctly', () => {
    expect(playGame('AAABBB' + 'BA' + 'BA' + 'B', YOUR_RULE).winner).toBe('B')
  })
})

describe('golden point rule', () => {
  it('the first deuce is already the golden point', () => {
    const { game } = playGame('AAABBB', GOLDEN)
    expect(isGoldenPoint(game, GOLDEN)).toBe(true)
    expect(playGame('AAABBB' + 'A', GOLDEN).winner).toBe('A')
    expect(playGame('AAABBB' + 'B', GOLDEN).winner).toBe('B')
  })

  it('does not trigger before deuce (40-30 still needs a normal win)', () => {
    const { game, winner } = playGame('AAAB', GOLDEN)
    expect(winner).toBeNull()
    expect(isGoldenPoint(game, GOLDEN)).toBe(false)
  })
})

describe('traditional advantage (no cap)', () => {
  it('never becomes golden, however many deuces', () => {
    let seq = 'AAABBB'
    for (let i = 0; i < 10; i++) seq += 'AB'
    const { game, winner } = playGame(seq, TRADITIONAL)
    expect(winner).toBeNull()
    expect(isGoldenPoint(game, TRADITIONAL)).toBe(false)
    expect(playGame(seq + 'AA', TRADITIONAL).winner).toBe('A')
  })
})

describe('tie-break points', () => {
  const play = (seq: string, target = 7) => {
    let points = { A: 0, B: 0 }
    let winner: 'A' | 'B' | null = null
    for (const ch of seq) {
      const r = scoreTieBreakPoint(points, ch as 'A' | 'B', target)
      points = r.points
      winner = r.winner
    }
    return { points, winner }
  }

  it('first to 7 wins when ahead by 2 or more', () => {
    expect(play('AAAAAA').winner).toBeNull() // 6-0, not yet
    expect(play('AAAAAAA').winner).toBe('A') // 7-0
    expect(play('ABABABABABAA').winner).toBe('A') // 7-5
  })

  it('6-6 continues; must win by 2', () => {
    const six = 'AB'.repeat(6) // 6-6
    expect(play(six).winner).toBeNull()
    expect(play(six + 'A').winner).toBeNull() // 7-6, only 1 ahead
    expect(play(six + 'AB').winner).toBeNull() // 7-7
    expect(play(six + 'AA').winner).toBe('A') // 8-6
    expect(play(six + 'ABAB' + 'BB').winner).toBe('B') // 8-8 then 8-10
  })

  it('super tie-break goes to 10', () => {
    expect(play('A'.repeat(9), 10).winner).toBeNull()
    expect(play('A'.repeat(10), 10).winner).toBe('A')
    expect(play('AB'.repeat(9) + 'AA', 10).winner).toBe('A') // 11-9
  })
})
