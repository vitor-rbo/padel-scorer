import { describe, expect, it } from 'vitest'
import { applyHistory, clearFinished, deleteFinished, reconcile } from './matches'
import { STANDARD_CONFIG, createHistory, recordPoint, undo } from './scoring'
import type { MatchHistory } from './scoring'
import { playH, set6_0 } from './scoring/testUtils'
import { EMPTY_APP } from './storage'
import type { AppData } from './storage'

const teams = { A: 'Ana & Rui', B: 'Marco & Tiago' }

/** A counter instead of random ids, so tests are predictable. */
const ids = () => {
  let n = 0
  return () => `id${++n}`
}

const startApp = (): AppData => ({
  ...EMPTY_APP,
  session: { teams, history: createHistory(STANDARD_CONFIG) },
})

/** Feed a new history into the app the way App.tsx does. */
const step = (app: AppData, history: MatchHistory, now = 1000, makeId = ids()) =>
  applyHistory(app, history, now, makeId)

/** A match one point from the end: A leads 1-0 in sets and 5-0 up, 40-0, in the second set. */
const almostWon = () => playH(createHistory(STANDARD_CONFIG), set6_0('A') + 'AAAA'.repeat(5) + 'AAA')

describe('applyHistory', () => {
  it('does nothing without a match', () => {
    const h = createHistory(STANDARD_CONFIG)
    expect(applyHistory(EMPTY_APP, h, 1, ids())).toBe(EMPTY_APP)
  })

  it('does not add anything while the match is in progress', () => {
    const app = startApp()
    const next = step(app, recordPoint(app.session!.history, 'A'))
    expect(next.finished).toEqual([])
    expect(next.session?.finishedId).toBeUndefined()
  })

  it('adds the match to the history the moment it finishes', () => {
    const app = { ...startApp(), session: { teams, history: almostWon() } }
    const done = recordPoint(app.session.history, 'A')
    const next = step(app, done, 5000, ids())
    expect(next.finished).toHaveLength(1)
    expect(next.finished[0]).toMatchObject({
      id: 'id1',
      finishedAt: 5000,
      teams,
      winner: 'A',
    })
    expect(next.session?.finishedId).toBe('id1')
  })

  it('removes the entry again if the winning point is undone', () => {
    const app = { ...startApp(), session: { teams, history: almostWon() } }
    const finished = step(app, recordPoint(app.session.history, 'A'))
    expect(finished.finished).toHaveLength(1)

    const reopened = step(finished, undo(finished.session!.history))
    expect(reopened.finished).toEqual([])
    expect(reopened.session?.finishedId).toBeUndefined()
  })

  it('finishing again after an undo leaves exactly one entry, with the new time', () => {
    const app = { ...startApp(), session: { teams, history: almostWon() } }
    const makeId = ids()
    const first = step(app, recordPoint(app.session.history, 'A'), 1000, makeId)
    expect(first.finished.map((e) => e.id)).toEqual(['id1'])

    const back = step(first, undo(first.session!.history), 2000, makeId)
    expect(back.finished).toEqual([])

    // B wins a point (40-15), so the match is still open...
    const bPoint = step(back, recordPoint(back.session!.history, 'B'), 3000, makeId)
    expect(bPoint.finished).toEqual([])

    // ...then A takes the game, the set and the match: one entry, not two.
    const end = step(bPoint, recordPoint(bPoint.session!.history, 'A'), 4000, makeId)
    expect(end.finished).toHaveLength(1)
    expect(end.finished[0]).toMatchObject({ id: 'id2', finishedAt: 4000, winner: 'A' })
  })

  it('does not bring back an entry the user deleted when an ignored tap arrives', () => {
    const app = { ...startApp(), session: { teams, history: almostWon() } }
    const finished = step(app, recordPoint(app.session.history, 'A'))
    const deleted = deleteFinished(finished, finished.finished[0].id)
    expect(deleted.finished).toEqual([])

    // Tapping a point on a finished match returns the SAME history object.
    const ignoredTap = recordPoint(deleted.session!.history, 'B')
    expect(ignoredTap).toBe(deleted.session!.history)
    expect(step(deleted, ignoredTap).finished).toEqual([])
  })

  it('keeps earlier matches and puts the newest first', () => {
    const older = step({ ...startApp(), session: { teams, history: almostWon() } }, recordPoint(almostWon(), 'A'), 1000, ids())
    const second: AppData = { ...older, session: { teams, history: almostWon() } }
    const next = step(second, recordPoint(almostWon(), 'A'), 9000, () => 'newer')
    expect(next.finished.map((e) => e.id)).toEqual(['newer', 'id1'])
  })
})

describe('reconcile (on startup)', () => {
  it('adds a finished match that was saved before the history existed', () => {
    const done = recordPoint(almostWon(), 'A')
    const app: AppData = { ...EMPTY_APP, session: { teams, history: done } }
    const next = reconcile(app, 7000, ids())
    expect(next.finished).toHaveLength(1)
    expect(next.finished[0].finishedAt).toBe(7000)
    expect(next.session?.finishedId).toBe('id1')
  })

  it('does not add it twice on the next startup', () => {
    const done = recordPoint(almostWon(), 'A')
    const once = reconcile({ ...EMPTY_APP, session: { teams, history: done } }, 7000, ids())
    expect(reconcile(once, 8000, ids())).toBe(once)
  })

  it('leaves everything else alone', () => {
    expect(reconcile(EMPTY_APP, 1, ids())).toBe(EMPTY_APP)
    const inProgress = startApp()
    expect(reconcile(inProgress, 1, ids())).toBe(inProgress)
  })
})

describe('deleting', () => {
  const withTwo = (): AppData => {
    const a = step({ ...startApp(), session: { teams, history: almostWon() } }, recordPoint(almostWon(), 'A'), 1000, () => 'one')
    const b: AppData = { ...a, session: { teams, history: almostWon() } }
    return step(b, recordPoint(almostWon(), 'A'), 2000, () => 'two')
  }

  it('deletes one entry', () => {
    expect(deleteFinished(withTwo(), 'one').finished.map((e) => e.id)).toEqual(['two'])
  })

  it('deletes all entries', () => {
    expect(clearFinished(withTwo()).finished).toEqual([])
  })
})
