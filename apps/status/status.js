const message = document.querySelector('#status-message')
const summary = document.querySelector('#status-summary')
const services = document.querySelector('#status-services')
const updated = document.querySelector('#status-updated')
const refresh = document.querySelector('#status-refresh')
const previousServices = new Map()
let timer

const statusLabels = {
  online: 'Healthy',
  warning: 'Degraded',
  error: 'Error',
  offline: 'Offline'
}

const accentByService = {
  Bitcoin: '#f7931a',
  'Bitcoin Cash': '#10b981',
  Dash: '#06b6d4',
  DigiByte: '#6366f1',
  Dogecoin: '#d6a11e',
  Firo: '#a855f7',
  Litecoin: '#60a5fa',
  PIVX: '#ec4899',
  Qtum: '#14b8a6',
  Vertcoin: '#8b5cf6'
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : 'Unavailable'
}

function formatSync(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Unavailable'
}

function formatAge(value) {
  if (!value) return 'Unavailable'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Unavailable'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ${minutes % 60} min ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ${hours % 24} hr ago`
}

function appendMetric(list, label, value, state, changed) {
  const row = document.createElement('div')
  row.className = 'status-metric'
  if (state) row.dataset.state = state
  if (changed) row.classList.add('status-metric-changed')
  const term = document.createElement('dt')
  const detail = document.createElement('dd')
  term.textContent = label
  detail.textContent = value
  row.append(term, detail)
  list.append(row)
}

function serviceChanged(previous, service, field) {
  return previous != null && previous[field] !== service[field]
}

function renderService(service) {
  const previous = previousServices.get(service.url)
  const article = document.createElement('article')
  article.className = 'status-service'
  article.dataset.status = service.status
  article.style.setProperty('--service-accent', accentByService[service.name] || '#08f0a1')
  if (previous != null && JSON.stringify(previous) !== JSON.stringify(service)) article.classList.add('status-service-updated')

  const header = document.createElement('header')
  header.className = 'status-service-header'
  const titleGroup = document.createElement('div')
  const heading = document.createElement('h3')
  const region = document.createElement('p')
  heading.textContent = service.name
  region.textContent = service.region || 'Region unavailable'
  titleGroup.append(heading, region)
  const state = document.createElement('span')
  state.className = 'status-state'
  state.dataset.status = service.status
  state.textContent = statusLabels[service.status] || service.status
  header.append(titleGroup, state)

  const details = document.createElement('details')
  details.className = 'status-details'
  details.open = !window.matchMedia('(max-width: 640px)').matches
  const detailsLabel = document.createElement('summary')
  detailsLabel.textContent = 'Server details'
  const metrics = document.createElement('dl')
  metrics.className = 'status-metrics'
  appendMetric(metrics, 'Coin', service.coin || service.name, null, serviceChanged(previous, service, 'coin'))
  appendMetric(metrics, 'Block height', formatNumber(service.blockHeight), null, serviceChanged(previous, service, 'blockHeight'))
  appendMetric(metrics, 'Synchronized', formatSync(service.inSync), service.inSync === false ? 'error' : service.inSync === true ? 'success' : '', serviceChanged(previous, service, 'inSync'))
  appendMetric(metrics, 'Last block', formatAge(service.lastBlockTime), null, serviceChanged(previous, service, 'lastBlockTime'))
  appendMetric(metrics, 'Mempool sync', formatSync(service.inSyncMempool), service.inSyncMempool === false ? 'error' : service.inSyncMempool === true ? 'success' : '', serviceChanged(previous, service, 'inSyncMempool'))
  appendMetric(metrics, 'Last mempool update', formatAge(service.lastMempoolTime), null, serviceChanged(previous, service, 'lastMempoolTime'))
  appendMetric(metrics, 'Version', service.version || 'Unavailable', null, serviceChanged(previous, service, 'version'))
  details.append(detailsLabel, metrics)

  const notices = document.createElement('div')
  notices.className = 'status-notices'
  for (const warning of service.warnings || []) {
    const notice = document.createElement('p')
    notice.textContent = warning
    notices.append(notice)
  }

  const link = document.createElement('a')
  link.className = 'button status-server-link'
  link.href = service.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Open xpub explorer ↗'
  link.setAttribute('aria-label', `Open ${service.name} ${service.region} xpub explorer in a new tab`)

  article.append(header, details)
  if (notices.childElementCount) article.append(notices)
  article.append(link)
  return article
}

function render(data) {
  const counts = data.services.reduce((out, service) => {
    out[service.status] = (out[service.status] || 0) + 1
    return out
  }, {})
  const summaryOrder = ['online', 'warning', 'error', 'offline']
  summary.replaceChildren(...summaryOrder.filter(state => counts[state]).map(state => {
    const pill = document.createElement('span')
    pill.className = 'status-pill'
    pill.dataset.status = state
    pill.textContent = `${counts[state]} ${statusLabels[state].toLowerCase()}`
    return pill
  }))
  services.replaceChildren(...data.services.map(renderService))
  previousServices.clear()
  for (const service of data.services) previousServices.set(service.url, service)
  updated.textContent = `Last checked ${new Date(data.generatedAt).toLocaleString()} · ${data.online} of ${data.total} services healthy or degraded.`
}

async function load() {
  refresh.disabled = true
  refresh.textContent = 'Refreshing…'
  message.textContent = 'Loading service health…'
  message.dataset.state = ''
  try {
    const response = await fetch('/api/status', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) throw new Error(`Status endpoint returned HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.services)) throw new Error('Status endpoint returned an invalid summary.')
    render(data)
    message.textContent = 'Service health loaded.'
    message.dataset.state = 'success'
  } catch (error) {
    message.textContent = error.name === 'TimeoutError' ? 'The status endpoint timed out. Try again.' : (error.message || 'Unable to load service health.')
    message.dataset.state = 'error'
  } finally {
    refresh.disabled = false
    refresh.textContent = 'Refresh now'
  }
}

refresh.addEventListener('click', load)
load()
timer = setInterval(load, 20000)
window.addEventListener('pagehide', () => clearInterval(timer), { once: true })
