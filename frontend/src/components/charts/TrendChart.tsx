import {
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { ChartAxis } from './ChartAxis'
import { ChartGrid } from './ChartGrid'
import { ChartTooltip } from './ChartTooltip'
import { getNiceScale } from './getNiceTicks'
import { useChartScale } from './useChartScale'
import { useElementWidth } from './useElementWidth'

const FALLBACK_WIDTH = 720
const PADDING = { top: 18, right: 16, bottom: 26, left: 52 }
const TICK_COUNT = 4

/** One plotted line (with an optional fill and end-of-line markers). */
export type TrendChartSeries = {
  key: string
  /** Spoken/tooltip name for this line. */
  label: string
  /** One entry per `points` index; `null` renders as a gap in the data. */
  values: (number | null)[]
  lineClassName: string
  areaClassName?: string
  endPointClassName?: string
  startPointClassName?: string
}

export type TrendChartProps = {
  /** X-axis keys in chronological order (e.g. `"2026-03"`). */
  points: string[]
  series: TrendChartSeries[]
  /** Full-precision formatter for the tooltip and the accessible label. */
  formatValue: (value: number) => string
  /** Compact formatter for the y-axis tick labels (e.g. `"€48K"`). */
  formatAxisValue: (value: number) => string
  /** Formats a point key for the x-axis and the tooltip title. */
  formatPointLabel: (pointKey: string) => string
  ariaLabelPrefix: string
  xLabelClassName: string
  baselineClassName: string
  /** Optional short suffix for a point's tooltip title (e.g. "estimated"). */
  pointNote?: (pointKey: string) => string | null
  /** Annotate the latest value directly at the end of the line (wealth trend). */
  showEdgeValueLabels?: boolean
  currentEdgeValueLabelClassName?: string
}

type PlotSeries = TrendChartSeries & {
  coordinates: { index: number; x: number; y: number; value: number }[]
}

function buildLinePath(
  coordinates: { x: number; y: number }[],
): string {
  return coordinates
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(' ')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

/**
 * Shared line-trend chart for the Wealth and Investments pages.
 *
 * Draws in a pixel coordinate space measured from the container (not a fixed
 * viewBox the browser rescales), rounds the value domain to "nice" bounds so
 * the line never touches an edge, and keeps the y-axis labels compact and
 * inside a dedicated gutter. Supports one or two series, pointer + keyboard
 * exploration, a crosshair, and a tooltip.
 */
export function TrendChart({
  points,
  series,
  formatValue,
  formatAxisValue,
  formatPointLabel,
  ariaLabelPrefix,
  xLabelClassName,
  baselineClassName,
  pointNote,
  showEdgeValueLabels = false,
  currentEdgeValueLabelClassName,
}: TrendChartProps) {
  const { ref, width } = useElementWidth(FALLBACK_WIDTH)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const height = useMemo(() => {
    const ratio = width < 480 ? 2.1 : 3.8
    return Math.round(clamp(width / ratio, 150, 280))
  }, [width])

  const domain = useMemo(() => {
    const allValues = series.flatMap((line) =>
      line.values.filter((value): value is number => value !== null),
    )

    if (allValues.length === 0) {
      return getNiceScale(0, 1, TICK_COUNT)
    }

    return getNiceScale(
      Math.min(...allValues),
      Math.max(...allValues),
      TICK_COUNT,
    )
  }, [series])

  const scale = useChartScale({
    width,
    height,
    padding: PADDING,
    pointCount: points.length,
    minValue: domain.min,
    maxValue: domain.max,
  })

  const plotSeries: PlotSeries[] = useMemo(
    () =>
      series.map((line) => ({
        ...line,
        coordinates: line.values
          .map((value, index) =>
            value === null
              ? null
              : {
                  index,
                  value,
                  x: scale.getX(index),
                  y: scale.getY(value),
                },
          )
          .filter((point): point is NonNullable<typeof point> => point !== null),
      })),
    [series, scale],
  )

  const lastIndex = points.length - 1
  const activeIndex = hoveredIndex ?? lastIndex
  const activePointKey = points[activeIndex]
  const activeX = scale.getX(activeIndex)
  const activeNote = pointNote?.(activePointKey) ?? null
  const activeTitle = activeNote
    ? `${formatPointLabel(activePointKey)} · ${activeNote}`
    : formatPointLabel(activePointKey)

  const gridRows = domain.ticks.map((value) => ({
    label: formatAxisValue(value),
    y: scale.getY(value),
  }))

  const xLabelIndexes = Array.from(
    new Set([0, Math.floor(lastIndex / 2), lastIndex].filter((index) => index >= 0)),
  )

  const tooltipLines = plotSeries.map((line) => {
    const match = line.coordinates.find((point) => point.index === activeIndex)

    return {
      label: line.label,
      text: match ? formatValue(match.value) : '-',
    }
  })
  const tooltipWidth = 200
  const tooltipHeight = 22 + tooltipLines.length * 17 + 8
  const activeSeriesY =
    plotSeries[0]?.coordinates.find((point) => point.index === activeIndex)?.y
    ?? PADDING.top
  const tooltipX = clamp(
    activeX + tooltipWidth + 16 > width
      ? activeX - 12 - tooltipWidth
      : activeX + 12,
    4,
    Math.max(4, width - tooltipWidth - 4),
  )
  const tooltipY = clamp(
    activeSeriesY - 12 - tooltipHeight,
    4,
    Math.max(4, height - tooltipHeight - 4),
  )

  function handleMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (points.length === 0) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearest = 0

    for (let index = 1; index < points.length; index += 1) {
      if (
        Math.abs(scale.getX(index) - pointerX)
        < Math.abs(scale.getX(nearest) - pointerX)
      ) {
        nearest = index
      }
    }

    setHoveredIndex(nearest)
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    let nextIndex: number

    if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(activeIndex - 1, 0)
    } else if (event.key === 'ArrowRight') {
      nextIndex = Math.min(activeIndex + 1, lastIndex)
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = lastIndex
    } else {
      return
    }

    event.preventDefault()
    setHoveredIndex(nextIndex)
  }

  const accessibleLabel = `${ariaLabelPrefix} ${activeTitle}: ${tooltipLines
    .map((line) => `${line.label} ${line.text === '-' ? 'unavailable' : line.text}`)
    .join(', ')}. Use Left and Right arrows to explore.`

  return (
    <div className="trend-chart-surface" ref={ref}>
      <svg
        className="trend-chart-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={accessibleLabel}
        tabIndex={0}
        onFocus={() => setHoveredIndex(lastIndex)}
        onBlur={() => setHoveredIndex(null)}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {plotSeries.map((line) =>
          line.areaClassName && line.coordinates.length > 0 ? (
            <path
              key={`${line.key}-area`}
              className={line.areaClassName}
              d={`${buildLinePath(line.coordinates)} L ${line.coordinates[
                line.coordinates.length - 1
              ].x.toFixed(2)} ${scale.baselineY.toFixed(2)} L ${line.coordinates[0].x.toFixed(
                2,
              )} ${scale.baselineY.toFixed(2)} Z`}
            />
          ) : null,
        )}

        <ChartGrid
          x1={PADDING.left}
          x2={width - PADDING.right}
          labelX={PADDING.left - 8}
          rows={gridRows}
        />

        <ChartAxis
          className={baselineClassName}
          x1={PADDING.left}
          x2={width - PADDING.right}
          y={scale.baselineY}
        />

        {plotSeries.map((line) =>
          line.coordinates.length > 0 ? (
            <path
              key={`${line.key}-line`}
              className={line.lineClassName}
              d={buildLinePath(line.coordinates)}
            />
          ) : null,
        )}

        {plotSeries.map((line) => {
          const first = line.coordinates[0]
          const last = line.coordinates[line.coordinates.length - 1]

          return (
            <g key={`${line.key}-markers`}>
              {line.startPointClassName && first ? (
                <circle
                  className={line.startPointClassName}
                  cx={first.x}
                  cy={first.y}
                  r="3.5"
                />
              ) : null}
              {line.endPointClassName && last ? (
                <circle
                  className={line.endPointClassName}
                  cx={last.x}
                  cy={last.y}
                  r="4.5"
                />
              ) : null}
            </g>
          )
        })}

        {showEdgeValueLabels && plotSeries[0]?.coordinates.length
          ? (() => {
              const coordinates = plotSeries[0].coordinates
              const last = coordinates[coordinates.length - 1]

              return (
                <text
                  className={currentEdgeValueLabelClassName}
                  x={last.x}
                  y={clamp(last.y - 12, PADDING.top - 4, height)}
                  textAnchor="end"
                >
                  {formatValue(last.value)}
                </text>
              )
            })()
          : null}

        {xLabelIndexes.map((index) => (
          <text
            key={points[index]}
            className={xLabelClassName}
            x={scale.getX(index)}
            y={height - 8}
            textAnchor={
              index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'
            }
          >
            {formatPointLabel(points[index])}
          </text>
        ))}

        {hoveredIndex !== null && (
          <>
            <line
              className="trend-chart-crosshair"
              x1={activeX}
              y1={PADDING.top}
              x2={activeX}
              y2={height - PADDING.bottom}
            />
            {plotSeries.map((line) => {
              const match = line.coordinates.find(
                (point) => point.index === activeIndex,
              )

              return match ? (
                <circle
                  key={`${line.key}-active`}
                  className="trend-chart-active-point trend-chart-active-point-primary"
                  cx={match.x}
                  cy={match.y}
                  r="4.6"
                />
              ) : null
            })}
            <ChartTooltip
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
            >
              <text
                className="chart-tooltip-label"
                x="12"
                y="18"
                fontSize="11"
                fontWeight="800"
              >
                {activeTitle}
              </text>
              {tooltipLines.map((line, lineIndex) => (
                <text
                  key={line.label}
                  className="chart-tooltip-value"
                  x="12"
                  y={36 + lineIndex * 17}
                  fontSize="12"
                  fontWeight="750"
                >
                  {line.label}: {line.text}
                </text>
              ))}
            </ChartTooltip>
          </>
        )}
      </svg>
    </div>
  )
}
