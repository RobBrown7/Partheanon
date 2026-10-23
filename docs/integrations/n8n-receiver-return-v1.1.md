# Forge → n8n assistant: receiver return handoff v1.1

Partheanon now implements the supplied handoff v1.1 wire shapes, with unchanged schema `partheanon.sync.v1` and producer `0.1.0`.

**Do not activate the source schedule, overwrite the mock destination, reuse mock cursors or send real source data yet.** All ten supplied examples passed local receiver/storage/display tests. The saved n8n worker has not yet delivered to this real endpoint.

Real endpoint: `https://partheanon-forge.athena-works-8404.chatgpt.site/api/ingest` (POST).

Required headers, stored securely in destination-specific n8n credentials:

```text
OAI-Sites-Authorization: Bearer <Site service credential>
Authorization: Bearer <restricted account intake key>
Content-Type: application/json
Idempotency-Key: <body.batchId>
X-Partheanon-Schema: partheanon.sync.v1
```

Obtain/revoke the restricted account key in Partheanon → Connections → n8n intake. Container IDs must match (`primary`, `all_mail` for the current Google pilot). No credentials belong in chat, code nodes, exports, URLs or execution output. Use a separate disposable configured account/key for synthetic hosted testing.

Receiver behavior to agree before cutover:

- Complete initial/reconcile is an additive baseline; deltas alone do not publish a new stream. No absence pruning in any mode. Unmapped legacy items remain visible and may duplicate new import rows; calendar coverage is provisional.
- Known newer versions apply to exact imported IDs. Gmail history IDs retain string precision. Cancellations, source deletion and scope exit are separate reversible local states. A newer valid record can re-enter its scope.
- Missing versions, equal-version conflicts, ambiguous all-day exits and conflicting receipt-window evidence are durably deferred without changing the current row. No automatic adjudicator runs. Deferred counts/evidence remain visible for review.
- Accepted means the full minimal envelope, agreed applied effects, deferred evidence and receipt committed atomically. It does not mean every proposed change was applied. Response includes matching batchId, accepted/duplicate, applied/deferred/stale counts, provisional coverage, sequence and receiptDigest. The existing acknowledgment check is compatible with this policy once that meaning is agreed.
- Canonical full-envelope fingerprint excludes only top-level generatedAt; object key order is irrelevant, array order and all stable field values matter. Compatible retry returns duplicate; conflicting reuse returns 409. Persist the minimal pending envelope securely; do not reconstruct uncertain retries from a fresh source read.
- Response lost: authenticated GET to the same endpoint with `?batchId=<batchId>` returns a scoped durable receipt/digest. Check identity and compare canonical logical-envelope digest before recovering/advancing. 404/timeout does not prove the delivery failed.
- Limit 1 MiB JSON; Gmail upserts ≤400, Calendar upserts ≤2,000, each removal array ≤2,000, combined entries ≤5,000, contributing pages ≤20. Reduce source scope if rejected; do not split/truncate an authoritative scan. HTTP 429 has Retry-After: 60; retry identical logical work after 429/5xx/network uncertainty.

Next: prepare a manual real-destination pilot with independently namespaced destination/environment/account/resource/container/scope cursor, pending-envelope and idempotency state. Preserve mock state and keep schedules off. Verify synthetic accepted/readback/lookup, duplicate, conflicting reuse, bad key/container, known update/cancellation, scope exit/re-entry, null-version deferral, empty scans and lost-response recovery. Then perform a fresh bounded initial real-account load and manual delta/no-change check, inspect receipts/display, and report results before scheduling.

Do not claim a hosted end-to-end pass based only on these local tests. Do not clear existing Command Center rows, fetch fuller source bodies, post a Guild message, mutate provider data, or enable absence pruning.

Full receiver contract: [n8n-intake.md](n8n-intake.md).
