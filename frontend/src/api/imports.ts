import { apiDelete, apiGet, apiPostForm } from './client'
import type { ImportBatch, ImportPreviewResponse, Transaction } from '../types/api'

function buildImportForm(source: string, file: File) {
  const formData = new FormData()
  formData.append('source', source)
  formData.append('file', file)
  return formData
}

export function previewImport(source: string, file: File) {
  return apiPostForm<ImportPreviewResponse>(
    '/api/import/preview',
    buildImportForm(source, file),
  )
}

export function commitImport(source: string, file: File) {
  return apiPostForm<unknown>(
    '/api/import/commit',
    buildImportForm(source, file),
  )
}

export function listImportBatches() {
  return apiGet<ImportBatch[]>('/api/import/batches')
}

export function listImportBatchTransactions(batchId: number) {
  return apiGet<Transaction[]>(`/api/import/batches/${batchId}/transactions`)
}

export function deleteImportBatch(batchId: number) {
  return apiDelete(`/api/import/batches/${batchId}`)
}

