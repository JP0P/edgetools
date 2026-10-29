import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchUsdRates, minuteKey, satsToUsd } from '../../apps/balance/rates.js'

// Fake v3 server: rate = minutes since epoch (so each date gets a distinct,
// checkable value); dates before 2012 get no rate.
function fakeServer ({ failHost } = {}) {
  const calls = []
  const fetchFn = async (url, { body }) => {
    const { crypto } = JSON.parse(body)
    calls.push({ url, count: crypto.length })
    if (failHost && url.startsWith(failHost)) throw new Error('network down')
    if (crypto.length >= 100) return { ok: false, status: 400, json: async () => ({ error: 'crypto array must be less than 100' }) }
    return {
      ok: true,
      json: async () => ({
        crypto: crypto.map(c => {
          const ms = Date.parse(c.isoDate)
          return ms < Date.parse('2012-01-01') ? { ...c } : { ...c, rate: ms / 60_000 }
        })
      })
    }
  }
  return { fetchFn, calls }
}

test('minuteKey rounds down and caps future times', () => {
  const now = Date.parse('2026-10-28T12:00:30Z')
  assert.equal(minuteKey(Date.parse('2024-03-03T12:07:13Z') / 1000, now), '2024-03-03T12:07:00.000Z')
  assert.equal(minuteKey(now / 1000 + 3600, now), '2026-10-28T11:59:00.000Z')
})

test('fetchUsdRates batches under 100, dedupes, and maps every date', async () => {
  const { fetchFn, calls } = fakeServer()
  const dates = Array.from({ length: 250 }, (_, i) => new Date(Date.parse('2024-01-01T00:00:00Z') + i * 60_000).toISOString())
  const progress = []
  const rates = await fetchUsdRates([...dates, ...dates], { fetchFn, onProgress: (d, t) => progress.push(`${d}/${t}`) })

  assert.equal(calls.length, 3)
  assert.ok(calls.every(c => c.count < 100))
  assert.equal(rates.size, 250)
  for (const iso of dates) assert.equal(rates.get(iso), Date.parse(iso) / 60_000)
  assert.equal(progress.at(-1), '3/3')
})

test('dates without a price map to null', async () => {
  const { fetchFn } = fakeServer()
  const rates = await fetchUsdRates(['2011-06-01T00:00:00.000Z'], { fetchFn })
  assert.equal(rates.get('2011-06-01T00:00:00.000Z'), null)
})

test('falls back to rates4 when rates3 fails', async () => {
  const { fetchFn, calls } = fakeServer({ failHost: 'https://rates3' })
  const rates = await fetchUsdRates(['2024-03-03T12:00:00.000Z'], { fetchFn })
  assert.ok(rates.get('2024-03-03T12:00:00.000Z') > 0)
  assert.deepEqual(calls.map(c => new URL(c.url).host), ['rates3.edge.app', 'rates4.edge.app'])
})

test('throws when every host fails', async () => {
  const fetchFn = async () => { throw new Error('offline') }
  await assert.rejects(fetchUsdRates(['2024-03-03T12:00:00.000Z'], { fetchFn }), /Edge rates server failed: offline/)
})

test('satsToUsd', () => {
  assert.equal(satsToUsd(50_000_000n, 60_000), 30_000)
  assert.equal(satsToUsd(-294n, 100_000), -0.294)
})
