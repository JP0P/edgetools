// Validates that input is a mainnet extended PUBLIC key and refuses private
// keys and seed phrases. Works in the browser and in Node (Web Crypto).

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const PUBLIC_VERSIONS = {
  '0488b21e': { prefix: 'xpub', format: 'Legacy (BIP44, addresses start with 1)' },
  '049d7cb2': { prefix: 'ypub', format: 'Wrapped SegWit (BIP49, addresses start with 3)' },
  '04b24746': { prefix: 'zpub', format: 'Native SegWit (BIP84, addresses start with bc1q)' }
}

const PRIVATE_VERSIONS = new Set(['0488ade4', '049d7878', '04b2430c'])
const TESTNET_VERSIONS = new Set(['043587cf', '044a5262', '045f1cf6'])

function base58Decode (text) {
  let n = 0n
  for (const char of text) {
    const digit = BASE58.indexOf(char)
    if (digit < 0) return null
    n = n * 58n + BigInt(digit)
  }
  const bytes = []
  while (n > 0n) {
    bytes.unshift(Number(n % 256n))
    n /= 256n
  }
  for (const char of text) {
    if (char !== '1') break
    bytes.unshift(0)
  }
  return new Uint8Array(bytes)
}

async function sha256 (bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

/**
 * Returns { ok: true, key, prefix, format } or { ok: false, error }.
 */
export async function parseExtendedPublicKey (input) {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, error: 'Enter an xpub, ypub or zpub.' }

  if (trimmed.split(/\s+/).length >= 12) {
    return {
      ok: false,
      error: 'This looks like a seed phrase. Never share or enter a seed phrase here. Use the wallet\'s xpub instead (Edge: wallet menu → View XPub Address).'
    }
  }
  // Keys pasted from email or chat are often wrapped across lines.
  const key = trimmed.replace(/\s+/g, '')
  if (/^[xyz]prv/.test(key)) {
    return { ok: false, error: 'This is a private key. Never share it. Use the extended public key (xpub, ypub or zpub) instead.' }
  }

  const bytes = base58Decode(key)
  if (bytes == null || bytes.length !== 82) {
    return { ok: false, error: 'This is not a valid extended public key. Check that it was copied completely.' }
  }

  const payload = bytes.slice(0, 78)
  const checksum = (await sha256(await sha256(payload))).slice(0, 4)
  if (toHex(checksum) !== toHex(bytes.slice(78))) {
    return { ok: false, error: 'Checksum mismatch: the key has a typo or was cut off.' }
  }

  const version = toHex(payload.slice(0, 4))
  if (PRIVATE_VERSIONS.has(version)) {
    return { ok: false, error: 'This is a private key. Never share it. Use the extended public key instead.' }
  }
  if (TESTNET_VERSIONS.has(version)) {
    return { ok: false, error: 'This is a testnet key. Only mainnet BTC is supported.' }
  }
  const info = PUBLIC_VERSIONS[version]
  if (info == null) return { ok: false, error: 'Unrecognized key type. Only xpub, ypub and zpub are supported.' }

  return { ok: true, key, ...info }
}
