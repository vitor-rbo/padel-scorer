import { loserOf, matchResult, participants, slotLabel, structureFor, winnerOf } from '../tournament/bracket'
import type { Bracket } from '../tournament/bracket'

// --- The drawing --------------------------------------------------------------------------
//
// Columns run left to right. The first column holds the teams that start a branch, and every
// match joins its two boxes with a bracket "[" whose middle line leads to the winner's box in
// the next column. A box that is fed by an earlier match is that match's winner box. Only the
// boxes that start from nothing (seeds, and losers dropping into the losers bracket) need a
// position written down here; the winner boxes work out their own.

export const BW = 130 // box width
export const BH = 30 // box height
export const GAP = 60 // space between columns, where the lines and the match button sit
export const TOP = 28 // room for the section titles
export const colX = (col: number) => 8 + col * (BW + GAP)

/** Where the boxes that nothing feeds sit: "<match><a|b>" -> [column, vertical centre]. */
const START_BOXES: Record<4 | 8, Record<string, [number, number]>> = {
  4: {
    '0a': [0, 30],
    '0b': [0, 90],
    '1a': [0, 150],
    '1b': [0, 210],
    '3a': [0, 330],
    '3b': [0, 390],
    '4b': [1, 450], // the winners' final loser drops in here
  },
  8: {
    '0a': [0, 30],
    '0b': [0, 90],
    '1a': [0, 150],
    '1b': [0, 210],
    '2a': [0, 270],
    '2b': [0, 330],
    '3a': [0, 390],
    '3b': [0, 450],
    '7a': [0, 560],
    '7b': [0, 620],
    '8a': [0, 680],
    '8b': [0, 740],
    '9b': [1, 650], // loser of M6 drops in
    '10b': [1, 770], // loser of M5 drops in
    '12b': [3, 770], // loser of the winners' final drops in
  },
}

export interface Box {
  col: number
  /** Vertical centre, before TOP is added. */
  y: number
  text: string
  /** Placeholder text (italic, muted): nobody is known for this box yet. */
  empty: boolean
  /** Outlined: this team won the match it plays in next. */
  won: boolean
}

export interface Link {
  match: number
  a: string
  b: string
  out: string
}

export function layout(b: Bracket) {
  const structure = structureFor(b)
  const starts = START_BOXES[b.teams.length as 4 | 8]
  const boxes: Record<string, Box> = {}
  const links: Link[] = []

  structure.forEach((spec, i) => {
    const sides = [
      ['a', spec.a],
      ['b', spec.b],
    ] as const
    const [x, y] = participants(b, i)
    const result = matchResult(b, i)
    const keys: string[] = []

    sides.forEach(([side, slot]) => {
      const won = result === (side === 'a' ? 'A' : 'B')
      if ('winner' in slot) {
        // Fed by an earlier match: reuse its winner box.
        const key = `o${slot.winner}`
        boxes[key].won = won
        keys.push(key)
        return
      }
      const key = `${i}${side}`
      const [col, cy] = starts[key]
      const team = 'seed' in slot ? (side === 'a' ? x : y) : loserOf(b, slot.loser)
      boxes[key] = {
        col,
        y: cy,
        text: team === null ? slotLabel(b, i, side) : b.teams[team],
        empty: team === null,
        won,
      }
      keys.push(key)
    })

    const [ka, kb] = keys
    const col = Math.max(boxes[ka].col, boxes[kb].col) + 1
    const winner = winnerOf(b, i)
    const last = i === structure.length - 1
    boxes[`o${i}`] = {
      col,
      y: (boxes[ka].y + boxes[kb].y) / 2,
      text: winner === null ? '' : b.teams[winner],
      empty: winner === null,
      won: last && winner !== null,
    }
    links.push({ match: i, a: ka, b: kb, out: `o${i}` })
  })

  return { boxes, links, structure }
}
