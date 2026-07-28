import { useMemo } from 'react'

export type ChartPadding = {
  top: number
  right: number
  bottom: number
  left: number
}

type UseChartScaleOptions = {
  width: number
  height: number
  padding: ChartPadding
  pointCount: number
  minValue: number
  maxValue: number
}

export function useChartScale({
  width,
  height,
  padding,
  pointCount,
  minValue,
  maxValue,
}: UseChartScaleOptions) {
  return useMemo(() => {
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const valueRange = Math.max(maxValue - minValue, 1)

    function getX(index: number) {
      return padding.left
        + (index / Math.max(pointCount - 1, 1)) * plotWidth
    }

    function getY(value: number) {
      return padding.top
        + ((maxValue - value) / valueRange) * plotHeight
    }

    return {
      baselineY: height - padding.bottom,
      getX,
      getY,
      plotHeight,
      plotWidth,
    }
  }, [
    height,
    maxValue,
    minValue,
    padding.bottom,
    padding.left,
    padding.right,
    padding.top,
    pointCount,
    width,
  ])
}
