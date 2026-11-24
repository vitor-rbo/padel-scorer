import { MAX_FINISHED } from './archive'
import type { FinishedMatch } from './archive'
import type { MatchHistory } from './scoring'
import { validateConfig } from './scoring'
import type { SetupState, Teams } from './setup'
import { DEFAULT_SETUP } from './setup'
import type { Tournament } from './tournament/tournament'
import { looksLikeTournament } from './tournament/validate'
import { looksLikeBracket } from './tournament/bracket'
import type { Bracket } from './tournament/bracket'

/**
 * Saving to localStorage so a refresh or accidental close keeps the score.
 *
 * localStorage can throw (private mode, blocked storage, full disk) and the
 * saved data can be stale or corrupted, so:
 *   - every access is wrapped in try/catch
 *   - loaded data is checked before we trust it; if anything looks wrong we
 *     fall back to a fresh start instead of crashing.
 */
const KEY = 'padel-scorer:v1'

export interface Session {
  teams: Teams
  history: MatchHistory
  /** Id of this match's entry in the match history, once it has finished. */
  finishedId?: string
}

export interface AppData {
  setup: SetupState
  /** null = no match in progress (show the setup screen). */
  session: Session | null
  /** Finished matches, newest first. */
  finished: FinishedMatch[]
  /** The tournament in progress, if any. Kept apart from single matches and the match history. */
  tournament: Tournament | null
  /** A double elimination bracket in progress, if any. Separate from the round robin tournament. */
  bracket: Bracket | null
}

export const EMPTY_APP: AppData = {
  setup: DEFAULT_SETUP,
  session: null,
  finished: [],
  tournament: null,
  bracket: null,
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * Earlier versions had a separate "3 games" format. It now lives inside
 * Custom, so convert an old saved setup instead of throwing it away.
 */
function migrateSetup(v: unknown): unknown {
  if (isObject(v) && v.mode === 'threeGames') {
    const custom = isObject(v.custom) ? v.custom : {}
    return { ...v, mode: 'custom', custom: { ...custom, format: 'games', numberOfGames: 3 } }
  }
  return v
}

function looksLikeSetup(v: unknown): v is SetupState {
  if (
    !isObject(v) ||
    (v.mode !== 'standard' && v.mode !== 'custom') ||
    (v.deuce !== 'golden' && v.deuce !== 'advantage' && v.deuce !== 'traditional') ||
    typeof v.superTieBreak !== 'boolean' ||
    !isObject(v.custom) ||
    !isObject(v.names)
  ) {
    return false
  }
  const c = v.custom
  return (
    (c.format === 'games' || c.format === 'sets') &&
    typeof c.numberOfGames === 'number' &&
    typeof c.numberOfSets === 'number' &&
    typeof c.playAll === 'boolean' &&
    typeof v.names.A === 'string' &&
    typeof v.names.B === 'string'
  )
}

function looksLikeSession(v: unknown): v is Session {
  if (!isObject(v) || !isObject(v.teams) || !isObject(v.history)) return false
  if (typeof v.teams.A !== 'string' || typeof v.teams.B !== 'string') return false
  const h = v.history
  if (!Array.isArray(h.past) || !isObject(h.present)) return false
  const present = h.present as Record<string, unknown>
  if (!isObject(present.config) || !Array.isArray(present.completedSets)) return false
  if (typeof present.status !== 'string') return false
  if (v.finishedId !== undefined && typeof v.finishedId !== 'string') return false
  // The engine's own validator checks the rules are usable.
  return validateConfig(present.config as never).length === 0
}

function looksLikeFinished(v: unknown): v is FinishedMatch {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.finishedAt !== 'number') return false
  if (!isObject(v.teams) || typeof v.teams.A !== 'string' || typeof v.teams.B !== 'string') return false
  if (!Array.isArray(v.completedSets) || !v.completedSets.every((s) => isObject(s) && isObject(s.games))) {
    return false
  }
  if (v.winner !== 'A' && v.winner !== 'B' && v.winner !== 'draw') return false
  return isObject(v.config) && validateConfig(v.config as never).length === 0
}

export function loadApp(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_APP
    const data: unknown = JSON.parse(raw)
    if (!isObject(data) || data.version !== 1) return EMPTY_APP
    const savedSetup = migrateSetup(data.setup)
    const setup = looksLikeSetup(savedSetup) ? savedSetup : DEFAULT_SETUP
    const session = looksLikeSession(data.session) ? data.session : null
    // Data saved before match history existed has no "finished" list: start it empty.
    const finished = Array.isArray(data.finished)
      ? data.finished.filter(looksLikeFinished).slice(0, MAX_FINISHED)
      : []
    // Data saved before tournaments existed has no "tournament": start without one.
    const tournament = looksLikeTournament(data.tournament) ? data.tournament : null
    const bracket = looksLikeBracket(data.bracket) ? data.bracket : null
    return { setup, session, finished, tournament, bracket }
  } catch {
    return EMPTY_APP
  }
}

/** Returns false if saving failed (the app keeps working, just unsaved). */
export function saveApp(app: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, ...app }))
    return true
  } catch {
    return false
  }
}
