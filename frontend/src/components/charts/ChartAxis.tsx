type ChartAxisProps = {
  className?: string
  x1: number
  x2: number
  y: number
}

export function ChartAxis({
  className,
  x1,
  x2,
  y,
}: ChartAxisProps) {
  return (
    <line
      className={className}
      x1={x1}
      y1={y}
      x2={x2}
      y2={y}
    />
  )
}
