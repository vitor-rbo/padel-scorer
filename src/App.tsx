import { useEffect, useState } from 'react'
import { Scorer } from './components/Scorer'
import { Setup } from './components/Setup'
import { Welcome } from './components/Welcome'
import { createHistory } from './scoring'
import type { MatchConfig, MatchHistory } from './scoring'
import type { SetupState, Teams } from './setup'
import { loadApp, saveApp } from './storage'
import type { AppData } from './storage'

/**
 * Three screens:
 *   Welcome -> Setup -> Scorer
 *
 * If a match is in progress (app.session), we always show the Scorer, even
 * right after a refresh, so you never lose your place on court. The welcome
 * and setup screens only matter when there is no match yet. Which of those two
 * is showing is remembered in `screen` (plain memory, not saved: opening the
 * app fresh with no match always starts on Welcome).
 */
export default function App() {
  // Passing a function to useState means loadApp() runs once, not every render.
  const [app, setApp] = useState<AppData>(loadApp)
  const [screen, setScreen] = useState<'welcome' | 'setup'>('welcome')

  useEffect(() => {
    saveApp(app)
  }, [app])

  // Swapping screens keeps the browser's scroll position, so a page scrolled down on
  // Welcome would open Setup cut off at the top. Jump back to the top on every screen change.
  const hasSession = app.session !== null
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, hasSession])

  const setSetup = (setup: SetupState) => setApp((a) => ({ ...a, setup }))

  const startMatch = (config: MatchConfig, teams: Teams) =>
    setApp((a) => ({ ...a, session: { teams, history: createHistory(config) } }))

  const setHistory = (history: MatchHistory) =>
    setApp((a) => (a.session ? { ...a, session: { ...a.session, history } } : a))

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
    />
  )
}
