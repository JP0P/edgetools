import assert from 'node:assert/strict'
import test from 'node:test'
import { providers, lookupOrder } from '../apps/orders/order-logic.js'
import publicApi from '../worker/public-api.js'

const hash = 'a'.repeat(64)
const uuid = '00000000-0000-4000-8000-000000000000'
const bridge = '1/0x' + hash + '/0'
const expectedSwapIds = ['bridgeless', 'changehero', 'changelly', 'changenow', 'cosmosibc', 'exolix', 'godex', 'houdini', 'lifi', 'nexchange', 'nymswap', 'rango', 'sideshift', 'spookySwap', 'mptrade', 'mptradedefi', 'swapter', 'swapuz', 'mayaprotocol', 'thorchain', 'swapkit', 'swapkitv3', 'tombSwap', 'transfer', 'unizen', 'velodrome', 'xgram', 'xrpdex', 'fantomsonicupgrade', '0xgasless']

test('catalog covers every current Edge swap registration and current fiat factories', () => {
  assert.deepEqual(providers.filter(provider => provider.group === 'Swap').map(provider => provider.id).sort(), expectedSwapIds.sort())
  const fiatIds = ['banxa', 'bitsofgold', 'bity', 'dfx', 'infinite', 'kado', 'kadoOtc', 'libertyx', 'moonpay', 'mtpelerin', 'paybis', 'revolut', 'simplex']
  assert.deepEqual(providers.filter(provider => provider.group === 'Buy / sell').map(provider => provider.id).sort(), fiatIds.sort())
  assert.equal(new Set(providers.map(provider => provider.id)).size, providers.length)
})

test('every direct template round trips without a provider-status request', () => {
  for (const provider of providers.filter(provider => provider.mode === 'direct')) {
    const id = provider.id === 'bridgeless' ? bridge : provider.pattern ? hash : 'synthetic_order-123'
    const resolved = lookupOrder(id, provider.id)
    assert.equal(resolved.kind, 'resolved', provider.id)
    assert.equal(resolved.evidence, 'provider-selected')
    assert.equal(resolved.verified, false)
    for (const link of resolved.matches[0].links) {
      assert.equal(new URL(link.url).protocol, 'https:')
      const parsed = lookupOrder(link.url)
      assert.equal(parsed.kind, ['mptrade', 'mptradedefi'].includes(provider.id) ? 'candidates' : 'resolved', link.url)
      assert.equal(parsed.orderId, id)
      assert.ok(parsed.matches.some(match => match.id === provider.id), link.url)
      assert.equal(parsed.evidence, 'tracking-url')
      assert.equal(parsed.verified, false)
    }
  }
})

test('corrects ChangeNOW, Paybis and structured Bridgeless destinations', () => {
  assert.equal(lookupOrder('synthetic', 'changenow').matches[0].links[0].url, 'https://changenow.io/exchange/txs/synthetic')
  assert.equal(lookupOrder('synthetic', 'paybis').matches[0].links[0].url, 'https://widget.paybis.com/?requestId=synthetic')
  assert.equal(lookupOrder(bridge, 'bridgeless').matches[0].links[0].url, 'https://tss1.mainnet.bridgeless.com/check/' + bridge)
  assert.equal(lookupOrder(hash, 'bridgeless').kind, 'invalid')
  assert.equal(lookupOrder(bridge, 'swapuz').kind, 'invalid')
  assert.equal(lookupOrder('1/' + hash + '/0', 'bridgeless').kind, 'invalid')
})

test('receipt-only providers never invent links or put an ID in a handoff', () => {
  for (const provider of providers.filter(provider => provider.mode === 'receipt')) {
    const result = lookupOrder('synthetic_order-123', provider.id)
    assert.equal(result.kind, 'resolved')
    assert.deepEqual(result.matches[0].links, [], provider.id)
    assert.ok(result.matches[0].note.length > 30, provider.id)
    assert.equal(result.matches[0].mode, 'receipt')
  }
})

test('UUIDs stay explicitly ambiguous and format candidates are not exhaustive', () => {
  const result = lookupOrder(uuid)
  assert.equal(result.kind, 'candidates')
  assert.equal(result.requiresProviderConfirmation, true)
  assert.equal(result.evidence, 'format-only')
  assert.deepEqual(result.matches.map(match => match.id).sort(), ['bity', 'moonpay', 'simplex'])
  assert.match(result.message, /not proof.*not exhaustive/)
  assert.equal(result.verified, false)
})

test('prefixed and bare hashes never imply Bitcoin, an EVM chain, or one swap provider', () => {
  for (const id of [hash, '0x' + hash, hash.toUpperCase()]) {
    const result = lookupOrder(id)
    assert.equal(result.kind, 'candidates')
    assert.equal(result.requiresProviderConfirmation, true)
    assert.match(result.transaction.label, /Shared/)
    assert.equal(result.matches.length, 4)
    assert.ok(result.transaction.links[0].url.startsWith('https://blockchair.com/search?'))
    assert.doesNotMatch(result.transaction.links[0].url, /bitcoin\/transaction/)
    assert.equal(result.verified, false)
  }
})

test('Solana format excludes hash-only trackers and unknown IDs remain usable manually', () => {
  const result = lookupOrder('2'.repeat(88))
  assert.match(result.transaction.label, /Possible Solana/)
  assert.deepEqual(result.matches.map(match => match.id), ['mptrade', 'mptradedefi'])
  const unknown = lookupOrder('synthetic_unknown_123')
  assert.equal(unknown.kind, 'unknown')
  assert.deepEqual(unknown.matches, [])
  assert.equal(lookupOrder('synthetic_unknown_123', 'swapuz').kind, 'resolved')
  assert.equal(lookupOrder('synthetic_unknown_123', 'thorchain').kind, 'invalid')
})

test('numeric and short IDs produce candidates, never certainty', () => {
  for (const id of ['123456', 'ABC123', 'a'.repeat(20), 'AbCdEf12345678']) {
    const result = lookupOrder(id)
    assert.equal(result.kind, 'candidates', id)
    assert.equal(result.evidence, 'format-only')
    assert.equal(result.verified, false)
  }
})

test('tracking URL must agree with selected provider, including shared MoonPay Trade links', () => {
  assert.equal(lookupOrder('https://swapuz.com/order/synthetic', 'houdini').kind, 'invalid')
  const shared = lookupOrder('https://scan.swaps.xyz/transactions/' + hash)
  assert.deepEqual(shared.matches.map(match => match.id), ['mptrade', 'mptradedefi'])
  assert.equal(shared.requiresProviderConfirmation, true)
  assert.equal(shared.kind, 'candidates')
  assert.equal(shared.verified, false)
})

test('invalid or spoofed input cannot generate an arbitrary outgoing URL', () => {
  for (const raw of [
    'javascript:alert(1)', 'http://swapuz.com/order/synthetic',
    'https://swapuz.com.evil.example/order/synthetic',
    'https://swapuz.com@evil.example/order/synthetic',
    'https://user:pass@swapuz.com/order/synthetic',
    'https://swapuz.com:8443/order/synthetic',
    'https://swapuz.com/order/synthetic?secret=do-not-forward',
    'https://swapuz.com/order/synthetic#secret',
    'https://swapuz.com/order/%3Cscript%3E',
    'https://swapuz.com/order/one/two',
    'https://widget.paybis.com/?requestId=one&requestId=two',
    'https://widget.paybis.com/?requestId=one&token=secret',
    'https://app.houdini.com/order-details?houdiniId=one&redirect=https://evil.example',
    '<img src=x onerror=alert(1)>', 'two IDs', 'a'.repeat(1025)
  ]) assert.equal(lookupOrder(raw).kind, 'invalid', raw)
  assert.equal(lookupOrder('synthetic', 'not-a-provider').kind, 'invalid')
  assert.equal(lookupOrder(null).kind, 'invalid')
  assert.equal(lookupOrder('  ').kind, 'empty')
})

function request(body, options = {}) {
  return new Request('https://edgetools.app/api/orders/resolve' + (options.query ?? ''), {
    method: options.method ?? 'POST',
    headers: options.headers ?? { 'Content-Type': 'application/json' },
    body: ['GET', 'HEAD'].includes(options.method) ? undefined : body
  })
}

test('stateless POST API matches browser resolver and returns no-store with no CORS', async () => {
  const beforeFetch = globalThis.fetch
  const beforeCaches = globalThis.caches
  globalThis.fetch = () => { throw new Error('No upstream requests allowed') }
  globalThis.caches = new Proxy({}, { get() { throw new Error('No caching allowed') } })
  try {
    const response = await publicApi.fetch(request(JSON.stringify({ input: 'synthetic', provider: 'swapuz' })))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
    assert.deepEqual(await response.json(), lookupOrder('synthetic', 'swapuz'))
    const ambiguous = await publicApi.fetch(request(JSON.stringify({ input: uuid })))
    assert.equal((await ambiguous.json()).requiresProviderConfirmation, true)
  } finally {
    globalThis.fetch = beforeFetch
    if (beforeCaches === undefined) delete globalThis.caches
    else globalThis.caches = beforeCaches
  }
})

test('POST API rejects methods, query input, bad media, malformed bodies and extra fields', async () => {
  const cases = [
    [request(undefined, { method: 'GET' }), 405],
    [request('data', { query: '?input=secret' }), 400],
    [request('{}', { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request('{'), 400], [request('null'), 400], [request('[]'), 400],
    [request('{}'), 400], [request('{"input":10}'), 400],
    [request('{"input":"a","provider":{}}'), 400],
    [request('{"input":"a","secret":"x"}'), 400],
    [request('{"input":"a","provider":"invalid"}'), 400],
    [request('x'.repeat(4097)), 413],
    [request('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '5000' } }), 413]
  ]
  for (const [req, expected] of cases) {
    const response = await publicApi.fetch(req)
    assert.equal(response.status, expected, req.url + ' ' + req.method)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  }
})

test('streaming bodies are bounded without trusting Content-Length', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4090)); controller.enqueue(new Uint8Array(20)); controller.close() } })
  const response = await publicApi.fetch(new Request('https://edgetools.app/api/orders/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' }))
  assert.equal(response.status, 413)
})

test('API rejects wrong host and near-match paths', async () => {
  for (const url of ['https://edgetools-public-api.workers.dev/api/orders/resolve', 'https://edgetools.app/api/orders/resolve/', 'https://edgetools.app/api/orders/resolver', 'https://support.edgetools.app/api/orders/resolve']) {
    assert.equal((await publicApi.fetch(new Request(url))).status, 404)
  }
})
