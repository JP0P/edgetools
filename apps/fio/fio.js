const API_URL = 'https://fio.eosusa.io/v1/chain/get_pub_address'

const networkTokens = {
  BTC: ['BTC'], ETH: ['ETH', 'USDT', 'USDC', 'DAI'], SOL: ['SOL', 'USDT', 'USDC'],
  ADA: ['ADA'], DOT: ['DOT'], AVAX: ['AVAX', 'USDT', 'USDC'], MATIC: ['MATIC', 'USDT', 'USDC'],
  BNB: ['BNB', 'USDT', 'USDC'], ATOM: ['ATOM', 'USDT', 'USDC'], ALGO: ['ALGO', 'USDT'],
  FTM: ['FTM', 'USDT', 'USDC'], NEAR: ['NEAR', 'USDT'], XTZ: ['XTZ'], FIL: ['FIL'],
  ICP: ['ICP'], FLOW: ['FLOW'], HBAR: ['HBAR'], XLM: ['XLM', 'USDT'], VET: ['VET'],
  LTC: ['LTC'], BCH: ['BCH'], EOS: ['EOS', 'USDT'], XRP: ['XRP'], TRX: ['TRX', 'USDT'],
  ETC: ['ETC'], DASH: ['DASH'], ZEC: ['ZEC'], XMR: ['XMR'], ARB: ['ETH', 'ARB', 'USDT'],
  OP: ['ETH', 'OP', 'USDT'], BASE: ['ETH', 'USDT'], ZANO: ['ZANO'], PIVX: ['PIVX'], XEC: ['XEC'], FIO: ['FIO']
}

const networkNames = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', ADA: 'Cardano', DOT: 'Polkadot', AVAX: 'Avalanche',
  MATIC: 'Polygon', BNB: 'BNB Smart Chain', ATOM: 'Cosmos', ALGO: 'Algorand', FTM: 'Fantom', NEAR: 'NEAR Protocol',
  XTZ: 'Tezos', FIL: 'Filecoin', ICP: 'Internet Computer', FLOW: 'Flow', HBAR: 'Hedera', XLM: 'Stellar', VET: 'VeChain',
  LTC: 'Litecoin', BCH: 'Bitcoin Cash', EOS: 'EOS', XRP: 'XRP Ledger', TRX: 'TRON', ETC: 'Ethereum Classic', DASH: 'Dash',
  ZEC: 'Zcash', XMR: 'Monero', ARB: 'Arbitrum', OP: 'Optimism', BASE: 'Base', ZANO: 'Zano', PIVX: 'PIVX', XEC: 'eCash', FIO: 'FIO Protocol'
}

const form = document.querySelector('#fio-form')
const handleInput = document.querySelector('#fio-handle')
const networkInput = document.querySelector('#fio-network')
const tokenInput = document.querySelector('#fio-token')
const submit = document.querySelector('#fio-submit')
const status = document.querySelector('#fio-status')
const result = document.querySelector('#fio-result')
const address = document.querySelector('#fio-address')

function setStatus(message, state = '') {
  status.textContent = message
  status.dataset.state = state
}

function fillNetworks() {
  for (const [code, name] of Object.entries(networkNames)) networkInput.add(new Option(name, code))
  networkInput.value = 'BTC'
  fillTokens()
}

function fillTokens() {
  tokenInput.replaceChildren(...(networkTokens[networkInput.value] ?? [networkInput.value]).map(token => new Option(token, token)))
}

async function resolveHandle(handle, chainCode, tokenCode) {
  const response = await fetch(API_URL, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fio_address: handle, chain_code: chainCode, token_code: tokenCode }),
    signal: AbortSignal.timeout(12000)
  })
  let data = {}
  try { data = await response.json() } catch { throw new Error('The FIO service returned an invalid response.') }
  if (!response.ok || !data.public_address) {
    if (response.status === 404 || data.message === 'Public address not found') {
      throw new Error(`No ${tokenCode} address is registered for ${handle} on ${networkNames[chainCode]}.`)
    }
    throw new Error(data.message || `FIO lookup failed (HTTP ${response.status}).`)
  }
  return data.public_address
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const handle = handleInput.value.trim()
  result.hidden = true
  if (!/^[^@\s]+@[^@\s]+$/.test(handle)) { setStatus('Enter a valid FIO Handle in the format name@domain.', 'error'); handleInput.focus(); return }
  submit.disabled = true
  setStatus('Resolving address…')
  try {
    const value = await resolveHandle(handle, networkInput.value, tokenInput.value)
    address.textContent = value
    result.hidden = false
    setStatus('Address resolved.', 'success')
  } catch (error) {
    setStatus(error.name === 'TimeoutError' ? 'The FIO service took too long to respond. Try again.' : (error.message || 'Unable to resolve this handle.'), 'error')
  } finally { submit.disabled = false }
})

document.querySelector('#fio-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(address.textContent); setStatus('Address copied to clipboard.', 'success') }
  catch { setStatus('Copy failed — select the address manually.', 'error') }
})
networkInput.addEventListener('change', fillTokens)
document.querySelector('#fio-clear').addEventListener('click', () => { form.reset(); networkInput.value = 'BTC'; fillTokens(); result.hidden = true; address.textContent = ''; setStatus(''); handleInput.focus() })
fillNetworks()
