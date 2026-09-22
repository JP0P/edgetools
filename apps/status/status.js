const message = document.querySelector('#status-message')
const summary = document.querySelector('#status-summary')
const services = document.querySelector('#status-services')
const updated = document.querySelector('#status-updated')
const refresh = document.querySelector('#status-refresh')
let timer

function render(data) {
  const counts = data.services.reduce((out, service) => { out[service.status] = (out[service.status] || 0) + 1; return out }, {})
  summary.replaceChildren(...Object.entries(counts).map(([state, count]) => { const pill = document.createElement('span'); pill.className = 'status-pill'; pill.dataset.status = state; pill.textContent = `${count} ${state}`; return pill }))
  services.replaceChildren(...data.services.map(service => {
    const article = document.createElement('article')
    article.className = 'status-service'
    const heading = document.createElement('h3')
    heading.textContent = service.name
    const state = document.createElement('strong')
    state.textContent = service.status
    const context = document.createElement('p')
    context.append(String(service.region ?? ''), ' · ', state)
    const height = document.createElement('p')
    height.textContent = service.blockHeight == null ? 'Block height unavailable' : `Block ${service.blockHeight}`
    article.append(heading, context, height)
    if (service.warnings?.length) {
      const details = document.createElement('details')
      const label = document.createElement('summary')
      const warnings = document.createElement('p')
      label.textContent = 'Warnings'
      warnings.textContent = service.warnings.join(' ')
      details.append(label, warnings)
      article.append(details)
    }
    return article
  }))
  updated.textContent = `Last checked ${new Date(data.generatedAt).toLocaleString()} · ${data.online} of ${data.total} services online or warning.`
}
async function load() {
  refresh.disabled = true; message.textContent = 'Loading service health…'; message.dataset.state = ''
  try { const response = await fetch('/api/status', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); if (!response.ok) throw new Error(`Status endpoint returned HTTP ${response.status}`); const data = await response.json(); if (!Array.isArray(data.services)) throw new Error('Status endpoint returned an invalid summary.'); render(data); message.textContent = 'Service health loaded.'; message.dataset.state = 'success' }
  catch (error) { message.textContent = error.name === 'TimeoutError' ? 'The status endpoint timed out. Try again.' : (error.message || 'Unable to load service health.'); message.dataset.state = 'error' }
  finally { refresh.disabled = false }
}
refresh.addEventListener('click', load)
load(); timer = setInterval(load, 20000)
window.addEventListener('pagehide', () => clearInterval(timer), { once: true })
