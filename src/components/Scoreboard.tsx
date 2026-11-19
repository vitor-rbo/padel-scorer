import type { ReactNode } from 'react'
import type { Scoreboard as Board, SetResult, TeamId } from '../scoring'
import type { Teams } from '../setup'
import { teamName } from '../setup'

interface Props {
  board: Board
  teams: Teams
}

const TEAM_IDS: TeamId[] = ['A', 'B']

/** One finished set's cell for one team, e.g. "6", "7" or "6⁴" (tie-break). */
function resultCell(r: SetResult, team: TeamId): ReactNode {
  if (r.kind === 'superTieBreak') return r.tieBreak?.[team] ?? 0
  const games = r.games[team]
  // Convention: show the LOSER's tie-break points small next to their games.
  if (r.tieBreak && r.winner && r.winner !== team) {
    return (
      <>
        {games}
        <sup>{r.tieBreak[team]}</sup>
      </>
    )
  }
  return games
}

/**
 * The table of scores: a row per team, a column per finished set, and a
 * highlighted column for the set/games being played right now. It only
 * displays; all rules live in the scoring module.
 */
export function Scoreboard({ board, teams }: Props) {
  const { current, completedSets } = board
  const gamesMode =
    current?.kind === 'fixedGames' || completedSets.some((r) => r.kind === 'fixedGames')
  const finalGames = completedSets.find((r) => r.kind === 'fixedGames')?.games

  return (
    <table className="board" aria-label="Score">
      <thead>
        <tr>
          <th scope="col" className="name-col">
            <span className="sr-only">Team</span>
          </th>
          {!gamesMode && <th scope="col">Sets</th>}
          {!gamesMode &&
            completedSets.map((_, i) => (
              <th scope="col" key={i}>
                S{i + 1}
              </th>
            ))}
          {!gamesMode && current && (
            <th scope="col" className="now">
              {current.kind === 'superTieBreak' ? 'TB' : `S${completedSets.length + 1}`}
            </th>
          )}
          {gamesMode && (
            <th scope="col" className="now">
              Games
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {TEAM_IDS.map((team) => (
          <tr key={team} className={`team-${team}`}>
            <th scope="row" className="name-col">
              {teamName(team, teams)}
            </th>
            {!gamesMode && <td className="sets-won">{board.setsWon[team]}</td>}
            {!gamesMode && completedSets.map((r, i) => <td key={i}>{resultCell(r, team)}</td>)}
            {!gamesMode && current && (
              <td className="now">
                {current.kind === 'superTieBreak' ? '-' : current.games[team]}
              </td>
            )}
            {gamesMode && (
              <td className="now">{(current?.games ?? finalGames)?.[team] ?? 0}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
