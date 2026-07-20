import { useId, type ReactElement, type ReactNode } from 'react'
import './Field.css'

export type FieldProps = {
  label: ReactNode
  /** Helper copy shown under the control when there is no error. */
  hint?: ReactNode
  /** When set, the field renders in its error state and announces the message. */
  error?: string | null
  required?: boolean
  /**
   * Receives `id`, `aria-describedby` and `aria-invalid`, so the control is
   * wired to its label and message without the caller doing it by hand.
   */
  children: (controlProps: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': true | undefined
  }) => ReactElement
}

/**
 * Field-level validation did not exist before this component. Every error in
 * the app was delivered through the page-level `StatusMessage` banner, so a
 * user was told that something was wrong but not which input caused it.
 */
export function Field({ label, hint, error, required = false, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={`ui-field${error ? ' ui-field-invalid' : ''}`}>
      <label className="ui-field-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="ui-field-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {error ? (
        <p className="ui-field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ui-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
