import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChartScale } from '../src/components/charts'

describe('useChartScale', () => {
  it('maps point indexes and values into the chart plot area', () => {
    const { result } = renderHook(() =>
      useChartScale({
        width: 100,
        height: 80,
        padding: {
          top: 10,
          right: 10,
          bottom: 20,
          left: 10,
        },
        pointCount: 3,
        minValue: 0,
        maxValue: 100,
      }),
    )

    expect(result.current.plotWidth).toBe(80)
    expect(result.current.plotHeight).toBe(50)
    expect(result.current.baselineY).toBe(60)

    expect(result.current.getX(0)).toBe(10)
    expect(result.current.getX(1)).toBe(50)
    expect(result.current.getX(2)).toBe(90)

    expect(result.current.getY(100)).toBe(10)
    expect(result.current.getY(50)).toBe(35)
    expect(result.current.getY(0)).toBe(60)
  })

  it('handles one point and a zero value range', () => {
    const { result } = renderHook(() =>
      useChartScale({
        width: 100,
        height: 80,
        padding: {
          top: 10,
          right: 10,
          bottom: 20,
          left: 10,
        },
        pointCount: 1,
        minValue: 25,
        maxValue: 25,
      }),
    )

    expect(result.current.getX(0)).toBe(10)
    expect(result.current.getY(25)).toBe(10)
  })
})
