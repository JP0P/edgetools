// Data for the balance-over-time chart. Pure functions, no DOM.
//
// A series is { points, anchors }:
// - points: [{ t, v }] drawn as a polyline (t = unix seconds, v = number).
// - anchors: hover/keyboard targets, [{ t, v, sats, price?, row? }].
//   row is set when the anchor is a transaction.

const toBtc = sats => Number(sats) / 1e8

/**
 * Plot times for rows (already in chain order). A block's timestamp may be
 * slightly earlier than the previous block's (Bitcoin only requires it to beat
 * the median of the last 11), so clamp to keep the x-axis moving forward.
 */
function plotTimes (rows) {
  let last = -Infinity
  return rows.map(row => (last = Math.max(last, row.time)))
}

/** Up to maxPoints evenly spaced times from start to end (inclusive). */
export function sampleTimes (start, end, maxPoints = 300) {
  if (!(end > start)) return [start]
  const step = Math.max(86_400, (end - start) / (maxPoints - 1))
  const times = []
  for (let t = start; t < end; t += step) times.push(Math.round(t))
  times.push(end)
  return times
}

/** Step line of the BTC balance: flat between transactions, vertical at each. */
export function btcSeries (rows, end) {
  if (rows.length === 0) return { points: [], anchors: [] }
  const times = plotTimes(rows)
  const points = [{ t: times[0], v: 0 }]
  const anchors = []
  let prev = 0n
  rows.forEach((row, i) => {
    const t = times[i]
    points.push({ t, v: toBtc(prev) }, { t, v: toBtc(row.balance) })
    anchors.push({ t, v: toBtc(row.balance), sats: row.balance, price: row.price ?? undefined, row })
    prev = row.balance
  })
  points.push({ t: Math.max(end, times.at(-1)), v: toBtc(prev) })
  return { points, anchors }
}

/**
 * USD value over time: the balance at each moment times the BTC price then.
 * samples: [{ t, price }] (price null when unknown). Between samples the value
 * is interpolated; at a transaction the value jumps with the balance.
 */
export function usdSeries (rows, samples, end, priceNow) {
  if (rows.length === 0) return { points: [], anchors: [] }
  const times = plotTimes(rows)
  const events = [
    ...rows.map((row, i) => ({ t: times[i], row })),
    ...samples.filter(s => s.price != null && s.t >= times[0]).map(s => ({ t: s.t, price: s.price }))
  ]
  // Stable sort keeps chain order among transactions; at the same second,
  // transactions go before samples so a sample sees the new balance.
  events.sort((a, b) => a.t - b.t || (a.row ? 0 : 1) - (b.row ? 0 : 1))

  const points = []
  const anchors = []
  let balance = 0n
  for (const e of events) {
    if (e.row) {
      const price = e.row.price
      if (price != null) {
        points.push({ t: e.t, v: toBtc(balance) * price })
        points.push({ t: e.t, v: toBtc(e.row.balance) * price })
        anchors.push({ t: e.t, v: toBtc(e.row.balance) * price, sats: e.row.balance, price, row: e.row })
      }
      balance = e.row.balance
    } else {
      const v = toBtc(balance) * e.price
      points.push({ t: e.t, v })
      anchors.push({ t: e.t, v, sats: balance, price: e.price })
    }
  }
  if (priceNow != null && end > (points.at(-1)?.t ?? 0)) {
    const v = toBtc(balance) * priceNow
    points.push({ t: end, v })
    anchors.push({ t: end, v, sats: balance, price: priceNow })
  }
  return { points, anchors }
}

/** Clean y-axis ticks from 0 to at least max: 1, 2, 2.5 or 5 × 10^n steps. */
export function niceTicks (max, count = 4) {
  if (!(max > 0)) return { ticks: [0, 1], step: 1 }
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
  const top = Math.ceil(max / step - 1e-9) * step
  const ticks = []
  for (let i = 0; i * step <= top + step / 2; i++) ticks.push(Number((i * step).toPrecision(12)))
  return { ticks, step }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Candidate x-axis intervals, smallest first.
const INTERVALS = [
  { days: 1 }, { days: 7 }, { months: 1 }, { months: 3 }, { months: 6 },
  { months: 12 }, { months: 24 }, { months: 60 }
]

/** Local-time x-axis ticks between start and end, at most maxTicks. */
export function timeTicks (start, end, maxTicks) {
  const spanDays = (end - start) / 86_400
  const interval = INTERVALS.find(i => spanDays / (i.days ?? i.months * 30.4) <= maxTicks) ?? INTERVALS.at(-1)

  const d = new Date(start * 1000)
  d.setHours(0, 0, 0, 0)
  if (interval.months >= 12) {
    // Whole years, on multiples of the step (2020, 2025, …).
    const years = interval.months / 12
    d.setFullYear(Math.ceil((d.getFullYear() + (d.getMonth() > 0 || d.getDate() > 1 ? 1 : 0)) / years) * years, 0, 1)
  } else if (interval.months) {
    d.setDate(1)
    d.setMonth(Math.ceil(d.getMonth() / interval.months) * interval.months)
  } else if (interval.days === 7) {
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7)) // next Monday
  }

  const ticks = []
  while (d.getTime() / 1000 <= end) {
    const t = d.getTime() / 1000
    if (t >= start) {
      let label
      if (interval.months >= 12) label = String(d.getFullYear())
      else if (interval.months) label = d.getMonth() === 0 || ticks.length === 0 ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : MONTHS[d.getMonth()]
      else label = `${MONTHS[d.getMonth()]} ${d.getDate()}`
      ticks.push({ t, label })
    }
    if (interval.months) d.setMonth(d.getMonth() + interval.months)
    else d.setDate(d.getDate() + interval.days)
  }
  return ticks
}

/**
 * Index of the anchor nearest to time t (anchors sorted by t). When several
 * share that time (same block), returns the last, i.e. the balance after all.
 */
export function nearestAnchor (anchors, t) {
  let lo = 0
  let hi = anchors.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (anchors[mid].t < t) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && t - anchors[lo - 1].t <= anchors[lo].t - t) lo--
  while (lo + 1 < anchors.length && anchors[lo + 1].t === anchors[lo].t) lo++
  return lo
}
