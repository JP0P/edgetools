import { notFound, privateResponse } from './private-response.js'

const canonicalHost = 'support.edgetools.app'
const routePrefix = '/staff'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname !== canonicalHost) return notFound()

    if (url.pathname === routePrefix) {
      return privateResponse(Response.redirect(`${url.origin}${routePrefix}/`, 308))
    }

    if (!url.pathname.startsWith(`${routePrefix}/`)) return notFound()

    url.pathname = url.pathname.slice(routePrefix.length) || '/'
    const assetRequest = new Request(url, request)
    return privateResponse(await env.ASSETS.fetch(assetRequest))
  }
}
