import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { btcSeries, nearestAnchor, niceTicks, sampleTimes, timeTicks, usdSeries } from '../../apps/balance/chart-data.js'
import { buildHistory } from '../../apps/balance/history.js'

const DAY = 86_400
const row = (time, balance, net, price) => ({ time, balance, net, price, type: net < 0n ? 'Out' : 'In', txid: `t${time}` })

test('btcSeries draws a step line ending at "now"', () => {
  const rows = [row(100, 50_000_000n, 50_000_000n), row(200, 20_000_000n, -30_000_000n)]
  const { points, anchors } = btcSeries(rows, 500)
  assert.deepEqual(points, [
    { t: 100, v: 0 }, { t: 100, v: 0 }, { t: 100, v: 0.5 },
    { t: 200, v: 0.5 }, { t: 200, v: 0.2 },
    { t: 500, v: 0.2 }
  ])
  assert.deepEqual(anchors.map(a => [a.t, a.sats]), [[100, 50_000_000n], [200, 20_000_000n]])
})

test('usdSeries values the balance at each sample price and jumps at transactions', () => {
  const rows = [row(100, 100_000_000n, 100_000_000n, 10_000), row(300, 50_000_000n, -50_000_000n, 30_000)]
  const samples = [{ t: 50, price: 9_000 }, { t: 200, price: 20_000 }, { t: 250, price: null }, { t: 400, price: 40_000 }]
  const { points, anchors } = usdSeries(rows, samples, 500, 50_000)
  assert.deepEqual(points, [
    { t: 100, v: 0 }, { t: 100, v: 10_000 }, // buy 1 BTC at $10k
    { t: 200, v: 20_000 }, // price doubles
    { t: 300, v: 30_000 }, { t: 300, v: 15_000 }, // sell half at $30k
    { t: 400, v: 20_000 },
    { t: 500, v: 25_000 } // now
  ])
  // Sample before the first transaction and the unpriced sample are skipped.
  assert.equal(anchors.length, 5)
  assert.ok(anchors[0].row && anchors[2].row)
})

test('a block timestamp earlier than the previous block keeps chain order', () => {
  // Second block's timestamp is 12s earlier (valid in Bitcoin).
  const rows = [row(1000, 100_000_000n, 100_000_000n, 10_000), row(988, 0n, -100_000_000n, 10_000)]
  const usd = usdSeries(rows, [], 2000, 10_000)
  assert.deepEqual(usd.anchors.filter(a => a.row).map(a => a.row.txid), ['t1000', 't988'])
  assert.equal(usd.anchors.at(-1).v, 0)
  const btc = btcSeries(rows, 2000)
  assert.deepEqual(btc.anchors.map(a => a.t), [1000, 1000])
})

test('sampleTimes spans the range with at most maxPoints, at least a day apart', () => {
  const times = sampleTimes(0, 1000 * DAY, 300)
  assert.ok(times.length <= 300)
  assert.equal(times[0], 0)
  assert.equal(times.at(-1), 1000 * DAY)
  assert.equal(sampleTimes(0, 10 * DAY, 300).length, 11)
})

test('niceTicks uses clean steps from zero', () => {
  assert.deepEqual(niceTicks(0.00016734), { ticks: [0, 0.00005, 0.0001, 0.00015, 0.0002], step: 0.00005 })
  assert.deepEqual(niceTicks(1234).ticks, [0, 500, 1000, 1500])
  assert.deepEqual(niceTicks(0).ticks, [0, 1])
})

test('timeTicks picks a readable interval', () => {
  const start = new Date(2019, 11, 13).getTime() / 1000
  const end = new Date(2026, 9, 28).getTime() / 1000
  const ticks = timeTicks(start, end, 9)
  assert.ok(ticks.length <= 9 && ticks.length >= 3)
  assert.ok(ticks.every(t => /^\d{4}$/.test(t.label)))

  // Narrow (phone) chart: multi-year steps still land on round years.
  assert.deepEqual(timeTicks(start, end, 3).map(t => t.label), ['2020', '2025'])

  const month = timeTicks(new Date(2026, 0, 5).getTime() / 1000, new Date(2026, 5, 20).getTime() / 1000, 8)
  assert.deepEqual(month.map(t => t.label), ['Feb 2026', 'Mar', 'Apr', 'May', 'Jun'])
})

test('nearestAnchor snaps to the closest time and to the last of a block', () => {
  const anchors = [{ t: 10 }, { t: 20 }, { t: 20 }, { t: 40 }]
  assert.equal(nearestAnchor(anchors, 0), 0)
  assert.equal(nearestAnchor(anchors, 18), 2)
  assert.equal(nearestAnchor(anchors, 31), 3)
  assert.equal(nearestAnchor(anchors, 99), 3)
})

test('real data: BTC series never dips below zero and ends at the final balance', () => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/bip84-test-vector.json', import.meta.url)))
  const { rows, totals } = buildHistory(data.transactions)
  const { points, anchors } = btcSeries(rows, Math.floor(Date.now() / 1000))
  assert.ok(points.every(p => p.v >= 0))
  assert.equal(anchors.at(-1).sats, totals.balance)
  for (let i = 1; i < points.length; i++) assert.ok(points[i].t >= points[i - 1].t, 'times must not go backwards')
})
