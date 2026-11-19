// Shared by browser and Worker. This prepares links; it never checks an order.
// Source revisions, coverage and limitations: docs/order-lookup.md.
const opaqueId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txHash = /^(?:0x)?[0-9a-f]{64}$/i
const solanaSignature = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/
const bridgeId = /^\d{1,10}\/0x[0-9a-f]{64}\/\d{1,10}$/i
const template = (prefix, label = 'Open order page') => ({ prefix, label })
const direct = (id, name, group, prefix, extra = {}) => ({ id, name, group, mode: 'direct', templates: [template(prefix)], ...extra })
const receipt = (id, name, group, note, extra = {}) => ({ id, name, group, mode: 'receipt', templates: [], note, ...extra })
const onChain = 'Use the network-specific explorer in your original Edge transaction. This integration does not have a separate order-tracking link here.'

// Every registration in edge-exchange-plugins/src/index.ts is represented.
// No guessed templates for integrations whose links depend on other data.
export const providers = [
  direct('bridgeless', 'Bridgeless', 'Swap', 'https://tss1.mainnet.bridgeless.com/check/', { pattern: bridgeId, structured: true, hint: bridgeId, note: 'Requires chain ID / 0x-prefixed deposit transaction / output index, not a bare transaction hash.' }),
  direct('changehero', 'ChangeHero', 'Swap', 'https://changehero.io/transaction/'),
  receipt('changelly', 'Changelly', 'Swap', 'Open the tracking link in your Edge transaction or Changelly receipt. The original link is required; an order ID alone is not enough.'),
  direct('changenow', 'ChangeNOW', 'Swap', 'https://changenow.io/exchange/txs/', { hint: /^[A-Za-z0-9]{14}$/ }),
  receipt('cosmosibc', 'Cosmos IBC', 'Swap', onChain),
  direct('exolix', 'Exolix', 'Swap', 'https://exolix.com/transaction/'),
  direct('godex', 'Godex', 'Swap', 'https://godex.io/exchange/waiting/'),
  direct('houdini', 'Houdini', 'Swap', 'https://app.houdini.com/order-details?houdiniId='),
  receipt('lifi', 'LI.FI', 'Swap', onChain),
  direct('nexchange', 'n.exchange', 'Swap', 'https://n.exchange/order/', { hint: /^[A-Z0-9]{6}$/ }),
  direct('nymswap', 'NYM', 'Swap', 'https://swap.nym.com/orderStatus/'),
  direct('rango', 'Rango Exchange', 'Swap', 'https://explorer.rango.exchange/search?query=', { note: 'Use the saved tracking ID. Some Edge transactions link by destination address instead; use the original transaction link in that case.' }),
  direct('sideshift', 'SideShift.ai', 'Swap', 'https://sideshift.ai/orders/', { hint: /^[0-9a-f]{20}$/i, note: 'Keep this ID private. Anyone with it may be able to cancel an order or choose a refund address.' }),
  receipt('spookySwap', 'SpookySwap', 'Swap', onChain),
  direct('mptrade', 'MoonPay Trade (Centralized)', 'Swap', 'https://scan.swaps.xyz/transactions/', { transaction: true }),
  direct('mptradedefi', 'MoonPay Trade (DeFi)', 'Swap', 'https://scan.swaps.xyz/transactions/', { transaction: true }),
  direct('swapter', 'Swapter', 'Swap', 'https://swapter.io/exchange-status/'),
  direct('swapuz', 'Swapuz', 'Swap', 'https://swapuz.com/order/'),
  direct('mayaprotocol', 'Maya Protocol', 'Swap', 'https://www.mayascan.org/tx/', { transaction: true, pattern: txHash }),
  direct('thorchain', 'THORChain', 'Swap', 'https://track.thorchain.org/', { transaction: true, pattern: txHash }),
  receipt('swapkit', 'SwapKit', 'Swap', onChain),
  receipt('swapkitv3', 'SwapKit V3', 'Swap', onChain),
  receipt('tombSwap', 'TombSwap', 'Swap', onChain),
  receipt('transfer', 'Transfer', 'Swap', onChain),
  receipt('unizen', 'Unizen', 'Swap', onChain),
  receipt('velodrome', 'Velodrome', 'Swap', onChain),
  direct('xgram', 'Xgram', 'Swap', 'https://xgram.io/exchange/order?id='),
  receipt('xrpdex', 'XRP DEX', 'Swap', onChain),
  receipt('fantomsonicupgrade', 'Fantom / Sonic Upgrade', 'Swap', onChain),
  receipt('0xgasless', '0x Gasless Swap', 'Swap', 'Use the original Edge transaction link. Its explorer URL depends on the source wallet network, not just the ID.'),

  direct('banxa', 'Banxa', 'Buy / sell', 'https://edge3.banxa.com/status/', { hint: /^\d{6,8}$/, note: 'For Edge orders on the default Banxa host. If your receipt has a different Banxa host, use that receipt; Banxa may require its support chatbot.' }),
  receipt('bitsofgold', 'Bits of Gold', 'Buy / sell', 'Use your Bits of Gold account or receipt and the original Edge order details. No ID-only status URL is verified.'),
  receipt('bity', 'Bity', 'Buy / sell', 'Open the order in your Bity receipt or account. If you need help, share the order ID with Bity support.', { hint: uuid }),
  receipt('dfx', 'DFX', 'Buy / sell', 'Open DFX from Edge, or use your DFX receipt or account to view the order.'),
  receipt('infinite', 'Infinite', 'Buy / sell', 'Use the original Edge transfer details or provider receipt. No public ID-only transfer page is verified.'),
  direct('kado', 'Kado', 'Buy / sell', 'https://app.kado.money/ramp/order/'),
  receipt('kadoOtc', 'Kado OTC', 'Buy / sell', 'Use your Kado OTC receipt or support contact. An OTC request is not the same as a Kado ramp order.'),
  receipt('libertyx', 'LibertyX', 'Buy / sell', 'Use your LibertyX account or receipt and the original Edge order details. No ID-only status URL is verified.'),
  direct('moonpay', 'MoonPay', 'Buy / sell', 'https://buy.moonpay.com/transaction_receipt?transactionId=', { hint: uuid, templates: [template('https://buy.moonpay.com/transaction_receipt?transactionId=', 'Open buy receipt'), template('https://sell.moonpay.com/transaction_receipt?transactionId=', 'Open sell receipt')], note: 'Choose buy or sell to match your receipt. A UUID does not establish that this is a MoonPay order.' }),
  receipt('mtpelerin', 'Mt Pelerin', 'Buy / sell', 'Use your original Mt Pelerin receipt or account to view the order.'),
  direct('paybis', 'Paybis', 'Buy / sell', 'https://widget.paybis.com/?requestId=', { note: 'Requires the Paybis request ID, which may differ from a payment/transaction ID. Paybis may require login.' }),
  receipt('revolut', 'Revolut', 'Buy / sell', 'Check your Revolut account or receipt. No public ID-only status URL is verified.'),
  receipt('simplex', 'Simplex', 'Buy / sell', 'Use the payment-status link in your Simplex email, or enter the payment ID at https://payment-status.simplex.com/.', { hint: uuid }),
  receipt('letsexchange', 'LetsExchange (legacy)', 'Legacy', 'Not registered in the current Edge exchange plugins. Use your original LetsExchange receipt; no current Edge ID-only template is verified.')
]

function linksFor(provider, id) {
  const encoded = provider.structured ? id.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(id)
  return provider.templates.map(({ prefix, label }) => ({ label, url: prefix + encoded }))
}
function resultFor(provider, id) {
  return { id: provider.id, name: provider.name, group: provider.group, mode: provider.mode, note: provider.note ?? '', links: linksFor(provider, id) }
}

// Recognize only exact allowlisted HTTPS templates. Never forward a supplied
// URL or preserve extra query parameters/fragments.
function parseTrackingUrl(raw) {
  let url
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null
  const matches = []
  for (const provider of providers) for (const { prefix } of provider.templates) {
    const base = new URL(prefix)
    if (url.origin !== base.origin) continue
    let id
    if (base.search) {
      const key = [...base.searchParams.keys()][0]
      if (url.pathname !== base.pathname || [...url.searchParams.keys()].length !== 1 || !url.searchParams.has(key)) continue
      id = url.searchParams.get(key)
    } else {
      if (url.search || !url.pathname.startsWith(base.pathname)) continue
      try { id = decodeURIComponent(url.pathname.slice(base.pathname.length)) } catch { continue }
    }
    if (!(provider.pattern ?? opaqueId).test(id)) continue
    matches.push({ provider, id })
  }
  return matches.length ? matches : null
}

export function detectTransaction(id) {
  if (txHash.test(id)) return {
    label: 'Shared blockchain hash format',
    note: 'This format is used by many networks and swap trackers. It does not identify Bitcoin, a specific EVM chain, or an exchange provider.',
    links: [{ label: 'Search public blockchain explorers', url: 'https://blockchair.com/search?q=' + encodeURIComponent(id) }]
  }
  if (solanaSignature.test(id)) return {
    label: 'Possible Solana transaction signature',
    note: 'Format only; existence and network have not been checked.',
    links: [{ label: 'Open Solana explorer', url: 'https://explorer.solana.com/tx/' + encodeURIComponent(id) }]
  }
  return null
}

export function lookupOrder(rawInput, providerId = '') {
  const empty = { matches: [], transaction: null, verified: false }
  const invalid = message => ({ ...empty, kind: 'invalid', message })
  if (typeof rawInput !== 'string' || typeof providerId !== 'string') return invalid('Input and provider must be text.')
  const raw = rawInput.trim()
  if (!raw) return { ...empty, kind: 'empty', message: 'Enter an order ID, tracking link or transaction hash.' }
  if (raw.length > 1024) return invalid('This value is too long. Paste only the order ID or its tracking link.')
  const selected = providers.find(provider => provider.id === providerId)
  if (providerId && !selected) return invalid('Choose a supported provider.')
  const isUrl = /[:/?#]/.test(raw) && !bridgeId.test(raw)
  const parsed = isUrl ? parseTrackingUrl(raw) : null
  if (isUrl && !parsed) return invalid('Unrecognized tracking link. Paste the order ID and choose its provider, or open the original receipt yourself.')
  const orderId = parsed ? parsed[0].id : raw
  if (!(bridgeId.test(orderId) || opaqueId.test(orderId))) return invalid('Paste a single order ID or supported tracking link, without spaces or extra text.')
  if (selected && parsed && !parsed.some(match => match.provider.id === selected.id)) return invalid('This tracking link belongs to a different provider. Select Auto or the provider named in the link.')
  if (selected && !(selected.pattern ?? opaqueId).test(orderId)) return invalid(selected.id === 'bridgeless' ? 'Bridgeless needs chain ID / 0x-prefixed transaction hash / output index.' : selected.pattern ? 'This tracker requires a 64-character transaction hash, optionally prefixed with 0x.' : 'This provider needs a single order ID, not a structured tracking reference.')
  const transaction = detectTransaction(orderId)
  const matches = selected ? [selected] : parsed ? parsed.map(match => match.provider) : providers.filter(provider => provider.hint?.test(orderId) || (provider.transaction && transaction && (provider.pattern ?? opaqueId).test(orderId)))
  const evidence = selected ? 'provider-selected' : parsed ? 'tracking-url' : 'format-only'
  const requiresProviderConfirmation = !selected && (evidence === 'format-only' || matches.length !== 1)
  return {
    kind: matches.length ? (requiresProviderConfirmation ? 'candidates' : 'resolved') : 'unknown',
    orderId, inputType: parsed ? 'url' : 'id', evidence, verified: false,
    requiresProviderConfirmation,
    message: evidence === 'format-only' ? 'Format is not proof of provider. Candidates are not exhaustive; choose the provider shown in Edge or your receipt.' : requiresProviderConfirmation ? 'This tracker is shared by multiple Edge integrations. Choose the venue shown in Edge; an order has not been verified.' : 'Link prepared locally. Order existence, ownership and status have not been checked.',
    transaction,
    matches: [...new Map(matches.map(provider => [provider.id, provider])).values()].map(provider => resultFor(provider, orderId))
  }
}
