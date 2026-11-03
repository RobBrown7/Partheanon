# Partheanon Focus — supervised pilot v1

Status: implementation and local synthetic validation; hosted provider delivery is a separate acceptance gate. Approved by Browneye on 2026-11-03. Selected owner: rob.k.brown.7@gmail.com. No recurring schedule or attendees.

## Scope and ownership

Partheanon owns the approved intent and durable command. Google owns the event. n8n executes a bounded manual worker and verifies Google readback. Aegis may propose internal protected time through its existing tool; publication requires the owner's separate Review publication / Approve calendar request click. The dedicated secondary calendar is Partheanon Focus. Existing inbox and calendar intake workflows remain unchanged.

Only the title `Focus time`, start/end, opaque correlation IDs and private/busy flags leave Partheanon. No task titles, stakeholder details, email bodies, meeting notes, attendees, descriptions or invitations are sent. A focus block is an ordinary timed Google event, not the Workspace-only focusTime event type.

## Setup

1. Create Partheanon Focus as a secondary Google calendar in the selected account, timezone America/Phoenix, public access off. Obtain Calendar ID from its settings. Do not use primary or its account address.
2. Partheanon → Schedule → Publish focus time: save the account and exact calendar ID. The destination is immutable within this pilot and defaults paused.
3. Create a seven-day focus worker key in the owner UI. It is shown once, masked, and only its SHA-256 hash is stored. Copy directly into n8n credential storage; never chat, source, workflow parameters, execution pin data or a URL. Generating a new key invalidates the prior key. Revoke also pauses the pilot.
4. Import `n8n-focus-manual.json` into a NEW workflow. It has one Manual Trigger, no schedule/webhook trigger, no credential values or identifiers, an execution timeout, and no saved success/error/manual execution payloads. The imported graph is not proof of the server's credential bindings or settings; verify them in the hosted editor.
5. For all Partheanon HTTP nodes select a dedicated **Custom Auth** credential containing both headers: `OAI-Sites-Authorization: Bearer <existing private Site service credential>` and `Authorization: Bearer <new focus worker key>`. The existing intake pt n key family cannot operate this endpoint. No browser identity headers or cookies.
6. For all four Google HTTP nodes select the rob.k.brown.7@gmail.com Google Calendar OAuth credential. Writes need provider authorization; an intake key or readonly OAuth grant does not supply it. Standard Google Calendar OAuth may grant broader account calendar access than one calendar: the worker destination guard limits this workflow, not the OAuth credential itself. Do not expand grants without the Chief Steward's specific authorization.
7. Keep existing source workflows, destinations, cursors and schedules unchanged. Enable the new manual pilot in Partheanon only when these bindings are ready. With no approved queue item, a manual run must stop after a successful `job:null` claim.

The initial implementation was imported into n8n workflow `U4sknHxzPirIPDJk`; verify the final graph/settings/bindings there rather than creating another copy.

## Wire contract

POST `/api/focus-worker`, JSON, both credential headers above. Max 8 KiB per request. Owner administration is a separate signed-in, same-origin `/api/focus-calendar` endpoint and cannot be performed with the worker credential.

- `{action:"claim"}` returns `{job:null}` or one job. Each job is `schemaVersion:partheanon.focus.v1`, exact request ID, claim token, pinned account/calendar, block/task IDs, deterministic eventId, create/reschedule operation, generic title, ISO UTC start/end, expectedEtag, no attendees and `sendUpdates:none`.
- `{action:"status",value:{id,claimToken}}` returns durable state/receipt and `mayWrite`. Check immediately before a provider mutation. Paused, expired, superseded or past-start attempts cannot write. Already-existing exact readback can still reconcile after the start time.
- `{action:"verified",value:{id,claimToken,event}}` submits the minimal verified readback: id, etag, summary, start/end dateTime, confirmed status, private visibility, opaque transparency, empty attendees and private block/command markers. The receiver independently compares these fields to its approved snapshot and stores the receipt and local reschedule in one D1 batch. Identical receipt replay returns duplicate; conflicting reuse is rejected.
- `{action:"attention",value:{id,claimToken}}` holds an unresolved command. Owner **Reconcile same request** requeues the same request and deterministic event ID, never a fresh insert identity.

One calendar lease permits one sending command at a time. Lease duration: five minutes; workflow timeout: three minutes; maximum five recovery claims until owner review. Queue/storage maximum: 500 commands per owner. Requests are not removed automatically. Latest 100 appear in the owner panel. Seven-day keys, pause and revoke are distinct controls. Pausing cannot retract a provider request already sent.

## Provider execution and recovery

1. GET the exact event ID before any write. Identity is `ptn` plus the local block UUID without hyphens, within Google's allowed ID alphabet.
2. Missing event + create permits one POST with that ID and `sendUpdates=none`. Existing exact approved event is verified without writing, including after a response was lost.
3. Reschedule targets the same ID, verifies the private block marker, rejects attendees/recurrence or cancellation, and PATCHes only with the last verified ETag as If-Match. An external edit, unknown event or missing published event is held for review.
4. Recheck the server lease immediately before writing. After mutation, GET the event again and compare all approved fields. No matching readback means no confirmed receipt.
5. If Google or the callback times out, the result is uncertain. Preserve the same queued command; after lease expiry, rerun the manual worker. It reads Google first and can return the matching receipt without repeating the mutation. Never infer failure from a lost response or issue a new event ID to recover.
6. Revoke/disable blocks new work; an inflight write may still complete. Preserve unresolved records for reconciliation. No automatic deletion, event moving, attendee addition, invite acceptance, or broad replication is implemented.

A worker receipt is authenticated worker-reported Google GET evidence, not independent receiver access to Google. Later external edits require the normal calendar intake to observe them; confirmed is a receipt state, not permanent freshness.

## Return sync and lifecycle

Add the dedicated calendar ID to a separate bounded calendar intake cursor and a suitably scoped intake key before claiming continuous return sync. Do not change existing primary-calendar cursor state. This ingestion setup is separate from the focus worker key.

The verified callback updates the matching internal block on reschedule. A returned intake event is hidden only when its exact source identity and times match a confirmed local block; that block remains in scheduling, preventing double counting. Changed/missing/local-unmapped events remain visible. Completing a task or releasing an internal reservation does not delete a provider event; the pilot flags a future confirmed event whose reservation disappears. Review it in Google Calendar.

## Hosted acceptance checklist

- Invalid/missing worker key rejected; intake credential rejected; private Site gate retained; owner admin rejects worker identity.
- New workflow has no schedule; no command means no Google call.
- Approve one future block after checking calendar coverage. Confirm account, secondary calendar, generic private/busy event, and zero attendees.
- One manual run creates one event and matching durable receipt; verify it in Google Calendar and Partheanon.
- A repeat run creates no second event. Confirm same ID and matching receipt through an uncertain-response replay.
- Review/approve reschedule; same event ID, ETag check, Google readback and local block updated. External ETag changes stop the write.
- Pause/revoke deny new writes; stale claim, wrong ID/markers, attendees and conflicting receipts rejected.
- Verify dedicated calendar intake readback and no double counting before continuous-sync acceptance.

Local evidence: `node --test lib/focus-contract.test.mjs`; local dev server + `python3 scripts/tests/focus-pilot-integration.py`; TypeScript and production build. These are synthetic tests, not a real Google/n8n execution. Run the HTTP test only against the disposable local database; it cleans up its own fixture rows.

Provider references: [event IDs/creation](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [ETag conditional writes](https://developers.google.com/workspace/calendar/api/guides/version-resources), [n8n HTTP credentials/options](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
