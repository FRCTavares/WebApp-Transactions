import { apiGet } from './client'

export type PersonalDataExport = {
  format_version: number
  user_id: string
  email: string | null
  exported_at?: string
  tables: Record<string, unknown[]>
}

export function getPersonalDataExport() {
  return apiGet<PersonalDataExport>('/api/export/json')
}
