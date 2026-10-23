import { adminHost, type RequestContext, vtexFetch } from '../context.js'
import { buildPreviewUrl } from './cmsPayloads.js'

/**
 * Client for the VTEX CMS (Storefront > Content) management API.
 *
 * These are the internal endpoints used by the content-platform Admin UI
 * (see backend/docs/cms-api.md); they are not part of the public API reference
 * and may change without notice.
 */

const MANAGE = '/api/content-platform/manage'
const SCHEMAS = '/api/content-platform/schemas'

type Ctx = Pick<RequestContext, 'account' | 'token'>

export interface CmsStore {
  id: string
  name: string
  url?: string
  buildSettings?: { previewUrl?: string }
  locales?: { default?: string }
}

export interface CmsBranch {
  id: string
  name: string
  isDev?: boolean
  schemaVersion?: string
  mergedAt?: string | null
}

function cmsFetch<T>(ctx: Ctx, path: string, init: RequestInit & { json?: unknown } = {}) {
  const authorization = ctx.token.toLowerCase().startsWith('bearer ') ? ctx.token : `Bearer ${ctx.token}`
  return vtexFetch<T>(ctx, `${adminHost(ctx.account)}${path}`, {
    ...init,
    headers: { Authorization: authorization, ...(init.headers as Record<string, string> | undefined) },
  })
}

function unwrapList<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[]
  const nested = (value as Record<string, unknown> | null)?.[key] ?? (value as Record<string, unknown> | null)?.items
  return Array.isArray(nested) ? (nested as T[]) : []
}

export async function getStore(ctx: Ctx, storeId?: string): Promise<CmsStore> {
  const wanted = storeId ?? process.env.CMS_STORE_ID
  if (wanted) return cmsFetch<CmsStore>(ctx, `${MANAGE}/${ctx.account}/stores/${encodeURIComponent(wanted)}`)
  const stores = unwrapList<CmsStore>(await cmsFetch(ctx, `${MANAGE}/${ctx.account}/stores?page=1&pageSize=50`), 'stores')
  if (stores.length === 0) throw new Error('No CMS store found for this account')
  return stores[0]
}

export async function listBranches(ctx: Ctx, storeId: string): Promise<CmsBranch[]> {
  return unwrapList<CmsBranch>(await cmsFetch(ctx, `${MANAGE}/${ctx.account}/${storeId}/branches`), 'branches')
}

export async function findBranch(ctx: Ctx, storeId: string, nameOrId: string): Promise<CmsBranch> {
  const branches = await listBranches(ctx, storeId)
  const needle = nameOrId.trim().toLowerCase()
  const branch = branches.find((b) => b.id === nameOrId || b.name.toLowerCase() === needle)
  if (!branch) {
    const available = branches.filter((b) => b.name !== 'main').map((b) => b.name)
    throw new Error(`CMS branch "${nameOrId}" not found. Available branches: ${available.join(', ') || 'none'}`)
  }
  if (branch.mergedAt) throw new Error(`CMS branch "${branch.name}" was already merged; create a new branch.`)
  return branch
}

export async function resolveSchemaBinding(ctx: Ctx, storeId: string, schemaVersion?: string) {
  const id = schemaVersion ? `${ctx.account}.${storeId}@${schemaVersion}` : `${ctx.account}.${storeId}`
  const resolution = await cmsFetch<{ schema: unknown; binding: unknown }>(ctx, `${SCHEMAS}/${id}/resolution`)
  if (!resolution?.binding) throw new Error(`Could not resolve the CMS schema binding for ${id}`)
  return resolution.binding
}

export async function getAuthorEmail(ctx: Ctx): Promise<string> {
  const user = await vtexFetch<{ user?: string }>(ctx, `${adminHost(ctx.account)}/api/vtexid/pub/authenticated/user`).catch(
    () => null,
  )
  return user?.user ?? process.env.CMS_AUTHOR_EMAIL ?? 'campaign-agent@primegoods.com'
}

interface CommitResponse {
  entryId?: string
  id?: string
  versionId?: string
  entryVersionId?: string
  hash?: string
  commitId?: string
  entry?: { id?: string; versionId?: string; entryVersionId?: string }
}

export interface CreateEntryInput {
  branch: string
  contentType: string
  entryName: string
  data: Record<string, unknown>
  slug?: string
  message?: string
}

export async function createEntry(ctx: Ctx, input: CreateEntryInput) {
  const store = await getStore(ctx)
  const branch = await findBranch(ctx, store.id, input.branch)
  const [schemaBinding, author] = await Promise.all([
    resolveSchemaBinding(ctx, store.id, branch.schemaVersion),
    getAuthorEmail(ctx),
  ])

  const commit = await cmsFetch<CommitResponse>(ctx, `${MANAGE}/${ctx.account}/${store.id}/branches/${branch.id}/commits`, {
    method: 'POST',
    json: {
      author,
      contentTypeId: input.contentType,
      message: input.message ?? 'Created by Campaign Agent',
      data: input.data,
      schemaBinding,
      entryName: input.entryName,
      ...(input.slug ? { search_keywords: [input.slug.replace(/^\/+/, ''), `/${input.slug.replace(/^\/+/, '')}`] } : {}),
    },
  })

  const entryId = commit.entryId ?? commit.entry?.id ?? commit.id
  if (!entryId) throw new Error(`CMS commit did not return an entry id: ${JSON.stringify(commit).slice(0, 300)}`)

  // FastStore's content-platform preview reads the `versionId` query param as the CMS branch id.
  const basePreview = store.buildSettings?.previewUrl ?? process.env.CMS_PREVIEW_URL
  const previewUrl = basePreview
    ? buildPreviewUrl(basePreview, {
        contentType: input.contentType,
        documentId: entryId,
        versionId: branch.id,
        slug: input.slug,
        locale: store.locales?.default,
      })
    : null
  const cmsUrl = `${adminHost(ctx.account)}/admin/content-platform/branches/${branch.id}/form/${store.id}/${input.contentType}/entries/${entryId}`

  return { entryId, versionId: branch.id, branch, store, previewUrl, cmsUrl }
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const UPLOAD_MUTATION =
  'mutation UploadFile($file: Upload!) { uploadFile(file: $file) @context(provider: "vtex.file-manager-graphql") { fileUrl } }'

/** Uploads an image to vtex.file-manager (the store used by CMS media). Returns null when unavailable. */
export async function uploadCmsAsset(ctx: Ctx, file: { data: Buffer; mimeType: string; filename: string }): Promise<string | null> {
  if (process.env.CMS_UPLOAD_ASSETS === 'false' || file.data.length > MAX_UPLOAD_BYTES) return null
  const extension = file.mimeType.split('/')[1] ?? 'png'
  const form = new FormData()
  form.append('operations', JSON.stringify({ query: UPLOAD_MUTATION, variables: { file: null } }))
  form.append('map', JSON.stringify({ 0: ['variables.file'] }))
  form.append('0', new Blob([new Uint8Array(file.data)], { type: file.mimeType }), `${file.filename}.${extension}`)

  const result = await vtexFetch<{ data?: { uploadFile?: { fileUrl?: string } }; errors?: unknown[] }>(
    ctx,
    `${adminHost(ctx.account)}/_v/private/graphql/v1?workspace=master`,
    { method: 'POST', body: form },
  )
  return result?.data?.uploadFile?.fileUrl ?? null
}
