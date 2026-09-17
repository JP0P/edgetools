import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { publicTools } from '../shared/tools.mjs'

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
    'apps/support-staff/index.html'
  ]) {
    assert.match(await read(path), /href="https:\/\/edge\.app\/"/, path)
  }
})

test('Support surfaces link prominently to the official Help Center', async () => {
  for (const path of ['apps/support/index.html', 'apps/datecalc/index.html']) {
    const html = await read(path)
    assert.match(html, /href="https:\/\/support\.edge\.app\/"/, path)
    assert.match(html, /Official Support|official Help Center/, path)
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

test('the four surfaces have distinct jobs and routes', async () => {
  const hub = await read('apps/hub/index.html')
  const support = await read('apps/support/index.html')
  const staff = await read('apps/staff/index.html')
  const supportStaff = await read('apps/support-staff/index.html')

  assert.match(hub, /Start with who you are/)
  assert.match(hub, /https:\/\/bizdev\.edgetools\.app\/intake\//)
  assert.match(support, /Choose the task/)
  assert.match(support, /Support workbench/)
  assert.match(staff, /Company-wide staff router/)
  assert.match(staff, /Department workspaces/)
  assert.match(supportStaff, /Support staff workspace/)
  assert.match(supportStaff, /A doorway is not authorization/)
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

  for (const otherSurface of [hub, support, staff]) {
    assert.doesNotMatch(otherSurface, /\{\{staff\.(?:voucher|userLookup|internalTools)\./)
  }

  const staffToolGrid = supportStaff.match(/<div class="staff-tool-grid">([\s\S]+?)<\/div>\s*<\/section>/)?.[1]
  assert.ok(staffToolGrid)
  assert.doesNotMatch(staffToolGrid, /href="https:\/\//)
  assert.match(supportStaff, /\{\{staff\.voucher\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.userLookup\.href\}\}/)
  assert.match(supportStaff, /\{\{staff\.internalTools\.href\}\}/)
  assert.doesNotMatch(supportStaff, /<form\b/i)
})

test('company Staff hub federates department workspaces and shared resources', async () => {
  const html = await read('apps/staff/index.html')
  assert.match(html, /https:\/\/support\.edgetools\.app\/staff\//)
  assert.match(html, /https:\/\/bizdev\.edgetools\.app\/staff\//)
  assert.match(html, /\{\{staff\.teamGuide\.href\}\}/)
  assert.match(html, /\{\{staff\.releasePlanning\.href\}\}/)
  assert.match(html, /\{\{staff\.hudl\.href\}\}/)
  assert.match(html, /Organize relevance, not permission/)
})

test('public Support links clearly to its own protected staff route', async () => {
  const html = await read('apps/support/index.html')
  assert.match(html, /Support staff sign-in/)
  assert.match(html, /href="https:\/\/support\.edgetools\.app\/staff\/"/)
  assert.match(html, /data-preview-href="\/support\/staff\/"/)
  assert.match(html, /href="\.\/datecalc\/"/)
})

test('staff copy distinguishes directory gates from target authorization', async () => {
  for (const path of ['apps/staff/index.html', 'apps/support-staff/index.html']) {
    const html = await read(path)
    assert.match(html, /own authorization|own sign-in and authorization/)
    assert.match(html, /Google login is not being simulated/)
    assert.match(html, /data-preview-only hidden/)
    assert.match(html, /data-production-only hidden/)
  }
})

test('protected destination URLs are not committed in HTML', async () => {
  const html = `${await read('apps/staff/index.html')}\n${await read('apps/support-staff/index.html')}`
  assert.doesNotMatch(html, /form\.asana\.com|logindb-logs-support|internal-tools\.edge\.app/)
  assert.doesNotMatch(html, /drive\.google\.com\/drive\/folders|docs\.google\.com\/spreadsheets/)
  assert.match(html, /\{\{staff\./)
})

test('preview server exposes global and Support staff routes separately', async () => {
  const source = await read('scripts/serve.mjs')
  assert.match(source, /\/support\/staff/)
  assert.match(source, /supportStaffOutput/)
  assert.match(source, /Staff hub preview/)
  assert.match(source, /Support staff preview/)
})

test('public source contains no analytics or browser persistence', async () => {
  const source = await Promise.all([
    read('apps/hub/index.html'),
    read('apps/support/index.html'),
    read('apps/staff/index.html'),
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
