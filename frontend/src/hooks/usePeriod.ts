import { useContext } from 'react'
import { PeriodContext } from '../context/periodContextValue'

export function usePeriod() {
  const context = useContext(PeriodContext)

  if (!context) {
    throw new Error('usePeriod must be used inside PeriodProvider')
  }

  return context
}
