import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
export const commitments = sqliteTable("commitments", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), title: text("title").notNull(),
 project: text("project").notNull(), lane: text("lane").notNull(), stakeholder: text("stakeholder").notNull(),
 deadline: text("deadline").notNull(), deadlineSource:text("deadline_source").notNull().default("unknown"), minutes: integer("minutes").notNull(), status: text("status").notNull(),
 lifeHealthSafety:integer("life_health_safety",{mode:"boolean"}).notNull().default(false),securityPrivacy:integer("security_privacy",{mode:"boolean"}).notNull().default(false),important:integer("important",{mode:"boolean"}),dependsOn:text("depends_on").notNull().default("[]"),delayImpact:text("delay_impact").notNull().default("unknown"),peopleBlocked:integer("people_blocked",{mode:"boolean"}).notNull().default(false),delayConsequence:text("delay_consequence").notNull().default(""),output: text("output").notNull(), sourceUrl: text("source_url").notNull(), sourceKey: text("source_key").notNull().default(""), parentId: text("parent_id"), createdAt: text("created_at").notNull()
});
export const focusBlocks = sqliteTable("focus_blocks", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), taskId: text("task_id").notNull(),
 title: text("title").notNull(), start: text("start").notNull(), end: text("end").notNull()
});
export const sourceSnapshots = sqliteTable("source_snapshots", {
 owner: text("owner").notNull(), source: text("source").notNull(), payload: text("payload").notNull(),
 updatedAt: text("updated_at").notNull()
}, (t) => [primaryKey({columns: [t.owner,t.source]})]);
export const preferences = sqliteTable("preferences", {
 owner: text("owner").primaryKey(),internalMailCalendarSync:integer("internal_mail_calendar_sync",{mode:"boolean"}).notNull().default(false),focusTaskId:text("focus_task_id"), startHour: integer("start_hour").notNull(), endHour: integer("end_hour").notNull(), theme:text("theme",{enum:["dark","light","system"]}).notNull().default("dark")
});
export const accountConnections = sqliteTable("account_connections", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),provider:text("provider",{enum:["google","microsoft","notion","apple"]}).notNull(),
 account:text("account").notNull(),lane:text("lane").notNull(),calendar:integer("calendar",{mode:"boolean"}).notNull(),mail:integer("mail",{mode:"boolean"}).notNull(),createdAt:text("created_at").notNull()
},t=>[uniqueIndex("account_connections_owner_provider_account").on(t.owner,t.provider,t.account)]);

export const workLogs = sqliteTable("work_logs", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),taskId:text("task_id").notNull(),
 workedOn:text("worked_on").notNull(),minutes:integer("minutes").notNull(),aiMinutes:integer("ai_minutes").notNull(),
 skills:text("skills").notNull(),notes:text("notes").notNull(),createdAt:text("created_at").notNull()
});
export const chatProposals = sqliteTable("chat_proposals", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),action:text("action").notNull(),payload:text("payload").notNull(),baseline:text("baseline"),status:text("status").notNull(),createdAt:text("created_at").notNull()
});

export const chatLimits = sqliteTable("chat_limits", {owner:text("owner").primaryKey(),window:text("window").notNull(),count:integer("count").notNull()});

export const oauthClients=sqliteTable("oauth_clients",{owner:text("owner").notNull(),provider:text("provider").notNull(),sealed:text("sealed").notNull(),updatedAt:text("updated_at").notNull()},t=>[primaryKey({columns:[t.owner,t.provider]})]);
export const oauthStates=sqliteTable("oauth_states",{state:text("state").primaryKey(),owner:text("owner").notNull(),provider:text("provider").notNull(),account:text("account").notNull(),verifier:text("verifier").notNull(),expiresAt:integer("expires_at").notNull(),used:integer("used",{mode:"boolean"}).notNull().default(false)});
export const oauthAccounts=sqliteTable("oauth_accounts",{owner:text("owner").notNull(),provider:text("provider").notNull(),account:text("account").notNull(),sealed:text("sealed").notNull(),updatedAt:text("updated_at").notNull(),refreshUntil:integer("refresh_until").notNull().default(0)},t=>[primaryKey({columns:[t.owner,t.provider,t.account]})]);

export const dismissedEmails=sqliteTable("dismissed_emails",{owner:text("owner").notNull(),emailId:text("email_id").notNull(),dismissedAt:text("dismissed_at").notNull()},t=>[primaryKey({columns:[t.owner,t.emailId]})]);

export const workOutputs=sqliteTable("work_outputs",{id:text("id").primaryKey(),owner:text("owner").notNull(),taskId:text("task_id").notNull(),workedOn:text("worked_on").notNull(),notes:text("notes").notNull(),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull()});

export const ingestKeys=sqliteTable("ingest_keys",{id:text("id").primaryKey(),owner:text("owner").notNull(),digest:text("digest").notNull(),provider:text("provider").notNull(),account:text("account").notNull(),containers:text("containers").notNull(),createdAt:text("created_at").notNull(),expiresAt:text("expires_at").notNull(),revoked:integer("revoked",{mode:"boolean"}).notNull().default(false),rateWindow:text("rate_window").notNull().default(""),rateCount:integer("rate_count").notNull().default(0)},t=>[uniqueIndex("ingest_keys_digest").on(t.digest)]);
export const ingestStreams=sqliteTable("ingest_streams",{id:text("id").primaryKey(),owner:text("owner").notNull(),provider:text("provider").notNull(),account:text("account").notNull(),resourceType:text("resource_type").notNull(),containerId:text("container_id").notNull(),sourceKey:text("source_key").notNull(),lane:text("lane").notNull(),testMode:integer("test_mode",{mode:"boolean"}).notNull(),generation:text("generation").notNull().default(""),generatedAt:text("generated_at").notNull().default(""),receivedAt:text("received_at").notNull().default(""),windowStart:text("window_start").notNull(),windowEnd:text("window_end").notNull(),complete:integer("complete",{mode:"boolean"}).notNull().default(false),published:integer("published",{mode:"boolean"}).notNull().default(false),contract:text("contract").notNull().default(""),scopeDefinition:text("scope_definition").notNull().default(""),sequence:integer("sequence").notNull().default(0),reviewCount:integer("review_count").notNull().default(0)});
export const ingestRecords=sqliteTable("ingest_records",{owner:text("owner").notNull(),streamId:text("stream_id").notNull(),recordId:text("record_id").notNull(),updatedAt:text("updated_at").notNull(),deleted:integer("deleted",{mode:"boolean"}).notNull(),payload:text("payload"),state:text("state").notNull().default("active"),reason:text("reason").notNull().default(""),evidenceBatch:text("evidence_batch").notNull().default("")},t=>[primaryKey({columns:[t.streamId,t.recordId]})]);
export const ingestReceipts=sqliteTable("ingest_receipts",{streamId:text("stream_id").notNull(),batchId:text("batch_id").notNull(),digest:text("digest").notNull(),receivedAt:text("received_at").notNull(),recordCount:integer("record_count").notNull(),deletedCount:integer("deleted_count").notNull(),result:text("result").notNull().default("{}"),envelope:text("envelope")},t=>[primaryKey({columns:[t.streamId,t.batchId]})]);
export const ingestDeferred=sqliteTable("ingest_deferred",{owner:text("owner").notNull(),streamId:text("stream_id").notNull(),batchId:text("batch_id").notNull(),recordId:text("record_id").notNull(),kind:text("kind").notNull(),reason:text("reason").notNull(),payload:text("payload").notNull(),createdAt:text("created_at").notNull()},t=>[primaryKey({columns:[t.streamId,t.batchId,t.recordId]})]);
