export type ChartGridRow = {
  label?: string
  y: number
}

type ChartGridProps = {
  className?: string
  labelClassName?: string
  labelX?: number
  rows: ChartGridRow[]
  x1: number
  x2: number
}

export function ChartGrid({
  className = 'trend-chart-grid-line',
  labelClassName = 'trend-chart-axis-label',
  labelX,
  rows,
  x1,
  x2,
}: ChartGridProps) {
  return (
    <g aria-hidden="true">
      {rows.map((row) => (
        <g key={`${row.y}-${row.label ?? ''}`}>
          <line
            className={className}
            x1={x1}
            y1={row.y}
            x2={x2}
            y2={row.y}
          />
          {row.label !== undefined && labelX !== undefined && (
            <text
              className={labelClassName}
              x={labelX}
              y={row.y}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {row.label}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}
