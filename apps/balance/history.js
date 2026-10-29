// Turns Blockbook xpub transactions (details=txs) into a running-balance
// history. Pure functions, no DOM, so they run in the browser and in tests.
// All amounts are BigInt satoshis.

const sumOwn = items => items.reduce((sum, item) => item.isOwn ? sum + BigInt(item.value ?? '0') : sum, 0n)

const isPending = tx => !(tx.confirmations > 0)

/**
 * Oldest first. Confirmed transactions by block height; pending ones last.
 * Within a block (or among pending), a transaction is placed after any
 * transaction whose outputs it spends. Blockbook lists newest first, so its
 * reversed order is the tie-breaker.
 */
export function sortChronologically (transactions) {
  const oldestFirst = [...transactions].reverse()
  const groups = new Map()
  for (const tx of oldestFirst) {
    const key = isPending(tx) ? Infinity : tx.blockHeight
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tx)
  }
  const keys = [...groups.keys()].sort((a, b) => a - b)
  return keys.flatMap(key => orderByDependency(groups.get(key)))
}

function orderByDependency (txs) {
  if (txs.length < 2) return txs
  const inGroup = new Set(txs.map(tx => tx.txid))
  const placed = new Set()
  const result = []
  const visit = (tx, path) => {
    if (placed.has(tx.txid) || path.has(tx.txid)) return
    path.add(tx.txid)
    for (const vin of tx.vin ?? []) {
      if (inGroup.has(vin.txid)) visit(txs.find(t => t.txid === vin.txid), path)
    }
    placed.add(tx.txid)
    result.push(tx)
  }
  for (const tx of txs) visit(tx, new Set())
  return result
}

/**
 * Returns { rows, totals }, rows oldest first. Each row:
 * { txid, blockHeight, time, confirmations, pending, type, net, fee, balance, mixedInputs }
 * net: change to the wallet (negative for spends; includes the fee).
 * fee: only set when the wallet paid it (has own inputs).
 */
export function buildHistory (transactions) {
  let balance = 0n
  let received = 0n
  let sent = 0n
  let fees = 0n

  const rows = sortChronologically(transactions).map(tx => {
    const ownIn = sumOwn(tx.vin ?? [])
    const ownOut = sumOwn(tx.vout ?? [])
    const net = ownOut - ownIn
    const hasOwnInputs = ownIn > 0n
    const allInputsOwn = (tx.vin ?? []).every(v => v.isOwn)
    const allOutputsOwn = (tx.vout ?? []).every(v => v.isOwn || BigInt(v.value ?? '0') === 0n)

    let type
    if (!hasOwnInputs) type = 'In'
    // A spend whose only outputs are zero-value (OP_RETURN) sends everything
    // to fees; that is an Out, not a transfer to self.
    else if (allOutputsOwn && allInputsOwn && ownOut > 0n) type = 'Self'
    else type = net >= 0n ? 'In' : 'Out'

    const fee = hasOwnInputs && allInputsOwn ? BigInt(tx.fees ?? '0') : null
    balance += net
    received += ownOut
    sent += ownIn
    if (fee != null) fees += fee

    return {
      txid: tx.txid,
      blockHeight: isPending(tx) ? null : tx.blockHeight,
      time: tx.blockTime,
      confirmations: tx.confirmations ?? 0,
      pending: isPending(tx),
      type,
      net,
      fee,
      balance,
      // Some inputs belong to other wallets (coinjoin, payjoin, or someone
      // else spending alongside this wallet). Worth a look in support cases.
      mixedInputs: hasOwnInputs && !allInputsOwn
    }
  })

  return { rows, totals: { balance, received, sent, fees, count: rows.length } }
}

/**
 * Compares the computed history with the totals the server reports.
 * Returns a list of human-readable problems (empty when everything matches).
 */
export function checkAgainstServer (totals, server) {
  const problems = []
  const serverBalance = BigInt(server.balance ?? '0') + BigInt(server.unconfirmedBalance ?? '0')
  if (totals.balance !== serverBalance) {
    problems.push(`Computed balance ${formatBtc(totals.balance)} differs from the server's ${formatBtc(serverBalance)}.`)
  }
  if (server.totalReceived != null && totals.received < BigInt(server.totalReceived)) {
    problems.push(`Computed total received ${formatBtc(totals.received)} is less than the server's ${formatBtc(BigInt(server.totalReceived))}.`)
  }
  if (server.txs != null && totals.count !== server.txs) {
    problems.push(`Loaded ${totals.count} transactions but the server reports ${server.txs}.`)
  }
  return problems
}

const SATS_PER_BTC = 100_000_000n

/** BTC string from satoshis, exact. signed: prefix "+" for positive values. */
export function formatBtc (sats, { signed = false, unit = true } = {}) {
  const n = BigInt(sats)
  const sign = n < 0n ? '-' : signed && n > 0n ? '+' : ''
  const abs = n < 0n ? -n : n
  const whole = abs / SATS_PER_BTC
  const frac = (abs % SATS_PER_BTC).toString().padStart(8, '0')
  return `${sign}${unit ? whole.toLocaleString('en-US') : whole}.${frac}${unit ? ' BTC' : ''}`
}
