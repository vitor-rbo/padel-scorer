import { addFinished, finishedFromState, newId } from './archive'
import type { MatchHistory } from './scoring'
import type { AppData } from './storage'

/**
 * Keeping the match history in step with the match being played.
 * These are plain functions from one AppData to the next, so they are easy to test.
 *
 * The rule: a match is added to the history the moment it finishes, and removed again if the
 * last point is undone. So the history never holds a result that was taken back.
 */

/** Make the history list agree with the state of the current match. */
function syncFinished(app: AppData, now: number, makeId: () => string): AppData {
  const session = app.session
  if (!session) return app

  const complete = session.history.present.status === 'complete'
  let finished = app.finished
  let finishedId = session.finishedId

  if (complete) {
    const id = finishedId ?? makeId()
    const previous = finished.find((e) => e.id === id)
    const entry = finishedFromState({
      id,
      finishedAt: previous?.finishedAt ?? now,
      teams: session.teams,
      state: session.history.present,
    })
    if (entry) {
      finished = addFinished(finished, entry)
      finishedId = id
    }
  } else if (finishedId) {
    // The match was reopened (for example by undoing the winning point).
    const idToRemove = finishedId
    finished = finished.filter((e) => e.id !== idToRemove)
    finishedId = undefined
  }

  return { ...app, finished, session: { ...session, finishedId } }
}

/** Store a new match history for the current session, updating the match history list to match. */
export function applyHistory(
  app: AppData,
  history: MatchHistory,
  now: number,
  makeId: () => string = newId,
): AppData {
  const session = app.session
  if (!session) return app
  // Nothing changed (e.g. a tap that was ignored). Don't touch the list, or an entry that was
  // deleted from the history would come back.
  if (history === session.history) return app
  return syncFinished({ ...app, session: { ...session, history } }, now, makeId)
}

/**
 * On startup: a finished match saved before match history existed has no entry yet. Add it.
 * A no-op for everything else.
 */
export function reconcile(app: AppData, now: number, makeId: () => string = newId): AppData {
  const session = app.session
  if (!session || session.history.present.status !== 'complete' || session.finishedId) return app
  return syncFinished(app, now, makeId)
}

export function deleteFinished(app: AppData, id: string): AppData {
  return { ...app, finished: app.finished.filter((e) => e.id !== id) }
}

export function clearFinished(app: AppData): AppData {
  return { ...app, finished: [] }
}
