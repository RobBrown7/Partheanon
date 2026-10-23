# n8n → Partheanon: saved worker compatibility

## Status — October 23, 2026

The actual sender is [worker jjRqawJGHl7gBDZc](https://athenaworx.app.n8n.cloud/workflow/jjRqawJGHl7gBDZc), node **Deliver Batch To Partheanon**. Its parent is [orchestrator DIUOAic0rr2fESrT](https://athenaworx.app.n8n.cloud/workflow/DIUOAic0rr2fESrT). The supplied handoff references Operating Record v1.8 and a 20-node worker graph. We have synthetic output examples, not a current inspection/export of that graph or a real delivered request.

**Keep the source schedule off and delivery at the authenticated mock.** The receiver now accepts the supplied nonempty and empty incremental Google examples. This is staged compatibility, not a production-ready cutover: initial/reconcile envelopes, authoritative coverage, nonempty deletions/scopeExits and calendar records with null sourceUpdatedAt are rejected with JSON 422 until their missing contracts and ordering rules are verified. The entire delivery is rejected; no receipt or record changes are committed for those cases. An incremental delivery cannot establish initial coverage or publish a new stream into the dashboard.

Current mock: `https://athenaworx.app.n8n.cloud/webhook/partheanon-mock-ingest`.

Real destination, once the acceptance gate below passes:

`https://partheanon-forge.athena-works-8404.chatgpt.site/api/ingest`

## Authentication and HTTP contract

The Site stays owner-private. Each request requires two independent credentials:

- `OAI-Sites-Authorization: Bearer <Site service-access credential>` — private hosting access, without browser identity or app consent.
- `Authorization: Bearer <account-scoped intake key>` — application write authorization. Create/revoke it in Connections → n8n intake. Only its SHA-256 hash is stored; keys expire in 90 days.

Keys are bound to the signed-in owner, configured provider/account and explicit calendar/mailbox container IDs. The Google examples use calendar `primary` and mailbox `all_mail`; the email envelope separately declares an INBOX scope. Metadata cannot choose an owner, lane or dashboard source. Removing a configured account clears its intake state and revokes its keys.

Store both headers in destination-specific n8n credentials. Never put credentials in URLs, Code/Set nodes, workflow exports, chat, source, successful-execution payload logs or browser cookies. Do not reuse the mock credential. Keep n8n access authenticated and its execution retention limited.

Use POST and Content-Type application/json, plus:

- `Idempotency-Key`: exact body batchId.
- `X-Partheanon-Schema`: `partheanon.sync.v1`.

Both headers are required and must match. Limit each request to 256 KiB and 200 upserts; rate limit is 60 deliveries/minute/key. HTTP 429 includes Retry-After: 60. Account/container mismatch returns 403, invalid/expired/revoked application credential 401, schema or unverified semantics 422, reused batch ID/stale delivery/concurrency/capacity conflict 409, storage failure 503. Hosting denial may instead be 403 or a login redirect; HTML is never an acknowledgment.

## Exact supplied payloads

The checked-in **synthetic** fixtures reproduce the handoff's two separate POST bodies:

- [Gmail incremental envelope](../../scripts/tests/fixtures/n8n-gmail.json)
- [Calendar incremental envelope](../../scripts/tests/fixtures/n8n-calendar.json)

Send one resource/cursor envelope per request. Do not combine examples or include ingest_url, result_base, provider cursors or n8n item wrappers. The body has the sender's 14 top-level fields: schemaVersion, batchId, provider, account, resourceType, syncMode, container, scope, records, deletions, scopeExits, coverage, generatedAt, producer. The receiver validates strict fields, matching record/envelope identities and canonical recordKeys, counts, UTC-day scope boundaries, source timestamps and calendar time zones. Unknown content/body/attachment fields are rejected. Source text remains inert display content.

`schemaVersion` is the string `partheanon.sync.v1`; batch IDs are `gsync_` plus 40 lowercase hex characters. Resource types are email_message/calendar_event. Only the supplied Google incremental contract is enabled at this stage. The older numeric schema is documented separately in [the legacy test-harness contract](n8n-legacy-intake.md); it is not the worker's production format. Do not add its testMode field to the saved worker body.

Gmail messageId is the Gmail provider ID, not RFC Message-ID. History IDs remain strings, including the 19-digit synthetic value. The payload retains them exactly; the storage comparison key uses decimal-string length and digits without Number conversion. Unrecognized nondecimal history versions fail closed. Email display receives sender, subject, received time and read state, without fabricated snippet, source link, body or attachment content.

Calendar sourceUpdatedAt is a timestamp. Null values are part of the sender's possible output but are currently rejected until a safe ordering rule exists; generatedAt is not a substitute for a source version. Timed boundaries preserve their offsets; all-day date boundaries are resolved in their named time zone, including daylight-saving changes. Availability is preserved. Cancellation/removal semantics still require examples.

## Receipts and replay

New deliveries return HTTP 200 only after a successful atomic D1 commit of stream generation, record changes and durable receipt:

```json
{"ok":true,"batchId":"gsync_fed46cca8513e9f60437adb5b92c934fc9a6e41e","status":"accepted"}
```

Additional fields may include receivedAt/counts. Retries return status duplicate with the exact incoming batchId. This matches the sender's accepted/duplicate acknowledgment requirement. A bare success, wrong ID, HTML or another status must not advance a cursor.

For this worker schema, the SHA-256 fingerprint covers the whole validated incoming envelope **except top-level generatedAt**, with recursively sorted object keys and preserved array order/string values. A regenerated generatedAt or reordered object keys therefore returns duplicate; changing subject, coverage, versions, scope or other content under the same batch ID returns 409. generatedAt must still pass timestamp validation. Receipts persist; replays do not apply data again.

Streams are separated by owner/provider/account/resource/container and exact declared scope, independently of credentials. Changing a key does not create a new destination baseline. Calendar and Gmail streams are separate. Earlier newly generated deliveries are rejected after a newer stream delivery. Provider versions prevent stale updates overwriting newer records. Concurrent identical deliveries yield accepted/duplicate, or a retryable failure if a storage conflict prevents completion. No successful acknowledgment is issued on an uncertain commit.

`coverage.complete:true` on a delta means that delta was collected successfully, not that the destination received an initial authoritative baseline. Staged worker streams therefore remain unpublished. Empty deltas are accepted and retain existing records. Absence never triggers a deletion in this implementation.

## Missing evidence and cutover gate

Before switching any real delivery:

1. Obtain synthetic initial/reconcile envelopes and the exact shapes of deletions[] and scopeExits[], including their record identity and source-ordering fields. Confirm the producer's bounded authoritative reconciliation rules, full-scan/partial-page behavior, scope identity across rolling windows and null calendar-version handling.
2. Implement and test those semantics. Source deletion/cancellation tombstones must remain distinct from leaving INBOX or moving out of the retained window; scope exits must permit legitimate re-entry and must never delete provider data. Failed/partial listings must never infer removals.
3. Create a real-destination credential and independent destination/account/resource/scope state. **Do not reuse mock-advanced cursors.** A bounded initial load must establish the real baseline.
4. Run a supervised synthetic manual delivery from the actual saved worker to the real destination with a disposable configured account. Verify exact acknowledgment and durable readback, replay, update, deletion/cancellation, scope exit/re-entry, empty delta, malformed/bad-credential rejection and interrupted initial-load recovery. Do not send synthetic data into a real account's dashboard stream.
5. Run the reviewed bounded initial real-account load, confirm coverage and entries in Partheanon, then separately enable the schedule.

No real workflow, provider data, schedule, destination, cursor or production intake record was changed during local compatibility testing. No production application key has been created by these tests. Existing internal email/calendar syncing remains off; Notion refresh is separate. The receiver cannot send mail or alter provider calendars, tasks or source records.

## Verified locally

```sh
node --test lib/ingest-contract.test.mjs lib/ingest-worker-contract.test.mjs lib/sync-policy.test.mjs
python3 scripts/tests/ingest-worker-integration.py
python3 scripts/tests/ingest-integration.py
python3 scripts/tests/ingest-projection.py
npx tsc --noEmit
```

The Python scripts are localhost-only; do not retarget them to production. They use disposable synthetic account data, revoke their keys and verify isolation/readback. The worker test exercises the actual fixture bodies, exact acknowledgment, regenerated-timestamp replay, changed-content conflict, concurrent retries, 19/20-digit version ordering, no-change retention and rejection of unverified semantics. The read-only hosted access probe separately verifies private hosting and JSON rejection of an invalid application key; it is not an n8n end-to-end test.
