# Aegis save feedback correction — 2026-11-02

Status: implemented and locally verified. Chief Steward authorized commit and publication through the controlled branch workflow on 2026-11-02. Hosted deployment verification and operational acceptance are separate pending states.
Branch: `fix/aegis-save-rejection-feedback` from inspected hosted source `ed68670a78339b7d53f526e16dc4e1e32283ca96`.

## Intent and evidence

Browneye reported refusal loops when editing Partheanon. The owner account and Site are active. Recent hosted logs contain HTTP 400 responses from `/api/state` and `/api/aegis`. The visible chat repeatedly proposed completion of a commitment with an open prerequisite. Its durable proposals are `failed`, but retries returned “expired or already attempted.” Aegis then incorrectly described itself as unable to persist changes. The current unrelated worksheet saved successfully during diagnosis.

This is a bounded application correction under the current troubleshooting request, not a new institutional Mission or expansion of Aegis authority. No connection settings, credentials, source sync schedules, task relationships, or completion states are changed by this patch. Existing confirmation and completion protections remain in force.

## Decision and implementation

Share task relationship/completion validation between proposal preparation and the write path. Reject blocked proposals before presenting a confirmation button. Name open prerequisites or subtasks and explain the distinction. Recheck at write time. Distinguish failed, processing, and expired proposals. Include failures in later Aegis conversation context so it can address the cause. Show worksheet errors next to Save as well as the existing message at the top.

No schema, migration, dependency, authentication, or privilege change is needed. Imported titles remain escaped React text. Error display names at most three blocking commitments; data stays inside the existing owner-scoped application and chat context.

## Validation

- TypeScript check passed.
- Production build passed.
- Thirteen focused unit tests passed: shared completion rules, dependency cycles, hierarchy, chat bounds, and failed-proposal feedback.
- Local synthetic HTTP regression passed: ordinary edit, blocked completion, child completion before parent, failed retry, processing/expiry, successful proposal and repeated application. Fixtures inserted into the local database were removed afterward. No model request was made.
- Whitespace check passed.

This is implementer verification, not independent assurance. Hosted verification of the changed code is pending deployment. Model wording remains nondeterministic; server-side validation supplies the enforced boundary.

## Forward actions and receiving gate

Chief Steward publication decision: APPROVED on 2026-11-02 in response to the explicit commit-and-publish request. No direct main commit is permitted. Preserve branch review and the hosting source provenance workflow when publishing.

After authorized deployment, verify a blocked proposal gives the named prerequisite, a valid task edit saves, and the worksheet shows the error near Save. Keep the existing published version available for rollback; no data rollback or migration is required for this code-only correction.

Browneye: review whether the affected delivery task relationship represents a prerequisite or a parent/subtask relationship. Do not automatically rewrite it or mark prerequisite work complete merely to make a proposal succeed. Retire/re-propose old failed proposals after resolving the relationship.

Residual issue: failed work-log and protected-time proposals still require a fresh proposal after reviewing their current state; detailed recovery for partial database writes is outside this patch. No live operational acceptance or incident closure is claimed.
