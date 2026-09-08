/**
 * Generates axis tick values that land on round numbers appropriate to the
 * data's magnitude (e.g. multiples of 1, 2, 5, or 10 x a power of ten),
 * instead of arbitrary fractions of the min/max range.
 *
 * Standard chart-axis technique (the same idea as D3's `ticks`): pick a
 * "nice" step size close to `range / tickCount`, then generate ticks at
 * multiples of that step. `tickCount` is a target, not a guarantee - the
 * actual count depends on how the nice step size divides the range.
 */
export function getNiceTicks(
  minValue: number,
  maxValue: number,
  tickCount = 3,
): number[] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return []
  }

  if (minValue === maxValue) {
    return [minValue]
  }

  const step = getNiceStep(maxValue - minValue, tickCount)
  const niceMin = Math.ceil(minValue / step) * step
  const ticks: number[] = []

  // A tiny epsilon guards against floating-point drift excluding a tick
  // that should land exactly on maxValue (e.g. 0.1 + 0.2 !== 0.3).
  const epsilon = step * 1e-9

  for (let tick = niceMin; tick <= maxValue + epsilon; tick += step) {
    ticks.push(Math.round(tick / step) * step)
  }

  return ticks
}

export type NiceScale = {
  min: number
  max: number
  ticks: number[]
}

/**
 * Like {@link getNiceTicks}, but also rounds the domain itself outward to the
 * nearest step so the plotted line never touches the top or bottom edge and a
 * near-flat series is not amplified into dramatic swings. Returns the padded
 * `[min, max]` plus the ticks that fall on it.
 */
export function getNiceScale(
  minValue: number,
  maxValue: number,
  tickCount = 3,
): NiceScale {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return { min: 0, max: 1, ticks: [] }
  }

  if (minValue === maxValue) {
    // A flat series: open a symmetric band around the single value so it
    // sits mid-plot rather than pinned to an edge.
    const padding = Math.abs(minValue) > 0 ? Math.abs(minValue) * 0.1 : 1
    return {
      min: minValue - padding,
      max: maxValue + padding,
      ticks: [minValue],
    }
  }

  const step = getNiceStep(maxValue - minValue, tickCount)
  const niceMin = Math.floor(minValue / step) * step
  const niceMax = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  const epsilon = step * 1e-9

  for (let tick = niceMin; tick <= niceMax + epsilon; tick += step) {
    ticks.push(Math.round(tick / step) * step)
  }

  return { min: niceMin, max: niceMax, ticks }
}

function getNiceStep(range: number, tickCount: number): number {
  if (range <= 0 || tickCount <= 0) {
    return 1
  }

  const roughStep = range / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const residual = roughStep / magnitude

  if (residual >= 5) {
    return 10 * magnitude
  }

  if (residual >= 2) {
    return 5 * magnitude
  }

  if (residual >= 1) {
    return 2 * magnitude
  }

  return magnitude
}
