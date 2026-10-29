// Blockbook over WebSocket, straight from the browser. Blockbook's REST API
// sends no CORS headers, but its WebSocket API accepts browser connections,
// so no backend is needed. The xpub goes only to the chosen Blockbook server.

const PAGE_SIZE = 1000
const CALL_TIMEOUT_MS = 60_000

export class BlockbookSocket {
  constructor (host, { WebSocketImpl = globalThis.WebSocket, timeoutMs = CALL_TIMEOUT_MS } = {}) {
    this.host = host
    this.WebSocketImpl = WebSocketImpl
    this.timeoutMs = timeoutMs
    this.nextId = 1
    this.pending = new Map()
    this.ws = null
  }

  open () {
    return new Promise((resolve, reject) => {
      const ws = new this.WebSocketImpl(`wss://${this.host}/websocket`)
      this.ws = ws
      let opened = false
      ws.onopen = () => { opened = true; resolve() }
      ws.onerror = () => {
        if (!opened) reject(new Error(`Could not connect to ${this.host}. It may be busy or not accepting connections from this page. Try again, or pick another server.`))
      }
      ws.onclose = () => {
        if (!opened) return reject(new Error(`Could not connect to ${this.host}.`))
        this.failAll(new Error(`Connection to ${this.host} closed unexpectedly. Try again.`))
      }
      ws.onmessage = event => this.onMessage(event)
    })
  }

  onMessage (event) {
    let message
    try { message = JSON.parse(event.data) } catch { return }
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    clearTimeout(entry.timer)
    const error = message.data?.error
    if (error) entry.reject(new Error(`${this.host}: ${error.message ?? 'request failed'}`))
    else entry.resolve(message.data)
  }

  call (method, params = {}) {
    const id = String(this.nextId++)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${this.host} did not respond in time. Try again, or pick another server.`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  failAll (error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer)
      reject(error)
    }
    this.pending.clear()
  }

  close () {
    if (!this.ws) return
    this.ws.onclose = null
    this.failAll(new Error('Connection closed'))
    this.ws.close()
  }
}

/**
 * Fetches server info and every page of an xpub's transactions.
 * Returns { server, info, transactions }: server is getInfo's data, info is
 * the first page's account summary (balance, totals, txs, usedTokens).
 */
export async function fetchAccount (host, key, { onPage, WebSocketImpl } = {}) {
  const socket = new BlockbookSocket(host, { WebSocketImpl })
  await socket.open()
  try {
    const server = await socket.call('getInfo')
    const transactions = []
    let info
    for (let page = 1; ; page++) {
      onPage?.(page, info?.totalPages)
      const data = await socket.call('getAccountInfo', { descriptor: key, details: 'txs', pageSize: PAGE_SIZE, page })
      info ??= data
      transactions.push(...(data.transactions ?? []))
      if (page >= (data.totalPages ?? 1)) break
    }
    return { server, info, transactions }
  } finally {
    socket.close()
  }
}
