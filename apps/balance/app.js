import { parseExtendedPublicKey } from './key.js'
import { buildHistory, checkAgainstServer, formatBtc } from './history.js'
import { toCsv } from './csv.js'
import { fetchUsdRates, minuteKey, satsToUsd } from './rates.js'
import { btcSeries, sampleTimes, usdSeries } from './chart-data.js'
import { createChart } from './chart.js'
import { fetchAccount } from './blockbook.js'
import { SERVERS } from './servers.js'

const $ = id => document.getElementById(id)
const form = $('lookup')
const keyInput = $('key')
const serverSelect = $('server')
const submitButton = $('submit')
const errorBox = $('error')
const checksBox = $('checks')
const loading = $('loading')
const result = $('result')
const newestFirst = $('newest-first')
const tbody = $('history-body')

const EXPLORER_TX = 'https://mempool.space/tx/'

let current = null // { rows, host, keyPrefix, summary, samples?, priceNow? }
let lookupId = 0 // ignores price results from a lookup that was replaced
let chartUnit = 'btc'

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
function formatUsd (value, { signed = false } = {}) {
  if (value == null) return ''
  const text = usdFormat.format(value)
  return signed && value > 0 ? `+${text}` : text
}

const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const chart = createChart($('chart'), {
  formatAxis (value, step) {
    if (chartUnit === 'usd') {
      if (step >= 1000) return usdCompact.format(value)
      return step >= 1 ? usdWhole.format(value) : usdFormat.format(value)
    }
    const decimals = Math.min(8, Math.max(0, Math.ceil(-Math.log10(step))))
    return value.toFixed(decimals)
  },
  formatTooltip (anchor) {
    const lines = [formatLocalTime(anchor.t)]
    const value = chartUnit === 'usd' ? formatUsd(anchor.v) : formatBtc(anchor.sats)
    if (chartUnit === 'usd') lines.push(formatBtc(anchor.sats))
    else if (anchor.price != null) lines.push(`≈ ${formatUsd(satsToUsd(anchor.sats, anchor.price))} then`)
    if (anchor.price != null) lines.push(`BTC price ${formatUsd(anchor.price)}`)
    if (anchor.row) {
      lines.push(`${anchor.row.type} ${formatBtc(anchor.row.net, { signed: true })}`)
      lines.push('Click to find in table')
    }
    return { value, lines }
  },
  onSelect (anchor) {
    if (anchor.row) selectRow(anchor.row.txid)
  }
})

/** Scrolls the table to a transaction and highlights it briefly. */
function selectRow (txid) {
  const tr = tbody.querySelector(`tr[data-txid="${txid}"]`)
  if (!tr) return
  tr.scrollIntoView({ block: 'center', behavior: 'smooth' })
  tr.classList.add('flash')
  setTimeout(() => tr.classList.remove('flash'), 2000)
}

function updateChart () {
  const usdReady = current?.samples != null
  if (chartUnit === 'usd' && !usdReady) chartUnit = 'btc'
  document.querySelectorAll('.segmented button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.unit === chartUnit))
    if (b.dataset.unit === 'usd') b.disabled = !usdReady
  })
  if (!current) return
  const now = Math.floor(Date.now() / 1000)
  if (chartUnit === 'usd') {
    chart.setSeries(usdSeries(current.rows, current.samples, now, current.priceNow), 'Wallet balance in USD over time')
    $('chart-caption').textContent = 'What the wallet was worth over time, at the BTC price at each moment. Hover or tap for details; click a transaction to find it in the list.'
  } else {
    chart.setSeries(btcSeries(current.rows, now), 'Wallet balance in BTC over time')
    $('chart-caption').textContent = 'Wallet balance after each transaction. Hover or tap for details; click a transaction to find it in the list.'
  }
}

function renderStats (dl, entries) {
  dl.replaceChildren(...entries.map(([label, value]) => {
    const div = document.createElement('div')
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = label
    dd.textContent = value
    div.append(dt, dd)
    return div
  }))
}

const pad = n => String(n).padStart(2, '0')
function formatLocalTime (unixSeconds) {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// label: column name, shown beside the value in the mobile card layout.
function cell (text, className, label) {
  const td = document.createElement('td')
  td.textContent = text
  if (className) td.className = className
  if (label) td.dataset.label = label
  return td
}

function renderTable () {
  const rows = newestFirst.checked ? [...current.rows].reverse() : current.rows
  const fragment = document.createDocumentFragment()
  for (const row of rows) {
    const tr = document.createElement('tr')
    tr.dataset.txid = row.txid
    if (row.pending) tr.className = 'pending'

    const date = cell(formatLocalTime(row.time), 'c-date')
    date.title = new Date(row.time * 1000).toISOString()

    const txidCell = cell('', 'mono c-txid', 'Txid')
    const link = document.createElement('a')
    link.href = EXPLORER_TX + row.txid
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = `${row.txid.slice(0, 8)}…${row.txid.slice(-6)}`
    link.title = row.txid
    txidCell.append(link)

    const notes = []
    if (row.pending) notes.push('Unconfirmed')
    if (row.mixedInputs) notes.push('Inputs from other wallets')
    if (row.price === null) notes.push('No USD price for this time')

    // row.price: undefined while loading, null when unavailable.
    const usd = sats => row.price == null ? '' : formatUsd(satsToUsd(sats, row.price), { signed: true })

    // Only the USD movement is emphasized; BTC detail stays muted.
    tr.append(
      date,
      cell(usd(row.net), `num c-usd ${row.net < 0n ? 'neg' : 'pos'}`),
      cell(row.type, 'muted c-type', 'Type'),
      cell(row.price == null ? '' : formatUsd(satsToUsd(row.balance, row.price)), 'num strong c-usdbal', 'USD Balance'),
      cell(formatBtc(row.balance, { unit: false }), 'num muted c-detail', 'BTC Balance'),
      cell(formatBtc(row.net, { signed: true, unit: false }), 'num muted c-detail', 'Change in BTC'),
      cell(row.price == null ? '' : formatUsd(row.price), 'num muted c-detail', 'BTC Price'),
      txidCell,
      cell(notes.join(', '), 'note c-note')
    )
    fragment.append(tr)
  }
  tbody.replaceChildren(fragment)
}

function downloadCsv () {
  const blob = new Blob([toCsv(current.rows)], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `btc-balance-history-${current.keyPrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Fetches USD prices for every row, then re-renders. Never blocks the BTC table. */
async function loadPrices (id, totals) {
  const usdStatus = $('usd-status')
  const now = Math.floor(Date.now() / 1000)
  const nowKey = minuteKey(now)
  const keys = current.rows.map(row => minuteKey(row.time))
  // Evenly spaced prices so the USD chart follows the price between transactions.
  const sampleAt = sampleTimes(current.rows[0].time, now)
  const sampleKeys = sampleAt.map(t => minuteKey(t))
  usdStatus.className = 'muted small'
  usdStatus.textContent = 'Loading USD prices from Edge\'s rates server…'
  usdStatus.hidden = false
  try {
    const rates = await fetchUsdRates([...keys, ...sampleKeys, nowKey], {
      onProgress: (done, total) => {
        if (id === lookupId && total > 1) usdStatus.textContent = `Loading USD prices… ${done} of ${total} batches`
      }
    })
    if (id !== lookupId) return
    current.rows.forEach((row, i) => { row.price = rates.get(keys[i]) })

    const priceNow = rates.get(nowKey)
    current.samples = sampleAt.map((t, i) => ({ t, price: rates.get(sampleKeys[i]) }))
    current.priceNow = priceNow
    updateChart()
    const missing = current.rows.filter(row => row.price === null).length
    const valueNow = priceNow == null ? 'n/a' : formatUsd(satsToUsd(totals.balance, priceNow))
    renderStats($('summary'), current.summary.map(([label, value]) => [label, label === 'Value now' ? valueNow : value]))
    renderStats($('status'), [...current.technical, ['BTC price now', priceNow == null ? 'n/a' : formatUsd(priceNow)]])
    usdStatus.hidden = missing === 0
    usdStatus.className = 'warn-box'
    usdStatus.textContent = `${missing} transaction(s) have no USD price for their time (the rates server has no data that far back).`
    renderTable()
  } catch (err) {
    if (id !== lookupId) return
    renderStats($('summary'), current.summary.map(([label, value]) => [label, label === 'Value now' ? 'n/a' : value]))
    usdStatus.className = 'error'
    usdStatus.textContent = `USD prices unavailable: ${err.message}. BTC amounts above are unaffected.`
  }
}

function showError (message) {
  errorBox.textContent = message
  errorBox.hidden = false
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  errorBox.hidden = true
  checksBox.hidden = true
  result.hidden = true
  $('usd-status').hidden = true
  const id = ++lookupId

  const parsed = await parseExtendedPublicKey(keyInput.value)
  if (!parsed.ok) return showError(parsed.error)

  const host = serverSelect.value
  submitButton.disabled = true
  loading.hidden = false
  try {
    loading.textContent = 'Connecting…'
    const { server, info, transactions } = await fetchAccount(host, parsed.key, {
      onPage: (page, total) => {
        loading.textContent = total ? `Loading transactions, page ${page} of ${total}…` : 'Loading transactions…'
      }
    })
    if (id !== lookupId) return
    const { rows, totals } = buildHistory(transactions)
    const summary = [
      ['Current balance', formatBtc(totals.balance)],
      ['Value now', 'Loading…'],
      ['Total received', formatBtc(totals.received)],
      ['Total sent (incl. fees)', formatBtc(totals.sent)],
      ['Transactions', totals.count.toLocaleString('en-US')]
    ]
    const technical = [
      ['Key type', `${parsed.prefix}: ${parsed.format}`],
      ['Fees paid', formatBtc(totals.fees)],
      ['Unconfirmed transactions', String(rows.filter(r => r.pending).length)],
      ['Used addresses', String(info.usedTokens ?? 'n/a')],
      ['Server', host],
      ['Blockbook version', server.version ?? 'n/a'],
      ['Best height', server.bestHeight?.toLocaleString('en-US') ?? 'n/a'],
      ['Bitcoin node', server.backend?.subversion?.replaceAll('/', '') ?? 'n/a']
    ]
    current = { rows, host, keyPrefix: parsed.prefix, summary, technical }
    renderStats($('summary'), summary)
    renderStats($('status'), technical)

    const problems = checkAgainstServer(totals, info)
    checksBox.className = problems.length ? 'error' : 'ok'
    checksBox.textContent = problems.length
      ? `Check failed: ${problems.join(' ')}`
      : `✓ Verified: these transactions add up exactly to the wallet's current balance on the Bitcoin network (${formatBtc(totals.balance)}).`
    checksBox.hidden = false

    $('history-empty').hidden = rows.length > 0
    $('history-wrap').hidden = rows.length === 0
    $('csv').disabled = rows.length === 0
    renderTable()
    $('chart').hidden = rows.length === 0
    updateChart()
    result.hidden = false
    if (rows.length > 0) loadPrices(id, totals)
  } catch (err) {
    showError(err.message)
  } finally {
    submitButton.disabled = false
    loading.hidden = true
  }
})

keyInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    form.requestSubmit()
  }
})
newestFirst.addEventListener('change', () => { if (current) renderTable() })
document.querySelectorAll('.segmented button').forEach(button => {
  button.addEventListener('click', () => {
    chartUnit = button.dataset.unit
    updateChart()
  })
})
$('csv').addEventListener('click', () => { if (current) downloadCsv() })

serverSelect.replaceChildren(...SERVERS.map(s => new Option(s.label, s.host)))
