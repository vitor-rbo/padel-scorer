import { useEffect, useState } from 'react'
import { History } from './components/History'
import { Scorer } from './components/Scorer'
import { BracketHub } from './components/BracketHub'
import { PointsScorer } from './components/PointsScorer'
import { Setup } from './components/Setup'
import { TournamentHub } from './components/TournamentHub'
import { TournamentSetup } from './components/TournamentSetup'
import { Welcome } from './components/Welcome'
import { newId } from './archive'
import { applyHistory, clearFinished, deleteFinished, reconcile } from './matches'
import { createHistory } from './scoring'
import type { MatchConfig, MatchHistory } from './scoring'
import type { SetupState, Teams } from './setup'
import { loadApp, saveApp } from './storage'
import type { AppData } from './storage'
import { activeFixture, startFinal, updateActive } from './tournament/tournament'
import type { Tournament } from './tournament/tournament'
import {
  bracketPoint,
  bracketUndo,
  closeMatch,
  isLocked,
  matchFixture,
  openMatch,
  participants,
  structureFor,
  updateRegularMatch,
} from './tournament/bracket'
import type { Bracket } from './tournament/bracket'

/**
 * Screens:
 *   Welcome -> Setup -> Scorer, plus Match history, which opens from Setup or from a finished match.
 *   Tournament mode is a second branch: Welcome -> Tournament setup -> Tournament overview, which
 *   opens a points scorer for each match. A tournament in progress is saved (app.tournament) and
 *   reopens on its overview after a refresh.
 *
 * If a match is in progress (app.session), we show the Scorer, even right after a refresh, so you
 * never lose your place on court. Welcome and Setup only matter when there is no match yet.
 * Which of those two is showing is kept in `screen`, and whether the history is open in
 * `historyOpen`. Neither is saved: opening the app fresh with no match starts on Welcome.
 */
export default function App() {
  // Passing a function to useState means this runs once, not on every render.
  const [app, setApp] = useState<AppData>(() => reconcile(loadApp(), Date.now(), newId))
  const [screen, setScreen] = useState<
    'welcome' | 'setup' | 'tournamentSetup' | 'tournament' | 'bracket' | 'finalSetup'
  >(() => (app.tournament ? 'tournament' : app.bracket ? 'bracket' : 'welcome'))
  // The two finalists while the rules of a regular-match final are being chosen.
  const [finalists, setFinalists] = useState<[number, number] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    saveApp(app)
  }, [app])

  // Swapping screens keeps the browser's scroll position, so a page scrolled down on
  // Welcome would open Setup cut off at the top. Jump back to the top on every screen change.
  const hasSession = app.session !== null
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, hasSession, historyOpen])

  const setSetup = (setup: SetupState) => setApp((a) => ({ ...a, setup }))

  const startMatch = (config: MatchConfig, teams: Teams) =>
    setApp((a) => ({ ...a, session: { teams, history: createHistory(config) } }))

  // Also adds the match to the history when it finishes (and removes it if the win is undone).
  const setHistory = (history: MatchHistory) =>
    setApp((a) => applyHistory(a, history, Date.now(), newId))

  const setTournament = (tournament: Tournament | null) => setApp((a) => ({ ...a, tournament }))

  const setBracket = (bracket: Bracket | null) => setApp((a) => ({ ...a, bracket }))

  const openHistory = () => setHistoryOpen(true)
  const historyCount = app.finished.length

  if (historyOpen) {
    return (
      <History
        entries={app.finished}
        onBack={() => setHistoryOpen(false)}
        onDelete={(id) => setApp((a) => deleteFinished(a, id))}
        onClear={() => setApp((a) => clearFinished(a))}
      />
    )
  }

  if (app.session) {
    const { session } = app
    return (
      <Scorer
        teams={session.teams}
        history={session.history}
        onHistory={setHistory}
        // Rematch: same teams, same rules, fresh score.
        onRematch={() => startMatch(session.history.present.config, session.teams)}
        // New match: straight to setup (names stay filled in so you can change them).
        onNewMatch={() => {
          setScreen('setup')
          setApp((a) => ({ ...a, session: null }))
        }}
        onOpenHistory={openHistory}
      />
    )
  }

  if (screen === 'tournamentSetup') {
    return (
      <TournamentSetup
        setup={app.setup}
        onChangeSetup={setSetup}
        onBack={() => setScreen('welcome')}
        onStart={(t) => {
          setTournament(t)
          setScreen('tournament')
        }}
        onStartBracket={(b) => {
          setBracket(b)
          setScreen('bracket')
        }}
      />
    )
  }

  if (screen === 'finalSetup' && app.tournament && finalists) {
    const t = app.tournament
    return (
      <Setup
        setup={app.setup}
        onChange={setSetup}
        fixed={{
          A: t.teams[finalists[0]],
          B: t.teams[finalists[1]],
          title: 'Final',
          startLabel: 'Start the final',
        }}
        onStart={(config) => {
          setTournament(startFinal(t, t.finalPoints, finalists, createHistory(config)))
          setScreen('tournament')
        }}
        onBack={() => setScreen('tournament')}
        historyCount={0}
        onOpenHistory={openHistory}
      />
    )
  }

  if (screen === 'tournament' && app.tournament) {
    const t = app.tournament
    const fixture = activeFixture(t)
    if (fixture && t.active === 'final' && t.finalMatch) {
      const history = t.finalMatch
      return (
        <Scorer
          teams={{ A: t.teams[fixture.a], B: t.teams[fixture.b] }}
          history={history}
          onHistory={(next) => setTournament({ ...t, finalMatch: next })}
          onNewMatch={() => setTournament({ ...t, active: null })}
          leaveLabel="Back to tournament"
          confirmLeave={false}
          noDraw
        />
      )
    }
    if (fixture) {
      const isFinal = t.active === 'final'
      return (
        <PointsScorer
          fixture={fixture}
          names={{ A: t.teams[fixture.a], B: t.teams[fixture.b] }}
          target={isFinal ? t.finalPoints : t.pointsPerMatch}
          isFinal={isFinal}
          onChange={(next) => setTournament(updateActive(t, next))}
          onDone={() => setTournament({ ...t, active: null })}
        />
      )
    }
    return (
      <TournamentHub
        tournament={t}
        onChange={setTournament}
        onHome={() => setScreen('welcome')}
        onEnd={() => {
          setTournament(null)
          setScreen('welcome')
        }}
        onSetupFinalMatch={(pair) => {
          setFinalists(pair)
          setScreen('finalSetup')
        }}
      />
    )
  }

  if (screen === 'bracket' && app.bracket) {
    const b = app.bracket
    const i = b.active
    const [x, y] = i === null ? [null, null] : participants(b, i)

    if (i !== null && x !== null && y !== null) {
      const names = { A: b.teams[x], B: b.teams[y] }
      const title = `M${i + 1} · ${structureFor(b)[i].section}`
      const m = b.matches[i]
      const leave = () => setBracket(closeMatch(b))

      if (m.match) {
        return (
          <Scorer
            teams={names}
            history={m.match}
            onHistory={(next) => setBracket(updateRegularMatch(b, i, next))}
            onNewMatch={leave}
            leaveLabel="Back to bracket"
            confirmLeave={false}
            noDraw
            undoLocked={isLocked(b, i)}
          />
        )
      }

      return (
        <PointsScorer
          fixture={matchFixture(b, i)}
          names={names}
          target={b.points}
          isFinal
          label={title}
          undoLocked={isLocked(b, i)}
          onChange={(next) => {
            // The scorer hands back the new fixture; work out whether that was a point or an undo.
            setBracket(
              next.log.length > m.log.length
                ? bracketPoint(b, i, next.log[next.log.length - 1])
                : bracketUndo(b, i),
            )
          }}
          onDone={leave}
        />
      )
    }

    return (
      <BracketHub
        bracket={b}
        onOpen={(i) => setBracket(openMatch(b, i))}
        onHome={() => setScreen('welcome')}
        onEnd={() => {
          setBracket(null)
          setScreen('welcome')
        }}
      />
    )
  }

  if (screen === 'welcome') {
    return (
      <Welcome
        onStart={() => setScreen('setup')}
        hasTournament={app.tournament !== null || app.bracket !== null}
        onTournament={() =>
          setScreen(app.tournament ? 'tournament' : app.bracket ? 'bracket' : 'tournamentSetup')
        }
      />
    )
  }

  return (
    <Setup
      setup={app.setup}
      onChange={setSetup}
      onStart={(config) => startMatch(config, app.setup.names)}
      onBack={() => setScreen('welcome')}
      historyCount={historyCount}
      onOpenHistory={openHistory}
    />
  )
}
