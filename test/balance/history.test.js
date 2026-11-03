import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHistory, checkAgainstServer, chooseDefaultView, formatBtc, mergeWalletTransactions, sortChronologically } from '../../apps/balance/history.js'

// Minimal Blockbook-shaped transaction. vin/vout: [value, isOwn, prevTxid?]
function tx (txid, blockHeight, vin, vout, fees = '0') {
  return {
    txid,
    blockHeight,
    blockTime: 1_700_000_000 + blockHeight,
    confirmations: blockHeight > 0 ? 10 : 0,
    fees,
    vin: vin.map(([value, isOwn, prev = 'ext']) => ({ txid: prev, value: String(value), ...(isOwn ? { isOwn } : {}) })),
    vout: vout.map(([value, isOwn]) => ({ value: String(value), ...(isOwn ? { isOwn } : {}) }))
  }
}

test('incoming, outgoing with change, self-transfer', () => {
  // Blockbook order: newest first.
  const { rows, totals } = buildHistory([
    tx('self', 3, [[39_000, true, 'out']], [[38_500, true]], '500'),
    tx('out', 2, [[100_000, true, 'in']], [[60_000, false], [39_000, true]], '1000'),
    tx('in', 1, [[100_500, false]], [[100_000, true]], '500')
  ])

  assert.deepEqual(rows.map(r => r.txid), ['in', 'out', 'self'])
  assert.deepEqual(rows.map(r => r.type), ['In', 'Out', 'Self'])
  assert.deepEqual(rows.map(r => r.net), [100_000n, -61_000n, -500n])
  assert.deepEqual(rows.map(r => r.balance), [100_000n, 39_000n, 38_500n])
  assert.deepEqual(rows.map(r => r.fee), [null, 1000n, 500n])
  assert.equal(totals.balance, 38_500n)
  assert.equal(totals.fees, 1500n)
})

test('same-block spend is ordered after the transaction that funded it', () => {
  // Blockbook happens to list the funding tx as "newer" within block 5.
  const sorted = sortChronologically([
    tx('fund', 5, [[10_000, false]], [[9_000, true]]),
    tx('spend', 5, [[9_000, true, 'fund']], [[8_000, false]], '1000')
  ])
  assert.deepEqual(sorted.map(t => t.txid), ['fund', 'spend'])
})

test('a spend to fees only (zero-value OP_RETURN output) is Out, not Self', () => {
  const { rows } = buildHistory([
    tx('burn', 2, [[2_000, true, 'in']], [[0, false]], '2000'),
    tx('in', 1, [[3_000, false]], [[2_000, true]])
  ])
  assert.equal(rows[1].type, 'Out')
  assert.equal(rows[1].net, -2_000n)
})

test('pending transactions come last and are marked', () => {
  const { rows } = buildHistory([
    tx('mempool', 0, [[5_000, false]], [[4_000, true]]),
    tx('old', 1, [[2_000, false]], [[1_000, true]])
  ])
  assert.deepEqual(rows.map(r => [r.txid, r.pending]), [['old', false], ['mempool', true]])
  assert.equal(rows[1].blockHeight, null)
})

test('inputs from other wallets are flagged and fee is not attributed', () => {
  const { rows } = buildHistory([
    tx('mixed', 1, [[300, true], [400, false]], [[500, false]], '200')
  ])
  assert.equal(rows[0].mixedInputs, true)
  assert.equal(rows[0].fee, null)
  assert.equal(rows[0].net, -300n)
})

test('real data: BIP84 test vector matches server totals and never goes negative', () => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/bip84-test-vector.json', import.meta.url)))
  const { rows, totals } = buildHistory(data.transactions)

  assert.equal(totals.count, data.txs)
  assert.equal(totals.received, BigInt(data.totalReceived))
  assert.equal(totals.sent, BigInt(data.totalSent))
  assert.deepEqual(checkAgainstServer(totals, data), [])
  for (const row of rows) assert.ok(row.balance >= 0n, `negative balance after ${row.txid}`)
})

test('checkAgainstServer reports a mismatch', () => {
  const problems = checkAgainstServer({ balance: 5n, received: 5n, count: 1 }, { balance: '7', totalReceived: '5', txs: 1 })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /differs/)
})

test('formatBtc is exact', () => {
  assert.equal(formatBtc(123_456_789n), '1.23456789 BTC')
  assert.equal(formatBtc(-1n), '-0.00000001 BTC')
  assert.equal(formatBtc(5n, { signed: true, unit: false }), '+0.00000005')
  assert.equal(formatBtc(2_100_000_000_000_000n), '21,000,000.00000000 BTC')
})

test('Both adds balances and row counts when transaction ids do not overlap', () => {
  const ypub = [tx('y-in', 1, [[101_000, false]], [[100_000, true]], '1000')]
  const zpub = [tx('z-in', 2, [[202_000, false]], [[200_000, true]], '2000')]
  const yHistory = buildHistory(ypub)
  const zHistory = buildHistory(zpub)
  const both = buildHistory(mergeWalletTransactions(ypub, zpub))

  assert.equal(both.totals.balance, yHistory.totals.balance + zHistory.totals.balance)
  assert.equal(both.rows.length, yHistory.rows.length + zHistory.rows.length)
})

test('Both keeps a shared txid once and unions ownership on its inputs and outputs', () => {
  const funding = tx('fund-y', 1, [[1_100, false]], [[1_000, true]], '100')
  const yShared = tx('shared', 2, [[1_000, true, 'fund-y']], [[400, false], [500, false]], '100')
  const zShared = tx('shared', 2, [[1_000, false, 'fund-y']], [[400, true], [500, false]], '100')

  const both = buildHistory(mergeWalletTransactions([yShared, funding], [zShared]))
  assert.deepEqual(both.rows.map(row => row.txid), ['fund-y', 'shared'])
  assert.equal(both.rows[1].net, -600n)
  assert.equal(both.rows[1].balance, 400n)
})

test('Both takes confirmation metadata from a confirmed copy of a shared transaction', () => {
  const pending = tx('shared', 0, [[1_000, false]], [[900, true]], '100')
  const confirmed = {
    ...pending,
    blockHeight: 7,
    blockTime: 1_700_000_007,
    blockHash: 'confirmed-block',
    confirmations: 3
  }

  const merged = mergeWalletTransactions([pending], [confirmed])
  assert.equal(merged[0].blockHeight, 7)
  assert.equal(merged[0].blockTime, 1_700_000_007)
  assert.equal(merged[0].blockHash, 'confirmed-block')
  assert.equal(merged[0].confirmations, 3)
  assert.equal(buildHistory(merged).rows[0].pending, false)
})

test('default view uses Both, the populated side, or zpub when both are empty', () => {
  assert.equal(chooseDefaultView([{ id: 'ypub', rows: [{}] }, { id: 'zpub', rows: [{}] }]), 'both')
  assert.equal(chooseDefaultView([{ id: 'ypub', rows: [{}] }, { id: 'zpub', rows: [] }]), 'ypub')
  assert.equal(chooseDefaultView([{ id: 'ypub', rows: [] }, { id: 'zpub', rows: [{}] }]), 'zpub')
  assert.equal(chooseDefaultView([{ id: 'ypub', rows: [] }, { id: 'zpub', rows: [] }]), 'zpub')
})
