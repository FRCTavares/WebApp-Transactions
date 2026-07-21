import { describe, expect, it } from 'vitest'
import { CHART_SLICE_TOKENS, chartSliceColour } from '../src/utils/chartColours'

describe('chartSliceColour', () => {
  it('returns semantic tokens, never raw colours', () => {
    for (const c of CHART_SLICE_TOKENS) {
      expect(c).toMatch(/^var\(--chart-\d\)$/)
    }
  })

  it('maps each index to its token in order', () => {
    CHART_SLICE_TOKENS.forEach((token, index) => {
      expect(chartSliceColour(index)).toBe(token)
    })
  })

  it('wraps around the palette so a legend swatch and its slice always agree', () => {
    // The whole point of the shared helper: whatever index a slice and its
    // legend entry share, they resolve to the same token.
    for (let i = 0; i < CHART_SLICE_TOKENS.length * 3; i++) {
      expect(chartSliceColour(i)).toBe(chartSliceColour(i % CHART_SLICE_TOKENS.length))
    }
  })
})
