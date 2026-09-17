# EdgeTools production deployment

This checklist keeps the public and protected surfaces independently
recoverable. It contains no credentials or private destination URLs.

## Release sequence

1. Merge a green pull request into `JP0P/edgetools:main`.
2. Build the protected outputs with all six Staff destination variables set.
3. Deploy the two Cloudflare Workers and confirm their alternate
   `workers.dev` and preview URLs are disabled.
4. Create or update the DigitalOcean static App from `.do/app.static.yaml`.
5. Point the proxied Cloudflare records for `edgetools.app` and
   `support.edgetools.app` at the DigitalOcean App origin.
6. Protect the entire `staff.edgetools.app` host plus both
   `support.edgetools.app/staff` and `support.edgetools.app/staff/*` with the
   approved Edge staff Google Access policy.
7. Run the verification checklist below before announcing the release.

## Capture before cutover

- merged Git commit SHA;
- last known-good DigitalOcean deployment ID;
- deployed version ID for each Worker;
- current Access application and policy configuration;
- existing Cloudflare DNS targets and proxy state.

## Verification

- `https://edgetools.app/` returns the Main surface without authentication.
- `https://support.edgetools.app/` and `/datecalc/` return the public Support
  surfaces without authentication.
- Anonymous requests to `https://staff.edgetools.app/`,
  `https://support.edgetools.app/staff`, and
  `https://support.edgetools.app/staff/` go to Cloudflare Access.
- An approved staff identity reaches both Staff surfaces; a non-approved
  identity does not.
- Authenticated Staff responses include `private, no-store`, `noindex`, and
  frame-denial headers.
- The voucher form, User Lookup, Matthew's internal tools, shared guide,
  release planning, and HUDL links are active and open their canonical targets.
- Each linked protected destination still enforces its own login and
  authorization.
- Neither Worker is reachable through a `workers.dev` or preview URL.
- The DigitalOcean starter domain exposes no Staff content.

## Rollback

1. Restore the prior DNS targets if routing is the failure.
2. Roll back each Worker to its captured version if a protected surface is the
   failure.
3. Redeploy the last known-good DigitalOcean deployment if a public surface is
   the failure.
4. Restore the captured Access policy if authentication or eligibility is the
   failure.
5. Revert the merged Git commit when the source revision itself is defective.
6. Repeat the relevant verification checks and record the final live IDs.
