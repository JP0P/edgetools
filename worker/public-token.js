const API_ROOT = 'https://api.coingecko.com/api/v3'
const DETAIL_QUERY = 'localization=false&tickers=false&market_data=false&community_data=false&developer_data=false'

const nativeCoins = {
  ethereum: 'ethereum',
  'polygon-pos': 'matic-network',
  'binance-smart-chain': 'binancecoin',
  'arbitrum-one': 'ethereum',
  'optimistic-ethereum': 'ethereum',
  base: 'ethereum',
  avalanche: 'avalanche-2',
  solana: 'solana'
}
const contractNetworks = new Set(Object.keys(nativeCoins).filter(network => network !== 'solana'))

function jsonHeaders(cacheSeconds = 0) {
  return {
    'Cache-Control': cacheSeconds > 0 ? `public, max-age=60, s-maxage=${cacheSeconds}` : 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
  }
}

function errorResponse(message, status) {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders() })
}

function coinPath(id) {
  return `/coins/${encodeURIComponent(id)}?${DETAIL_QUERY}`
}

export function tokenUpstreamPath(url) {
  const kind = url.searchParams.get('kind')
  if (kind === 'native') {
    const id = nativeCoins[url.searchParams.get('network')]
    return id ? coinPath(id) : null
  }
  if (kind === 'coin') {
    const id = url.searchParams.get('id') ?? ''
    return /^[a-z0-9-]{1,100}$/.test(id) ? coinPath(id) : null
  }
  if (kind === 'contract') {
    const network = url.searchParams.get('network') ?? ''
    const contract = url.searchParams.get('contract') ?? ''
    if (!contractNetworks.has(network) || !/^0x[a-f\d]{40}$/i.test(contract)) return null
    return `/coins/${encodeURIComponent(network)}/contract/${encodeURIComponent(contract)}?${DETAIL_QUERY}`
  }
  if (kind === 'search') {
    const query = (url.searchParams.get('q') ?? '').trim()
    return query.length >= 2 && query.length <= 100
      ? `/search?query=${encodeURIComponent(query)}`
      : null
  }
  return null
}

export async function handlePublicToken(request, env = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...jsonHeaders() } })
  }
  const url = new URL(request.url)
  const path = tokenUpstreamPath(url)
  if (!path) return errorResponse('Invalid token lookup parameters.', 400)

  const cache = globalThis.caches?.default
  const key = new Request(url.toString(), { method: 'GET' })
  if (cache) {
    const cached = await cache.match(key)
    if (cached) return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached
  }

  let upstream
  try {
    upstream = await (env.fetch ?? fetch)(`${API_ROOT}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EdgeTools/1.0 (+https://edgetools.app)'
      },
      signal: AbortSignal.timeout(12000)
    })
  } catch {
    return errorResponse('CoinGecko is temporarily unavailable.', 502)
  }

  if (!upstream.ok) {
    const status = [404, 429].includes(upstream.status) ? upstream.status : 502
    return errorResponse(status === 404 ? 'CoinGecko could not find that token.' : status === 429 ? 'CoinGecko is rate limiting requests.' : 'CoinGecko is temporarily unavailable.', status)
  }

  let data
  try { data = await upstream.json() } catch { return errorResponse('CoinGecko returned an invalid response.', 502) }
  const response = new Response(JSON.stringify(data), { headers: jsonHeaders(300) })
  if (cache) await cache.put(key, response.clone())
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response
}
