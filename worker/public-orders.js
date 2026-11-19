import { lookupOrder } from '../apps/orders/order-logic.js'

const maxBodyBytes = 4096
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders
    }
  })
}

// Pure parsing/link generation only: no fetch, secrets, Cache API, logs or state.
export async function handlePublicOrders(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST with a JSON body.' }, 405, { Allow: 'POST' })
  if (new URL(request.url).search) return json({ error: 'Query parameters are not accepted. Put input in the JSON body.' }, 400)
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') ?? '')) return json({ error: 'Content-Type must be application/json.' }, 415)
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return json({ error: 'Encoded bodies are not accepted.' }, 415)
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBodyBytes)) return json({ error: 'Body must not exceed 4096 bytes.' }, 413)
  if (!request.body) return json({ error: 'A JSON body is required.' }, 400)
  const reader = request.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBodyBytes) {
        await reader.cancel()
        return json({ error: 'Body must not exceed 4096 bytes.' }, 413)
      }
      chunks.push(value)
    }
  } catch {
    return json({ error: 'Could not read the JSON body.' }, 400)
  } finally {
    reader.releaseLock()
  }
  let body
  try {
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { return json({ error: 'Invalid JSON body.' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['input', 'provider'].includes(key)) || typeof body.input !== 'string' || (body.provider !== undefined && typeof body.provider !== 'string')) {
    return json({ error: 'Use { "input": "...", "provider": "optional provider ID" } only.' }, 400)
  }
  const result = lookupOrder(body.input, body.provider ?? '')
  if (['empty', 'invalid'].includes(result.kind)) return json({ error: result.message }, 400)
  return json(result)
}
