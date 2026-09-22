export const partners = {
  banxa: { name: 'Banxa', pattern: /^\d{6,8}$/, url: 'https://edge3.banxa.com/status/', description: 'Cryptocurrency payment processor', note: 'Use the Banxa support chatbot to view order status.' },
  paybis: { name: 'Paybis', pattern: /^PB[A-Z0-9]{10,15}$/i, url: 'https://onramp.payb.is/?requestId=', description: 'Cryptocurrency payment processor', note: 'Paybis may require login to view order status.' },
  moonpay: { name: 'Moonpay', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, url: 'https://buy.moonpay.com/transaction_receipt?transactionId=', description: 'Cryptocurrency payment processor' },
  simplex: { name: 'Simplex', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, url: 'https://payment-status.simplex.com/?#/payment/', description: 'Cryptocurrency payment processor' },
  changenow: { name: 'ChangeNow', pattern: /^[a-zA-Z0-9]{14}$/, url: 'https://changenow.io/exchange/', description: 'Cryptocurrency exchange service' },
  letsexchange: { name: 'LetsExchange', pattern: /^[a-zA-Z0-9]{14}$/, url: 'https://letsexchange.io/exchange/', description: 'Cryptocurrency exchange service' },
  bity: { name: 'Bity', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, url: 'https://sophia.bity.com/?id=', description: 'Swiss crypto exchange & payment processor' }
}

export const cryptoPatterns = {
  evm: { name: 'Ethereum / EVM Network', pattern: /^0x[0-9a-fA-F]{64}$/, description: 'EVM-compatible blockchain transaction', explorer: id => `https://blockchair.com/search?q=${encodeURIComponent(id)}` },
  bitcoin: { name: 'Bitcoin', pattern: /^[0-9a-fA-F]{64}$/, description: 'Bitcoin transaction', explorer: id => `https://blockchair.com/bitcoin/transaction/${encodeURIComponent(id)}` },
  solana: { name: 'Solana', pattern: /^[1-9A-HJ-NP-Za-km-z]{87,88}$/, description: 'Solana transaction', explorer: id => `https://blockchair.com/solana/transaction/${encodeURIComponent(id)}` }
}

export function detectCryptoTransaction(id) {
  for (const [type, definition] of Object.entries(cryptoPatterns)) if (definition.pattern.test(id)) return { type, ...definition, txId: id }
  return null
}

export function findMatchingPartners(id) {
  return Object.entries(partners).filter(([, partner]) => partner.pattern.test(id)).map(([key, partner]) => ({ key, ...partner }))
}

export function lookupOrder(rawId) {
  const orderId = rawId.trim()
  if (!orderId) return { kind: 'empty', matches: [] }
  const crypto = detectCryptoTransaction(orderId)
  if (crypto) return { kind: 'crypto', orderId, crypto, matches: [] }
  return { kind: 'partners', orderId, matches: findMatchingPartners(orderId) }
}
