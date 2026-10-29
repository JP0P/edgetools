import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAccount } from '../../apps/balance/blockbook.js'

// Fake WebSocket that answers Blockbook calls via a handler(method, params).
function fakeSocket (handler, { failToConnect = false } = {}) {
  const sent = []
  class FakeWebSocket {
    constructor (url) {
      this.url = url
      setTimeout(() => {
        if (failToConnect) { this.onerror?.(); this.onclose?.() } else this.onopen?.()
      }, 0)
    }

    send (raw) {
      const { id, method, params } = JSON.parse(raw)
      sent.push({ url: this.url, method, params })
      const reply = handler(method, params)
      if (reply !== undefined) setTimeout(() => this.onmessage?.({ data: JSON.stringify({ id, data: reply }) }), 0)
    }

    close () { this.closed = true }
  }
  return { FakeWebSocket, sent }
}

const tx = i => ({ txid: `tx${i}` })

test('fetches server info and every page of transactions', async () => {
  const { FakeWebSocket, sent } = fakeSocket((method, params) => {
    if (method === 'getInfo') return { version: '0.5.0', bestHeight: 900_000 }
    const all = [tx(1), tx(2), tx(3)]
    return { page: params.page, totalPages: 2, balance: '5', txs: 3, transactions: params.page === 1 ? all.slice(0, 2) : all.slice(2) }
  })
  const pages = []
  const { server, info, transactions } = await fetchAccount('btc-wusa1.edge.app', 'zpubX', {
    WebSocketImpl: FakeWebSocket,
    onPage: (page, total) => pages.push([page, total])
  })

  assert.equal(server.version, '0.5.0')
  assert.equal(info.balance, '5')
  assert.deepEqual(transactions.map(t => t.txid), ['tx1', 'tx2', 'tx3'])
  assert.deepEqual(pages, [[1, undefined], [2, 2]])
  assert.equal(sent[0].url, 'wss://btc-wusa1.edge.app/websocket')
  assert.deepEqual(sent[1].params, { descriptor: 'zpubX', details: 'txs', pageSize: 1000, page: 1 })
})

test('surfaces Blockbook error messages', async () => {
  const { FakeWebSocket } = fakeSocket(method =>
    method === 'getInfo' ? {} : { error: { message: 'Invalid address, checksum mismatch' } })
  await assert.rejects(
    fetchAccount('btc-eu1.edge.app', 'zpubBad', { WebSocketImpl: FakeWebSocket }),
    /btc-eu1\.edge\.app: Invalid address, checksum mismatch/
  )
})

test('reports a failed connection clearly', async () => {
  const { FakeWebSocket } = fakeSocket(() => ({}), { failToConnect: true })
  await assert.rejects(
    fetchAccount('btc1.trezor.io', 'zpubX', { WebSocketImpl: FakeWebSocket }),
    /Could not connect to btc1\.trezor\.io/
  )
})
