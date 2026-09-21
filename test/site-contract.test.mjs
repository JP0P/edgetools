import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { publicTools } from '../shared/tools.mjs'
import { build, parseStaffTarget } from '../scripts/build.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')

async function read(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), 'utf8')
}

test('every main surface links to edge.app', async () => {
  for (const path of [
    'apps/hub/index.html',
    'apps/support/index.html',
    'apps/datecalc/index.html',
    'apps/staff/index.html',
    'apps/qa-staff/index.html',
    'apps/support-staff/index.html'
  ]) {
    assert.match(await read(path), /href="https:\/\/edge\.app\/"/, path)
  }
})

test('Support surfaces link prominently to the official Help Center', async () => {
  for (const path of ['apps/support/index.html', 'apps/datecalc/index.html']) {
    const html = await read(path)
    assert.match(html, /href="https:\/\/support\.edge\.app\/"/, path)
    assert.match(html, /Help Center/, path)
  }
})

test('public external tool cards disclose the destination behavior', async () => {
  for (const path of ['apps/hub/index.html', 'apps/support/index.html']) {
    const html = await read(path)
    const blankTargets = html.match(/target="_blank"/g) ?? []
    const protectedTargets = html.match(/rel="noopener noreferrer"/g) ?? []
    assert.ok(blankTargets.length > 0, path)
    assert.equal(protectedTargets.length, blankTargets.length, path)
    assert.match(html, /External ↗|Restricted target|Asana sign-in/, path)
  }
})

test('the staff surfaces have distinct jobs and routes', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
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
  assert.match(support, /What do you need\?/)
  assert.match(support, /Support workspace/)
  assert.match(staff, /Shared tools/)
  assert.doesNotMatch(staff, /Choose a team workspace|BizDev/)
  assert.match(staff, /Shared tools/)
  assert.match(qaStaff, /Download builds, run tests, report issues/)
  assert.match(qaStaff, /Build lab/)
  assert.match(supportStaff, /Support workspace/)
  assert.match(supportStaff, /Conversations and follow-up/)
  assert.match(supportStaff, /Investigate an issue/)
  assert.match(supportStaff, /Account Access &amp; Device Authorization/)
  assert.match(supportStaff, /Internal login-help resources/)
  assert.match(supportStaff, /Service diagnostics/)
})

test('shared public-tool facts have one canonical source', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')

  for (const [toolId, tool] of Object.entries(publicTools)) {
    assert.match(hub, new RegExp(`\\{\\{tool\\.${toolId}\\.href\\}\\}`))
    assert.match(support, new RegExp(`\\{\\{tool\\.${toolId}\\.href\\}\\}`))
    assert.doesNotMatch(hub, new RegExp(tool.href.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')))
    assert.doesNotMatch(support, new RegExp(tool.href.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')))
  }
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
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
  const staff = await read('apps/staff/index.html')
  const supportStaff = await read('apps/support-staff/index.html')
  const accountAccess = await read('apps/support-staff/account-access/index.html')

  const qaStaff = await read('apps/qa-staff/index.html')

  for (const otherSurface of [hub, support, staff, qaStaff]) {
    assert.doesNotMatch(otherSurface, /\{\{staff\.(?:voucher|userLookup|internalTools|logsUpload|intercomInbox)\./)
  }

  assert.doesNotMatch(supportStaff, /form\.asana\.com|logindb-logs-support|internal-tools\.edge\.app/)
  assert.match(supportStaff, /\{\{staff\.userLookup\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.internalTools\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.logsUpload\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.intercomInbox\.href\}\}/)
  assert.match(accountAccess, /\{\{staff\.voucher\.href\}\}/)
  assert.match(accountAccess, /Submit authorization case/)
  assert.doesNotMatch(supportStaff, /<form\b/i)
})

test('company Staff hub contains shared resources and routes through shared navigation', async () => {
  const html = await read('apps/staff/index.html')
  const navigation = await read('shared/navigation.mjs')
  assert.match(html, /\{\{nav\.header\}\}/)
  assert.doesNotMatch(html, /bizdev\.edgetools\.app\/staff|Choose a team workspace/)
  assert.match(navigation, /https:\/\/support\.edgetools\.app\/staff\//)
  assert.match(navigation, /https:\/\/staff\.edgetools\.app\/qa\//)
  assert.match(html, /\{\{staff\.teamGuide\.href\}\}/)
  assert.match(html, /\{\{staff\.releasePlanning\.href\}\}/)
  assert.match(html, /\{\{staff\.hudl\.href\}\}/)
  assert.match(html, /\{\{staff\.reports\.href\}\}/)
  assert.match(html, /\{\{staff\.posthog\.href\}\}/)
  assert.match(html, /\{\{staff\.prometheus\.href\}\}/)
  assert.doesNotMatch(html, /own sign-in and authorization/)
})

test('QA operations appear only in the QA staff workspace', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
  const staff = await read('apps/staff/index.html')
  const supportStaff = await read('apps/support-staff/index.html')
  const qaStaff = await read('apps/qa-staff/index.html')

  for (const otherSurface of [hub, support, staff, supportStaff]) {
    assert.doesNotMatch(otherSurface, /\{\{staff\.(?:zealot|testrail|sentry|jenkins|browserstack|unifi)\./)
  }
  for (const target of ['zealot', 'testrail', 'sentry', 'jenkins', 'browserstack', 'unifi']) {
    assert.match(qaStaff, new RegExp(`\\{\\{staff\\.${target}\\.href\\}\\}`))
  }
})

test('public Support links clearly to its own protected staff route', async () => {
  const html = await read('apps/support/index.html')
  assert.match(html, /Support workspace/)
  assert.match(html, /href="https:\/\/support\.edgetools\.app\/staff\/"/)
  assert.match(html, /data-preview-href="\/support\/staff\/"/)
  assert.doesNotMatch(html, /datecalc|Date calculator/)
})

test('staff previews explain only the preview login state', async () => {
  for (const path of ['apps/staff/index.html', 'apps/qa-staff/index.html', 'apps/support-staff/index.html']) {
    const html = await read(path)
    assert.match(html, /Google login is not being simulated/)
    assert.match(html, /data-preview-only hidden/)
    assert.doesNotMatch(html, /data-production-only/)
    assert.doesNotMatch(html, /own sign-in and authorization/)
  }
})

test('DateCalc is direct-link and staff-only in site navigation', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
  const supportStaff = await read('apps/support-staff/index.html')

  assert.doesNotMatch(hub, /datecalc|Date calculator/i)
  assert.doesNotMatch(support, /datecalc|Date calculator/i)
  assert.match(supportStaff, /https:\/\/support\.edgetools\.app\/datecalc\//)
})

test('protected destination URLs are not committed in HTML', async () => {
  const html = `${await read('apps/staff/index.html')}\n${await read('apps/qa-staff/index.html')}\n${await read('apps/support-staff/index.html')}`
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

test('preview server exposes global and Support staff routes separately', async () => {
  const source = await read('scripts/serve.mjs')
  assert.match(source, /\/support\/staff/)
  assert.match(source, /supportStaffOutput/)
  assert.match(source, /Staff hub preview/)
  assert.match(source, /QA staff preview/)
  assert.match(source, /Support staff preview/)
})

test('public pages load the anonymous Edge Messenger and staff pages do not', async () => {
  for (const path of [
    'apps/hub/index.html',
    'apps/hub/404.html',
    'apps/support/index.html',
    'apps/support/404.html',
    'apps/datecalc/index.html'
  ]) {
    const html = await read(path)
    assert.match(html, /assets\/intercom\.js/)
  }

  for (const path of [
    'apps/staff/index.html',
    'apps/staff/404.html',
    'apps/qa-staff/index.html',
    'apps/support-staff/index.html',
    'apps/support-staff/404.html'
  ]) {
    const html = await read(path)
    assert.doesNotMatch(html, /assets\/intercom\.js|widget\.intercom\.io/)
  }

  const loader = await read('shared/intercom.js')
  assert.match(loader, /APP_ID = 'ourx4xix'/)
  assert.match(loader, /https:\/\/widget\.intercom\.io\/widget\/\$\{APP_ID\}/)
  assert.doesNotMatch(loader, /email|user_id|created_at|intercomUserJwt/)
})

test('site source contains no first-party analytics or storage code', async () => {
  const source = await Promise.all([
    read('apps/hub/index.html'),
    read('apps/support/index.html'),
    read('apps/staff/index.html'),
    read('apps/qa-staff/index.html'),
    read('apps/support-staff/index.html'),
    read('apps/support-staff/account-access/index.html'),
    read('apps/datecalc/index.html'),
    read('apps/datecalc/datecalc.js'),
    read('shared/site.js'),
    read('shared/intercom.js')
  ])
  const combined = source.join('\n')

  assert.doesNotMatch(combined, /google-analytics|googletagmanager|segment\.com/i)
  assert.doesNotMatch(combined, /localStorage|sessionStorage|document\.cookie/)
})

test('DateCalc exposes explicit copy buttons and polite status', async () => {
  const html = await read('apps/datecalc/index.html')
  assert.match(html, /id="copy-days"/)
  assert.equal((html.match(/class="copy-button"/g) ?? []).length, 4)
  assert.match(html, /id="copy-status" aria-live="polite"/)
  assert.match(html, /never sent, stored, or added to the URL/)
})

test('built pages fingerprint local assets so HTML and CSS deploy atomically', async () => {
  const { assetVersion, mainOutput, staffOutput, supportOutput, supportStaffOutput } = await build()
  assert.match(assetVersion, /^[a-f0-9]{12}$/)

  for (const path of [
    resolve(mainOutput, 'index.html'),
    resolve(mainOutput, '404.html'),
    resolve(supportOutput, 'index.html'),
    resolve(supportOutput, '404.html'),
    resolve(supportOutput, 'datecalc', 'index.html'),
    resolve(staffOutput, 'index.html'),
    resolve(staffOutput, 'qa', 'index.html'),
    resolve(staffOutput, '404.html'),
    resolve(supportStaffOutput, 'index.html'),
    resolve(supportStaffOutput, 'account-access', 'index.html'),
    resolve(supportStaffOutput, '404.html')
  ]) {
    const html = await readFile(path, 'utf8')
    assert.match(html, new RegExp(`assets/styles\\.css\\?v=${assetVersion}`), path)
    assert.doesNotMatch(html, /(?:href|src)="(?:\.\.\/|\.\/)assets\/[^"?]+"/, path)
  }

  for (const path of [
    resolve(mainOutput, 'index.html'),
    resolve(mainOutput, '404.html'),
    resolve(supportOutput, 'index.html'),
    resolve(supportOutput, '404.html'),
    resolve(supportOutput, 'datecalc', 'index.html')
  ]) {
    const html = await readFile(path, 'utf8')
    assert.match(html, new RegExp(`assets/intercom\\.js\\?v=${assetVersion}`), path)
  }

  for (const path of [
    resolve(staffOutput, 'index.html'),
    resolve(staffOutput, 'qa', 'index.html'),
    resolve(staffOutput, '404.html'),
    resolve(supportStaffOutput, 'index.html'),
    resolve(supportStaffOutput, 'account-access', 'index.html'),
    resolve(supportStaffOutput, '404.html')
  ]) {
    const html = await readFile(path, 'utf8')
    assert.doesNotMatch(html, /assets\/intercom\.js|widget\.intercom\.io/, path)
  }
})
