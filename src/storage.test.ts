import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHistory, recordPoint, STANDARD_CONFIG } from './scoring'
import { DEFAULT_SETUP } from './setup'
import { EMPTY_APP, loadApp, saveApp } from './storage'
import type { AppData } from './storage'

/** A tiny in-memory stand-in for localStorage (tests run in Node, not a browser). */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}

const KEY = 'padel-scorer:v1'

const sampleApp = (): AppData => ({
  setup: { ...DEFAULT_SETUP, names: { A: 'Ana & Rui', B: '' } },
  session: {
    teams: { A: 'Ana & Rui', B: '' },
    history: recordPoint(recordPoint(createHistory(STANDARD_CONFIG), 'A'), 'B'),
  },
})

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadApp()).toEqual(EMPTY_APP)
  })

  it('round-trips a match in progress', () => {
    const app = sampleApp()
    expect(saveApp(app)).toBe(true)
    expect(loadApp()).toEqual(app)
  })

  it('survives corrupted JSON', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: '{not json' }))
    expect(loadApp()).toEqual(EMPTY_APP)
  })

  it('ignores data from another version', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: JSON.stringify({ version: 99, ...sampleApp() }) }))
    expect(loadApp()).toEqual(EMPTY_APP)
  })

  it('drops a saved match whose rules are invalid, but keeps the setup', () => {
    const app = sampleApp()
    const bad = JSON.parse(JSON.stringify({ version: 1, ...app }))
    bad.session.history.present.config.gamesPerSet = -3
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: JSON.stringify(bad) }))
    const loaded = loadApp()
    expect(loaded.session).toBeNull()
    expect(loaded.setup).toEqual(app.setup)
  })

  it('migrates an old "3 games" setup to Custom with 3 games', () => {
    const old = JSON.parse(JSON.stringify({ version: 1, ...sampleApp() }))
    old.setup.mode = 'threeGames'
    old.setup.custom = { format: 'sets', numberOfGames: 7, numberOfSets: 3, playAll: false }
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: JSON.stringify(old) }))
    const { setup } = loadApp()
    expect(setup.mode).toBe('custom')
    expect(setup.custom).toMatchObject({ format: 'games', numberOfGames: 3 })
    expect(setup.names.A).toBe('Ana & Rui') // names are kept
  })

  it('falls back to the default setup if the saved one is unusable', () => {
    const bad = JSON.parse(JSON.stringify({ version: 1, ...sampleApp() }))
    bad.setup.mode = 'banana'
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: JSON.stringify(bad) }))
    expect(loadApp().setup).toEqual(DEFAULT_SETUP)
  })

  it('drops a saved match with a malformed shape', () => {
    const bad = { version: 1, setup: sampleApp().setup, session: { teams: {}, history: 5 } }
    vi.stubGlobal('localStorage', fakeStorage({ [KEY]: JSON.stringify(bad) }))
    expect(loadApp().session).toBeNull()
  })

  it('does not crash when storage throws (private mode / blocked)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(loadApp()).toEqual(EMPTY_APP)
    expect(saveApp(sampleApp())).toBe(false)
  })

  it('does not crash when localStorage does not exist at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadApp()).toEqual(EMPTY_APP)
    expect(saveApp(sampleApp())).toBe(false)
  })
})
