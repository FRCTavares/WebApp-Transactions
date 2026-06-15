import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'f-transactions-selected-period'

type Period = {
  year: number
  month: number
  monthKey: string
}

type PeriodContextValue = Period & {
  setPeriod: (year: number, month: number) => void
  setMonthKey: (monthKey: string) => void
  shiftMonth: (offset: number) => void
  resetToCurrentMonth: () => void
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

function getCurrentPeriod(): Period {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  return {
    year,
    month,
    monthKey: getMonthKey(year, month),
  }
}

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthKey(monthKey: string): Period | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (month < 1 || month > 12) {
    return null
  }

  return {
    year,
    month,
    monthKey: getMonthKey(year, month),
  }
}

function getInitialPeriod() {
  const storedMonthKey = window.localStorage.getItem(STORAGE_KEY)

  if (storedMonthKey) {
    const storedPeriod = parseMonthKey(storedMonthKey)

    if (storedPeriod) {
      return storedPeriod
    }
  }

  return getCurrentPeriod()
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<Period>(getInitialPeriod)

  function setPeriod(year: number, month: number) {
    const nextPeriod = {
      year,
      month,
      monthKey: getMonthKey(year, month),
    }

    window.localStorage.setItem(STORAGE_KEY, nextPeriod.monthKey)
    setPeriodState(nextPeriod)
  }

  function setMonthKey(monthKey: string) {
    const nextPeriod = parseMonthKey(monthKey)

    if (!nextPeriod) {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, nextPeriod.monthKey)
    setPeriodState(nextPeriod)
  }

  function shiftMonth(offset: number) {
    const shiftedDate = new Date(period.year, period.month - 1 + offset, 1)
    setPeriod(shiftedDate.getFullYear(), shiftedDate.getMonth() + 1)
  }

  function resetToCurrentMonth() {
    const currentPeriod = getCurrentPeriod()
    setPeriod(currentPeriod.year, currentPeriod.month)
  }

  const value = useMemo(
    () => ({
      ...period,
      setPeriod,
      setMonthKey,
      shiftMonth,
      resetToCurrentMonth,
    }),
    [period],
  )

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const context = useContext(PeriodContext)

  if (!context) {
    throw new Error('usePeriod must be used inside PeriodProvider')
  }

  return context
}
