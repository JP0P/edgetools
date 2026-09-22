import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from './build.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkExternal = process.argv.includes('--external')
const {
  mainOutput,
  protectedStaffOrigins,
  staffOutput,
  supportOutput,
  supportStaffOutput
} = await build()

const htmlFiles = [
  resolve(mainOutput, 'index.html'),
  resolve(mainOutput, '404.html'),
  resolve(mainOutput, 'fio', 'index.html'),
  resolve(mainOutput, 'token', 'index.html'),
  resolve(mainOutput, 'status', 'index.html'),
  resolve(mainOutput, 'orders', 'index.html'),
  resolve(supportOutput, 'index.html'),
  resolve(supportOutput, '404.html'),
  resolve(staffOutput, 'index.html'),
  resolve(staffOutput, 'qa', 'index.html'),
  resolve(staffOutput, '404.html'),
  resolve(supportStaffOutput, 'index.html'),
  resolve(supportStaffOutput, 'datecalc', 'index.html'),
  resolve(supportStaffOutput, 'account-access', 'index.html'),
  resolve(supportStaffOutput, '404.html')
]

const failures = []
const externalUrls = new Set()
const protectedOrigins = new Set(protectedStaffOrigins)
const externallyRateLimitedHosts = new Set(['www.coingecko.com'])

function productionUrlToLocal(url) {
  if (url.hostname === 'edgetools.app') {
    return resolve(mainOutput, `.${url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname}`)
  }
  if (url.hostname === 'support.edgetools.app') {
    if (url.pathname === '/staff' || url.pathname.startsWith('/staff/')) {
      const pathname = url.pathname.replace(/^\/staff(?=\/|$)/, '') || '/'
      return resolve(
        supportStaffOutput,
        `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`
      )
    }
    return resolve(supportOutput, `.${url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname}`)
  }
  if (url.hostname === 'staff.edgetools.app') {
    return resolve(staffOutput, `.${url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname}`)
  }
  return null
}

function localTarget(documentPath, value) {
  const cleanValue = value.split('#')[0].split('?')[0]
  if (!cleanValue) return null
  if (
    documentPath.startsWith(`${supportStaffOutput}/`) &&
    (cleanValue === '/staff' || cleanValue.startsWith('/staff/'))
  ) {
    const pathname = cleanValue.replace(/^\/staff(?=\/|$)/, '') || '/'
    const candidate = resolve(supportStaffOutput, `.${pathname}`)
    return pathname.endsWith('/') ? resolve(candidate, 'index.html') : candidate
  }
  const outputRoot = documentPath.startsWith(`${supportStaffOutput}/`)
    ? supportStaffOutput
    : documentPath.startsWith(`${supportOutput}/`)
      ? supportOutput
      : documentPath.startsWith(`${staffOutput}/`)
      ? staffOutput
      : mainOutput
  const candidate = cleanValue.startsWith('/')
    ? resolve(outputRoot, `.${cleanValue}`)
    : resolve(dirname(documentPath), cleanValue)
  return cleanValue.endsWith('/') ? resolve(candidate, 'index.html') : candidate
}

for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, 'utf8')
  const references = [...html.matchAll(/(?:^|\s)(?:href|src)="([^"]+)"/gm)].map(match => match[1])

  for (const reference of references) {
    if (reference.startsWith('#') || reference.startsWith('mailto:')) continue

    if (/^https?:\/\//.test(reference)) {
      const url = new URL(reference)
      const local = productionUrlToLocal(url)
      if (local) {
        try {
          await access(local)
        } catch {
          failures.push(`${htmlPath}: missing estate route ${reference}`)
        }
      } else {
        externalUrls.add(`${url.origin}${url.pathname}`)
      }
      continue
    }

    const target = localTarget(htmlPath, reference)
    if (!target) continue
    try {
      await access(target)
    } catch {
      failures.push(`${htmlPath}: missing local asset ${reference}`)
    }
  }
}

if (checkExternal) {
  for (const url of externalUrls) {
    try {
      const target = new URL(url)
      if (protectedOrigins.has(target.origin)) {
        console.log(`Skipped authenticated destination ${target.origin}`)
        continue
      }
      if (externallyRateLimitedHosts.has(target.hostname)) {
        console.log(`Skipped attribution destination ${target.origin}`)
        continue
      }

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'EdgeTools link check' }
      })
      await response.body?.cancel()
      if (!response.ok) failures.push(`${url}: HTTP ${response.status}`)
    } catch (error) {
      failures.push(`${url}: ${error.message}`)
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Checked ${htmlFiles.length} pages and ${externalUrls.size} external destinations.`)
}
