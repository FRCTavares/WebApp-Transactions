export type ChartLegendItem = {
  className: string
  label: string
}

type ChartLegendProps = {
  className?: string
  items: ChartLegendItem[]
}

export function ChartLegend({
  className = 'investment-trend-legend',
  items,
}: ChartLegendProps) {
  return (
    <div className={className}>
      {items.map((item) => (
        <span key={item.label}>
          <i className={item.className} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
