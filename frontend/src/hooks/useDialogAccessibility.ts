import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type DialogAccessibilityOptions = {
  onClose: () => void
  isCloseDisabled?: boolean
  isOpen?: boolean
}

export function useDialogAccessibility<T extends HTMLElement>({
  onClose,
  isCloseDisabled = false,
  isOpen = true,
}: DialogAccessibilityOptions) {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    if (!dialog || !isOpen) {
      return
    }

    const dialogElement = dialog
    const focusableElements = () =>
      Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    const firstFocusable = focusableElements()[0]
    ;(firstFocusable ?? dialogElement).focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCloseDisabled) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const elements = focusableElements()

      if (elements.length === 0) {
        event.preventDefault()
        dialogElement.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isCloseDisabled, isOpen, onClose])

  return dialogRef
}
