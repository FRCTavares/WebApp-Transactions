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
