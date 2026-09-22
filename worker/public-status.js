export const blockbookOrigins = [
  ['Bitcoin', 'Europe 1', 'https://btc-eu1.edge.app/'],
  ['Bitcoin', 'West USA 1', 'https://btc-wusa1.edge.app/'],
  ['Bitcoin Cash', 'East USA 1', 'https://bch-eusa1.edge.app/'],
  ['Dash', 'West USA 1', 'https://dash-wusa1.edge.app/'],
  ['DigiByte', 'Europe 1', 'https://dgb-eu1.edge.app/'],
  ['Dogecoin', 'East USA 1', 'https://doge-eusa1.edge.app/'],
  ['Firo', 'East USA 1', 'https://firo-eusa1.edge.app/'],
  ['Litecoin', 'West USA 1', 'https://ltc-wusa1.edge.app/'],
  ['PIVX', 'East USA 1', 'https://pivx-eusa1.edge.app/'],
  ['Qtum', 'West USA 1', 'https://qtum-wusa1.edge.app/'],
  ['Vertcoin', 'West USA 1', 'https://vtc-wusa1.edge.app/']
]

export const STATUS_CACHE_SECONDS = 20
export const STATUS_TIMEOUT_MS = 5000

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('upstream timeout')), ms))])
}

function summarize([name, region, origin], payload) {
  const blockbook = payload?.blockbook ?? {}
  const backend = payload?.backend ?? {}
  const warnings = []
  let status = 'online'
  if (typeof backend.error === 'string' && backend.error) { status = 'error'; warnings.push('Backend reported an error') }
  if (blockbook.inSync === false || blockbook.inSyncMempool === false) { if (status === 'online') status = 'warning'; warnings.push('Service is catching up') }
  if (typeof blockbook.lastBlockTime === 'string') {
    const age = Date.now() - Date.parse(blockbook.lastBlockTime)
    if (Number.isFinite(age) && age > 24 * 60 * 60 * 1000) { status = 'error'; warnings.push('Latest block is more than a day old') }
    else if (Number.isFinite(age) && age > 2 * 60 * 60 * 1000 && status === 'online') { status = 'warning'; warnings.push('Latest block is more than two hours old') }
  }
  return { name, region, status, blockHeight: Number.isFinite(backend.blocks) ? backend.blocks : (Number.isFinite(blockbook.bestHeight) ? blockbook.bestHeight : null), inSync: blockbook.inSync ?? null, inSyncMempool: blockbook.inSyncMempool ?? null, warnings }
}

export async function collectPublicStatus(fetchImpl = fetch) {
  const services = []
  // Workers allow six simultaneous outgoing connections. Two bounded batches
  // keep the 11-origin aggregate within that ceiling and within the client's
  // 12-second timeout even when every upstream reaches the five-second limit.
  for (let index = 0; index < blockbookOrigins.length; index += 6) {
    const batch = blockbookOrigins.slice(index, index + 6)
    services.push(...await Promise.all(batch.map(async definition => {
      try {
        const response = await withTimeout(fetchImpl(`${definition[2]}api/v2`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) }), STATUS_TIMEOUT_MS)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return summarize(definition, await response.json())
      } catch {
        return { name: definition[0], region: definition[1], status: 'offline', blockHeight: null, inSync: null, inSyncMempool: null, warnings: ['Unable to reach service'] }
      }
    })))
  }
  const online = services.filter(service => service.status === 'online' || service.status === 'warning').length
  return { generatedAt: new Date().toISOString(), total: services.length, online, services }
}

export function publicStatusHeaders() {
  return { 'Cache-Control': `public, max-age=15, s-maxage=${STATUS_CACHE_SECONDS}`, 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }
}

export async function handlePublicStatus(request, env = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...publicStatusHeaders() } })
  const cache = globalThis.caches?.default
  const key = new Request('https://edgetools.app/api/status')
  if (cache) {
    const cached = await cache.match(key)
    if (cached) return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached
  }
  const data = await collectPublicStatus(env.fetch ?? fetch)
  const response = new Response(JSON.stringify(data), { headers: publicStatusHeaders() })
  if (cache) await cache.put(key, response.clone())
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response
}
