import type { MatchConfig, TeamId } from './scoring'
import { STANDARD_CONFIG } from './scoring'

/**
 * What the user picks on the setup screen. This is UI-level data (friendly
 * choices); buildConfig() turns it into the engine's MatchConfig.
 */
export type Mode = 'standard' | 'custom'
export type DeuceChoice = 'golden' | 'advantage' | 'traditional'
export type Teams = Record<TeamId, string>

export interface CustomOptions {
  format: 'games' | 'sets'
  numberOfGames: number
  numberOfSets: number
  /** Sets mode: play every set even if the result is already decided. */
  playAll: boolean
}

export interface SetupState {
  mode: Mode
  deuce: DeuceChoice
  /** Replace a deciding third set with a first-to-10 super tie-break. */
  superTieBreak: boolean
  custom: CustomOptions
  names: Teams
}

export const DEFAULT_SETUP: SetupState = {
  mode: 'standard',
  // Custom starts on your group's usual game: 3 games, no sets.
  deuce: 'advantage',
  superTieBreak: false,
  custom: { format: 'games', numberOfGames: 3, numberOfSets: 3, playAll: false },
  names: { A: '', B: '' },
}

export function buildConfig(setup: SetupState): MatchConfig {
  const deuce: MatchConfig['deuce'] =
    setup.deuce === 'golden'
      ? { kind: 'golden' }
      : { kind: 'advantage', goldenAfter: setup.deuce === 'advantage' ? 3 : null }

  const base = { ...STANDARD_CONFIG, deuce }

  if (setup.mode === 'standard') {
    return {
      ...base,
      format: {
        kind: 'sets',
        numberOfSets: 3,
        playAll: false,
        superTieBreakDecider: setup.superTieBreak,
      },
    }
  }
  const c = setup.custom
  if (c.format === 'games') {
    return { ...base, format: { kind: 'games', numberOfGames: c.numberOfGames } }
  }
  return {
    ...base,
    format: {
      kind: 'sets',
      numberOfSets: c.numberOfSets,
      playAll: c.playAll,
      superTieBreakDecider: setup.superTieBreak && !c.playAll,
    },
  }
}

/** "Team A" if the user left the name empty. */
export function teamName(team: TeamId, names: Teams): string {
  return names[team].trim() || `Team ${team}`
}
