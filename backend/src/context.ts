export interface RequestContext {
  account: string
  token: string
  conversationId: string
  messageId: string
  locale: string
}

export function vtexHost(account: string) {
  return process.env.VTEX_API_HOST?.replace('{account}', account) ?? `https://${account}.vtexcommercestable.com.br`
}

export function adminHost(account: string) {
  return `https://${account}.myvtex.com`
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
  }
}

export async function vtexFetch<T>(
  ctx: Pick<RequestContext, 'account' | 'token'>,
  pathOrUrl: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${vtexHost(ctx.account)}${pathOrUrl}`
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('VtexIdclientAutCookie', ctx.token)
  if (!headers.has('Cookie')) headers.set('Cookie', `VtexIdclientAutCookie=${ctx.token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const res = await fetch(url, { ...init, headers, body })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // non-JSON body, keep raw text
  }
  if (!res.ok) {
    const detail = typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500)
    throw new HttpError(`${init.method ?? 'GET'} ${new URL(url).pathname} failed with ${res.status}: ${detail}`, res.status, parsed)
  }
  return parsed as T
}
