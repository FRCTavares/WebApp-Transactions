import { apiDelete } from './client'


export function deleteCurrentAccount(confirmation: string) {
  return apiDelete('/api/me', {
    headers: {
      'X-Confirm-Account-Deletion': confirmation,
    },
  })
}
