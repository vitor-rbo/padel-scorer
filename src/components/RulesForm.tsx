import type { ReactNode } from 'react'
import type { CustomOptions, DeuceChoice, Mode, SetupState } from '../setup'

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Best of 3 sets' },
  { value: 'custom', label: 'Custom', hint: 'Your own rules' },
]

const DEUCES: { value: DeuceChoice; label: string; hint: string }[] = [
  { value: 'advantage', label: 'Advantage', hint: 'Golden point on the 3rd deuce' },
  { value: 'golden', label: 'Golden point', hint: 'Next point at 40-40 wins' },
  { value: 'traditional', label: 'Traditional', hint: 'Advantage, no limit' },
]

interface FormProps {
  setup: SetupState
  onChange: (next: SetupState) => void
}

/**
 * The match rules: Standard or Custom (games or sets), the super tie-break, and what happens at
 * 40-40. Renders the "Format" and "At 40-40" sections, so the parent lays them out. Shared by the
 * new match screen and the tournament screens.
 */
export function RulesForm({ setup, onChange }: FormProps) {
  const patch = (p: Partial<SetupState>) => onChange({ ...setup, ...p })
  const patchCustom = (p: Partial<CustomOptions>) =>
    patch({ custom: { ...setup.custom, ...p } })

  const showSuperTieBreak =
    setup.mode === 'standard' ||
    (setup.mode === 'custom' && setup.custom.format === 'sets' && !setup.custom.playAll)

  return (
    <>
          <section>
            <h2>Format</h2>
            <Choices options={MODES} value={setup.mode} onPick={(mode) => patch({ mode })} />
  
            {setup.mode === 'custom' && (
              <div className="custom">
                <Choices
                  options={[
                    { value: 'games', label: 'Games only', hint: 'No sets' },
                    { value: 'sets', label: 'Sets', hint: 'Games make sets' },
                  ]}
                  value={setup.custom.format}
                  onPick={(format) => patchCustom({ format })}
                />
                {setup.custom.format === 'games' ? (
                  <Stepper
                    label="Number of games"
                    value={setup.custom.numberOfGames}
                    min={1}
                    max={21}
                    onChange={(numberOfGames) => patchCustom({ numberOfGames })}
                  />
                ) : (
                  <>
                    <Stepper
                      label="Number of sets"
                      value={setup.custom.numberOfSets}
                      min={1}
                      max={9}
                      onChange={(numberOfSets) => patchCustom({ numberOfSets })}
                    />
                    <Toggle
                      checked={setup.custom.playAll}
                      onChange={(playAll) => patchCustom({ playAll })}
                    >
                      Always play every set
                    </Toggle>
                  </>
                )}
              </div>
            )}
  
            {showSuperTieBreak && (
              <Toggle
                checked={setup.superTieBreak}
                onChange={(superTieBreak) => patch({ superTieBreak })}
              >
                Super tie-break (first to 10) instead of the deciding set
              </Toggle>
            )}
          </section>
  
          <section className="span-all">
            <h2>At 40-40</h2>
            {/* Three options: stacked on a phone, one row of three on a wide screen. A plain
                2-column grid would leave the third one half-width. */}
            <Choices
              stacked
              options={DEUCES}
              value={setup.deuce}
              onPick={(deuce) => patch({ deuce })}
            />
          </section>
    </>
  )
}

// --- Small form controls ---------------------------------------------------

export function Choices<T extends string>(props: {
  options: { value: T; label: string; hint: string }[]
  value: T
  onPick: (value: T) => void
  /** One option per row, all the same width. */
  stacked?: boolean
}) {
  return (
    <div className={props.stacked ? 'choices stacked' : 'choices'} role="radiogroup">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? 'choice selected' : 'choice'}
          onClick={() => props.onPick(o.value)}
        >
          <strong>{o.label}</strong>
          <small>{o.hint}</small>
        </button>
      ))}
    </div>
  )
}

export function Stepper(props: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  /** Smaller buttons, for a stepper that sits under other choices. */
  compact?: boolean
}) {
  const { value, min, max, onChange } = props
  return (
    <div className={props.compact ? 'stepper compact' : 'stepper'}>
      <span>{props.label}</span>
      <button
        type="button"
        aria-label={`Fewer ${props.label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={`More ${props.label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

export function Toggle(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.children}</span>
    </label>
  )
}
