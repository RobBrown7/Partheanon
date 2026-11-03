# Engineering Mission — Partheanon Focus pilot v1

Status: APPROVED / implementation active. Authority: Chief Steward Robert Brown's explicit approval of the recommended first pilot on 2026-11-03; selected owner rob.k.brown.7@gmail.com. Forge is the implementer; Aegis is the planning Persona; n8n is a bounded executor. Review at first provider write, any credential expansion, or pilot acceptance. Private scheduling metadata; public source contains no live credentials.

## Why; customer and stakeholders

Browneye needs protected commitment time on a real calendar with observable completion and recoverable delivery. Customer, receiving owner and acceptance authority: Robert Brown. External attendees and other account owners are unaffected by this no-attendee pilot. UI uses ordinary form labels, explicit review, visible errors, Phoenix times and a keyboard-operable setup path.

## Desired outcome and success criteria

One approved future block creates exactly one private busy event in one selected secondary calendar. A reviewed reschedule updates that event conditionally, a GET readback matches, and Partheanon keeps an attributable receipt and correct local block. No unapproved source/workflow changes, invitations, duplicate creation or false confirmed status. The runbook contains the hosted checklist. Implementation, local validation, supervised provider verification and operational acceptance remain separate.

## Scope; systems; interfaces

In scope: Partheanon owner UI/API, D1 commands and receipts, a separate manual n8n worker, one selected Gmail account secondary calendar, source archive, tests and runbook. Repositories: RobBrown7/Partheanon and its existing Sites source. Exact Site: appgprj_6ac674e520748191a52f9af5f874ce68. Out of scope: email-body review, attendees, invitations, automatic rescheduling, primary calendars, other lanes' calendar writes, deleting provider events, unattended activation, existing intake schedule/cursor changes or institutional doctrine changes.

Inputs: explicit user direction; current application source; n8n editor and calendar UI (untrusted operational evidence); official Google/n8n interfaces; approved Guild Engineering Framework/ADR-001 documentation practice. No prior Phylax/Themis Mission grants apply.

## Authority and constraints

The pilot approval authorizes bounded implementation, testing and separate manual workflow preparation. Existing user direction supports controlled-branch source publication. Provider writes require a specific reviewed focus block; new browser credential/access grants require action-time human confirmation. No main-branch direct commit, GitHub PR merge, provider-wide copy, unrelated communication or automatic schedule is inferred. No subagents are delegated. Escalate destination ambiguity, credential scope expansion, stale/external edits or uncertain delivery to Browneye.

## Classification, security and privacy

Private provider data stays in owner-scoped D1 and authorized n8n/Google paths. Google receives only generic Focus time, times and opaque markers. Task descriptions, stakeholders and email content are excluded. Separate 7-day hashed worker key, private Sites service authorization, signed-in same-origin owner admin, pinned secondary calendar, deterministic IDs, write leases, ETag checks, schema validation, caps and durable receipts form the control boundary. Secrets stay in masked UI and protected credential storage, never source/chat/logs. OAuth provider scope may exceed the workflow allowlist and must be stated honestly before any new grant. Credential/command retention: receipts retained within a 500-command pilot cap; deliberate retention policy needed before broader operation.

## Architecture and dependencies

Decided under the approved pilot: durable pull-based commands with a manual executor. This avoids storing outbound webhook credentials in app configuration and preserves existing intake. Provider owns events; application owns approved intent. Migrations append focus_calendars and focus_commands plus lease-token metadata. No new packages. Unknowns until inspected: credential bindings/scopes and hosted n8n execution. Return-sync cursor setup remains a separate action in this pilot, not a claim based on callback alone. Shared helper source generates the n8n Code-node logic for testable compatibility.

## Governed Learning Agency control record

| Stage | Scope record |
|---|---|
| GOVERN | Forge Commission and current Chief Steward pilot delegation; private data, one calendar, no invites; no institutional-policy changes |
| OBSERVE | Current source/owner access, synthetic HTTP results, n8n graph, calendar ownership/privacy and later live receipts; distinguish missing evidence |
| ORIENT | Existing intake is readonly; new mutations require separate scoped authority and recoverable delivery |
| DECIDE | Durable commands, serialized manual worker, stable event IDs and conditional reschedules; no broad calendar mirror |
| AUTHORIZE | Pilot scope approved; account selected; each block approved in product; browser credential grants separately confirmed |
| ACT | Controlled branch, append-only migrations, owner API, restricted worker protocol, Google POST/PATCH with no attendees |
| ASSURE | Synthetic unit/HTTP/build checks plus hosted Google GET and dashboard receipt checks; implementer validation is not independent assurance |
| LEARN | Record mismatches, unresolved delivery and credential limits in this runbook/handoff; propose wider activation only with new evidence and Chief Steward decision |

## Risks and ownership

| Risk | Control | Owner/review |
|---|---|---|
| Duplicate after timeout | Stable event ID, read before mutation, durable command and receipt | Forge; each pilot result |
| External overwrite/invites | Private marker, no attendees/recurrence, If-Match; stop on mismatch | Forge/n8n executor; each write |
| Excess provider grant | Separate explicit scope review and pinned workflow; no claim of per-calendar OAuth limitation | Chief Steward; provisioning |
| Missing calendar coverage | User review acknowledgement, cached conflict check, coverage remains provisional | Browneye; each approval |
| Provider event outlives task/reservation | Visible warning and manual Google review; no implicit delete | Browneye; task lifecycle |
| Unverified continuous return sync | Separate intake container/cursor and hosted matching-ID test | Forge/Aegis; acceptance |

## Deliverables and validation

Owner for implementation artifacts: Forge. Deliverables: owner panel, worker API and D1 state, inactive manual workflow export/import, shared decision logic, synthetic tests, this Mission/runbook and publication handoff. Local validation is implemented and must be recorded with exact results. Independent reviewer: not assigned; no independent assurance claim. Stop on wrong account/calendar, any attendee, unexpected provider edit, mismatched receipt, missing scope, incomplete authentication or uncertain source state.

## Rollback, recovery and human gates

Pause/revoke first; preserve unresolved commands. Reconcile the same Google event ID before writing. Last prior Site version can be redeployed; additive tables may remain, never roll back by deleting receipt evidence. Completed provider writes require explicit manual review to undo; app rollback does not undo Google. Gates: account choice; credential grant/key generation; each block's content/time approval; initial provider verification; separate continuous-sync/operational acceptance. No gate is satisfied by silence or configuration alone.

## Completion, handoff and continuity

Receiving owner: Browneye; n8n credential installation and workflow review require his authorized session. Use README.md's checklist and the publication/live-run handoff. Current acceptance disposition: PENDING supervised live proof. Closure: OPEN. Capability added: manual no-attendee focus publishing, v1, bounded pilot. Decisions, risks, open actions and learning are recorded here proportionately; no canonical Guild doctrine or registers are silently modified by application implementation. Legacy/source continuity is preserved through controlled branches and reviewable GitHub changes.
