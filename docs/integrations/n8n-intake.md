# n8n → Partheanon receiver: handoff v1.1

## Status and destination

The wire schema remains `partheanon.sync.v1`; producer version remains `0.1.0`. The October 23 documentation revision does not change either field.

POST `https://partheanon-forge.athena-works-8404.chatgpt.site/api/ingest`.

The receiver supports the ten supplied synthetic envelopes, additive initial/reconcile loads, typed explicit removals, conservative deferred evidence, durable full-envelope receipts and authenticated receipt lookup. All ten were exercised against local HTTP/D1 storage and dashboard readback. This is receiver verification, **not a delivery from the saved n8n worker to the real destination**. No live workflow, destination, schedule, provider data or mock cursor was changed. Keep the source schedule off and delivery at the authenticated mock until the supervised pilot below succeeds.

Worker: [jjRqawJGHl7gBDZc](https://athenaworx.app.n8n.cloud/workflow/jjRqawJGHl7gBDZc), node **Deliver Batch To Partheanon**. Parent: [DIUOAic0rr2fESrT](https://athenaworx.app.n8n.cloud/workflow/DIUOAic0rr2fESrT). Current mock: `https://athenaworx.app.n8n.cloud/webhook/partheanon-mock-ingest`.

Evidence: Rob supplied the consolidated v1.1 handoff and ten bodies from the saved worker, referencing Operating Record v1.8 and worker-export SHA-256 `35759d27ac634edf409efe98cd34c287d36a2f3d101e26281bc6601f068c9684`. This source graph/hash was not independently fetched. Checked-in [synthetic fixture bodies](../../scripts/tests/fixtures/n8n-v11) reproduce the supplied examples; none contains real source content or credentials.

## Authentication, ownership and HTTP

The Site remains owner-private. Two independent credentials are required:

- `OAI-Sites-Authorization: Bearer <existing Site service-access credential>` — hosting access; no browser identity or app consent.
- `Authorization: Bearer <account-scoped intake key>` — application write/read-receipt permission. Connections → n8n intake creates/revokes these. Only SHA-256 hashes are stored; keys expire after 90 days.

Use destination-specific n8n credential storage. Never use browser cookies or put secrets in URLs, Code/Set nodes, workflow exports, repository files or execution logs. Do not reuse the mock's credential. Service access alone cannot create application keys. Removing an account clears its intake streams, records, deferred evidence and receipts, and revokes its keys. Revocation alone stops future delivery but preserves existing records and receipts.

Application keys restrict provider, configured account, calendar and mailbox IDs. The pilot uses calendar `primary` and mailbox `all_mail`; that mailbox alias permits only the supported INBOX scope, not whole-mailbox reconciliation. Owner and lane come from server-owned Connections. A separate receiver-owned namespace isolates v1.1 streams from the earlier unpublished compatibility streams and numeric-schema harness. Destination databases isolate local and hosted data. Key rotation does not reset a stream.

Required nonsecret headers:

```text
Content-Type: application/json
Idempotency-Key: <exact body batchId>
X-Partheanon-Schema: partheanon.sync.v1
```

One complete resource envelope per POST, with the fourteen fields supplied in the handoff. No mixed resources, wrapper objects, ingest_url, result_base or provider cursor fields. The worker aggregates pages; **do not split an authoritative envelope into independently accepted pages**.

Limits: 1 MiB streamed UTF-8 JSON; up to 400 Gmail upserts or 2,000 Calendar upserts, up to 2,000 entries per removal array, 5,000 combined entries, coverage pagesFetched ≤20. Resource limits can reject a sender scan that is too large; reduce its configured scope before retrying, never truncate it into a falsely complete scan. The larger byte bound accommodates 400 metadata records, including Unicode subjects. Streams retain at most 5,000 record identities and 5,000 deferred entries. Rate limit is 60 POSTs/minute/key, with Retry-After: 60 on HTTP 429.

Strict validation covers identities, recordKeys, all array counts, mode/authoritative consistency, complete=true, UTC-day bounds, minimal field allowlists, timestamp validity and duplicate IDs across all three arrays. A malformed/incomplete batch receives no successful receipt and applies no records. Full Gmail scans cannot supply history deletions or generic out_of_scope exits; full Calendar scans cannot supply scope exits, matching the supplied worker paths.

## Additive baseline, rolling scope and legacy rows

Incremental-only streams stay unpublished. A complete initial or reconcile envelope establishes an **additive** baseline and publishes accepted records. Missing records are retained: **absence pruning is disabled for all modes, including complete empty authoritative reconciliation**. A receiver CAS serializes commits, but cannot prove when a provider scan began. Neither generatedAt nor a batch hash is a source snapshot barrier. A delayed full scan therefore has no authority to hide newer or absent records.

The stable stream identity includes destination database, owner, provider, account, resource, container and logical scope membership (INBOX/alignment). Rolling receipt/calendar boundaries are stored in stream state rather than creating a new stream daily. Older generatedAt values cannot regress the display window; advancing bounds are monotonic. Aged-out rows are reversibly hidden by the retained display window, remain stored, and may reappear with a valid newer update/window. They are never reclassified as provider-deleted merely because they aged out.

Unmapped legacy cache items remain stored **and visible** alongside the new import. They are not adopted or deduplicated by title, sender, thread ID or iCalUID. This can show duplicates until a deliberate account/container/source-ID ownership map is reviewed. User-created commitments, tasks, work logs and provider data remain outside reconciliation authority. Numeric-schema test-harness streams keep their original behavior; see [the legacy contract](n8n-legacy-intake.md).

Calendar coverage remains provisional because absence pruning and legacy migration are unresolved; Aegis must not present that time as confirmed availability. Connections reports pending evidence and recent receipts. Source status notes explain retained legacy rows and provisional coverage.

## Versions, removals and deferred evidence

Gmail messageId is the Gmail provider ID. History IDs are kept exactly as strings. Ordering uses decimal-string length/digits without Number conversion. Unsupported nondecimal versions are rejected. Calendar known timestamps normalize to UTC for comparison. A newer known version can update or restore its exact imported record. Older versions are ignored with a stale count. Equal-version identical data is unchanged; conflicting state/content is durably deferred instead of using arrival order to guess a winner.

States are reversible local markers, recorded with reason and evidence batch:

| Input | State/effect |
| --- | --- |
| Gmail deletions, kind deleted_at_source | source_deleted, exact imported ID only, when version ordering is known |
| Calendar deletions, kind cancelled | cancelled, exact occurrence/sourceId only, when version ordering is known |
| Gmail scopeExits | scope_exit with the supplied reason; never source deletion |
| Calendar outside_window exit | scope_exit only with a known newer version and a previously owned timed-event shape |
| Valid newer record after a hidden state | active; restores that one scope membership |

All six Gmail reasons are preserved: out_of_scope, left_scope, source_not_found, outside_window, spam, trashed. Generic exclusion or a 404 is never promoted to explicit source deletion. Unknown IDs with known ordering may receive bounded local evidence/tombstones; no wider legacy/source search is performed. A series ID/iCalUID never broadens a cancellation beyond its exact supplied sourceId.

Sparse cancellations need no title/start/end. Timed originalStartTime and date-only all-day originalStartTime are preserved exactly in durable envelopes/evidence. A null sourceUpdatedAt is **not replaced with generatedAt**. Null-version records and removals are retained as deferred candidates and do not alter an existing record or fabricate a tombstone. Thus A4's sparse occurrence cancellation and A8's two null-version occurrences remain pending. This intentionally does not claim that every cancellation was applied.

Known-version Calendar outside_window exits are also deferred for unknown/all-day prior shapes. All-day record boundaries use their named timezone, including DST; ambiguous all-day records at the window boundary are deferred. No all-day absence inference runs. Gmail exactly-at-cutoff rows are retained because absence never prunes; an explicit receipt-window exit that disagrees with the previously owned receivedAt is deferred too.

Deferred evidence is durable, visible in Connections (latest 50), and counts toward a bounded stream quota. This release has no automatic adjudicator or apply-pending control: a missing/ambiguous version must be resolved through reviewed receiver/sender evidence or an explicit future resolution feature. A later known source update does not silently erase the historical deferred evidence. Coverage remains provisional. Raw minimal accepted envelopes and receipts remain until the account is removed; no automatic retention purge currently runs.

Imported sender/subject/title text is rendered through escaped React text; no source links, HTML, Markdown actions or automatic fetches are added. Intake never fetches fuller email/event content and cannot send mail or alter provider calendars. Aegis receives source records as untrusted planning context, not privileged instructions.

## Durable acknowledgment and replay recovery

Atomic D1 acceptance commits stream CAS/generation, ordered record effects, deferred evidence, full validated envelope and receipt together. No successful acknowledgment is sent until that commit completes. Acceptance means **safely received under this conservative policy**, not that every proposed removal was applied. The sender/operator must agree to this distinction before cutover.

Example response (counts depend on the envelope):

```json
{"ok":true,"batchId":"gsync_35d35c799697ba99735ef78a494e4f0d6ff34402","status":"accepted","applied":1,"deferred":1,"absencePruning":"disabled","coverage":"provisional"}
```

Additional fields include unchanged/stale counts, receivedAt, sequence, published, baseline and receiptDigest. The exact batchId/status accepted or duplicate satisfy the existing sender check. An HTTP success without matching JSON must never advance a source cursor.

The SHA-256 replay fingerprint covers the complete validated logical envelope except top-level generatedAt. Object keys are recursively sorted; string values and array order remain significant. Regenerated generatedAt and object-key reordering are compatible. Changed record text, source versions, scope, coverage, producer or any other stable field under the same batchId returns 409. The reduced sender batch hash alone is not treated as payload equality. Compatible replays return the original receipt details with status duplicate and do not reapply evidence or increase counts. Timestamps still must validate.

For a response-lost outcome, use exact-envelope replay or authenticated lookup with the same two credentials:

```text
GET /api/ingest?batchId=<complete gsync_ batch ID>
```

Lookup returns the committed receipt/status/counts/digest only; it never exposes the stored envelope or key. Account/container authorization is enforced again. HTTP 404 means no scoped committed receipt was found, not proof that an in-flight request failed. A hash can be compared against the canonical logical envelope when recovering a conflicted sender state. Do not advance a cursor on receipt mismatch, 404 or a lookup timeout. Preserve the minimal pending logical envelope securely until matching acceptance; a fresh provider read need not reproduce it.

Errors: 401 invalid/expired/revoked application key; 403 scope/account removed; 404 missing scoped receipt; 409 reused batch ID/concurrency/capacity/ambiguous lookup; 413 byte budget; 415 media type; 422 invalid contract/incomplete scan; 429 rate limit; 503 uncommitted/uncertain storage failure. Private hosting may instead return a denial/login redirect. HTML is not an acknowledgment. Concurrent losers retry the same logical envelope and replan against the new stored versions.

## Supervised real-destination pilot — still outstanding

1. Leave the source schedule off and preserve the mock destination, credentials, cursors and receipts. Do not switch the production worker URL alone.
2. Review this acceptance policy: additive baseline, no absence pruning, deferred ambiguous versions, provisional coverage and retained legacy rows. Configure two destination-specific credentials in n8n; no secrets in chat.
3. Create separate **real-destination** cursor/pending-envelope/idempotency state keyed by environment + endpoint + authorized import/account + resource + container + logical scope. Do not reuse mock-advanced cursors, erase the mock state or clear Command Center records.
4. Use a dedicated manual test route with synthetic payload identities matching a disposable configured account and its restricted key. Verify a real HTTP accepted response, receipt lookup, dashboard readback, compatible duplicate, changed-content rejection, invalid-key/container rejection, known-version update, exact cancellation, scope exit/re-entry, null-version deferral and empty delta/full retention. Replay and lookup must recover an intentionally interrupted/lost response. The ten fixture identities alone are not an authorized real account.
5. For the first real account, start a fresh bounded initial load (Gmail INBOX from the approved cutoff; Calendar from the approved window), serially for that destination. Check actual stored/displayed rows, review counts, receipts and legacy duplicates. Keep internal Partheanon provider syncing off (enforced server-side); Notion remains separate.
6. Confirm the baseline and manual incremental/no-change cycle before separately enabling a source schedule. Automatic absence pruning requires a separate snapshot/barrier protocol and reviewed ownership/timezone/cutoff rules; it is not enabled by this pilot.

Copy-ready [receiver return handoff](n8n-receiver-return-v1.1.md) summarizes what the n8n assistant should configure and what remains unverified.

## Local verification

```sh
node --test lib/ingest-contract.test.mjs lib/ingest-worker-contract.test.mjs lib/ingest-worker-plan.test.mjs lib/sync-policy.test.mjs
python3 scripts/tests/ingest-v11-integration.py
python3 scripts/tests/ingest-worker-integration.py
python3 scripts/tests/ingest-integration.py
python3 scripts/tests/ingest-projection.py
npx tsc --noEmit
```

The Python scripts are localhost-only and use disposable synthetic data/keys. The v1.1 test delivers all ten bodies separately, verifies full-envelope/receipt persistence and authenticated lookup, expected seven deferred entries across the supplied fixtures, initial dashboard projection, source-version protection, typed removals, re-entry, rolling-scope continuity, and credential isolation. Regression tests cover concurrency, replay conflicts, size bounds and key revocation. A read-only hosted probe verifies hosting denial and invalid application-key rejection, without inserting records.

Official semantics checked while implementing: [Gmail history versions](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list), [Calendar cancellation resource](https://developers.google.com/workspace/calendar/api/v3/reference/events), [Calendar overlap query bounds](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Calendar/all-day timezone rules](https://developers.google.com/workspace/calendar/api/concepts/events-calendars#time_zones). These provider references do not establish an atomic sender snapshot or resolve the documented sender boundary discrepancies.


## Sender interoperability and supervised pilot preparation

See [the interoperability fixture pack](interop-v1.1/README.md) for the pinned receiver canonicalization helper, exact expected digests, accepted/lookup/duplicate examples, secure provisioning path, hosted acceptance checklist and remaining sender/receiver work. These are preparation artifacts; no live delivery or production activation is implied.
