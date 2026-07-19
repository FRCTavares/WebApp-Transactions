const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const DEFAULT_REQUEST_TIMEOUT_MS = 30000
const SLOW_API_NOTICE_DELAY_MS = 4000

type QueryValue = string | number | boolean | null | undefined
type AccessTokenProvider = (() => Promise<string | null>) | null
type UnauthorizedHandler = (() => Promise<void> | void) | null

export type ApiErrorCode =
  | 'cancelled'
  | 'http'
  | 'network'
  | 'timeout'

export type ApiRequestOptions = {
  headers?: HeadersInit
  signal?: AbortSignal
  timeoutMs?: number
}

type ApiFetchOptions = RequestInit & ApiRequestOptions

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly method: string
  readonly path: string
  readonly status: number | null

  constructor({
    code,
    message,
    method,
    path,
    status = null,
  }: {
    code: ApiErrorCode
    message: string
    method: string
    path: string
    status?: number | null
  }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.method = method
    this.path = path
    this.status = status
  }
}

let accessTokenProvider: AccessTokenProvider = null
let unauthorizedHandler: UnauthorizedHandler = null
let unauthorizedRecoveryPromise: Promise<void> | null = null
let slowApiRequestCount = 0

function emitSlowApiState(isSlow: boolean): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('finance-api-slow-state', {
      detail: { isSlow },
    }),
  )
}

function startSlowApiNoticeTimer(): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    slowApiRequestCount += 1
    emitSlowApiState(true)
  }, SLOW_API_NOTICE_DELAY_MS)
}

function stopSlowApiNoticeTimer(
  timer: ReturnType<typeof setTimeout>,
): void {
  clearTimeout(timer)

  if (slowApiRequestCount === 0) {
    return
  }

  slowApiRequestCount -= 1

  if (slowApiRequestCount === 0) {
    emitSlowApiState(false)
  }
}

export function setAccessTokenProvider(
  provider: AccessTokenProvider,
): void {
  accessTokenProvider = provider
}

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler,
): void {
  unauthorizedHandler = handler
}

export function buildQuery(
  params: Record<string, QueryValue>,
): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function buildHeaders(
  headers?: HeadersInit,
): Promise<Headers> {
  const nextHeaders = new Headers(headers)
  const accessToken = accessTokenProvider
    ? await accessTokenProvider()
    : null

  if (accessToken) {
    nextHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  return nextHeaders
}

function getRequestMethod(init: RequestInit): string {
  return init.method?.toUpperCase() ?? 'GET'
}

function createCombinedSignal(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): {
  cleanup: () => void
  signal: AbortSignal
  timeoutController: AbortController
} {
  const timeoutController = new AbortController()
  const combinedController = new AbortController()

  function abortFromExternalSignal() {
    combinedController.abort(externalSignal?.reason)
  }

  function abortFromTimeoutSignal() {
    combinedController.abort(timeoutController.signal.reason)
  }

  if (externalSignal?.aborted) {
    abortFromExternalSignal()
  } else if (externalSignal) {
    externalSignal.addEventListener(
      'abort',
      abortFromExternalSignal,
      { once: true },
    )
  }

  timeoutController.signal.addEventListener(
    'abort',
    abortFromTimeoutSignal,
    { once: true },
  )

  const timeoutId = setTimeout(() => {
    timeoutController.abort(
      new DOMException('Request timed out', 'TimeoutError'),
    )
  }, timeoutMs)

  return {
    cleanup: () => {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener(
        'abort',
        abortFromExternalSignal,
      )
      timeoutController.signal.removeEventListener(
        'abort',
        abortFromTimeoutSignal,
      )
    },
    signal: combinedController.signal,
    timeoutController,
  }
}

async function runUnauthorizedRecovery(): Promise<void> {
  if (!unauthorizedHandler) {
    return
  }

  if (!unauthorizedRecoveryPromise) {
    unauthorizedRecoveryPromise = Promise.resolve()
      .then(() => unauthorizedHandler?.())
      .finally(() => {
        unauthorizedRecoveryPromise = null
      })
  }

  await unauthorizedRecoveryPromise
}

async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const {
    signal: externalSignal,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ...init
  } = options
  const method = getRequestMethod(init)
  const slowApiNoticeTimer = startSlowApiNoticeTimer()
  const {
    cleanup,
    signal,
    timeoutController,
  } = createCombinedSignal(externalSignal, timeoutMs)

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: await buildHeaders(init.headers),
      signal,
    })
  } catch (error: unknown) {
    if (timeoutController.signal.aborted) {
      throw new ApiError({
        code: 'timeout',
        message: `${method} ${path} timed out`,
        method,
        path,
      })
    }

    if (externalSignal?.aborted) {
      throw new ApiError({
        code: 'cancelled',
        message: `${method} ${path} was cancelled`,
        method,
        path,
      })
    }

    throw new ApiError({
      code: 'network',
      message:
        error instanceof Error
          ? error.message
          : `${method} ${path} failed`,
      method,
      path,
    })
  } finally {
    cleanup()
    stopSlowApiNoticeTimer(slowApiNoticeTimer)
  }
}

async function raiseForBadResponse(
  response: Response,
  method: string,
  path: string,
): Promise<void> {
  if (response.ok) {
    return
  }

  if (response.status === 401) {
    await runUnauthorizedRecovery()
  }

  const detail = await readErrorDetail(response)
  const fallbackMessage =
    response.status === 401
      ? 'Your session has expired. Sign in again.'
      : `${method} ${path} failed with ${response.status}`

  throw new ApiError({
    code: 'http',
    message: detail || fallbackMessage,
    method,
    path,
    status: response.status,
  })
}

async function readErrorDetail(
  response: Response,
): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    const body = (await response.json()) as unknown

    if (
      typeof body === 'object'
      && body !== null
      && 'detail' in body
    ) {
      const detail = body.detail

      if (typeof detail === 'string') {
        return detail
      }

      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (
              typeof item === 'object'
              && item !== null
              && 'msg' in item
              && typeof item.msg === 'string'
            ) {
              return item.msg
            }

            return null
          })
          .filter(
            (message): message is string => message !== null,
          )
          .join(', ')
      }

      if (typeof detail === 'object' && detail !== null) {
        if (
          'message' in detail
          && typeof detail.message === 'string'
        ) {
          return detail.message
        }

        return JSON.stringify(detail)
      }
    }
  } catch {
    return null
  }

  return null
}

export async function apiGet<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options)

  await raiseForBadResponse(response, 'GET', path)

  return response.json() as Promise<T>
}

export async function apiGetBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const response = await apiFetch(path, options)

  await raiseForBadResponse(response, 'GET', path)

  return response.blob()
}

export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    method: 'POST',
    body: formData,
  })

  await raiseForBadResponse(response, 'POST', path)

  return response.json() as Promise<T>
}

export async function apiPostJson<T>(
  path: string,
  payload: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
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
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  await raiseForBadResponse(response, 'PATCH', path)

  return response.json() as Promise<T>
}

export async function apiPutJson<T>(
  path: string,
  payload: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  await raiseForBadResponse(response, 'PUT', path)

  return response.json() as Promise<T>
}

export async function apiDelete(
  path: string,
  options: ApiRequestOptions = {},
): Promise<void> {
  const response = await apiFetch(path, {
    ...options,
    method: 'DELETE',
  })

  await raiseForBadResponse(response, 'DELETE', path)
}
