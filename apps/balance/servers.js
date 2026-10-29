// BTC Blockbook servers from Edge's coreRollup (info1.edge.app/v1/coreRollup).
// Keep in sync with connect-src in index.html's Content-Security-Policy.
export const SERVERS = [
  { host: 'btc-wusa1.edge.app', label: 'Edge US West (btc-wusa1)' },
  { host: 'btc-eu1.edge.app', label: 'Edge EU (btc-eu1)' },
  { host: 'btc1.trezor.io', label: 'Trezor btc1 (independent)' },
  { host: 'btc2.trezor.io', label: 'Trezor btc2 (independent)' },
  { host: 'btc3.trezor.io', label: 'Trezor btc3 (independent)' },
  { host: 'btc4.trezor.io', label: 'Trezor btc4 (independent)' },
  { host: 'btc5.trezor.io', label: 'Trezor btc5 (independent)' }
]
