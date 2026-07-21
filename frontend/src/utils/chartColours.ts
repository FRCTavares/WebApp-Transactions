/**
 * The ordered slice palette for donut and allocation charts, as references to
 * the semantic --chart-* tokens rather than raw hex.
 *
 * Two things this fixes. The palette was hardcoded hex duplicated in two
 * components, so it did not respond to the theme - the dark sheet could not
 * reach an inline style attribute. And because the SVG slice used the array
 * while the legend swatch built its own colour, the two could drift. Both now
 * read from this one array, so a legend swatch and its slice are the same
 * token by construction.
 */
export const CHART_SLICE_TOKENS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const

/** The token for slice `index`, wrapping around the palette. */
export function chartSliceColour(index: number): string {
  return CHART_SLICE_TOKENS[index % CHART_SLICE_TOKENS.length]
}
