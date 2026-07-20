import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import { IconButton } from './IconButton'
import './Modal.css'

export type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Blocks Escape and the close button while a mutation is in flight. */
  isCloseDisabled?: boolean
}

/**
 * Wraps the existing `useDialogAccessibility` hook rather than reimplementing
 * focus trapping - that hook already handles Escape, Tab cycling and restoring
 * focus on unmount, and had a real focus-stealing bug fixed in it previously.
 * Do not duplicate that logic here.
 *
 * Adds the parts the hand-rolled `.modal-backdrop`/`.modal-card` markup was
 * missing: `role="dialog"`, `aria-modal`, and a labelled title.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  isCloseDisabled = false,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    onClose,
    isCloseDisabled,
  })

  return (
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => {
        // Only a click that both starts and ends on the backdrop dismisses.
        // A drag that begins inside the dialog and releases outside it must
        // not close - that is how text selection loses your work.
        if (event.target === event.currentTarget && !isCloseDisabled) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`ui-modal ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="ui-modal-header">
          <h2 className="ui-modal-title" id={titleId}>
            {title}
          </h2>
          <IconButton
            icon={X}
            label="Close dialog"
            size="sm"
            onClick={onClose}
            disabled={isCloseDisabled}
          />
        </div>

        <div className="ui-modal-body">{children}</div>

        {footer ? <div className="ui-modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
