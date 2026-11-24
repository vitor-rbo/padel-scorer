import type { TeamId } from '../scoring'
import { addPoint, fixtureScore, fixtureWinner, isFixtureDone, removeLastPoint } from '../tournament/tournament'
import type { Fixture } from '../tournament/tournament'

interface Props {
  fixture: Fixture
  names: Record<TeamId, string>
  target: number
  isFinal: boolean
  /** Shown before the status instead of "Final", e.g. "Losers bracket". */
  label?: string
  /** Undo is blocked because a later match already depends on this result. */
  undoLocked?: boolean
  onChange: (next: Fixture) => void
  /** Back to the tournament overview. */
  onDone: () => void
}

/** Scores one tournament match: tap a team to give it a point. */
export function PointsScorer({
  fixture,
  names,
  target,
  isFinal,
  label,
  undoLocked = false,
  onChange,
  onDone,
}: Props) {
  const score = fixtureScore(fixture)
  const done = isFixtureDone(fixture, target, isFinal)
  const winner = fixtureWinner(fixture, target, isFinal)
  const played = fixture.log.length
  const level = score.A === score.B
  const sudden = isFinal && !done && played >= target

  const heading = label ?? (isFinal ? 'Final' : null)
  const status = done
    ? 'Match finished'
    : sudden
      ? 'Level! Next point wins'
      : `Point ${played + 1} of ${target}`

  return (
    <main className="scorer">
      <header className="status" aria-live="polite">
        <span>{heading ? `${heading} · ${status}` : status}</span>
        {!isFinal && !done && played > 0 && <strong className="golden">{target - played} to go</strong>}
      </header>

      {done && (
        <section
          className={`panel ${winner === 'draw' ? 'draw' : `win-${winner}`}`}
          role="status"
        >
          <p className="result">
            {winner === 'draw'
              ? `Draw ${score.A}-${score.B}`
              : `${names[winner as TeamId]} win ${Math.max(score.A, score.B)}-${Math.min(score.A, score.B)}`}
          </p>
          <div className="panel-actions">
            <button type="button" onClick={onDone}>
              Back to tournament
            </button>
          </div>
        </section>
      )}

      <div className="points">
        {(['A', 'B'] as TeamId[]).map((team) => (
          <button
            key={team}
            type="button"
            className={`point team-${team}`}
            disabled={done}
            onClick={() => onChange(addPoint(fixture, team, target, isFinal))}
            aria-label={`Point for ${names[team]}`}
          >
            <span className="point-name">{names[team]}</span>
            <span className="point-score">{score[team]}</span>
          </button>
        ))}
      </div>

      <footer className="controls">
        <button
          type="button"
          className="undo"
          disabled={played === 0 || undoLocked}
          onClick={() => onChange(removeLastPoint(fixture))}
        >
          ↶ Undo
        </button>
        <button type="button" className="menu" onClick={onDone}>
          {done || played === 0 ? 'Overview' : 'Pause'}
        </button>
      </footer>
      {!done && level && played > 0 && !sudden && <span className="sr-only">Scores are level</span>}
    </main>
  )
}
