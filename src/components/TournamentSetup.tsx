import { useState } from 'react'
import { validateConfig } from '../scoring'
import type { MatchConfig } from '../scoring'
import { buildConfig } from '../setup'
import type { SetupState } from '../setup'
import { BRACKET_SIZES, createBracket } from '../tournament/bracket'
import type { Bracket } from '../tournament/bracket'
import {
  DEFAULT_POINTS,
  MAX_POINTS,
  MAX_TEAMS,
  MIN_POINTS,
  MIN_TEAMS,
  createTournament,
  defaultTeamName,
  matchCount,
  validateTournament,
} from '../tournament/tournament'
import type { Tournament } from '../tournament/tournament'
import { Choices, RulesForm, Stepper } from './RulesForm'

interface Props {
  /** The match rules last used. Shared with the normal new match screen. */
  setup: SetupState
  onChangeSetup: (next: SetupState) => void
  onStart: (tournament: Tournament) => void
  onStartBracket: (bracket: Bracket) => void
  onBack: () => void
}

type Format = 'roundRobin' | 'bracket'
type MatchKind = 'points' | 'regular'

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'roundRobin', label: 'Round robin', hint: 'Everyone plays everyone, then a final' },
  { value: 'bracket', label: 'Double elimination', hint: '4 or 8 teams, out after two losses' },
]

/** Pick the format, the teams and how the matches are played. */
export function TournamentSetup({ setup, onChangeSetup, onStart, onStartBracket, onBack }: Props) {
  const [format, setFormat] = useState<Format>('roundRobin')
  const [names, setNames] = useState<string[]>(['', '', '', ''])
  const [points, setPoints] = useState(DEFAULT_POINTS)
  // Double elimination only: every match is a points match, or a regular padel match.
  const [kind, setKind] = useState<MatchKind>('points')

  const bracket = format === 'bracket'
  const regular = bracket && kind === 'regular'
  const config: MatchConfig | null = regular ? buildConfig(setup) : null
  const errors = [
    ...validateTournament(names, points),
    ...(config ? validateConfig(config) : []),
  ]
  const resize = (count: number) =>
    setNames((cur) =>
      count <= cur.length ? cur.slice(0, count) : [...cur, ...Array<string>(count - cur.length).fill('')],
    )
  const pick = (next: Format) => {
    setFormat(next)
    // A bracket has 4 or 8 teams: keep 8 if there are more than 4, otherwise 4.
    if (next === 'bracket') resize(names.length > 4 ? 8 : 4)
  }

  return (
    <main className="setup">
      <div className="setup-top">
        <button type="button" className="back" onClick={onBack}>
          ← Back
        </button>
      </div>
      <h1>New tournament</h1>

      <section>
        <h2>Format</h2>
        <Choices options={FORMATS} value={format} onPick={pick} />
        <p className="lead-small">
          {bracket
            ? `Winners play on in the winners bracket. A team that loses once drops to the losers bracket, and a second loss knocks it out. ${names.length === 8 ? 14 : 6} matches: the winners of both brackets meet in the grand final.`
            : `Every team plays every other team once (${matchCount(names.length)} matches). Win 3, draw 1, loss 0. Then the top two teams can play a final.`}
        </p>
      </section>

      <div className="setup-grid">
        <section>
          <h2>Teams</h2>
          {bracket && (
            <Choices
              options={BRACKET_SIZES.map((n) => ({
                value: String(n),
                label: `${n} teams`,
                hint: n === 4 ? '6 matches' : '14 matches',
              }))}
              value={String(names.length)}
              onPick={(n) => resize(Number(n))}
            />
          )}
          {!bracket && (
            <Stepper
              label="Number of teams"
              value={names.length}
              min={MIN_TEAMS}
              max={MAX_TEAMS}
              onChange={resize}
            />
          )}
          {names.map((name, i) => (
            <label className="field" key={i}>
              <span>{bracket ? `Seed ${i + 1}` : `Team ${i + 1}`}</span>
              <input
                type="text"
                value={name}
                placeholder={`${defaultTeamName(i)} (e.g. Ana & Rui)`}
                maxLength={40}
                onChange={(e) => setNames((cur) => cur.map((n, j) => (j === i ? e.target.value : n)))}
              />
            </label>
          ))}
          {bracket && <p className="lead-small">Round one is seed 1 v seed 2, seed 3 v seed 4 and so on.</p>}
        </section>

        <section>
          <h2>{bracket ? 'Match type' : 'Match length'}</h2>
          {bracket && (
            <Choices
              options={[
                { value: 'points' as MatchKind, label: 'Points match', hint: `First to ${points} points` },
                { value: 'regular' as MatchKind, label: 'Regular match', hint: 'Sets or games, your rules' },
              ]}
              value={kind}
              onPick={setKind}
            />
          )}
          {!regular && (
            <>
              <Stepper
                label="Points per match"
                compact={bracket}
                value={points}
                min={MIN_POINTS}
                max={MAX_POINTS}
                onChange={setPoints}
              />
              <p className="lead-small">
                {bracket
                  ? `Every match is played to ${points} points. Someone has to win, so if it is level at ${points}, the next point wins.`
                  : `Each match is exactly ${points} points. A level score is a draw. You choose the final's format when you get there.`}
              </p>
            </>
          )}
          {regular && (
            <p className="lead-small">
              Every match uses the rules below. A match can't end as a draw: if it is level, it plays on.
            </p>
          )}
        </section>
      </div>

      {regular && (
        <div className="setup-grid">
          <RulesForm setup={setup} onChange={onChangeSetup} />
        </div>
      )}

      {errors.length > 0 && (
        <p className="error" role="alert">
          {errors.join('. ')}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={errors.length > 0}
          onClick={() =>
            bracket
              ? onStartBracket(createBracket(names, points, config))
              : onStart(createTournament(names, points))
          }
        >
          Start tournament
        </button>
      </div>
    </main>
  )
}
