import assert from 'node:assert/strict'
import test from 'node:test'

import staffWorker from '../worker/staff.js'
import supportStaffWorker from '../worker/support-staff.js'
import publicApiWorker from '../worker/public-api.js'
import { blockbookOrigins, collectPublicStatus } from '../worker/public-status.js'
import { tokenUpstreamPath } from '../worker/public-token.js'

function assets(status = 200, body = 'asset') {
  return {
    async fetch(request) {
      return new Response(body, {
        status,
        headers: {
          'Content-Type': 'text/html',
          'X-Asset-Path': new URL(request.url).pathname
        }
      })
    }
  }
}

test('company Staff worker serves only the canonical host with private headers', async () => {
  const response = await staffWorker.fetch(
    new Request('https://staff.edgetools.app/'),
    { ASSETS: assets() }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY')

  const rejected = await staffWorker.fetch(
    new Request('https://edgetools-staff.workers.dev/'),
    { ASSETS: assets() }
  )
  assert.equal(rejected.status, 404)
})

test('company Staff worker canonicalizes index.html', async () => {
  const response = await staffWorker.fetch(
    new Request('https://staff.edgetools.app/index.html'),
    { ASSETS: assets() }
  )
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('Location'), 'https://staff.edgetools.app/')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
})

test('Support Staff worker strips only the protected route prefix', async () => {
  const response = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/staff/assets/site.js'),
    { ASSETS: assets() }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Asset-Path'), '/assets/site.js')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')

  const workflow = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/staff/account-access/'),
    { ASSETS: assets() }
  )
  assert.equal(workflow.status, 200)
  assert.equal(workflow.headers.get('X-Asset-Path'), '/account-access/')

  const outside = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/datecalc/'),
    { ASSETS: assets() }
  )
  assert.equal(outside.status, 404)

  const wrongHost = await supportStaffWorker.fetch(
    new Request('https://edgetools-support-staff.workers.dev/staff/'),
    { ASSETS: assets() }
  )
  assert.equal(wrongHost.status, 404)
})

test('Support Staff worker redirects the bare protected path', async () => {
  const response = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/staff'),
    { ASSETS: assets() }
  )
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('Location'), 'https://support.edgetools.app/staff/')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
})

test('public status aggregates only the fixed Blockbook allowlist', async () => {
  assert.equal(blockbookOrigins.length, 11)
  const requested = []
  const data = { blockbook: { bestHeight: 42, inSync: true, inSyncMempool: true }, backend: { blocks: 42 } }
  const response = await collectPublicStatus(async url => {
    requested.push(url)
    return new Response(JSON.stringify(data), { status: 200 })
  })
  assert.equal(response.total, 11)
  assert.equal(response.online, 11)
  assert.equal(requested.length, 11)
  assert.ok(requested.every(url => url.endsWith('/api/v2')))
  assert.ok(response.services.every(service => service.status === 'online'))
})

test('public status never exceeds six simultaneous upstream requests', async () => {
  let active = 0
  let peak = 0
  const data = { blockbook: { bestHeight: 42, inSync: true, inSyncMempool: true }, backend: { blocks: 42 } }
  await collectPublicStatus(async () => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    return new Response(JSON.stringify(data), { status: 200 })
  })
  assert.ok(peak <= 6, `peak concurrency was ${peak}`)
})

test('public status classifies upstream error, sync, and stale-block states', async () => {
  const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const response = await collectPublicStatus(async url => {
    if (url.includes('btc-eu1')) return new Response(JSON.stringify({ blockbook: { inSync: true }, backend: { error: 'backend failure' } }))
    if (url.includes('btc-wusa1')) return new Response(JSON.stringify({ blockbook: { inSync: false, inSyncMempool: true }, backend: { blocks: 2 } }))
    if (url.includes('bch-eusa1')) return new Response(JSON.stringify({ blockbook: { inSync: true, lastBlockTime: stale }, backend: { blocks: 3 } }))
    return new Response(JSON.stringify({ blockbook: { inSync: true, inSyncMempool: true }, backend: { blocks: 4 } }))
  })
  assert.equal(response.services.find(service => service.name === 'Bitcoin' && service.region === 'Europe 1').status, 'error')
  assert.equal(response.services.find(service => service.name === 'Bitcoin' && service.region === 'West USA 1').status, 'warning')
  assert.equal(response.services.find(service => service.name === 'Bitcoin Cash').status, 'error')
})

test('Public API Worker exposes only the exact status route without private headers', async () => {
  const response = await publicApiWorker.fetch(
    new Request('https://edgetools.app/api/status'),
    {
      fetch: async () => new Response(JSON.stringify({ blockbook: { bestHeight: 1 }, backend: { blocks: 1 } }))
    }
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Cache-Control'), /max-age=15/)
  assert.equal(response.headers.get('X-Robots-Tag'), null)

  const wrongPath = await publicApiWorker.fetch(new Request('https://edgetools.app/api/status/'))
  assert.equal(wrongPath.status, 404)
  const wrongHost = await publicApiWorker.fetch(new Request('https://edgetools-public-api.workers.dev/api/status'))
  assert.equal(wrongHost.status, 404)
})

test('public status HEAD preserves headers without poisoning the GET body', async () => {
  const originalCaches = globalThis.caches
  let stored
  globalThis.caches = {
    default: {
      async match() { return stored?.clone() },
      async put(_key, response) { stored = response.clone() }
    }
  }
  const env = {
    fetch: async () => new Response(JSON.stringify({ blockbook: { bestHeight: 1 }, backend: { blocks: 1 } }))
  }
  try {
    const head = await publicApiWorker.fetch(new Request('https://edgetools.app/api/status', { method: 'HEAD' }), env)
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    assert.match(head.headers.get('Cache-Control'), /max-age=15/)

    const get = await publicApiWorker.fetch(new Request('https://edgetools.app/api/status'), env)
    assert.equal(get.status, 200)
    assert.match(await get.text(), /"services"/)
  } finally {
    if (originalCaches === undefined) delete globalThis.caches
    else globalThis.caches = originalCaches
  }
})

test('public token endpoint accepts only bounded lookup shapes', () => {
  assert.match(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=native&network=ethereum')), /^\/coins\/ethereum\?/)
  assert.match(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=coin&id=usd-coin')), /^\/coins\/usd-coin\?/)
  assert.match(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=search&q=USDC')), /^\/search\?query=USDC$/)
  assert.match(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=contract&network=ethereum&contract=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')), /^\/coins\/ethereum\/contract\//)
  assert.equal(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=native&network=unknown')), null)
  assert.equal(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=coin&id=https://evil.example')), null)
  assert.equal(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=contract&network=ethereum&contract=bad')), null)
  assert.equal(tokenUpstreamPath(new URL('https://edgetools.app/api/token?kind=contract&network=solana&contract=0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')), null)
})

test('Public API Worker exposes only the exact token route without private headers', async () => {
  let upstream
  const response = await publicApiWorker.fetch(
    new Request('https://edgetools.app/api/token?kind=native&network=ethereum'),
    {
      fetch: async url => {
        upstream = url
        return new Response(JSON.stringify({ id: 'ethereum', name: 'Ethereum', symbol: 'eth' }))
      }
    }
  )
  assert.equal(response.status, 200)
  assert.match(upstream, /^https:\/\/api\.coingecko\.com\/api\/v3\/coins\/ethereum\?/)
  assert.match(response.headers.get('Cache-Control'), /s-maxage=300/)
  assert.equal(response.headers.get('X-Robots-Tag'), null)
  assert.equal((await response.json()).id, 'ethereum')

  const invalid = await publicApiWorker.fetch(new Request('https://edgetools.app/api/token?kind=coin&id=https://evil.example'))
  assert.equal(invalid.status, 400)
  const wrongPath = await publicApiWorker.fetch(new Request('https://edgetools.app/api/token/'))
  assert.equal(wrongPath.status, 404)
})

test('public token endpoint maps upstream failures without leaking response bodies', async () => {
  for (const [upstreamStatus, expectedStatus, message] of [
    [404, 404, 'could not find'],
    [429, 429, 'rate limiting'],
    [403, 502, 'temporarily unavailable']
  ]) {
    const response = await publicApiWorker.fetch(
      new Request('https://edgetools.app/api/token?kind=native&network=ethereum'),
      { fetch: async () => new Response('upstream detail must not leak', { status: upstreamStatus }) }
    )
    assert.equal(response.status, expectedStatus)
    assert.match((await response.json()).error, new RegExp(message, 'i'))
  }

  const unavailable = await publicApiWorker.fetch(
    new Request('https://edgetools.app/api/token?kind=native&network=ethereum'),
    { fetch: async () => { throw new Error('network detail must not leak') } }
  )
  assert.equal(unavailable.status, 502)
  assert.match((await unavailable.json()).error, /temporarily unavailable/i)
})
