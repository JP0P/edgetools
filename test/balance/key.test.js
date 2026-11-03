import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseExtendedPublicKey } from '../../apps/balance/key.js'

const YPUB = 'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
const ZPUB = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
const OTHER_ZPUB = 'zpub6rFR7y4Q2AijF6Gk1bofHLs1d66hKFamhXWdWBup1Em25wfabZqkDqvaieV63fDQFaYmaatCG7jVNUpUiM2hAMo6SAVHcrUpSnHDpNzucB7'
const TESTNET_VPUB = 'vpub5YvMuJNjRSYon44z9QmCfdf8SqJRVNvz6m55Qy5iVjZQxDfUgtiQjnc7CC1fAbED2tAGCZRERUfvtn2DstZGU6HMns6dXXH2wujSc2wfi2x'

test('parses Edge View XPub Address ypub and zpub lines separately', async () => {
  const parsed = await parseExtendedPublicKey(`${YPUB}\n${ZPUB}`)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.keys.map(key => key.prefix), ['ypub', 'zpub'])
})

test('keeps a single wrapped key as one key', async () => {
  const parsed = await parseExtendedPublicKey(`${ZPUB.slice(0, 55)}\n${ZPUB.slice(55)}`)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.keys.length, 1)
  assert.equal(parsed.keys[0].key, ZPUB)
})

test('ignores an exact duplicate key', async () => {
  const parsed = await parseExtendedPublicKey(`${ZPUB}, ${ZPUB}`)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.keys.length, 1)
})

test('refuses two different keys of the same type', async () => {
  const parsed = await parseExtendedPublicKey(`${ZPUB}\n${OTHER_ZPUB}`)
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /different types/)
})

test('still refuses seed phrases and private keys', async () => {
  const seed = await parseExtendedPublicKey('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  assert.equal(seed.ok, false)
  assert.match(seed.error, /seed phrase/)

  const commaSeed = await parseExtendedPublicKey('abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, about')
  assert.equal(commaSeed.ok, false)
  assert.match(commaSeed.error, /seed phrase/)

  const privateKey = await parseExtendedPublicKey('xprv-not-a-real-private-key')
  assert.equal(privateKey.ok, false)
  assert.match(privateKey.error, /private key/)

  const mixedPrivate = await parseExtendedPublicKey(`${ZPUB}\nxprv-not-a-real-private-key`)
  assert.equal(mixedPrivate.ok, false)
  assert.match(mixedPrivate.error, /private key/)
})

test('still refuses testnet extended public keys', async () => {
  const parsed = await parseExtendedPublicKey(TESTNET_VPUB)
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /testnet key/)
})
