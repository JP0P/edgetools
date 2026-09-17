import assert from 'node:assert/strict'
import test from 'node:test'

import staffWorker from '../worker/staff.js'
import supportStaffWorker from '../worker/support-staff.js'

function assets(status = 200, body = 'asset') {
  return {
    async fetch(request) {
      return new Response(body, {
        status,
        headers: {
          'Content-Type': 'text/html',
          'X-Asset-Path': new URL(request.url).pathname
        }
      })
    }
  }
}

test('company Staff worker serves only the canonical host with private headers', async () => {
  const response = await staffWorker.fetch(
    new Request('https://staff.edgetools.app/'),
    { ASSETS: assets() }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY')

  const rejected = await staffWorker.fetch(
    new Request('https://edgetools-staff.workers.dev/'),
    { ASSETS: assets() }
  )
  assert.equal(rejected.status, 404)
})

test('company Staff worker canonicalizes index.html', async () => {
  const response = await staffWorker.fetch(
    new Request('https://staff.edgetools.app/index.html'),
    { ASSETS: assets() }
  )
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('Location'), 'https://staff.edgetools.app/')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
})

test('Support Staff worker strips only the protected route prefix', async () => {
  const response = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/staff/assets/site.js'),
    { ASSETS: assets() }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Asset-Path'), '/assets/site.js')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')

  const outside = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/datecalc/'),
    { ASSETS: assets() }
  )
  assert.equal(outside.status, 404)

  const wrongHost = await supportStaffWorker.fetch(
    new Request('https://edgetools-support-staff.workers.dev/staff/'),
    { ASSETS: assets() }
  )
  assert.equal(wrongHost.status, 404)
})

test('Support Staff worker redirects the bare protected path', async () => {
  const response = await supportStaffWorker.fetch(
    new Request('https://support.edgetools.app/staff'),
    { ASSETS: assets() }
  )
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('Location'), 'https://support.edgetools.app/staff/')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
})
