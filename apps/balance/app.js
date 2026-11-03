import { parseExtendedPublicKey } from './key.js'
import { buildHistory, checkAgainstServer, chooseDefaultView, formatBtc, mergeWalletTransactions } from './history.js'
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
const viewTabs = $('view-tabs')

const EXPLORER_TX = 'https://mempool.space/tx/'
const VIEW_ORDER = { zpub: 0, ypub: 1, xpub: 2 }

let current = null // { views, sideViews, selected, samples?, priceNow?, priceLoaded?, priceError? }
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

const activeView = () => current?.views.get(current.selected)

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
  const view = activeView()
  const usdReady = current?.priceLoaded === true
  if (chartUnit === 'usd' && !usdReady) chartUnit = 'btc'
  document.querySelectorAll('.chart-units button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.unit === chartUnit))
    if (button.dataset.unit === 'usd') button.disabled = !usdReady
  })
  if (!view || view.rows.length === 0) return
  const now = Math.floor(Date.now() / 1000)
  if (chartUnit === 'usd') {
    chart.setSeries(usdSeries(view.rows, current.samples, now, current.priceNow), 'Wallet balance in USD over time')
    $('chart-caption').textContent = 'What the wallet was worth over time, at the BTC price at each moment. Hover or tap for details; click a transaction to find it in the list.'
  } else {
    chart.setSeries(btcSeries(view.rows, now), 'Wallet balance in BTC over time')
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
  const view = activeView()
  const rows = newestFirst.checked ? [...view.rows].reverse() : view.rows
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
  const view = activeView()
  const blob = new Blob([toCsv(view.rows)], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `btc-balance-history-${view.id}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function summaryFor (view) {
  let valueNow = view.rows.length === 0 ? 'n/a' : 'Loading…'
  if (current.priceLoaded) valueNow = current.priceNow == null ? 'n/a' : formatUsd(satsToUsd(view.totals.balance, current.priceNow))
  if (current.priceError) valueNow = 'n/a'
  return [
    ['Current balance', formatBtc(view.totals.balance)],
    ['Value now', valueNow],
    ['Total received', formatBtc(view.totals.received)],
    ['Total sent (incl. fees)', formatBtc(view.totals.sent)],
    ['Transactions', view.totals.count.toLocaleString('en-US')]
  ]
}

function renderUsdStatus (view) {
  const usdStatus = $('usd-status')
  if (current.priceError) {
    usdStatus.hidden = false
    usdStatus.className = 'error'
    usdStatus.textContent = `USD prices unavailable: ${current.priceError}. BTC amounts above are unaffected.`
    return
  }
  if (!current.priceLoaded) return
  const missing = view.rows.filter(row => row.price === null).length
  usdStatus.hidden = missing === 0
  usdStatus.className = 'warn-box'
  usdStatus.textContent = `${missing} transaction(s) have no USD price for their time (the rates server has no data that far back).`
}

function renderSelectedView () {
  const view = activeView()
  viewTabs.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view.id))
  })
  renderStats($('summary'), summaryFor(view))
  const technical = current.priceLoaded
    ? [...view.technical, ['BTC price now', current.priceNow == null ? 'n/a' : formatUsd(current.priceNow)]]
    : view.technical
  renderStats($('status'), technical)

  const hasRows = view.rows.length > 0
  $('history-empty').hidden = hasRows
  $('history-wrap').hidden = !hasRows
  $('csv').disabled = !hasRows
  $('chart').hidden = !hasRows
  $('chart-caption').hidden = !hasRows
  if (hasRows) renderTable()
  else tbody.replaceChildren()
  $('usd-status').hidden = true
  renderUsdStatus(view)
  updateChart()
}

function viewNames (id, parsed) {
  if (id === 'both') return { long: 'Both', short: 'Both' }
  const long = parsed.format.replace(/, addresses.*\)/, ')')
  return { long, short: parsed.prefix }
}

function renderViewTabs () {
  if (current.sideViews.length < 2) {
    viewTabs.hidden = true
    viewTabs.replaceChildren()
    return
  }
  const ordered = [...current.sideViews].sort((a, b) => VIEW_ORDER[a.id] - VIEW_ORDER[b.id])
  const views = [current.views.get('both'), ...ordered]
  viewTabs.replaceChildren(...views.map(view => {
    const names = viewNames(view.id, view.parsed)
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.view = view.id
    button.setAttribute('aria-pressed', String(view.id === current.selected))
    button.setAttribute('aria-label', names.long)
    const long = document.createElement('span')
    long.className = 'tab-long'
    long.textContent = names.long
    const short = document.createElement('span')
    short.className = 'tab-short'
    short.textContent = names.short
    button.append(long, short)
    return button
  }))
  viewTabs.hidden = false
}

function renderChecks (accounts) {
  checksBox.replaceChildren(...accounts.map(account => {
    const problems = checkAgainstServer(account.totals, account.info)
    const line = document.createElement('p')
    line.className = problems.length ? 'error' : 'ok'
    line.textContent = problems.length
      ? `${account.parsed.prefix}: Check failed: ${problems.join(' ')}`
      : `✓ ${account.parsed.prefix} verified: these transactions add up exactly to its current balance on the Bitcoin network (${formatBtc(account.totals.balance)}).`
    return line
  }))
  checksBox.hidden = false
}

function technicalForSide (account, host) {
  return [
    ['Key type', `${account.parsed.prefix}: ${account.parsed.format}`],
    ['Fees paid', formatBtc(account.totals.fees)],
    ['Unconfirmed transactions', String(account.rows.filter(row => row.pending).length)],
    ['Used addresses', String(account.info.usedTokens ?? 'n/a')],
    ['Server', host],
    ['Blockbook version', account.server.version ?? 'n/a'],
    ['Best height', account.server.bestHeight?.toLocaleString('en-US') ?? 'n/a'],
    ['Bitcoin node', account.server.backend?.subversion?.replaceAll('/', '') ?? 'n/a']
  ]
}

function technicalForBoth (accounts, totals, rows, host) {
  const first = accounts[0]
  const usedAddresses = accounts.every(account => Number.isFinite(Number(account.info.usedTokens)))
    ? accounts.reduce((sum, account) => sum + Number(account.info.usedTokens), 0)
    : 'n/a'
  return [
    ['Key types', accounts.map(account => account.parsed.prefix).join(' + ')],
    ['Fees paid', formatBtc(totals.fees)],
    ['Unconfirmed transactions', String(rows.filter(row => row.pending).length)],
    ['Used addresses', String(usedAddresses)],
    ['Server', host],
    ['Blockbook version', first.server.version ?? 'n/a'],
    ['Best height', first.server.bestHeight?.toLocaleString('en-US') ?? 'n/a'],
    ['Bitcoin node', first.server.backend?.subversion?.replaceAll('/', '') ?? 'n/a']
  ]
}

/** Fetches one shared set of USD prices, then applies it to every view. */
async function loadPrices (id) {
  const usdStatus = $('usd-status')
  const allRows = current.sideViews.flatMap(view => view.rows)
  if (allRows.length === 0) return
  const now = Math.floor(Date.now() / 1000)
  const nowKey = minuteKey(now)
  const rowKeys = allRows.map(row => minuteKey(row.time))
  const firstTime = Math.min(...allRows.map(row => row.time))
  const sampleAt = sampleTimes(firstTime, now)
  const sampleKeys = sampleAt.map(time => minuteKey(time))
  usdStatus.className = 'muted small'
  usdStatus.textContent = 'Loading USD prices from Edge\'s rates server…'
  usdStatus.hidden = false
  try {
    const rates = await fetchUsdRates([...rowKeys, ...sampleKeys, nowKey], {
      onProgress: (done, total) => {
        if (id === lookupId && total > 1) usdStatus.textContent = `Loading USD prices… ${done} of ${total} batches`
      }
    })
    if (id !== lookupId) return
    for (const view of current.views.values()) {
      for (const row of view.rows) row.price = rates.get(minuteKey(row.time))
    }
    current.samples = sampleAt.map((time, index) => ({ t: time, price: rates.get(sampleKeys[index]) }))
    current.priceNow = rates.get(nowKey)
    current.priceLoaded = true
    renderSelectedView()
  } catch (err) {
    if (id !== lookupId) return
    current.priceError = err.message
    renderSelectedView()
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
    const accounts = await Promise.all(parsed.keys.map(async parsedKey => {
      const account = await fetchAccount(host, parsedKey.key, {
        onPage: (page, total) => {
          loading.textContent = total
            ? `Loading ${parsedKey.prefix} transactions, page ${page} of ${total}…`
            : `Loading ${parsedKey.prefix} transactions…`
        }
      })
      const history = buildHistory(account.transactions)
      return { ...account, ...history, parsed: parsedKey, id: parsedKey.prefix }
    }))
    if (id !== lookupId) return

    const sideViews = accounts.map(account => ({
      id: account.id,
      parsed: account.parsed,
      rows: account.rows,
      totals: account.totals,
      technical: technicalForSide(account, host)
    }))
    const views = new Map(sideViews.map(view => [view.id, view]))
    if (accounts.length === 2) {
      const combined = buildHistory(mergeWalletTransactions(...accounts.map(account => account.transactions)))
      views.set('both', {
        id: 'both',
        rows: combined.rows,
        totals: combined.totals,
        technical: technicalForBoth(accounts, combined.totals, combined.rows, host)
      })
    }

    current = {
      views,
      sideViews,
      selected: chooseDefaultView(sideViews),
      priceLoaded: false,
      priceError: null
    }
    renderChecks(accounts)
    renderViewTabs()
    renderSelectedView()
    result.hidden = false
    loadPrices(id)
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
document.querySelectorAll('.chart-units button').forEach(button => {
  button.addEventListener('click', () => {
    chartUnit = button.dataset.unit
    updateChart()
  })
})
viewTabs.addEventListener('click', event => {
  const button = event.target.closest('button[data-view]')
  if (!button || !current) return
  current.selected = button.dataset.view
  renderSelectedView()
})
$('csv').addEventListener('click', () => { if (current) downloadCsv() })

serverSelect.replaceChildren(...SERVERS.map(server => new Option(server.label, server.host)))
