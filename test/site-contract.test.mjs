import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { publicTools } from '../shared/tools.mjs'
import { build, parseStaffTarget } from '../scripts/build.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const read = relativePath => readFile(resolve(repositoryRoot, relativePath), 'utf8')

test('Main is the one public catalog and uses local tool routes', async () => {
  const html = await read('apps/hub/index.html')
  for (const toolId of ['fio', 'token', 'status', 'orders']) {
    assert.match(html, new RegExp(`href="\\{\\{tool\\.${toolId}\\.href\\}\\}"`))
    assert.match(publicTools[toolId].href, new RegExp(`^/${toolId}/$`))
  }
  assert.doesNotMatch(html, /target="_blank"|External ↗|jpop\.cloud|orders\.edge\.app/)
})

test('Main provides a complete large-image social preview', async () => {
  const html = await read('apps/hub/index.html')
  const imageUrl = 'https://edgetools.app/assets/edge-tools-social-91ccf865.png'
  assert.match(html, /property="og:type" content="website"/)
  assert.match(html, /property="og:title" content="EdgeTools — Public Edge Wallet tools"/)
  assert.match(html, new RegExp(`property="og:image" content="${imageUrl.replaceAll('.', '\\.')}`))
  assert.match(html, /property="og:image:width" content="1200"/)
  assert.match(html, /property="og:image:height" content="630"/)
  assert.match(html, /property="og:image:alt"/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.match(html, new RegExp(`name="twitter:image" content="${imageUrl.replaceAll('.', '\\.')}`))

  const previewImagePath = resolve(repositoryRoot, 'shared/assets/edge-tools-social-91ccf865.png')
  const previewImage = await stat(previewImagePath)
  assert.ok(previewImage.size > 10_000, 'social preview image must be a real rendered asset')
  const previewImageBytes = await readFile(previewImagePath)
  assert.equal(previewImageBytes.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(previewImageBytes.readUInt32BE(16), 1200)
  assert.equal(previewImageBytes.readUInt32BE(20), 630)

  const { mainOutput } = await build()
  const builtHtml = await readFile(resolve(mainOutput, 'index.html'), 'utf8')
  await stat(resolve(mainOutput, 'assets/edge-tools-social-91ccf865.png'))
  assert.match(builtHtml, new RegExp(`property="og:image" content="${imageUrl.replaceAll('.', '\\.')}`))
})

test('public navigation points Help Center directly to support.edge.app', async () => {
  const navigation = await read('shared/navigation.mjs')
  assert.match(navigation, /Help Center/)
  assert.match(navigation, /https:\/\/support\.edge\.app\//)
  assert.doesNotMatch(navigation, /routes\.support\}/)
})

test('Support is a noindex legacy handoff without a duplicated catalog', async () => {
  const html = await read('apps/support/index.html')
  assert.match(html, /name="robots" content="noindex,follow"/)
  assert.match(html, /canonical" href="https:\/\/support\.edge\.app\//)
  assert.match(html, /Help Center/)
  assert.doesNotMatch(html, /\{\{tool\.|workflow-links|directory-card/)
})

test('all four public tool pages have shared chrome and Intercom', async () => {
  for (const toolId of ['fio', 'token', 'status', 'orders']) {
    const html = await read(`apps/${toolId}/index.html`)
    assert.match(html, /\{\{nav\.header\}\}/)
    assert.match(html, /assets\/intercom\.js/)
    assert.match(html, /site-footer/)
  }
})

test('DateCalc is protected staff-only and has no Intercom', async () => {
  const source = await read('apps/datecalc/index.html')
  assert.match(source, /support\.edgetools\.app\/staff\/datecalc\//)
  assert.match(source, /noindex, nofollow/)
  assert.doesNotMatch(source, /assets\/intercom\.js/)
  const outputs = await build()
  await assert.rejects(readFile(resolve(outputs.supportOutput, 'datecalc', 'index.html')))
  const built = await readFile(resolve(outputs.supportStaffOutput, 'datecalc', 'index.html'), 'utf8')
  assert.match(built, /support\.edgetools\.app\/staff\/datecalc\//)
  assert.doesNotMatch(built, /assets\/intercom\.js/)
})

test('public tool behavior is local and stateless', async () => {
  const fio = await read('apps/fio/fio.js')
  assert.match(fio, /fio\.eosusa\.io\/v1\/chain\/get_pub_address/)
  assert.match(fio, /navigator\.clipboard/)
  const token = await read('apps/token/token.js')
  assert.match(token, /\/api\/token/)
  assert.doesNotMatch(token, /api\.coingecko\.com/)
  assert.match(token, /429/)
  assert.match(token, /setTimeout\(/)
  const orders = `${await read('apps/orders/orders.js')}\n${await read('apps/orders/order-logic.js')}`
  assert.doesNotMatch(orders, /localStorage|sessionStorage|\/api\/stats|URLSearchParams/)
  assert.match(orders, /window\.open/)
})

test('public API routes include query strings while the Worker enforces exact paths', async () => {
  const config = JSON.parse(await read('wrangler.public-api.jsonc'))
  assert.deepEqual(
    config.routes.map(route => route.pattern),
    ['edgetools.app/api/status*', 'edgetools.app/api/token*']
  )
  const worker = await read('worker/public-api.js')
  assert.match(worker, /url\.pathname === '\/api\/status'/)
  assert.match(worker, /url\.pathname === '\/api\/token'/)
})

test('built routes include each public tool and protected DateCalc', async () => {
  const outputs = await build()
  for (const toolId of ['fio', 'token', 'status', 'orders']) {
    const html = await readFile(resolve(outputs.mainOutput, toolId, 'index.html'), 'utf8')
    assert.match(html, new RegExp(`assets/tool\\.css\\?v=${outputs.assetVersion}`))
    assert.doesNotMatch(html, /\{\{nav\./)
  }
  assert.match(await readFile(resolve(outputs.supportStaffOutput, 'datecalc', 'index.html'), 'utf8'), /noindex, nofollow/)
})

test('provenance manifest pins the four approved source commits', async () => {
  const manifest = JSON.parse(await read('public-tools-manifest.json'))
  assert.deepEqual(
    Object.fromEntries(Object.entries(manifest.tools).map(([id, tool]) => [id, tool.source])),
    { fio: 'JP0P/FIO-Resolver', token: 'JP0P/TokenIconLookup', status: 'JP0P/Status-Dashboard', orders: 'JP0P/order-lookup' }
  )
  for (const tool of Object.values(manifest.tools)) assert.match(tool.commit, /^[a-f0-9]{40}$/)
})

test('every primary surface links to edge.app', async () => {
  for (const path of [
    'apps/hub/index.html',
    'apps/support/index.html',
    'apps/datecalc/index.html',
    'apps/staff/index.html',
    'apps/qa-staff/index.html',
    'apps/support-staff/index.html'
  ]) assert.match(await read(path), /href="https:\/\/edge\.app\/"/, path)
})

test('the staff surfaces retain distinct jobs and routes', async () => {
  const hub = await read('apps/hub/index.html')
  const staff = await read('apps/staff/index.html')
  const qaStaff = await read('apps/qa-staff/index.html')
  const supportStaff = await read('apps/support-staff/index.html')
  const navigation = await read('shared/navigation.mjs')

  assert.doesNotMatch(hub, /Choose your team|Staff workspaces/)
  assert.match(hub, /Public tools/)
  assert.match(navigation, /details class="nav-disclosure"/)
  assert.match(navigation, /https:\/\/staff\.edgetools\.app\/qa\//)
  assert.match(navigation, /Support workspace/)
  assert.match(navigation, /https:\/\/bizdev\.edgetools\.app\//)
  assert.match(staff, /Shared tools/)
  assert.doesNotMatch(staff, /Choose a team workspace|BizDev/)
  assert.match(qaStaff, /Download builds, run tests, report issues/)
  assert.match(qaStaff, /Build lab/)
  assert.match(supportStaff, /Conversations and follow-up/)
  assert.match(supportStaff, /Investigate an issue/)
  assert.match(supportStaff, /Account Access &amp; Device Authorization/)
  assert.match(supportStaff, /Service diagnostics/)
})

test('built public navigation exposes staff discovery without private tool targets', async () => {
  const { mainOutput, supportOutput } = await build()
  for (const path of [resolve(mainOutput, 'index.html'), resolve(supportOutput, 'index.html')]) {
    const html = await readFile(path, 'utf8')
    assert.match(html, /<details class="nav-disclosure">/)
    assert.match(html, /https:\/\/staff\.edgetools\.app\/qa\//)
    assert.match(html, /https:\/\/support\.edgetools\.app\/staff\//)
    assert.match(html, /href="https:\/\/bizdev\.edgetools\.app\/"/)
    assert.doesNotMatch(html, /bizdev\.edgetools\.app\/(?:staff|intake)/)
    assert.doesNotMatch(html, /form\.asana\.com|app\.intercom\.com|logs1\.edge\.app/)
  }
})

test('Support operations appear only in the Support staff surface', async () => {
  const surfaces = await Promise.all([
    read('apps/hub/index.html'),
    read('apps/support/index.html'),
    read('apps/staff/index.html'),
    read('apps/qa-staff/index.html')
  ])
  for (const html of surfaces) assert.doesNotMatch(html, /\{\{staff\.(?:voucher|userLookup|internalTools|logsUpload|intercomInbox)\./)

  const supportStaff = await read('apps/support-staff/index.html')
  const accountAccess = await read('apps/support-staff/account-access/index.html')
  assert.doesNotMatch(supportStaff, /form\.asana\.com|logindb-logs-support|internal-tools\.edge\.app/)
  for (const target of ['userLookup', 'internalTools', 'logsUpload', 'intercomInbox']) {
    assert.match(supportStaff, new RegExp(`\\{\\{staff\\.${target}\\.href\\}\\}`))
  }
  assert.match(accountAccess, /\{\{staff\.voucher\.href\}\}/)
  assert.match(accountAccess, /Submit authorization case/)
})

test('QA operations appear only in the QA staff workspace', async () => {
  const otherSurfaces = await Promise.all([
    read('apps/hub/index.html'),
    read('apps/support/index.html'),
    read('apps/staff/index.html'),
    read('apps/support-staff/index.html')
  ])
  for (const html of otherSurfaces) assert.doesNotMatch(html, /\{\{staff\.(?:zealot|testrail|sentry|jenkins|browserstack|unifi)\./)
  const qaStaff = await read('apps/qa-staff/index.html')
  for (const target of ['zealot', 'testrail', 'sentry', 'jenkins', 'browserstack', 'unifi']) {
    assert.match(qaStaff, new RegExp(`\\{\\{staff\\.${target}\\.href\\}\\}`))
  }
})

test('protected destination URLs are not committed in HTML', async () => {
  const html = (await Promise.all([
    read('apps/staff/index.html'),
    read('apps/qa-staff/index.html'),
    read('apps/support-staff/index.html')
  ])).join('\n')
  assert.doesNotMatch(html, /form\.asana\.com|logindb-logs-support|internal-tools\.edge\.app/)
  assert.doesNotMatch(html, /drive\.google\.com\/drive\/folders|docs\.google\.com\/spreadsheets/)
  assert.doesNotMatch(html, /reports-wusa1|posthog\.com|prometheus\.edge\.app|zealot\.edge\.app/)
  assert.doesNotMatch(html, /testrail\.io|sentry\.edge\.app|jack2|browserstack\.com|10\.10\.8\.1/)
  assert.doesNotMatch(html, /logs1\.edge\.app|app\.intercom\.com/)
  assert.match(html, /\{\{staff\./)
})

test('only the exact internal Jenkins origin may use HTTP', () => {
  assert.equal(parseStaffTarget('http://jack2:8080/', 'jenkins').toString(), 'http://jack2:8080/')
  assert.throws(() => parseStaffTarget('http://jack2:8081/', 'jenkins'), /must be/)
  assert.throws(() => parseStaffTarget('http://example.com/', 'reports'), /must be/)
  assert.throws(() => parseStaffTarget('https://user:pass@example.com/', 'reports'), /must be/)
})

test('public pages load anonymous Intercom and protected pages do not', async () => {
  const publicPages = [
    'apps/hub/index.html',
    'apps/hub/404.html',
    'apps/support/index.html',
    'apps/support/404.html',
    'apps/fio/index.html',
    'apps/token/index.html',
    'apps/status/index.html',
    'apps/orders/index.html'
  ]
  for (const path of publicPages) assert.match(await read(path), /assets\/intercom\.js/, path)

  const protectedPages = [
    'apps/staff/index.html',
    'apps/staff/404.html',
    'apps/qa-staff/index.html',
    'apps/support-staff/index.html',
    'apps/support-staff/404.html',
    'apps/datecalc/index.html'
  ]
  for (const path of protectedPages) assert.doesNotMatch(await read(path), /assets\/intercom\.js|widget\.intercom\.io/, path)

  const loader = await read('shared/intercom.js')
  assert.match(loader, /APP_ID = 'ourx4xix'/)
  assert.doesNotMatch(loader, /email|user_id|created_at|intercomUserJwt/)
})

test('site source contains no first-party analytics or persistence code', async () => {
  const source = await Promise.all([
    'apps/hub/index.html', 'apps/support/index.html', 'apps/staff/index.html',
    'apps/qa-staff/index.html', 'apps/support-staff/index.html',
    'apps/support-staff/account-access/index.html', 'apps/datecalc/index.html',
    'apps/datecalc/datecalc.js', 'apps/fio/fio.js', 'apps/token/token.js',
    'apps/status/status.js', 'apps/orders/orders.js', 'apps/orders/order-logic.js',
    'shared/site.js', 'shared/intercom.js'
  ].map(read))
  const combined = source.join('\n')
  assert.doesNotMatch(combined, /google-analytics|googletagmanager|segment\.com/i)
  assert.doesNotMatch(combined, /localStorage|sessionStorage|document\.cookie/)
})

test('DateCalc retains explicit copy controls and privacy copy', async () => {
  const html = await read('apps/datecalc/index.html')
  assert.match(html, /id="copy-days"/)
  assert.equal((html.match(/class="copy-button"/g) ?? []).length, 4)
  assert.match(html, /id="copy-status" aria-live="polite"/)
  assert.match(html, /never sent, stored, or added to the URL/)
})

test('built pages fingerprint local assets and preserve the privacy boundary', async () => {
  const { assetVersion, mainOutput, staffOutput, supportOutput, supportStaffOutput } = await build()
  assert.match(assetVersion, /^[a-f0-9]{12}$/)

  const pages = [
    resolve(mainOutput, 'index.html'), resolve(mainOutput, '404.html'),
    ...['fio', 'token', 'status', 'orders'].map(id => resolve(mainOutput, id, 'index.html')),
    resolve(supportOutput, 'index.html'), resolve(supportOutput, '404.html'),
    resolve(staffOutput, 'index.html'), resolve(staffOutput, 'qa', 'index.html'), resolve(staffOutput, '404.html'),
    resolve(supportStaffOutput, 'index.html'), resolve(supportStaffOutput, 'account-access', 'index.html'),
    resolve(supportStaffOutput, 'datecalc', 'index.html'), resolve(supportStaffOutput, '404.html')
  ]
  for (const path of pages) {
    const html = await readFile(path, 'utf8')
    assert.match(html, new RegExp(`assets/styles\\.css\\?v=${assetVersion}`), path)
    assert.doesNotMatch(html, /(?:href|src)="(?:\.\.\/|\.\/)assets\/[^"?]+"/, path)
  }

  for (const path of [
    resolve(mainOutput, 'index.html'), resolve(mainOutput, '404.html'),
    ...['fio', 'token', 'status', 'orders'].map(id => resolve(mainOutput, id, 'index.html')),
    resolve(supportOutput, 'index.html'), resolve(supportOutput, '404.html')
  ]) assert.match(await readFile(path, 'utf8'), new RegExp(`assets/intercom\\.js\\?v=${assetVersion}`), path)

  for (const path of [
    resolve(staffOutput, 'index.html'), resolve(staffOutput, 'qa', 'index.html'), resolve(staffOutput, '404.html'),
    resolve(supportStaffOutput, 'index.html'), resolve(supportStaffOutput, 'account-access', 'index.html'),
    resolve(supportStaffOutput, 'datecalc', 'index.html'), resolve(supportStaffOutput, '404.html')
  ]) assert.doesNotMatch(await readFile(path, 'utf8'), /assets\/intercom\.js|widget\.intercom\.io/, path)
})
