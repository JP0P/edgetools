import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { publicTools } from '../shared/tools.mjs'
import { parseStaffTarget } from '../scripts/build.mjs'

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

  assert.match(hub, /Staff workspaces/)
  assert.match(hub, /Public tools/)
  assert.match(hub, /https:\/\/bizdev\.edgetools\.app\/intake\//)
  assert.match(support, /What do you need\?/)
  assert.match(support, /Support staff sign in/)
  assert.match(staff, /Choose a team workspace/)
  assert.match(staff, /Shared tools/)
  assert.match(qaStaff, /Download builds, run tests, report issues/)
  assert.match(qaStaff, /Build lab/)
  assert.match(supportStaff, /Open conversations, logs, account tools/)
  assert.match(supportStaff, /Accounts & vouchers/)
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

test('Support operations appear only in the Support staff surface', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
  const staff = await read('apps/staff/index.html')
  const supportStaff = await read('apps/support-staff/index.html')

  const qaStaff = await read('apps/qa-staff/index.html')

  for (const otherSurface of [hub, support, staff, qaStaff]) {
    assert.doesNotMatch(otherSurface, /\{\{staff\.(?:voucher|userLookup|internalTools|logsUpload|intercomInbox)\./)
  }

  assert.doesNotMatch(supportStaff, /form\.asana\.com|logindb-logs-support|internal-tools\.edge\.app/)
  assert.match(supportStaff, /\{\{staff\.voucher\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.userLookup\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.internalTools\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.logsUpload\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.intercomInbox\.href\}\}/)
  assert.doesNotMatch(supportStaff, /<form\b/i)
})

test('company Staff hub federates department workspaces and shared resources', async () => {
  const html = await read('apps/staff/index.html')
  assert.match(html, /https:\/\/support\.edgetools\.app\/staff\//)
  assert.match(html, /https:\/\/bizdev\.edgetools\.app\/staff\//)
  assert.match(html, /https:\/\/staff\.edgetools\.app\/qa\//)
  assert.match(html, /\{\{staff\.teamGuide\.href\}\}/)
  assert.match(html, /\{\{staff\.releasePlanning\.href\}\}/)
  assert.match(html, /\{\{staff\.hudl\.href\}\}/)
  assert.match(html, /\{\{staff\.reports\.href\}\}/)
  assert.match(html, /\{\{staff\.posthog\.href\}\}/)
  assert.match(html, /\{\{staff\.prometheus\.href\}\}/)
  assert.match(html, /own sign-in and authorization/)
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
  assert.match(html, /Support staff sign in/)
  assert.match(html, /href="https:\/\/support\.edgetools\.app\/staff\/"/)
  assert.match(html, /data-preview-href="\/support\/staff\/"/)
  assert.match(html, /href="\.\/datecalc\/"/)
})

test('staff copy distinguishes directory gates from target authorization', async () => {
  for (const path of ['apps/staff/index.html', 'apps/qa-staff/index.html', 'apps/support-staff/index.html']) {
    const html = await read(path)
    assert.match(html, /own authorization|own sign-in and authorization/)
    assert.match(html, /Google login is not being simulated/)
    assert.match(html, /data-preview-only hidden/)
    assert.match(html, /data-production-only hidden/)
  }
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

test('public source contains no analytics or browser persistence', async () => {
  const source = await Promise.all([
    read('apps/hub/index.html'),
    read('apps/support/index.html'),
    read('apps/staff/index.html'),
    read('apps/qa-staff/index.html'),
    read('apps/support-staff/index.html'),
    read('apps/datecalc/index.html'),
    read('apps/datecalc/datecalc.js'),
    read('shared/site.js')
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
