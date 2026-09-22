import { handlePublicStatus } from './public-status.js'
import { handlePublicToken } from './public-token.js'

const canonicalHost = 'edgetools.app'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname !== canonicalHost) return new Response('Not found', { status: 404 })
    if (url.pathname === '/api/status') return handlePublicStatus(request, env)
    if (url.pathname === '/api/token') return handlePublicToken(request, env)
    return new Response('Not found', { status: 404 })
  }
}
