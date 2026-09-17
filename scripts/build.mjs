import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { publicTools } from '../shared/tools.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(repositoryRoot, 'dist')
const localStaffTargetsPath = process.env.EDGETOOLS_STAFF_TARGETS_FILE
  ? resolve(repositoryRoot, process.env.EDGETOOLS_STAFF_TARGETS_FILE)
  : resolve(repositoryRoot, 'config', 'staff-targets.local.json')

const globalStaffTargetDefinitions = {
  teamGuide: {
    action: 'Open team guide',
    envName: 'EDGETOOLS_GLOBAL_STAFF_TEAM_GUIDE_URL'
  },
  releasePlanning: {
    action: 'Open release planning',
    envName: 'EDGETOOLS_GLOBAL_STAFF_RELEASE_PLANNING_URL'
  },
  hudl: {
    action: 'Open HUDL',
    envName: 'EDGETOOLS_GLOBAL_STAFF_HUDL_URL'
  },
  reports: {
    action: 'Open reports',
    envName: 'EDGETOOLS_GLOBAL_STAFF_REPORTS_URL'
  },
  posthog: {
    action: 'Open PostHog',
    envName: 'EDGETOOLS_GLOBAL_STAFF_POSTHOG_URL'
  },
  prometheus: {
    action: 'Open Prometheus',
    envName: 'EDGETOOLS_GLOBAL_STAFF_PROMETHEUS_URL'
  }
}

const qaStaffTargetDefinitions = {
  zealot: {
    action: 'Open Zealot builds',
    envName: 'EDGETOOLS_QA_STAFF_ZEALOT_URL'
  },
  testrail: {
    action: 'Open TestRail',
    envName: 'EDGETOOLS_QA_STAFF_TESTRAIL_URL'
  },
  sentry: {
    action: 'Open Sentry issues',
    envName: 'EDGETOOLS_QA_STAFF_SENTRY_URL'
  },
  jenkins: {
    action: 'Open Jenkins builds',
    envName: 'EDGETOOLS_QA_STAFF_JENKINS_URL',
    allowedHttpOrigin: 'http://jack2:8080'
  },
  browserstack: {
    action: 'Open BrowserStack',
    envName: 'EDGETOOLS_QA_STAFF_BROWSERSTACK_URL'
  },
  unifi: {
    action: 'Open Android devices',
    envName: 'EDGETOOLS_QA_STAFF_UNIFI_URL'
  }
}

const supportStaffTargetDefinitions = {
  voucher: {
    action: 'Open voucher form',
    envName: 'EDGETOOLS_SUPPORT_STAFF_VOUCHER_URL'
  },
  userLookup: {
    action: 'Open User Lookup',
    envName: 'EDGETOOLS_SUPPORT_STAFF_USER_LOOKUP_URL'
  },
  internalTools: {
    action: 'Open internal tools',
    envName: 'EDGETOOLS_SUPPORT_STAFF_INTERNAL_TOOLS_URL'
  },
  logsUpload: {
    action: 'Open uploaded logs',
    envName: 'EDGETOOLS_SUPPORT_STAFF_LOGS_URL'
  },
  intercomInbox: {
    action: 'Open Intercom Inbox',
    envName: 'EDGETOOLS_SUPPORT_STAFF_INTERCOM_URL'
  }
}

const staffTargetDefinitions = {
  ...globalStaffTargetDefinitions,
  ...qaStaffTargetDefinitions,
  ...supportStaffTargetDefinitions
}

export function parseStaffTarget(rawValue, targetId) {
  const definition = staffTargetDefinitions[targetId]
  if (!definition) throw new Error(`Unknown Staff target: ${targetId}`)

  const url = new URL(rawValue)
  const allowedHttp =
    url.protocol === 'http:' &&
    definition.allowedHttpOrigin &&
    url.origin === definition.allowedHttpOrigin
  if ((url.protocol !== 'https:' && !allowedHttp) || url.username || url.password) {
    const requirement = definition.allowedHttpOrigin
      ? `a credential-free HTTPS URL or ${definition.allowedHttpOrigin}`
      : 'a credential-free HTTPS URL'
    throw new Error(`${definition.envName} must be ${requirement}`)
  }
  return url
}

async function copySharedAssets(outputRoot) {
  await mkdir(resolve(outputRoot, 'assets'), { recursive: true })
  await cp(resolve(repositoryRoot, 'shared', 'assets'), resolve(outputRoot, 'assets'), {
    recursive: true
  })
  for (const stylesheet of ['styles.css', 'hub.css', 'staff.css', 'support.css']) {
    await cp(resolve(repositoryRoot, 'shared', stylesheet), resolve(outputRoot, 'assets', stylesheet))
  }
  await cp(resolve(repositoryRoot, 'shared', 'site.js'), resolve(outputRoot, 'assets', 'site.js'))
  await cp(resolve(repositoryRoot, 'shared', 'intercom.js'), resolve(outputRoot, 'assets', 'intercom.js'))
}

async function computeAssetVersion() {
  const assetPaths = [
    resolve(repositoryRoot, 'shared', 'styles.css'),
    resolve(repositoryRoot, 'shared', 'hub.css'),
    resolve(repositoryRoot, 'shared', 'staff.css'),
    resolve(repositoryRoot, 'shared', 'support.css'),
    resolve(repositoryRoot, 'shared', 'site.js'),
    resolve(repositoryRoot, 'shared', 'intercom.js'),
    resolve(repositoryRoot, 'shared', 'assets', 'tool-icons.svg'),
    resolve(repositoryRoot, 'apps', 'datecalc', 'datecalc.js')
  ]
  const hash = createHash('sha256')
  for (const assetPath of assetPaths) hash.update(await readFile(assetPath))
  return hash.digest('hex').slice(0, 12)
}

function versionLocalAssets(source, assetVersion) {
  return source
    .replace(
      /((?:\.\.\/|\.\/)assets\/[^"'#?]+)(?=[#"'])/g,
      `$1?v=${assetVersion}`
    )
    .replace(/(\.\/datecalc\.js)(?=["'])/g, `$1?v=${assetVersion}`)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function loadStaffTargets() {
  let localTargets = {}
  try {
    localTargets = JSON.parse(await readFile(localStaffTargetsPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const targets = {}
  for (const [targetId, definition] of Object.entries(staffTargetDefinitions)) {
    const rawValue = process.env[definition.envName] || localTargets[targetId]
    if (!rawValue) continue

    const url = parseStaffTarget(rawValue, targetId)
    targets[targetId] = url.toString()
  }
  return targets
}

function staffTemplateValue(staffTargets, targetId, field) {
  if (targetId.endsWith('Config') && field === 'noteClass') {
    const scope = targetId === 'globalConfig'
      ? globalStaffTargetDefinitions
      : targetId === 'qaConfig'
        ? qaStaffTargetDefinitions
      : targetId === 'supportConfig'
        ? supportStaffTargetDefinitions
        : null
    if (!scope) return null
    return Object.keys(scope).every(id => staffTargets[id])
      ? 'staff-config-note-hidden'
      : ''
  }

  const definition = staffTargetDefinitions[targetId]
  if (!definition) return null
  const configured = Boolean(staffTargets[targetId])
  const values = {
    action: configured ? definition.action : 'Unavailable pending configuration',
    arrow: configured ? '↗' : '',
    href: configured ? staffTargets[targetId] : '#staff-targets-unconfigured',
    linkAttributes: configured
      ? 'target="_blank" rel="noopener noreferrer"'
      : 'aria-disabled="true"',
    stateClass: configured ? '' : 'staff-tool-disabled'
  }
  return values[field] ?? null
}

async function renderTemplate(sourcePath, outputPath, staffTargets = {}, assetVersion) {
  const source = await readFile(sourcePath, 'utf8')
  const toolsRendered = source.replace(
    /\{\{tool\.([a-z0-9]+)\.([A-Za-z]+)\}\}/g,
    (token, toolId, field) => {
      const value = publicTools[toolId]?.[field]
      if (typeof value !== 'string') throw new Error(`Unknown tool template token: ${token}`)
      return escapeHtml(value)
    }
  )

  const rendered = toolsRendered.replace(
    /\{\{staff\.([A-Za-z]+)\.([A-Za-z]+)\}\}/g,
    (token, targetId, field) => {
      const value = staffTemplateValue(staffTargets, targetId, field)
      if (typeof value !== 'string') throw new Error(`Unknown staff template token: ${token}`)
      return field === 'linkAttributes' ? value : escapeHtml(value)
    }
  )

  if (rendered.includes('{{tool.') || rendered.includes('{{staff.')) {
    throw new Error(`Unresolved template token in ${sourcePath}`)
  }
  await writeFile(outputPath, versionLocalAssets(rendered, assetVersion))
}

export async function build() {
  const mainOutput = resolve(distRoot, 'main')
  const supportOutput = resolve(distRoot, 'support')
  const supportStaffOutput = resolve(distRoot, 'support-staff')
  const staffOutput = resolve(distRoot, 'staff')
  const staffTargets = await loadStaffTargets()
  const assetVersion = await computeAssetVersion()

  await rm(distRoot, { recursive: true, force: true })
  await mkdir(mainOutput, { recursive: true })
  await mkdir(supportOutput, { recursive: true })
  await mkdir(supportStaffOutput, { recursive: true })
  await mkdir(staffOutput, { recursive: true })

  await copySharedAssets(mainOutput)
  await copySharedAssets(supportOutput)
  await copySharedAssets(supportStaffOutput)
  await copySharedAssets(staffOutput)

  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'hub', 'index.html'),
    resolve(mainOutput, 'index.html'),
    {},
    assetVersion
  )
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'hub', '404.html'),
    resolve(mainOutput, '404.html'),
    {},
    assetVersion
  )

  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'support', 'index.html'),
    resolve(supportOutput, 'index.html'),
    {},
    assetVersion
  )
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'support', '404.html'),
    resolve(supportOutput, '404.html'),
    {},
    assetVersion
  )
  await cp(resolve(repositoryRoot, 'apps', 'datecalc'), resolve(supportOutput, 'datecalc'), {
    recursive: true
  })
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'datecalc', 'index.html'),
    resolve(supportOutput, 'datecalc', 'index.html'),
    {},
    assetVersion
  )

  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'staff', 'index.html'),
    resolve(staffOutput, 'index.html'),
    staffTargets,
    assetVersion
  )
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'staff', '404.html'),
    resolve(staffOutput, '404.html'),
    {},
    assetVersion
  )
  await mkdir(resolve(staffOutput, 'qa'), { recursive: true })
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'qa-staff', 'index.html'),
    resolve(staffOutput, 'qa', 'index.html'),
    staffTargets,
    assetVersion
  )

  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'support-staff', 'index.html'),
    resolve(supportStaffOutput, 'index.html'),
    staffTargets,
    assetVersion
  )
  await renderTemplate(
    resolve(repositoryRoot, 'apps', 'support-staff', '404.html'),
    resolve(supportStaffOutput, '404.html'),
    {},
    assetVersion
  )

  return {
    distRoot,
    assetVersion,
    mainOutput,
    staffOutput,
    protectedStaffOrigins: [...new Set(Object.values(staffTargets).map(value => new URL(value).origin))],
    staffTargetsConfigured: Object.keys(staffTargets).length,
    supportStaffOutput,
    supportOutput
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputs = await build()
  console.log(`Built ${outputs.mainOutput}`)
  console.log(`Built ${outputs.supportOutput}`)
  console.log(`Built ${outputs.staffOutput}`)
  console.log(`Built ${outputs.supportStaffOutput}`)
  console.log(`Configured ${outputs.staffTargetsConfigured}/17 protected Staff targets`)
}
