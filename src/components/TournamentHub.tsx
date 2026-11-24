import { useState } from 'react'
import {
  DEFAULT_POINTS,
  MAX_POINTS,
  MIN_POINTS,
  cancelFinal,
  champion,
  finalStarted,
  finalistsTied,
  fixtureScore,
  fixtureWinner,
  isFixtureDone,
  leagueDone,
  matchCount,
  playedCount,
  standings,
  startFinal,
} from '../tournament/tournament'
import type { Fixture, Tournament } from '../tournament/tournament'
import { getScoreboard } from '../scoring'

interface Props {
  tournament: Tournament
  onChange: (next: Tournament) => void
  onHome: () => void
  onEnd: () => void
  /** The user wants the final played as a regular match: go and choose its rules. */
  onSetupFinalMatch: (finalists: [number, number]) => void
}

/** The tournament overview: league table, the list of matches, and the final. */
export function TournamentHub({ tournament: t, onChange, onHome, onEnd, onSetupFinalMatch }: Props) {
  const table = standings(t)
  const done = leagueDone(t)
  const champ = champion(t)
  const total = matchCount(t.teams.length)
  const rounds = [...new Set(t.fixtures.map((f) => f.round))]

  const confirmEnd = () => {
    if (window.confirm('End this tournament? All its results will be deleted.')) onEnd()
  }

  return (
    <main className="tournament">
      <div className="setup-top">
        <button type="button" className="back" onClick={onHome}>
          ← Home
        </button>
        <button type="button" className="back" onClick={confirmEnd}>
          End tournament
        </button>
      </div>
      <h1>Tournament</h1>
      <p className="lead-small">
        {playedCount(t)} of {total} matches played · {t.pointsPerMatch} points each
      </p>

      {champ !== null && (
        <section className="panel win-A" role="status">
          <p className="result">🏆 {t.teams[champ]} are the champions!</p>
        </section>
      )}

      <h2>Table</h2>
      <div className="table-wrap">
        <table className="league" aria-label="League table">
          <thead>
            <tr>
              <th scope="col" className="name-col">
                <span className="sr-only">Team</span>
              </th>
              <th scope="col" title="Played">P</th>
              <th scope="col" title="Won">W</th>
              <th scope="col" title="Drawn">D</th>
              <th scope="col" title="Lost">L</th>
              <th scope="col" title="Points difference">+/−</th>
              <th scope="col" title="League points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.team} className={done && i < 2 ? 'finalist' : undefined}>
                <th scope="row" className="name-col">
                  <span className="rank">{i + 1}</span> {r.name}
                </th>
                <td>{r.played}</td>
                <td>{r.won}</td>
                <td>{r.drawn}</td>
                <td>{r.lost}</td>
                <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                <td className="pts">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Matches</h2>
      {rounds.map((round) => (
        <div key={round} className="round">
          <h3>Round {round}</h3>
          <ul className="fixture-list">
            {t.fixtures.map((f, i) =>
              f.round === round ? (
                <FixtureRow
                  key={i}
                  fixture={f}
                  names={t.teams}
                  target={t.pointsPerMatch}
                  isFinal={false}
                  onOpen={() => onChange({ ...t, active: i })}
                />
              ) : null,
            )}
          </ul>
        </div>
      ))}

      <h2>Final</h2>
      {t.final ? (
        <>
          <ul className="fixture-list">
            {t.finalMatch ? (
              <FinalMatchRow tournament={t} onOpen={() => onChange({ ...t, active: 'final' })} />
            ) : (
              <FixtureRow
                fixture={t.final}
                names={t.teams}
                target={t.finalPoints}
                isFinal
                onOpen={() => onChange({ ...t, active: 'final' })}
              />
            )}
          </ul>
          {!finalStarted(t) && (
            <button type="button" className="secondary" onClick={() => onChange(cancelFinal(t))}>
              Change the final
            </button>
          )}
        </>
      ) : done ? (
        <FinalPicker tournament={t} onStart={onChange} onSetupMatch={onSetupFinalMatch} />
      ) : (
        <p className="lead-small">
          The final unlocks when all {total} matches are played. The top two teams meet.
        </p>
      )}
    </main>
  )
}

function FixtureRow(props: {
  fixture: Fixture
  names: string[]
  target: number
  isFinal: boolean
  onOpen: () => void
}) {
  const { fixture: f, names, target, isFinal } = props
  const finished = isFixtureDone(f, target, isFinal)
  const winner = fixtureWinner(f, target, isFinal)
  const score = fixtureScore(f)
  const started = f.log.length > 0
  const label = finished ? 'View' : started ? 'Continue' : 'Play'

  return (
    <li className={`fixture ${finished ? 'finished' : ''}`}>
      <button type="button" onClick={props.onOpen}>
        <span className={`fx-team ${winner === 'A' ? 'won' : ''}`}>{names[f.a]}</span>
        <span className="fx-score">{started ? `${score.A} - ${score.B}` : 'vs'}</span>
        <span className={`fx-team right ${winner === 'B' ? 'won' : ''}`}>{names[f.b]}</span>
        <span className="fx-action">{winner === 'draw' ? 'Draw' : label}</span>
      </button>
    </li>
  )
}

/** A final played as a regular padel match: shows the sets or games, like the scoreboard does. */
function FinalMatchRow({ tournament: t, onOpen }: { tournament: Tournament; onOpen: () => void }) {
  const final = t.final as Fixture
  const state = (t.finalMatch as NonNullable<Tournament['finalMatch']>).present
  const board = getScoreboard(state)
  const finished = state.status === 'complete'
  const started = finalStarted(t)
  const won = state.winner
  // Games-only matches show the games; set matches show the sets won so far.
  const gamesMode = state.config.format.kind === 'games'
  const shown = gamesMode
    ? (board.current?.games ?? board.completedSets[0]?.games ?? { A: 0, B: 0 })
    : board.setsWon

  return (
    <li className={`fixture ${finished ? 'finished' : ''}`}>
      <button type="button" onClick={onOpen}>
        <span className={`fx-team ${won === 'A' ? 'won' : ''}`}>{t.teams[final.a]}</span>
        <span className="fx-score">
          {started ? `${shown.A} - ${shown.B}` : 'vs'}
        </span>
        <span className={`fx-team right ${won === 'B' ? 'won' : ''}`}>{t.teams[final.b]}</span>
        <span className="fx-action">{finished ? (won === 'draw' ? 'Draw' : 'View') : started ? 'Continue' : 'Play'}</span>
      </button>
    </li>
  )
}

/** Shown when the league is over: pick how the final is played (and the finalists, if the table can't). */
function FinalPicker({
  tournament: t,
  onStart,
  onSetupMatch,
}: {
  tournament: Tournament
  onStart: (t: Tournament) => void
  onSetupMatch: (finalists: [number, number]) => void
}) {
  const table = standings(t)
  const tied = finalistsTied(t)
  const [points, setPoints] = useState(t.pointsPerMatch || DEFAULT_POINTS)
  const [kind, setKind] = useState<'points' | 'match'>('points')
  // Only used when the table cannot decide who is in: the user picks the second finalist.
  const [second, setSecond] = useState(table[1].team)
  const first = table[0].team

  const runnerUp = table[1]
  const candidates = table.filter(
    (r) =>
      r.team !== first &&
      r.points === runnerUp.points &&
      r.diff === runnerUp.diff &&
      r.pointsFor === runnerUp.pointsFor,
  )

  return (
    <div className="final-picker">
      <p className="lead-small">
        League finished. {t.teams[first]} and {t.teams[tied ? second : table[1].team]} play the
        final. There are no draws: if it is level at the end, the next point wins.
      </p>
      {tied && (
        <label className="field">
          <span>Level for 2nd place: who plays {t.teams[first]}?</span>
          <select value={second} onChange={(e) => setSecond(Number(e.target.value))}>
            {candidates.map((r) => (
              <option key={r.team} value={r.team}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="choices" role="radiogroup" aria-label="How the final is played">
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'points'}
          className={kind === 'points' ? 'choice selected' : 'choice'}
          onClick={() => setKind('points')}
        >
          <strong>Points match</strong>
          <small>Like the league, no draws</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'match'}
          className={kind === 'match' ? 'choice selected' : 'choice'}
          onClick={() => setKind('match')}
        >
          <strong>Regular match</strong>
          <small>Sets or games, your rules</small>
        </button>
      </div>
      {kind === 'points' && (
      <div className="stepper">
        <span>Final points</span>
        <button
          type="button"
          aria-label="Fewer final points"
          disabled={points <= MIN_POINTS}
          onClick={() => setPoints(points - 1)}
        >
          −
        </button>
        <output aria-live="polite">{points}</output>
        <button
          type="button"
          aria-label="More final points"
          disabled={points >= MAX_POINTS}
          onClick={() => setPoints(points + 1)}
        >
          +
        </button>
      </div>
      )}
      <button
        type="button"
        className="primary"
        onClick={() => {
          const finalists: [number, number] = [first, tied ? second : table[1].team]
          if (kind === 'match') onSetupMatch(finalists)
          else onStart(startFinal(t, points, finalists))
        }}
      >
        {kind === 'match' ? 'Choose the match rules' : 'Start the final'}
      </button>
    </div>
  )
}
