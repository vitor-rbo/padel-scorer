import { headlineScore, formatLabel, resultTitle, setScoreLines } from '../archive'
import type { FinishedMatch } from '../archive'
import type { TeamId } from '../scoring'
import { teamName } from '../setup'

interface Props {
  entries: FinishedMatch[]
  onBack: () => void
  onDelete: (id: string) => void
  onClear: () => void
}

const TEAM_IDS: TeamId[] = ['A', 'B']

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function History({ entries, onBack, onDelete, onClear }: Props) {
  const confirmDelete = (id: string) => {
    if (window.confirm('Delete this match from your history?')) onDelete(id)
  }
  const confirmClear = () => {
    if (window.confirm(`Delete all ${entries.length} matches from your history?`)) onClear()
  }

  return (
    <main className="history">
      <button type="button" className="back" onClick={onBack}>
        ← Back
      </button>
      <h1>Match history</h1>

      {entries.length === 0 ? (
        <p className="empty">
          No finished matches yet. When you finish a match, it shows up here.
        </p>
      ) : (
        <>
          <ul className="match-list">
            {entries.map((entry) => {
              const score = headlineScore(entry)
              const sets = setScoreLines(entry)
              return (
                <li
                  key={entry.id}
                  className={entry.winner === 'draw' ? 'match-card' : 'match-card has-winner'}
                >
                  <div className="match-meta">
                    <time dateTime={new Date(entry.finishedAt).toISOString()}>
                      {formatDate(entry.finishedAt)}
                    </time>
                    <span>{formatLabel(entry.config)}</span>
                  </div>

                  <div className="match-teams">
                    {TEAM_IDS.map((team) => (
                      <div
                        key={team}
                        className={`match-row team-${team}${entry.winner === team ? ' winner' : ''}`}
                      >
                        <span className="match-name">{teamName(team, entry.teams)}</span>
                        <span className="match-score">{score[team]}</span>
                      </div>
                    ))}
                  </div>

                  {sets.length > 0 && <p className="match-sets">{sets.join('   ')}</p>}

                  <div className="match-foot">
                    <strong className={entry.winner === 'draw' ? '' : `result-${entry.winner}`}>
                      {resultTitle(entry)}
                    </strong>
                    <button type="button" className="text-button" onClick={() => confirmDelete(entry.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <button type="button" className="secondary" onClick={confirmClear}>
            Delete all matches
          </button>
        </>
      )}
    </main>
  )
}
