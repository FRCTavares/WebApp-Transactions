import { describe, expect, it } from 'vitest'
import { getNiceScale, getNiceTicks } from '../src/components/charts'

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

describe('getNiceScale', () => {
  it('rounds the domain outward so the line never touches an edge', () => {
    const scale = getNiceScale(4213, 5487, 4)

    expect(scale.min).toBeLessThanOrEqual(4213)
    expect(scale.max).toBeGreaterThanOrEqual(5487)
    expect(scale.ticks[0]).toBe(scale.min)
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max)

    for (const tick of scale.ticks) {
      expect(tick % 500).toBe(0)
    }
  })

  it('opens a band around a flat series instead of pinning it to an edge', () => {
    const scale = getNiceScale(1000, 1000, 4)

    expect(scale.min).toBeLessThan(1000)
    expect(scale.max).toBeGreaterThan(1000)
    expect(scale.ticks).toEqual([1000])
  })

  it('falls back to a unit domain for non-finite input', () => {
    expect(getNiceScale(Number.NaN, 10)).toEqual({ min: 0, max: 1, ticks: [] })
  })
})
