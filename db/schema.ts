import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
export const commitments = sqliteTable("commitments", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), title: text("title").notNull(),
 project: text("project").notNull(), lane: text("lane").notNull(), stakeholder: text("stakeholder").notNull(),
 deadline: text("deadline").notNull(), minutes: integer("minutes").notNull(), status: text("status").notNull(),
 output: text("output").notNull(), sourceUrl: text("source_url").notNull(), createdAt: text("created_at").notNull()
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
 owner: text("owner").primaryKey(), startHour: integer("start_hour").notNull(), endHour: integer("end_hour").notNull()
});
export const accountConnections = sqliteTable("account_connections", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),provider:text("provider",{enum:["google","microsoft","notion","apple"]}).notNull(),
 account:text("account").notNull(),lane:text("lane").notNull(),calendar:integer("calendar",{mode:"boolean"}).notNull(),mail:integer("mail",{mode:"boolean"}).notNull(),createdAt:text("created_at").notNull()
},t=>[uniqueIndex("account_connections_owner_provider_account").on(t.owner,t.provider,t.account)]);
