import { createContext, useContext } from 'react'
import type { Ledger, Transaction } from './data'

export interface FinanceContextValue {
  ledger: Ledger
  ledgers: Ledger[]
  activeId: string
  updateLedger: (update: (ledger: Ledger) => Ledger, activity?: string) => void
  selectLedger: (id: string) => void
  addLedger: (ledger: Ledger) => void
  removeLedger: (id: string) => void
  openPage: (id: string, transaction?: Transaction) => void
  notify: (text: string, type?: 'success' | 'info' | 'error') => void
  confirm: (title: string, text: string, action: () => void) => void
  editTransaction: Transaction | null
  clearEditing: () => void
}

export const FinanceContext = createContext<FinanceContextValue | null>(null)

export function useFinance() {
  const context = useContext(FinanceContext)
  if (!context) throw new Error('FinanceContext is required')
  return context
}
