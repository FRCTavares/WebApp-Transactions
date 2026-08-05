import { describe, expect, it } from 'vitest'
import { getNiceTicks } from '../src/components/charts'

describe('getNiceTicks', () => {
  it('produces round numbers instead of arbitrary quarter-splits', () => {
    // Regression case from the bug report: quarter-splitting €35-€10,509
    // produced €7,954.00 / €5,314.00 / €2,675.00 - none of them round.
    const ticks = getNiceTicks(35, 10509, 3)

    for (const tick of ticks) {
      expect(tick % 1000).toBe(0)
    }
  })

  it('returns a single tick when min and max are equal', () => {
    expect(getNiceTicks(50, 50, 3)).toEqual([50])
  })

  it('covers small ranges with a fine enough step', () => {
    const ticks = getNiceTicks(0, 9, 3)

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(0)
      expect(tick).toBeLessThanOrEqual(9)
    }
  })

  it('handles negative ranges', () => {
    const ticks = getNiceTicks(-100, 100, 3)

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(Math.abs(tick % 50)).toBe(0)
    }
  })

  it('never returns a tick outside the given range', () => {
    const ticks = getNiceTicks(123, 4567, 4)

    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(123)
      expect(tick).toBeLessThanOrEqual(4567)
    }
  })

  it('returns an empty array for non-finite input', () => {
    expect(getNiceTicks(Number.NaN, 100, 3)).toEqual([])
    expect(getNiceTicks(0, Number.POSITIVE_INFINITY, 3)).toEqual([])
  })
})
