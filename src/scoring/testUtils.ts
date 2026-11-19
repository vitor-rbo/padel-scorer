import { recordPoint } from './history'
import type { MatchHistory } from './history'
import { scorePoint } from './match'
import type { MatchState, TeamId } from './types'

/** Play a string of points, e.g. "AAAB" = A, A, A, B. Spaces are ignored. */
export function play(state: MatchState, seq: string): MatchState {
  let s = state
  for (const ch of seq.replace(/\s/g, '')) s = scorePoint(s, ch as TeamId)
  return s
}

export function playH(history: MatchHistory, seq: string): MatchHistory {
  let h = history
  for (const ch of seq.replace(/\s/g, '')) h = recordPoint(h, ch as TeamId)
  return h
}

/** Points for a love game (4-0) won by `team`. */
export const game = (team: TeamId) => team.repeat(4)

/** Love games won in order, e.g. "AAB" = A wins a game, A wins, B wins. */
export const games = (winners: string) => [...winners].map((w) => game(w as TeamId)).join('')

/** Points for a 6-0 set won by `team`. */
export const set6_0 = (team: TeamId) => game(team).repeat(6)
