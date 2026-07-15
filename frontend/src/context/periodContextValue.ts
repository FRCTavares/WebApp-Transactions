import { createContext } from 'react'

export type Period = {
  year: number
  month: number
  monthKey: string
}

export type PeriodContextValue = Period & {
  setPeriod: (year: number, month: number) => void
  setMonthKey: (monthKey: string) => void
  shiftMonth: (offset: number) => void
  resetToCurrentMonth: () => void
}

export const PeriodContext = createContext<PeriodContextValue | null>(null)
