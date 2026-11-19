import { canUndo, getScoreboard, recordPoint, recordTieDecision, undo } from '../scoring'
import type { MatchHistory, MatchState, TeamId, TieDecision } from '../scoring'
import type { Teams } from '../setup'
import { teamName } from '../setup'
import { Scoreboard } from './Scoreboard'

interface Props {
  teams: Teams
  history: MatchHistory
  onHistory: (next: MatchHistory) => void
  onRematch: () => void
  onNewMatch: () => void
  onOpenHistory: () => void
}

function statusText(state: MatchState): string {
  const board = getScoreboard(state)
  const cur = board.current
  if (state.status === 'awaitingTieDecision') return 'Level after all games'
  if (!cur) return 'Match finished'
  if (cur.kind === 'fixedGames') {
    const played = cur.games.A + cur.games.B
    return `Game ${played + 1} of ${cur.gameLimit}`
  }
  if (cur.kind === 'superTieBreak') return 'Super tie-break'
  if (cur.tieBreak) return `Set ${board.completedSets.length + 1}, tie-break`
  return `Set ${board.completedSets.length + 1}`
}

/** What to show on a team's big button: 15/30/40/Ad, or tie-break points. */
function buttonScore(state: MatchState, team: TeamId): string {
  const cur = getScoreboard(state).current
  if (!cur) return ''
  if (cur.tieBreak) return String(cur.tieBreak[team])
  return cur.gameLabels?.[team] ?? ''
}

export function Scorer({ teams, history, onHistory, onRematch, onNewMatch, onOpenHistory }: Props) {
  const state = history.present
  const board = getScoreboard(state)
  const live = state.status === 'inProgress'
  const names: Record<TeamId, string> = {
    A: teamName('A', teams),
    B: teamName('B', teams),
  }

  const tap = (team: TeamId) => onHistory(recordPoint(history, team))
  const decide = (d: TieDecision) => onHistory(recordTieDecision(history, d))
  const extraLabel = state.config.format.kind === 'games' ? 'Play one more game' : 'Play one more set'

  const confirmNewMatch = () => {
    if (state.status !== 'complete' && !window.confirm('Leave this match? The score will be lost.')) {
      return
    }
    onNewMatch()
  }

  return (
    <main className="scorer">
      <header className="status" aria-live="polite">
        <span>{statusText(state)}</span>
        {live && board.current?.isGoldenPoint && <strong className="golden">Golden point</strong>}
      </header>

      <Scoreboard board={board} teams={teams} />

      {state.status === 'awaitingTieDecision' && (
        <section className="panel fill" role="alertdialog" aria-label="Match is level">
          <p>Level! What now?</p>
          <div className="panel-actions">
            <button type="button" onClick={() => decide('extra')}>
              {extraLabel}
            </button>
            <button type="button" onClick={() => decide('draw')}>
              End as a draw
            </button>
          </div>
        </section>
      )}

      {state.status === 'complete' && (
        <section
          className={`panel fill ${state.winner === 'draw' ? 'draw' : `win-${state.winner}`}`}
          role="status"
        >
          <p className="result">
            {state.winner === 'draw' ? 'Draw!' : `${names[state.winner as TeamId]} win!`}
          </p>
          <div className="panel-actions">
            <button type="button" onClick={onRematch}>
              Rematch (same teams)
            </button>
            <button type="button" onClick={onNewMatch}>
              New match
            </button>
            <button type="button" onClick={onOpenHistory}>
              Match history
            </button>
          </div>
        </section>
      )}

      {/* The point buttons only exist while play is on; otherwise the panel above fills the space. */}
      {live && (
        <div className="points">
          {(['A', 'B'] as TeamId[]).map((team) => (
            <button
              key={team}
              type="button"
              className={`point team-${team}`}
              onClick={() => tap(team)}
              aria-label={`Point for ${names[team]}`}
            >
              <span className="point-name">{names[team]}</span>
              <span className="point-score">{buttonScore(state, team)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Undo stays available even after the last point, to fix a mis-tap.
          The finished panel has its own New match button, so the footer one is hidden then. */}
      <footer className={state.status === 'complete' ? 'controls single' : 'controls'}>
        <button
          type="button"
          className="undo"
          disabled={!canUndo(history)}
          onClick={() => onHistory(undo(history))}
        >
          ↶ Undo
        </button>
        {state.status !== 'complete' && (
          <button type="button" className="menu" onClick={confirmNewMatch}>
            New match
          </button>
        )}
      </footer>
    </main>
  )
}
