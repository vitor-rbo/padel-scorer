import heroUrl from '../assets/hero.webp'
import { useInstall } from '../install'

interface Props {
  onStart: () => void
}

/**
 * The first screen a new visitor sees. Importing the image (instead of
 * linking /public) lets Vite fingerprint the file name, so browsers cache it
 * correctly and always pick up a new image if you replace it.
 */
export function Welcome({ onStart }: Props) {
  const { mode, install } = useInstall()

  return (
    <main className="welcome">
      <img
        className="hero-img"
        src={heroUrl}
        // Width and height let the browser reserve the space before the image loads.
        width={3840}
        height={1745}
        alt="Two padel rackets and three tennis balls resting against the net on a green court"
        fetchPriority="high"
        decoding="async"
      />

      <div className="welcome-body">
        <span className="ball-bar" aria-hidden="true" />
        <h1>Padel Scorer</h1>
        <p className="lead">
          Simple score keeping for padel. Tap a point, fix a mistake with undo, and carry on
          playing.
        </p>

        <button type="button" className="primary" onClick={onStart}>
          Start a match
        </button>

        {mode === 'prompt' && (
          <button type="button" className="secondary" onClick={install}>
            Install app
          </button>
        )}
        {mode === 'ios' && (
          <p className="hint">
            To install on iPhone: tap the Share button, then Add to Home Screen.
          </p>
        )}

        <p className="note">Your match is saved on this device, so a refresh won't lose the score.</p>
      </div>
    </main>
  )
}
