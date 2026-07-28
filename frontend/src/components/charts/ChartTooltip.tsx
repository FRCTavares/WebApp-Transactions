import type { ReactNode } from 'react'

type ChartTooltipProps = {
  children: ReactNode
  height: number
  width: number
  x: number
  y: number
  className?: string
}

export function ChartTooltip({
  children,
  className,
  height,
  width,
  x,
  y,
}: ChartTooltipProps) {
  return (
    <g
      className={className}
      transform={`translate(${x}, ${y})`}
      pointerEvents="none"
    >
      <rect
        width={width}
        height={height}
        rx="10"
        className="chart-tooltip-surface"
      />
      {children}
    </g>
  )
}
