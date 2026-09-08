import { useEffect, useRef, useState } from 'react'

/**
 * Tracks the rendered pixel width of an element via ResizeObserver.
 *
 * Charts use this to draw in a real pixel coordinate space that matches the
 * container instead of a fixed-width viewBox that the browser then squishes
 * into a narrow column - which is what made axis labels overflow the plot on
 * small screens. `fallbackWidth` is used for the first paint (and in
 * environments without ResizeObserver, e.g. jsdom).
 */
export function useElementWidth(fallbackWidth: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(fallbackWidth)

  useEffect(() => {
    const element = ref.current

    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      const nextWidth = entry.contentRect.width

      if (nextWidth > 0) {
        setWidth(nextWidth)
      }
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
