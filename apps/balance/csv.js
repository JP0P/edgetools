import { formatBtc } from './history.js'
import { satsToUsd } from './rates.js'

const HEADER = [
  'date_utc', 'block_height', 'txid', 'type',
  'amount_btc', 'amount_usd', 'fee_btc', 'balance_btc', 'balance_usd', 'btc_price_usd',
  'confirmations', 'note'
]

const escape = value => /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

// Plain numbers for spreadsheets: no currency symbol or thousands separators.
const usd = value => value.toFixed(2)

/** CSV of history rows, oldest first. USD columns are empty when row.price is missing. */
export function toCsv (rows) {
  const lines = rows.map(row => {
    const notes = []
    if (row.pending) notes.push('Unconfirmed')
    if (row.mixedInputs) notes.push('Inputs from other wallets')
    if (row.price === null) notes.push('No USD price for this time')
    const hasPrice = row.price != null
    return [
      new Date(row.time * 1000).toISOString(),
      row.blockHeight ?? '',
      row.txid,
      row.type,
      formatBtc(row.net, { signed: true, unit: false }),
      hasPrice ? usd(satsToUsd(row.net, row.price)) : '',
      row.fee == null ? '' : formatBtc(row.fee, { unit: false }),
      formatBtc(row.balance, { unit: false }),
      hasPrice ? usd(satsToUsd(row.balance, row.price)) : '',
      hasPrice ? usd(row.price) : '',
      row.confirmations,
      notes.join('; ')
    ].map(v => escape(String(v))).join(',')
  })
  return [HEADER.join(','), ...lines].join('\n') + '\n'
}
