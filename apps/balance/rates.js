// Historical BTC/USD prices from Edge's rates server (v3 API).
// The browser calls it directly; it allows any origin (CORS *).
// Only timestamps are sent, never addresses or keys.
//
// Server facts (checked 2026-10-28):
// - Prices resolve to the minute.
// - A batch must have fewer than 100 entries.
// - Any future date makes the whole batch fail, so times are capped at now.
// - Very old dates (around 2011 and earlier) come back with no rate.

const HOSTS = ['https://rates3.edge.app', 'https://rates4.edge.app']
const BATCH_SIZE = 99
const CONCURRENCY = 4

/** ISO time rounded down to the minute, capped at one minute before now. */
export function minuteKey (unixSeconds, nowMs = Date.now()) {
  const ms = Math.min(unixSeconds * 1000, nowMs - 60_000)
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString()
}

async function postBatch (isoDates, fetchFn) {
  const body = JSON.stringify({
    targetFiat: 'USD',
    fiat: [],
    crypto: isoDates.map(isoDate => ({ isoDate, asset: { pluginId: 'bitcoin', tokenId: null } }))
  })
  let lastError
  for (const host of HOSTS) {
    try {
      const res = await fetchFn(`${host}/v3/rates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      return data.crypto
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`Edge rates server failed: ${lastError.message}`)
}

/**
 * Returns Map<isoDate, number | null> of USD per BTC.
 * null means the server has no price for that time.
 */
export async function fetchUsdRates (isoDates, { fetchFn = fetch, onProgress } = {}) {
  const unique = [...new Set(isoDates)]
  const batches = []
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE))

  const rates = new Map()
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++]
      const results = await postBatch(batch, fetchFn)
      // Match by the echoed date; fall back to position (the server keeps
      // request order).
      const byDate = new Map((results ?? []).map(r => [r.isoDate, r.rate]))
      batch.forEach((iso, i) => {
        const rate = byDate.has(iso) ? byDate.get(iso) : results?.[i]?.rate
        rates.set(iso, typeof rate === 'number' && rate > 0 ? rate : null)
      })
      onProgress?.(++done, batches.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))
  return rates
}

/** USD value of a satoshi amount at a given USD/BTC price. */
export const satsToUsd = (sats, price) => Number(sats) / 1e8 * price
