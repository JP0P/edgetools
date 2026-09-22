# EdgeTools

EdgeTools is Edge Wallet's resource and utility directory. The repository
builds the public catalog, four local browser tools, and protected staff surfaces:

- `edgetools.app` — the one public catalog, with `/fio/`, `/token/`, `/status/`,
  and `/orders/` local tool routes.
- `support.edgetools.app` — a lean legacy handoff to the official Help Center
  plus the protected Support workspace.
- `staff.edgetools.app` — a restricted company-wide router for department
  workspaces and shared staff resources, including the focused `/qa/`
  workspace.
- `support.edgetools.app/staff/` — a restricted, Support-specific workflow
  launcher for customer response, investigation, account access and device
  authorization, and service diagnostics.

The public site is static-only. The only runtime is two narrow, stateless
public API routes on a dedicated public Worker; there are no
analytics, account system, secrets, or retained user data. The Staff surfaces
are only launchers:
production must protect the Staff host and the Support `/staff/` route with
Google-backed Cloudflare Access, and each linked destination remains
responsible for its own authorization. Staff target URLs are injected during a
private build and are never committed to this public repository.

## Local development

Requirements: Node.js 24 or newer.

```bash
npm run check
npm run preview
```

The preview defaults to `http://127.0.0.1:4173`. Its local routes mirror the
production hosts and protected paths:

- `/` — main EdgeTools directory
- `/support/` — legacy Help Center and Support Staff handoff
- `/support/staff/datecalc/` — protected DateCalc
- `/fio/`, `/token/`, `/status/`, `/orders/` — public tool previews
- `/staff/` — company-wide Staff hub; local preview does not simulate Google
  login
- `/staff/qa/` — QA staff workspace; local preview does not simulate Google
  login
- `/support/staff/` — Support staff workspace; local preview does not simulate
  Google login
- `/support/staff/account-access/` — protected Account Access & Device
  Authorization workflow; local preview does not simulate Google login

To share a temporary preview over a private network, bind the server to the
machine's private interface:

```bash
npm run preview -- --host <private-interface-ip>
```

Do not bind a development preview to a public interface.

## Staff target configuration

For a local review, create ignored `config/staff-targets.local.json` with any of
these keys:

- Company-wide hub: `teamGuide`, `releasePlanning`, `hudl`, `reports`,
  `posthog`, and `prometheus`
- QA staff: `zealot`, `testrail`, `sentry`, `jenkins`, `browserstack`, and
  `unifi`
- Support staff: `voucher` (the legacy target identifier for the authorization
  request destination), `userLookup`, `internalTools`, `logsUpload`, and
  `intercomInbox`

Cloudflare Workers Builds provide the matching build-time environment
variables for the protected outputs:

- `EDGETOOLS_GLOBAL_STAFF_TEAM_GUIDE_URL`
- `EDGETOOLS_GLOBAL_STAFF_RELEASE_PLANNING_URL`
- `EDGETOOLS_GLOBAL_STAFF_HUDL_URL`
- `EDGETOOLS_GLOBAL_STAFF_REPORTS_URL`
- `EDGETOOLS_GLOBAL_STAFF_POSTHOG_URL`
- `EDGETOOLS_GLOBAL_STAFF_PROMETHEUS_URL`
- `EDGETOOLS_QA_STAFF_ZEALOT_URL`
- `EDGETOOLS_QA_STAFF_TESTRAIL_URL`
- `EDGETOOLS_QA_STAFF_SENTRY_URL`
- `EDGETOOLS_QA_STAFF_JENKINS_URL`
- `EDGETOOLS_QA_STAFF_BROWSERSTACK_URL`
- `EDGETOOLS_QA_STAFF_UNIFI_URL`
- `EDGETOOLS_SUPPORT_STAFF_VOUCHER_URL`
- `EDGETOOLS_SUPPORT_STAFF_USER_LOOKUP_URL`
- `EDGETOOLS_SUPPORT_STAFF_INTERNAL_TOOLS_URL`
- `EDGETOOLS_SUPPORT_STAFF_LOGS_URL`
- `EDGETOOLS_SUPPORT_STAFF_INTERCOM_URL`

Only credential-free HTTPS URLs are accepted, except the exact internal
Jenkins origin `http://jack2:8080`. Missing targets render as disabled cards;
they are not silently guessed. Set
`EDGETOOLS_STAFF_TARGETS_FILE` to use a different private JSON file during a
build.

## Production deployment

- `.do/app.static.yaml` defines the two public static components and routes
  `edgetools.app` and `support.edgetools.app` by hostname. DigitalOcean builds
  only `dist/main` and `dist/support` from `JP0P/edgetools:main`.
- The exact `edgetools.app/api/status` and `edgetools.app/api/token` routes are
  attached to the dedicated `edgetools-public-api` Worker. They are public
  routes with no private Support headers. The status route aggregates a fixed
  upstream list; the token route exposes only validated CoinGecko lookups.
- `wrangler.staff.jsonc` deploys `dist/staff` as the origin for the entire
  `staff.edgetools.app` hostname.
- `wrangler.support-staff.jsonc` deploys `dist/support-staff` only on
  `support.edgetools.app/staff` and `/staff/*`.
- All three Workers disable `workers.dev` and preview URLs. Cloudflare Access must
  protect the whole Staff hostname plus both Support Staff paths.

The protected Worker builds need the relevant target URL variables above.
Those values belong in Cloudflare build settings, not this public repository.
The public DigitalOcean build needs none of them.

## Commands

```bash
npm run build          # create the two public and two protected static outputs
npm test               # unit and source-contract tests
npm run check:links    # verify local routes and live external links
npm run check:deploy   # dry-run all three Worker bundles
npm run check:secrets  # scan the repository with gitleaks
npm run check          # build, test, link check, and secret scan
npm run deploy:staff   # require global Staff URLs, then deploy that Worker
npm run deploy:support-staff # require Support Staff URLs, then deploy that Worker
npm run deploy:public-api # deploy the exact public API routes
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for host routing and deployment
boundaries. See [DEPLOYMENT.md](DEPLOYMENT.md) for the release, verification,
and rollback checklist. See [public-tools-manifest.json](public-tools-manifest.json)
for pinned source provenance and selective migration notes.
