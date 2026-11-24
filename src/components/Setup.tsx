import { validateConfig } from '../scoring'
import type { MatchConfig } from '../scoring'
import { buildConfig } from '../setup'
import type { SetupState } from '../setup'
import { RulesForm } from './RulesForm'

interface Props {
  setup: SetupState
  onChange: (next: SetupState) => void
  onStart: (config: MatchConfig) => void
  onBack: () => void
  /** The history link only shows when there is something to see. */
  historyCount: number
  onOpenHistory: () => void
  /** Setting up one match of a tournament: the teams are decided, so show them instead of the name fields. */
  fixed?: { A: string; B: string; title: string; startLabel: string }
}

export function Setup({ setup, onChange, onStart, onBack, historyCount, onOpenHistory, fixed }: Props) {
  const config = buildConfig(setup)
  const errors = validateConfig(config)
  const patch = (p: Partial<SetupState>) => onChange({ ...setup, ...p })

  return (
    <main className="setup">
      <div className="setup-top">
        <button type="button" className="back" onClick={onBack}>
          ← Back
        </button>
        {historyCount > 0 && (
          <button type="button" className="back" onClick={onOpenHistory}>
            Match history ({historyCount})
          </button>
        )}
      </div>
      <h1>{fixed ? fixed.title : 'New match'}</h1>
      {fixed && (
        <p className="lead-small">
          {fixed.A} vs {fixed.B}. Choose how the match is played.
        </p>
      )}

      {/* One column on a phone; Teams and Format sit side by side on a wide screen (see index.css). */}
      <div className="setup-grid">
        {!fixed && (
        <section>
          <h2>Teams</h2>
          <label className="field">
            <span>Team A</span>
            <input
              type="text"
              value={setup.names.A}
              placeholder="Team A (e.g. Ana & Rui)"
              maxLength={40}
              onChange={(e) => patch({ names: { ...setup.names, A: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>Team B</span>
            <input
              type="text"
              value={setup.names.B}
              placeholder="Team B"
              maxLength={40}
              onChange={(e) => patch({ names: { ...setup.names, B: e.target.value } })}
            />
          </label>
        </section>
        )}

        <RulesForm setup={setup} onChange={onChange} />
      </div>

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
          onClick={() => onStart(config)}
        >
          {fixed ? fixed.startLabel : 'Start match'}
        </button>
      </div>
    </main>
  )
}
