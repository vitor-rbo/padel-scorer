import { useCallback, useEffect, useState } from 'react'

/**
 * Helping people install the app to their home screen.
 *
 * Browsers handle this differently:
 *  - Chrome / Edge (Android and desktop) fire a "beforeinstallprompt" event. We keep it and
 *    trigger it from our own "Install app" button.
 *  - iPhone / iPad Safari has no such event. Installing is a manual Share > Add to Home Screen,
 *    so all we can do is show a hint.
 *  - If the app is already running installed (standalone), we show nothing.
 */

/** The non-standard event Chrome gives us. TypeScript doesn't know it, so we describe it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode =
  | 'installed' // already running as an installed app
  | 'prompt' // browser can show its install dialog on request
  | 'ios' // needs the manual Share > Add to Home Screen steps
  | 'none' // nothing useful to offer (e.g. Firefox desktop)

/** Pure, so it can be unit tested. iPadOS pretends to be a Mac, hence the touch-points check. */
export function looksLikeIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true
  return platform === 'MacIntel' && maxTouchPoints > 1
}

function runningStandalone(): boolean {
  try {
    const iosFlag = (navigator as Navigator & { standalone?: boolean }).standalone === true
    return iosFlag || window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(runningStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // stop Chrome's own mini-banner; we show our button instead
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return
    await event.prompt()
    await event.userChoice
    setEvent(null) // an install prompt can only be used once
  }, [event])

  let mode: InstallMode = 'none'
  if (installed) mode = 'installed'
  else if (event) mode = 'prompt'
  else if (looksLikeIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) mode = 'ios'

  return { mode, install }
}
