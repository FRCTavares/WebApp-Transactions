const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type QueryValue = string | number | boolean | null | undefined

export function buildQuery(params: Record<string, QueryValue>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function raiseForBadResponse(
  response: Response,
  method: string,
  path: string,
): Promise<void> {
  if (response.ok) {
    return
  }

  const detail = await readErrorDetail(response)

  if (detail) {
    throw new Error(detail)
  }

  throw new Error(`${method} ${path} failed with ${response.status}`)
}

async function readErrorDetail(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    const body = (await response.json()) as unknown

    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body
    ) {
      const detail = body.detail

      if (typeof detail === 'string') {
        return detail
      }

      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (
              typeof item === 'object' &&
              item !== null &&
              'msg' in item &&
              typeof item.msg === 'string'
            ) {
              return item.msg
            }

            return null
          })
          .filter((message): message is string => message !== null)
          .join(', ')
      }
    }
  } catch {
    return null
  }

  return null
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  await raiseForBadResponse(response, 'GET', path)

  return response.json() as Promise<T>
}

export async function apiPostForm<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  })

  await raiseForBadResponse(response, 'POST', path)

  return response.json() as Promise<T>
}

export async function apiPostJson<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  await raiseForBadResponse(response, 'POST', path)

  return response.json() as Promise<T>
}

export async function apiPatchJson<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  await raiseForBadResponse(response, 'PATCH', path)

  return response.json() as Promise<T>
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
  })

  await raiseForBadResponse(response, 'DELETE', path)
}
