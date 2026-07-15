import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  PeriodContext,
  type Period,
} from './periodContextValue'

const STORAGE_KEY = 'f-transactions-selected-period'

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

  const setPeriod = useCallback((year: number, month: number) => {
    const nextPeriod = {
      year,
      month,
      monthKey: getMonthKey(year, month),
    }

    window.localStorage.setItem(STORAGE_KEY, nextPeriod.monthKey)
    setPeriodState(nextPeriod)
  }, [])

  const setMonthKey = useCallback((monthKey: string) => {
    const nextPeriod = parseMonthKey(monthKey)

    if (!nextPeriod) {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, nextPeriod.monthKey)
    setPeriodState(nextPeriod)
  }, [])

  const shiftMonth = useCallback((offset: number) => {
    const shiftedDate = new Date(period.year, period.month - 1 + offset, 1)
    setPeriod(shiftedDate.getFullYear(), shiftedDate.getMonth() + 1)
  }, [period.month, period.year, setPeriod])

  const resetToCurrentMonth = useCallback(() => {
    const currentPeriod = getCurrentPeriod()
    setPeriod(currentPeriod.year, currentPeriod.month)
  }, [setPeriod])

  const value = useMemo(
    () => ({
      ...period,
      setPeriod,
      setMonthKey,
      shiftMonth,
      resetToCurrentMonth,
    }),
    [
      period,
      resetToCurrentMonth,
      setMonthKey,
      setPeriod,
      shiftMonth,
    ],
  )

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}
