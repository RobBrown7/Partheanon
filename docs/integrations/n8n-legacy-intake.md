# Original numeric-schema test harness

**This is not the saved n8n worker contract.** Use [the current handoff](n8n-intake.md) for the Google pilot. The numeric schema remains supported for the existing isolated local tests. Do not replace the worker payload with these examples.

# n8n → Partheanon intake v1

## Current boundary

POST `https://partheanon-forge.athena-works-8404.chatgpt.site/api/ingest`.

The Site remains owner-private. Two independent credentials are required:

- `OAI-Sites-Authorization: Bearer <Site service-access credential>` — private hosting access. It does not provide a browser identity or permission to create intake keys.
- `Authorization: Bearer <account-scoped intake key>` — intake write authorization. Create and revoke these in Connections → n8n intake. The application stores only the SHA-256 digest. Keys expire after 90 days and cannot be read back after issuance.

Store both headers using n8n credentials, not URL parameters, Code/Set nodes, exported workflow files, or execution logs. Never use browser cookies. Keep workflow execution-data retention short and avoid saving successful production payloads. Authenticate and encrypt access to n8n itself.

The Site service credential is separate from the account key. A workflow is not ready until both are configured securely and a manual request receives a JSON acknowledgment. Do not make the Site public to bypass this boundary.

## HTTP Request node

- Method: POST
- URL: the endpoint above
- Authentication: use an n8n credential supporting the two required headers.
- Content-Type: application/json
- Body: one JSON object conforming exactly to the contract below; not an array of n8n items.
- Return the full response and treat non-2xx responses as failures. Do not enable “ignore response code” and then advance the provider cursor regardless.
- Maximum request size: 256 KiB; maximum 200 upserts and 200 explicit deletion markers per request. Reduce batch size for large/Unicode snippets.
- Maximum 60 deliveries/minute/key. A 429 includes Retry-After: 60.
- Retry timeouts, 429 and 5xx with backoff, using the exact same payload and batchId. Save the payload before the first attempt. Do not regenerate timestamps or IDs on a retry.
- A new logical delivery gets a fresh UUID batchId and generatedAt. Deliver a stream sequentially; reconcile before retrying an older batch after a newer delivery succeeded.
- Advance source cursors only after an authenticated JSON response with ok=true, matching batchId, and status accepted or duplicate.

## Calendar example (synthetic)

Replace dates with the actual workflow's collection window. `primary` is a container alias: it must match the container allowlist on the key. Record IDs are provider event/occurrence IDs and must remain stable.

```json
{
  "schemaVersion": 1,
  "batchId": "dbdfcc29-981b-413a-b114-885bde6d01da",
  "provider": "google",
  "account": "rob.k.brown.7@gmail.com",
  "resourceType": "calendar",
  "syncMode": "reconciliation",
  "generatedAt": "2026-10-23T20:00:00Z",
  "testMode": true,
  "scope": {
    "containerId": "primary",
    "complete": true,
    "windowStart": "2026-10-16T00:00:00Z",
    "windowEnd": "2026-12-22T00:00:00Z"
  },
  "records": [{
    "id": "synthetic-event-001",
    "updatedAt": "2026-10-23T19:59:00Z",
    "title": "Synthetic intake test",
    "start": "2026-10-24T09:00:00-07:00",
    "end": "2026-10-24T10:00:00-07:00",
    "allDay": false,
    "busy": true,
    "cancelled": false,
    "calendarName": "Synthetic test calendar",
    "url": ""
  }],
  "deleted": []
}
```

Calendar required fields: id, updatedAt, title, start, end. Optional: allDay (false), busy (true), cancelled (false), calendarName (Calendar), url (empty), uid, recurringEventId, originalStart. Dates must include UTC Z or an explicit offset. All-day boundaries still need explicit timezone-resolved timestamps. Compact cancellation events lacking start/end belong in `deleted`, not an incomplete calendar record. Preserve occurrence IDs for recurring events.

## Email record

Set resourceType to `email` and scope.containerId to an allowed mailbox alias such as `inbox`.

```json
{
  "id": "synthetic-message-001",
  "updatedAt": "2026-10-23T19:59:00Z",
  "threadId": "synthetic-thread-001",
  "subject": "Synthetic message",
  "sender": "Example Sender <sender@example.test>",
  "receivedAt": "2026-10-23T19:30:00Z",
  "snippet": "Synthetic metadata only.",
  "unread": true,
  "starred": false,
  "labels": ["INBOX"],
  "url": ""
}
```

Required: id, updatedAt, subject, sender, receivedAt. Other fields are optional; snippets are limited to 2,000 characters. No bodies, attachments or arbitrary extra properties are accepted. Use the provider's modification timestamp; if it has none, record a stable first-observed timestamp for that version. Do not replace updatedAt with a new timestamp on delivery retries.

## Completion, reconciliation and deletion

A stream is provider + account + resourceType + containerId + testMode, bound to the key's owner. Provider/account/container must match the key. The payload cannot choose a user ID, lane or internal source key; Partheanon maps these from saved Connections.

Send pages sequentially with scope.complete=false until every page in the declared scan has been delivered and acknowledged. Only the final page may set complete=true. Mark false after any partial or failed source scan. A stream remains unpublished until its first complete delivery. Subsequent partial deliveries retain records and mark coverage provisional. Expected containers that have never completed delivery also make coverage provisional.

**v1 never treats omission as deletion, even in reconciliation mode.** Use explicit deletion/cancellation markers:

```json
{"id":"source-record-id","updatedAt":"2026-10-23T20:00:00Z"}
```

A record may occur once per batch, either as an upsert or deletion. Tombstones prevent old updates resurrecting removed records. Daily reconciliation must compare successfully completed authoritative source listings with its prior durable manifest and emit explicit deletions only after the full scan succeeds. A failed/partial listing must never generate disappearance-based deletions. Limit inference to the identical account/container/scope; do not infer deletion because an item moved outside the requested date window.

No more than 5,000 stored record identities per stream, including tombstones. Capacity failure is explicit; review scope/retention before increasing this bound. Do not silently drop recent records to make room.

## Acknowledgments and errors

Successful new batch:
```json
{"ok":true,"batchId":"dbdfcc29-981b-413a-b114-885bde6d01da","status":"accepted","testMode":true,"receivedAt":"2026-10-23T20:00:01.000Z","records":1,"deleted":0}
```

Exact replays return HTTP 200 with status `duplicate` and the same batchId. Reusing a batchId with changed content returns 409. Newer source updatedAt wins; stale record versions cannot replace newer ones. Batches generated before the last accepted batch are rejected with 409. Concurrent commits use a guarded generation update and an atomic D1 batch; a conflicting execution must retry/reconcile rather than overwrite another run.

Errors have `{ "ok": false, "error": { "code": "...", "message": "..." } }`:

- 401: invalid, expired or revoked intake credential.
- 403: account/provider/container outside the key scope, or removed account.
- 409: reused batch ID, stale batch, concurrency conflict or stream capacity.
- 413: body exceeds 256 KiB.
- 415: Content-Type is not application/json.
- 422: invalid schema, ambiguous timestamps, duplicate IDs or future clocks.
- 429: per-key rate limit.
- 503: storage/processing unavailable; retry the same batch safely.

A hosting login redirect/HTML response is a failure, even if an HTTP node eventually reports 200. It generally indicates missing Site service access. Do not advance cursors.

## Pilot verification

1. Configure one Google account and small calendar/mailbox scope.
2. Create its account-scoped key; store it and Site service access in n8n credentials.
3. Run manually with synthetic data and testMode=true. Refresh Connections → n8n intake and confirm the test stream, count and timestamp. Test streams never appear in live dashboard sources.
4. Repeat the identical batch: it must return duplicate and retain the same count.
5. Try an unauthorized account/container, bad key, oversized/invalid body and stale batch: verify rejection.
6. Deliver a newer update and explicit cancellation; verify counts and readback in the isolated test stream.
7. Test partial-page failure and resume with durable provider cursors.
8. After reviewing real transformed metadata, change testMode to false, run the complete initial sync, and verify calendar/inbox entries and source timestamps in Partheanon. Only then enable the schedule.
9. Revoke a test key and confirm its next request is rejected. Keep production keys separate.

Internal email/calendar syncing stays off. Dashboard records are re-read every 30 seconds while open; n8n delivery does not require a browser. Notion continues on its separate five-minute refresh. Email/calendar writes, tasks, email sending and external calendar edits are outside the intake key's permission.

## Validation commands (local only)

```sh
node --test lib/ingest-contract.test.mjs
python3 scripts/tests/ingest-integration.py
python3 scripts/tests/ingest-projection.py
npx tsc --noEmit
```

The Python scripts intentionally use only localhost and synthetic test data; never change them to target production.

References: [D1 atomic batch execution](https://developers.cloudflare.com/d1/worker-api/d1-database/), [bound JSON queries](https://developers.cloudflare.com/d1/sql-api/query-json/).
