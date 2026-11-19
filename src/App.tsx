import { useEffect, useState } from 'react'
import { History } from './components/History'
import { Scorer } from './components/Scorer'
import { Setup } from './components/Setup'
import { Welcome } from './components/Welcome'
import { newId } from './archive'
import { applyHistory, clearFinished, deleteFinished, reconcile } from './matches'
import { createHistory } from './scoring'
import type { MatchConfig, MatchHistory } from './scoring'
import type { SetupState, Teams } from './setup'
import { loadApp, saveApp } from './storage'
import type { AppData } from './storage'

/**
 * Screens:
 *   Welcome -> Setup -> Scorer, plus Match history, which opens from Setup or from a finished match.
 *
 * If a match is in progress (app.session), we show the Scorer, even right after a refresh, so you
 * never lose your place on court. Welcome and Setup only matter when there is no match yet.
 * Which of those two is showing is kept in `screen`, and whether the history is open in
 * `historyOpen`. Neither is saved: opening the app fresh with no match starts on Welcome.
 */
export default function App() {
  // Passing a function to useState means this runs once, not on every render.
  const [app, setApp] = useState<AppData>(() => reconcile(loadApp(), Date.now(), newId))
  const [screen, setScreen] = useState<'welcome' | 'setup'>('welcome')
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

  if (screen === 'welcome') {
    return <Welcome onStart={() => setScreen('setup')} />
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
