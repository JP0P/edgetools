const API_ROOT = '/api/token'
const cache = new Map()
const form = document.querySelector('#token-form')
const network = document.querySelector('#token-network')
const query = document.querySelector('#token-query')
const suggestions = document.querySelector('#token-suggestions')
const status = document.querySelector('#token-status')
const submit = document.querySelector('#token-submit')
const result = document.querySelector('#token-result')
const resultHeading = document.querySelector('#token-result-heading')
const tokenId = document.querySelector('#token-id')
const contractRow = document.querySelector('#token-contract-row')
const contractValue = document.querySelector('#token-contract')
const explorerLink = document.querySelector('#token-explorer-link')
let selectedId = ''
let searchTimer
let lookupVersion = 0
let searchVersion = 0

const explorerRoots = {
  ethereum: 'https://etherscan.io/token/',
  'polygon-pos': 'https://polygonscan.com/token/',
  'binance-smart-chain': 'https://bscscan.com/token/',
  'arbitrum-one': 'https://arbiscan.io/token/',
  'optimistic-ethereum': 'https://optimistic.etherscan.io/token/',
  base: 'https://basescan.org/token/',
  avalanche: 'https://snowtrace.io/token/',
  solana: 'https://solscan.io/token/'
}

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
function resetResult() {
  result.hidden = true
  tokenId.textContent = ''
  contractValue.textContent = ''
  contractRow.hidden = true
  explorerLink.hidden = true
  explorerLink.removeAttribute('href')
}
function renderToken(data, contract = '') {
  const symbol = String(data.symbol || '').toUpperCase()
  document.querySelector('#token-name').textContent = data.name || 'Unknown token'
  document.querySelector('#token-symbol').textContent = symbol ? `(${symbol})` : ''
  document.querySelector('#token-network-name').textContent = `Network: ${network.options[network.selectedIndex].textContent}`
  tokenId.textContent = data.id || selectedId || '—'
  contractValue.textContent = contract
  contractRow.hidden = !contract
  const explorerRoot = explorerRoots[network.value]
  explorerLink.hidden = !contract || !explorerRoot
  if (contract && explorerRoot) explorerLink.href = `${explorerRoot}${encodeURIComponent(contract)}`
  document.querySelector('#token-rank').textContent = data.market_cap_rank ? `#${data.market_cap_rank}` : 'Not ranked'
  const image = document.querySelector('#token-image'); image.hidden = !data.image?.large; image.src = data.image?.large || data.image?.small || ''; image.alt = data.name ? `${data.name} icon` : ''
  const geckoLink = document.querySelector('#token-gecko-link'); geckoLink.href = `https://www.coingecko.com/en/coins/${encodeURIComponent(data.id)}`
  result.hidden = false
  resultHeading.focus()
}
function assertCurrent(version) {
  if (version !== lookupVersion) throw new DOMException('Lookup superseded.', 'AbortError')
}
async function lookup(version) {
  const value = query.value.trim()
  selectedId = selectedId || ''
  if (!value) {
    const data = await api({ kind: 'native', network: network.value })
    assertCurrent(version); renderToken(data); return
  }
  if (selectedId && !isContract(value)) {
    const data = await api({ kind: 'coin', id: selectedId })
    assertCurrent(version); renderToken(data); return
  }
  if (isContract(value) && network.value === 'solana') throw new Error('Solana contract lookup is not available through this CoinGecko endpoint. Search by CoinGecko name or ID.')
  if (isContract(value) && value.startsWith('0x')) {
    const data = await api({ kind: 'contract', network: network.value, contract: value })
    assertCurrent(version); renderToken(data, value); return
  }
  const search = await api({ kind: 'search', q: value })
  assertCurrent(version)
  const match = search.coins?.find(item => item.id === value.toLowerCase()) || search.coins?.[0]
  if (!match) throw new Error('No CoinGecko token matched that name or ID.')
  selectedId = match.id
  const data = await api({ kind: 'coin', id: match.id })
  assertCurrent(version)
  renderToken(data)
}
form.addEventListener('submit', async event => { event.preventDefault(); const version = ++lookupVersion; suggestions.hidden = true; resetResult(); submit.disabled = true; setStatus('Looking up token…'); try { await lookup(version); if (version === lookupVersion) setStatus('Token metadata loaded.', 'success') } catch (error) { if (error.name === 'AbortError' || version !== lookupVersion) return; resetResult(); setStatus(error.name === 'TimeoutError' ? 'CoinGecko took too long to respond. Try again.' : error.message, 'error') } finally { if (version === lookupVersion) submit.disabled = false } })
query.addEventListener('input', () => { selectedId = ''; lookupVersion += 1; submit.disabled = false; const version = ++searchVersion; resetResult(); setStatus(''); clearTimeout(searchTimer); const value = query.value.trim(); suggestions.hidden = true; if (value.length < 2 || isContract(value)) return; searchTimer = setTimeout(async () => { try { const data = await api({ kind: 'search', q: value }); if (version !== searchVersion || query.value.trim() !== value) return; suggestions.replaceChildren(...(data.coins || []).slice(0, 6).map(item => { const li = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = `${item.name} (${String(item.symbol || '').toUpperCase()})`; const meta = document.createElement('span'); meta.className = 'token-suggestion-meta'; meta.textContent = item.id; button.append(meta); button.addEventListener('click', () => { selectedId = item.id; query.value = item.id; suggestions.hidden = true; resetResult(); setStatus('') }); li.append(button); return li })); suggestions.hidden = suggestions.children.length === 0 } catch { /* Search errors appear on submit to keep typing quiet. */ } }, 350) })
network.addEventListener('change', () => { selectedId = ''; lookupVersion += 1; searchVersion += 1; submit.disabled = false; resetResult(); setStatus('') })
async function copyValue(value, label) { try { await navigator.clipboard.writeText(value); setStatus(`${label} copied to clipboard.`, 'success') } catch { setStatus(`Copy failed — select the ${label.toLowerCase()} manually.`, 'error') } }
document.querySelector('#token-copy-id').addEventListener('click', () => copyValue(tokenId.textContent, 'CoinGecko ID'))
document.querySelector('#token-copy-contract').addEventListener('click', () => copyValue(contractValue.textContent, 'Contract address'))
document.querySelector('#token-clear').addEventListener('click', () => { lookupVersion += 1; searchVersion += 1; form.reset(); selectedId = ''; suggestions.hidden = true; resetResult(); setStatus(''); query.focus() })
