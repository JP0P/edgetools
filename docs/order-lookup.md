# Order Lookup contracts

Reviewed 2026-11-18. This is a local link resolver, not an order-status service.
No provider is queried, and no order existence, status or ownership is verified.
All examples/tests use synthetic values, not customer orders.

## Sources and coverage

- Swap registry: [edge-exchange-plugins at 5a49641](https://github.com/EdgeApp/edge-exchange-plugins/blob/5a49641f69eab6c10dc9b0c14db53095dbb294b5/src/index.ts).
  All 30 registered integrations are in the selector. This is source coverage,
  not a claim that every provider is enabled for every region, asset or build.
- Fiat registry: [edge-react-gui at 9b9b551](https://github.com/EdgeApp/edge-react-gui/tree/9b9b5513c025419d0a5cd0cd7309cfe3fc671e34/src/plugins).
  The union of `gui/amountQuotePlugin.ts` providerFactories and
  `ramps/allRampPlugins.ts` is 13 providers. Payment-method aliases are not
  separate providers. Ionia rewards/gift cards are not buy/sell orders.
- LetsExchange is retained as an explicitly legacy receipt handoff, not called
  a currently registered Edge provider.

Direct swap templates are taken from these files under the pinned swap source:

| Provider IDs | Source under src/swap | Saved order URL |
|---|---|---|
| bridgeless | defi/bridgeless.ts | tss1.mainnet.bridgeless.com/check/{chainId}/{0xTxid}/{outputIndex} |
| changehero | central/changehero.ts | changehero.io/transaction/{id} |
| changenow | central/changenow.ts | changenow.io/exchange/txs/{id} |
| exolix | central/exolix.ts | exolix.com/transaction/{id} |
| godex | central/godex.ts | godex.io/exchange/waiting/{id} |
| houdini | central/houdini.ts | app.houdini.com/order-details?houdiniId={id} |
| nexchange | central/nexchange.ts | n.exchange/order/{unique_reference} |
| nymswap | central/nym.ts | swap.nym.com/orderStatus/{orderId} |
| rango | defi/rango.ts | explorer.rango.exchange/search?query={trackingId} |
| sideshift | central/sideshift.ts | sideshift.ai/orders/{id} |
| mptrade, mptradedefi | central/mptrade.ts, defi/mptradeDefi.ts | scan.swaps.xyz/transactions/{txId} |
| swapter | central/swapter.ts | swapter.io/exchange-status/{uid} |
| swapuz | central/swapuz.ts | swapuz.com/order/{uid} |
| mayaprotocol | defi/thorchain/mayaprotocol.ts | www.mayascan.org/tx/{txId} |
| thorchain | defi/thorchain/thorchain.ts | track.thorchain.org/{txId} |
| xgram | central/xgram.ts | xgram.io/exchange/order?id={id} |

Bridgeless path separators are structural, not percent-encoded as one ID.
Rango sometimes saves a destination-address search instead; the UI directs the
user back to that original link rather than guessing an address from an ID.
MoonPay Trade's two registrations intentionally share a tracker and remain
two candidates when a pasted URL cannot distinguish the venue.

Changelly returns a per-order `trackUrl`; it is not derived here. LI.FI,
SwapKit, SwapKit V3, Unizen, SpookySwap, TombSwap, Velodrome, Cosmos IBC, XRP
DEX, Transfer and Fantom/Sonic Upgrade have no saved reconstructible template.
0x Gasless uses the wallet's network-specific transaction explorer. Each has
an explicit original-transaction/receipt handoff, with no guessed URL.

Fiat links use the pinned GUI source:

| Provider | Source / limitation |
|---|---|
| Banxa | ramps/banxa/banxaRampTypes.ts default host + banxaRampPlugin.ts status path; other checkout hosts must use their receipt |
| Paybis | ramps/paybis/paybisRampTypes.ts + paybisRampPlugin.ts orderUri; requires requestId, not an arbitrary payment ID |
| Kado | gui/providers/kadoProvider.ts widget/ramp/order/{orderId} |
| MoonPay | ramps/moonpay/moonpayRampTypes.ts widget hosts + moonpaySellOrder.ts receipt path; prior buy-receipt template retained, buy/sell explicit |

Bity, Simplex, Kado OTC, Mt Pelerin, Revolut, DFX, Infinite, LibertyX and Bits
of Gold have receipt/account guidance, not invented deep links. The old Bity
Sophia and Simplex hash-route templates were not substantiated as current.

## Identification and privacy

- A known HTTPS tracking URL is parsed only against exact allowlisted
  host/path/query templates. Extra parameters, fragments, credentials, ports,
  unsupported hosts and unsafe IDs are rejected. Only a rebuilt allowlisted
  URL can become an outgoing link; arbitrary URLs are never forwarded.
- An explicitly chosen provider is a user assertion, not a verified identity.
- Raw IDs produce only non-exhaustive format candidates. Observed eleven-character lowercase alphanumeric Swapuz IDs are suggested as candidates, never identified as proven orders. Short n.exchange,
  ChangeNOW, Banxa and SideShift shapes are hints, never exclusive schemas.
  UUIDs retain multiple candidates; no provider is auto-selected.
- Hex hashes are shared by many chains and trackers, with or without `0x`.
  They are never called Bitcoin or a particular EVM chain. Solana signatures
  are also only format candidates. No live chain existence is checked.
- The browser has no persistence, ID-bearing query strings, API calls, Intercom
  or analytics. A restrictive CSP blocks third-party scripts and all network
  connections. Explicit outbound links send the ID only to the chosen
  destination, with `noopener noreferrer` and no referrer.
- SideShift warns that an ID can authorize order actions. Its
  [official FAQ](https://docs.sideshift.ai/faq/) confirms that sensitivity.
- The page does not modify, cancel, refund or create any order.

## Optional Intercom connector endpoint

`POST https://edgetools.app/api/orders/resolve`

```json
{ "input": "synthetic_order-123", "provider": "swapuz" }
```

`provider` is optional and uses the catalog ID, not its display name. The
response is the same pure resolver result used by the page:

- `kind`: resolved, candidates, or unknown;
- `evidence`: provider-selected, tracking-url, or format-only;
- `verified: false` always; no live status claim;
- `requiresProviderConfirmation`: true for raw format-only input or a tracker
  URL shared by multiple integrations (identity uncertainty only, not a required UI step);
- normalized `orderId`, provider `matches` with `links`/receipt `note`,
  and optional shared-format `transaction` explorer options.

**A connector must not turn a candidate into a provider identification or
claim an order is found.** Ask for the provider in Edge/receipt, then resolve
again with that selected provider. Receipt-only matches have no direct links.
Do not pass a customer conversation, credentials or unrelated fields.

The handler accepts only JSON objects with `input` and optional `provider`.
It rejects GET/query input, extra fields, encoded bodies, unsafe values and
bodies above 4096 bytes, including chunked bodies. Responses are no-store;
there is no CORS, provider fetch, credential proxy, cache, database, queue,
request-body logging or retention. Worker observability is disabled. The host
platform may still process request metadata under its own policies.

The browser displays direct destination links for candidates. Clicking the link is the
provider choice; there is no intermediate confirmation button.

### Deployment and cost

No new runtime, binding, secret or paid product is introduced. The existing
`edgetools-public-api` Worker gets only the route
`edgetools.app/api/orders/resolve*`; application routing still accepts only
the exact path. workers.dev and preview URLs remain disabled. The browser
does not depend on this endpoint.

[Cloudflare's current Free limits](https://developers.cloudflare.com/workers/platform/pricing/)
are 100,000 requests/day and 10 ms CPU/invocation, shared with the existing
account allowance. Each connector call consumes an invocation, with no
upstream calls. Traffic/abuse can exhaust that shared allowance; do not enable
paid Workers automatically. Verify the account plan and quota before rollout.
No live Worker or connector is changed by this PR.

After merge, deploy the public API Worker through its existing pipeline and
verify POST success/no-store, GET 405, invalid JSON 400, large body 413,
unknown paths/wrong hosts 404. Deploy the static page independently and verify
desktop/mobile local matching, receipt handoffs and third-party isolation.
Roll back the static deployment and public Worker to the captured pre-release
versions independently; no migration or stored order data needs rollback.
