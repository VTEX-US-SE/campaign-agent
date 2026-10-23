const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function imageExtension(mimeType: string) {
  return EXTENSIONS[mimeType] ?? 'png'
}

export function githubSettings() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo || !repo.includes('/')) {
    throw new Error('Set GITHUB_TOKEN and GITHUB_REPO (owner/name) in backend/.env to publish banner images.')
  }
  return {
    token,
    repo,
    branch: process.env.GITHUB_BRANCH || 'main',
    directory: (process.env.GITHUB_ASSETS_DIR || 'campaigns').replace(/^\/+|\/+$/g, ''),
  }
}

/** Public URL of a file on a public GitHub branch. */
export function publicRawUrl(repo: string, branch: string, filePath: string) {
  const path = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path}`
}

interface GithubContentResponse {
  content?: { download_url?: string | null }
  message?: string
}

/**
 * Commits an image to the configured GitHub branch and returns its public raw URL.
 * The CMS and the storefront load this URL directly, so the repository must be public.
 */
export async function uploadPublicImage(file: { data: Buffer; mimeType: string; path: string }): Promise<string> {
  const { token, repo, branch } = githubSettings()
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${file.path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'primegoods-campaign-agent',
    },
    body: JSON.stringify({
      message: `Add campaign banner ${file.path}`,
      content: file.data.toString('base64'),
      branch,
    }),
  })

  const body = (await response.json().catch(() => ({}))) as GithubContentResponse
  if (!response.ok) {
    throw new Error(`GitHub upload failed (${response.status}): ${body.message ?? response.statusText}`)
  }
  return body.content?.download_url ?? publicRawUrl(repo, branch, file.path)
}
