import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
export const commitments = sqliteTable("commitments", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), title: text("title").notNull(),
 project: text("project").notNull(), lane: text("lane").notNull(), stakeholder: text("stakeholder").notNull(),
 deadline: text("deadline").notNull(), minutes: integer("minutes").notNull(), status: text("status").notNull(),
 output: text("output").notNull(), sourceUrl: text("source_url").notNull(), sourceKey: text("source_key").notNull().default(""), parentId: text("parent_id"), createdAt: text("created_at").notNull()
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
 owner: text("owner").primaryKey(), startHour: integer("start_hour").notNull(), endHour: integer("end_hour").notNull(), theme:text("theme",{enum:["dark","light","system"]}).notNull().default("dark")
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
