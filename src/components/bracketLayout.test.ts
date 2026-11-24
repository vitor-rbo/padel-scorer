import { describe, expect, it } from 'vitest'
import { createBracket } from '../tournament/bracket'
import { layout } from './bracketLayout'

const names = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`)

describe.each([4, 8])('bracket drawing, %i teams', (size) => {
  const b = createBracket(names(size), 16)
  const { boxes, links, structure } = layout(b)

  it('has a winner box for every match, and a link for every match', () => {
    expect(links).toHaveLength(structure.length)
    for (let i = 0; i < structure.length; i++) expect(boxes[`o${i}`]).toBeDefined()
  })

  it('shows every team once in the first column of the winners bracket', () => {
    const seeds = Object.values(boxes)
      .filter((x) => x.col === 0 && !x.empty)
      .map((x) => x.text)
    expect(new Set(seeds)).toEqual(new Set(names(size)))
  })

  it('never lets two boxes overlap', () => {
    const list = Object.values(boxes)
    for (const x of list) {
      for (const y of list) {
        if (x !== y && x.col === y.col) expect(Math.abs(x.y - y.y)).toBeGreaterThanOrEqual(30)
      }
    }
  })

  it('draws each winner box one column to the right of its inputs, at their midpoint', () => {
    for (const l of links) {
      const a = boxes[l.a]
      const c = boxes[l.b]
      const o = boxes[l.out]
      expect(o.col).toBe(Math.max(a.col, c.col) + 1)
      expect(o.y).toBe((a.y + c.y) / 2)
    }
  })
})
