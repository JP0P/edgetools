import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv } from '../../apps/balance/csv.js'

test('CSV has a header and one exact line per row, with USD when priced', () => {
  const csv = toCsv([
    { time: 1_700_000_000, blockHeight: 800_000, txid: 'aa', type: 'In', net: 150_000_000n, fee: null, balance: 150_000_000n, confirmations: 5, pending: false, mixedInputs: false, price: 36_500 },
    { time: 1_700_000_600, blockHeight: null, txid: 'bb', type: 'Out', net: -1_000n, fee: 200n, balance: 149_999_000n, confirmations: 0, pending: true, mixedInputs: true, price: null }
  ])
  assert.equal(csv,
    'date_utc,block_height,txid,type,amount_btc,amount_usd,fee_btc,balance_btc,balance_usd,btc_price_usd,confirmations,note\n' +
    '2023-11-14T22:13:20.000Z,800000,aa,In,+1.50000000,54750.00,,1.50000000,54750.00,36500.00,5,\n' +
    '2023-11-14T22:23:20.000Z,,bb,Out,-0.00001000,,0.00000200,1.49999000,,,0,Unconfirmed; Inputs from other wallets; No USD price for this time\n')
})
