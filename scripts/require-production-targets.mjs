const requiredTargets = {
  global: [
    'EDGETOOLS_GLOBAL_STAFF_TEAM_GUIDE_URL',
    'EDGETOOLS_GLOBAL_STAFF_RELEASE_PLANNING_URL',
    'EDGETOOLS_GLOBAL_STAFF_HUDL_URL'
  ],
  support: [
    'EDGETOOLS_SUPPORT_STAFF_VOUCHER_URL',
    'EDGETOOLS_SUPPORT_STAFF_USER_LOOKUP_URL',
    'EDGETOOLS_SUPPORT_STAFF_INTERNAL_TOOLS_URL'
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
