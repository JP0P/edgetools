import { notFound, privateResponse } from './private-response.js'

const canonicalHost = 'staff.edgetools.app'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname !== canonicalHost) return notFound()

    if (url.pathname === '/index.html') {
      return privateResponse(Response.redirect(`${url.origin}/`, 308))
    }

    return privateResponse(await env.ASSETS.fetch(request))
  }
}
