const API_ROOT = '/api/token'
const cache = new Map()
const form = document.querySelector('#token-form')
const network = document.querySelector('#token-network')
const query = document.querySelector('#token-query')
const suggestions = document.querySelector('#token-suggestions')
const status = document.querySelector('#token-status')
const submit = document.querySelector('#token-submit')
const result = document.querySelector('#token-result')
let selectedId = ''
let searchTimer

function setStatus(message, state = '') { status.textContent = message; status.dataset.state = state }
async function api(parameters) {
  const key = new URLSearchParams(parameters).toString()
  if (cache.has(key)) return cache.get(key)
  const response = await fetch(`${API_ROOT}?${key}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
  if (response.status === 404) throw new Error('CoinGecko could not find that token on the selected network.')
  if (response.status === 429) throw new Error('CoinGecko is rate limiting requests. Wait a moment and try again.')
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `CoinGecko lookup failed (HTTP ${response.status}).`)
  cache.set(key, data); return data
}
function isContract(value) { return /^0x[a-f\d]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) }
function renderToken(data, contract = '') {
  const symbol = String(data.symbol || '').toUpperCase()
  document.querySelector('#token-name').textContent = data.name || 'Unknown token'
  document.querySelector('#token-symbol').textContent = symbol ? `(${symbol})` : ''
  document.querySelector('#token-network-name').textContent = `Network: ${network.options[network.selectedIndex].textContent}`
  document.querySelector('#token-id').textContent = data.id || selectedId || '—'
  document.querySelector('#token-contract').textContent = contract || 'Native coin'
  document.querySelector('#token-rank').textContent = data.market_cap_rank ? `#${data.market_cap_rank}` : 'Not ranked'
  const image = document.querySelector('#token-image'); image.hidden = !data.image?.large; image.src = data.image?.large || data.image?.small || ''; image.alt = data.name ? `${data.name} icon` : ''
  const geckoLink = document.querySelector('#token-gecko-link'); geckoLink.href = `https://www.coingecko.com/en/coins/${encodeURIComponent(data.id)}`
  result.hidden = false
}
async function lookup() {
  const value = query.value.trim()
  selectedId = selectedId || ''
  if (!value) return api({ kind: 'native', network: network.value }).then(data => renderToken(data))
  if (selectedId && !isContract(value)) return api({ kind: 'coin', id: selectedId }).then(data => renderToken(data))
  if (isContract(value) && network.value === 'solana') throw new Error('Solana contract lookup is not available through this CoinGecko endpoint. Search by CoinGecko name or ID.')
  if (isContract(value) && value.startsWith('0x')) return api({ kind: 'contract', network: network.value, contract: value }).then(data => renderToken(data, value))
  const search = await api({ kind: 'search', q: value })
  const match = search.coins?.find(item => item.id === value.toLowerCase()) || search.coins?.[0]
  if (!match) throw new Error('No CoinGecko token matched that name or ID.')
  selectedId = match.id
  const data = await api({ kind: 'coin', id: match.id })
  renderToken(data)
}
form.addEventListener('submit', async event => { event.preventDefault(); suggestions.hidden = true; result.hidden = true; submit.disabled = true; setStatus('Looking up token…'); try { await lookup(); setStatus('Token metadata loaded.', 'success') } catch (error) { setStatus(error.name === 'TimeoutError' ? 'CoinGecko took too long to respond. Try again.' : error.message, 'error') } finally { submit.disabled = false } })
query.addEventListener('input', () => { selectedId = ''; clearTimeout(searchTimer); const value = query.value.trim(); suggestions.hidden = true; if (value.length < 2 || isContract(value)) return; searchTimer = setTimeout(async () => { try { const data = await api({ kind: 'search', q: value }); suggestions.replaceChildren(...(data.coins || []).slice(0, 6).map(item => { const li = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = `${item.name} (${String(item.symbol || '').toUpperCase()})`; const meta = document.createElement('span'); meta.className = 'token-suggestion-meta'; meta.textContent = item.id; button.append(meta); button.addEventListener('click', () => { selectedId = item.id; query.value = item.id; suggestions.hidden = true }); li.append(button); return li })); suggestions.hidden = suggestions.children.length === 0 } catch { /* Search errors appear on submit to keep typing quiet. */ } }, 350) })
network.addEventListener('change', () => { selectedId = ''; result.hidden = true })
document.querySelector('#token-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(document.querySelector('#token-contract').textContent); setStatus('Contract copied to clipboard.', 'success') } catch { setStatus('Copy failed — select the contract manually.', 'error') } })
document.querySelector('#token-clear').addEventListener('click', () => { form.reset(); selectedId = ''; suggestions.hidden = true; result.hidden = true; setStatus(''); query.focus() })
