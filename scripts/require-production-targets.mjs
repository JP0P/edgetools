const requiredTargets = {
  global: [
    'EDGETOOLS_GLOBAL_STAFF_TEAM_GUIDE_URL',
    'EDGETOOLS_GLOBAL_STAFF_RELEASE_PLANNING_URL',
    'EDGETOOLS_GLOBAL_STAFF_HUDL_URL',
    'EDGETOOLS_GLOBAL_STAFF_REPORTS_URL',
    'EDGETOOLS_GLOBAL_STAFF_POSTHOG_URL',
    'EDGETOOLS_GLOBAL_STAFF_PROMETHEUS_URL',
    'EDGETOOLS_QA_STAFF_ZEALOT_URL',
    'EDGETOOLS_QA_STAFF_TESTRAIL_URL',
    'EDGETOOLS_QA_STAFF_SENTRY_URL',
    'EDGETOOLS_QA_STAFF_JENKINS_URL',
    'EDGETOOLS_QA_STAFF_BROWSERSTACK_URL',
    'EDGETOOLS_QA_STAFF_UNIFI_URL'
  ],
  support: [
    'EDGETOOLS_SUPPORT_STAFF_VOUCHER_URL',
    'EDGETOOLS_SUPPORT_STAFF_USER_LOOKUP_URL',
    'EDGETOOLS_SUPPORT_STAFF_INTERNAL_TOOLS_URL',
    'EDGETOOLS_SUPPORT_STAFF_LOGS_URL',
    'EDGETOOLS_SUPPORT_STAFF_INTERCOM_URL'
  ]
}

const scope = process.argv[2]
if (!requiredTargets[scope]) {
  throw new Error(`Expected target scope: ${Object.keys(requiredTargets).join(' or ')}`)
}

const missing = requiredTargets[scope].filter(name => !process.env[name])
if (missing.length > 0) {
  throw new Error(`Missing production Staff target variables: ${missing.join(', ')}`)
}

console.log(`Production ${scope} Staff target variables are present.`)
