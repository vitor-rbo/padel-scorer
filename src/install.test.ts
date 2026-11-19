import { describe, expect, it } from 'vitest'
import { looksLikeIos } from './install'

describe('looksLikeIos', () => {
  it('recognises iPhone and iPad user agents', () => {
    expect(
      looksLikeIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', 'iPhone', 5),
    ).toBe(true)
    expect(looksLikeIos('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 'iPad', 5)).toBe(true)
  })

  it('recognises iPadOS, which reports itself as a Mac but has a touch screen', () => {
    expect(looksLikeIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true)
  })

  it('does not mistake a real Mac or other devices for iOS', () => {
    expect(looksLikeIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false)
    expect(looksLikeIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false)
    expect(looksLikeIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv81', 5)).toBe(false)
  })
})
